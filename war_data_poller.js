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
    if (!clanTag) {
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
              // New war attack(s) detected.
              // TODO: implement auto-logging.
            }
          }      
        })
        .catch((error) => {
          logger.debug(`Polling war data for ${clanTag} failed. Expected 404 error if clan doesn\'t have their ` +
              `war log set to public or has a misconfigured clan tag. Error: ${error}`);
        });
  }
};
