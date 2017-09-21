const clashApi = require('clash-of-clans-api');
const logger = require('./logger.js');

try {
  var auth = require("./auth.json");
} catch (e) {
  logger.error("Please create an auth.json file like auth.json.example " + e);
  process.exit();
}

let clashApiClient = clashApi({
  token: auth.clashApiToken
});

// Returns a future for the current war for the specific clan.
exports.getCurrentWar = function(clanTag) {
  if (!clanTag.startsWith('#')) {
    clanTag = `#${clanTag}`;
  }
  logger.debug(`Fetching current war for ${clanTag}`);

  return clashApiClient.clanCurrentWarByTag(clanTag).
      then(currentWar => {
        logger.debug(`Current war for ${clanTag}: ${JSON.stringify(currentWar)}`);
        return currentWar;
      }).
      catch(err => {
        logger.debug(`Unable to fetch current war data from clash API for ${clanTag}`);
        throw err;
      });
};