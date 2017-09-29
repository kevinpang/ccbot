const clashCallerService = require('./services/clash_caller_service.js');
const clashService = require('./services/clash_service.js');
const configs = require('./configs.js');
const logger = require('./logger.js');
const warDataDao = require('./dao/war_data_dao.js');

const POLLING_FREQUENCY_MILLIS = 60000; // 1 minute

/**
 * Starts polling the Clash of Clans API for data.
 */
exports.startPolling = function() {
  if (!global.clashPollingIntervalId) {
    global.clashPollingIntervalId = setInterval(exports.poll, POLLING_FREQUENCY_MILLIS);
  } else {
    logger.warn('Skipping startPolling call because we\'re already polling');
  }
};

/**
 * Look up the current war for every clan that has a clan tag specified and
 * perform automatic actions from the data.
 */
exports.poll = function() {
  logger.info('War data poll tick');

  let cfgs = configs.get();
  for (let channelId in cfgs) {
    if (!cfgs.hasOwnProperty(channelId)) {
      continue;
    }

    let config = cfgs[channelId];
    let clanTag = config.clantag;
    let ccId = config.cc_id;
    let disableAutolog = config.disableAutolog || config.disableAutolog == undefined;
    let disableAutostart = config.disableAutostart || config.disableAutostart == undefined;
    if (!clanTag || !ccId) {
      continue;
    }

    clashService.getCurrentWar(clanTag)
        .then((warData) => {
          let oldWarData = warDataDao.getWarData(clanTag, warData.preparationStartTime);
          warDataDao.saveWarData(clanTag, warData);

          if (oldWarData) {
            let channel = global.bot.channels.get(channelId);
            if (oldWarData.preparationStartTime != warData.preparationStartTime && warData.state == 'preparation') {
              let message = `War search completed, preparation day against ${warData.opponent.name} has begun!\n`;

              if (disableAutostart) {
                message += `Skipping automatic creation of Clash Caller war because it is currently disabled. Type '/setautostart on' to enable.`;
                channel.sendMessage(message);
              } else {
                clashCallerService.startWar(config, warData.teamSize, warData.opponent.name)
                    .then((result) => {
                      config.cc_id = result.ccId;
                      configs.saveChannelConfig(channel.id, config);
                      
                      if (result.prevCcId) {
                        message += `Previous war id: ${result.prevCcId}\n`;
                      }
                      
                      message += `New war automatically started on Clash Caller: ${clashCallerService.getCcUrl(result.ccId)}.\nWar summary:\n`;
                      message += clashService.getWarSummaryMessage(warData);

                      channel.sendMessage(message);

                      // Update start time on war.
                      try {
                        let startTime = warData.startTime;
                        let year = startTime.substring(0, 4);
                        let month = startTime.substring(4, 6);
                        let day = startTime.substring(6, 8);
                        let hour = startTime.substring(9, 11);
                        let minute = startTime.substring(11, 13);
                        let second = startTime.substring(13, 15);
                        let startDate = new Date(`${year}-${month}-${day} ${hour}:${minute}:${second} +0000`);
                        let now = new Date();
                        let timeDiff = startDate - now;
                        let minutesDiff = timeDiff / 1000 / 60;

                        clashCallerService.updateWarTime(result.ccId, true, minutesDiff)
                            .then(() => {logger.info(`Set start time for ${result.ccId} (${warData.startTime}) to ${minutesDiff} from now`)})
                            .catch((error) => {logger.warn(`Unable to set set start time for ${result.ccId}: ${error}`)});
                      } catch (e) {
                        logger.warn(`Unable to compute start time: ` + warData.startTime);
                      }
                    })
                    .catch((error) => {`Error automatically starting war on Clash Caller: ${error}`});
              }
            } else if (oldWarData.state == 'preparation' && warData.state == 'inWar') {
              let message = `War against ${warData.opponent.name} has started!\nWar summary:\n`
              message += clashService.getWarSummaryMessage(warData);
              log.info(`Trying to send war start message: ` + message);
              channel.sendMessage(message);
            } else if (oldWarData.state == 'inWar' && warData.state == 'warEnded') {
              let message = `War against ${warData.opponent.name} has ended!\nWar summary:\n`;
              message += clashService.getWarSummaryMessage(warData);
              log.info(`Trying to send war end message: ` + message);
              channel.sendMessage(message);
            } else if (oldWarData.state == 'inWar' && warData.state == 'inWar' &&
                oldWarData.clan.attacks < warData.clan.attacks) {
              if (!disableAutolog) {
                autoLogAttack_(warData, oldWarData, ccId, channel, config);  
              }
            }
          }      
        })
        .catch((error) => {
          logger.debug(`Polling war data for ${clanTag} failed. Expected 404 error if clan doesn\'t have their ` +
              `war log set to public or has a misconfigured clan tag. Error: ${error}`);
        });
  }
};

