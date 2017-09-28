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

    let clanTag = cfgs[channelId].clantag;
    let ccId = cfgs[channelId].cc_id;
    if (!clanTag || !ccId) {
      continue;
    }

    clashService.getCurrentWar(clanTag)
        .then((warData) => {
          let oldWarData = warDataDao.getWarData(clanTag, warData.preparationStartTime);
          warDataDao.saveWarData(clanTag, warData);

          if (oldWarData) {
            let channel = global.bot.channels.get(channelId);
            if (oldWarData.preparationStartTime != warData.preparationStartTime) {
              // New war detected.
              // TODO: implement auto-start.
            } else if (oldWarData.state == 'preparation' && warData.state == 'inWar') {
              // War start detected.
              // TODO: send war start message.
            } else if (oldWarData.state == 'inWar' && warData.state == 'warEnded') {
              // War end detected.
              // TODO: send war end summary message.
            } else if (oldWarData.state == 'inWar' && warData.state == 'inWar' &&
                oldWarData.clan.attacks < warData.clan.attacks) {
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
                        let ccCallPosX = clashCallerService.findCallPosX(ccWarStatus, attacker.name, defender.mapPosition);
                        if (ccCallPosX) {
                          // TODO: automatically log attack to clash caller if it hasn't already been logged
                          logger.info(`${attackerName} attacked #${enemyBaseNumber} for ${newAttack.stars} star(s) + call found!`);
                        } else {
                          // TODO: send a message to the channel indicating an attack happened but no matching call found
                          logger.info(`${attackerName} attacked #${enemyBaseNumber} for ${newAttack.stars} star(s) + no call found`);
                        }
                      }
                    }
                  })
                  .catch((error) => {logger.warn(`Unable to fetch clash caller war data for auto-logging: ${error}`)});
            }
          }      
        })
        .catch((error) => {
          logger.debug(`Polling war data for ${clanTag} failed. Expected 404 error if clan doesn\'t have their ` +
              `war log set to public or has a misconfigured clan tag. Error: ${error}`);
        });
  }
};