let autoLogAttack_ = function(warData, oldWarData, ccId, channel, config) {
  // New war attacks detected. Attempt to auto-log them in Clash Caller.
  clashCallerService.getWarStatus(ccId)
      .then((warStatus) => {
        let newAttacks = clashService.getNewAttacks(warData, oldWarData);
        
        for (let i = 0; i < newAttacks.length; i++) {
          let newAttack = newAttacks[i];
          logger.info(`Found new attack ${JSON.stringify(newAttack)}`);
          
          let attacker = clashService.getMember(warData, newAttack.attackerTag);
          let defender = clashService.getMember(warData, newAttack.defenderTag);

          if (!attacker) {
            logger.warning(`Unable to find attacker ${JSON.stringify(attacker)} in ${JSON.stringify(warData)}`);
          } else if (!defender) {
            logger.warning(`Unable to find defender ${JSON.stringify(defender)} in ${JSON.stringify(warData)}`);
          } else {
            let message = `${attacker.name} attacked #${defender.mapPosition} for ${newAttack.stars} star(s).\n`;
            if (newAttack.stars == 3 && config.congratsMessages && config.congratsMessages.length > 0) {
              message += `${config.congratsMessages[Math.floor(Math.random() * config.congratsMessages.length)]}\n`;
            }

            try {
              logger.info(`Searching for call by ${attacker.name} on ${defender.mapPosition} in ${ccId}`);
              let ccCall = clashCallerService.findCall(warStatus, attacker.name, defender.mapPosition);
              logger.info(`Found call by ${attacker.name} on ${defender.mapPosition} in ${ccId}`);

              // If base doesn't have stars already recorded on it, go ahead and record the attack.
              if (ccCall.stars == '1') {
                logger.info(`Attempting to autolog attack by ${attacker.name} on ${defender.mapPosition} in ${ccId}`);
                clashCallerService.logAttack(ccId, attacker.name, defender.mapPosition, newAttack.stars)
                    .then(() => {
                      logger.info(`Successfully autologged attack to Clash Caller`);
                      message += `Attack automatically logged to Clash Caller\n`;
                      logger.info(`Trying to send autologged message: ` + message);
                      channel.sendMessage(message);
                    })
                    .catch((error) => {
                      logger.warn(`Error autologging attack to Clash Caller: ${error}`);
                      message += `Error automatically logging this attack to Clash Caller: ${error}`;
                      channel.sendMessage(message);
                    });
              } else {
                logger.info(`Skipping auto-logging of ${attacker.name} on ${defender.mapPosition} since attack has already been logged.`);
              }
            } catch (e) {
              logger.info(`Error autologging attack to Clash Caller because call not found on Clash Caller.`);
              message += `Attempted to automatically log to Clash Caller but could not find matching call. ` +
                  `Please make sure the call exists and the name in Clash Caller matches the player's in-game name exactly.`;
              channel.sendMessage(message);
            }
          }
        }
      })
      .catch((error) => {logger.warn(`Unable to fetch clash caller war data for auto-logging: ${error}`)});
};
