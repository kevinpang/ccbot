var logger = require('./logger.js');
var request = require('request');

const CC_API = "http://clashcaller.com/api.php";
const CC_WAR_URL = "http://www.clashcaller.com/war/";

/**
 * Returns a promise containing the war status for the specified war ID.
 */
exports.getWarStatus = function (ccId) {
  return new Promise((resolve, reject) => {
    request.post(CC_API, {
      form: {
        'REQUEST': 'GET_UPDATE',
        'warcode': ccId
      }
    }, function (error, response, body) {
      if (error) {
        logger.warn(`Error retrieving data from Clash Caller for ${ccId}: ${error}`);
        reject(`Error retrieving data from Clash Caller: ${error}`);
        return;
      } else {
        // CC API returns <success> when it can't find the war ID.
        if (body == '<success>') {
          reject(`Cannot find war: ${ccId}. Please make sure war still exists on ` +
              `Clash Caller: ${getCcUrl_(ccId)}`);
          return;
        }

        try {
          logger.debug(`GET_UPDATE response for war ${ccId}: ${body}`);
          resolve(JSON.parse(body));
        } catch (e) {
          logger.warn(`Error in getWarStatus_ callback: ${e}. War status: ${body}`);
          reject(`Error getting war status for war ID ${ccId}: e`);
        }
      }
    });
  });
};

/**
 * Returns a promise for deleting the specified call
 * posx - 
 */
exports.deleteCall = function(ccId, playerName, baseNumber) {
  return exports.getWarStatus(ccId)
      .then(warStatus => {
        let posx = findCallPosX_(warStatus, playerName, baseNumber);
        request.post(CC_API, {
          form: {
            "REQUEST": "DELETE_CALL",
            "warcode": ccId,
            "posx": posx,
            "posy": baseNumber - 1
          }
        }, function(error, response, body) {
          if (error) {
            throw `Unable to delete call: ${error}`;
          }
        })
      });
};

/**
 * Returns the Clash Caller url for the specified war ID.
 */
let getCcUrl_ = function(ccId) {
  return "<" + CC_WAR_URL + ccId + ">";
};

/**
 * Returns the X position of a user's call or null if call is not found.
 */
let findCallPosX_ = function(warStatus, playerName, baseNumber) {
  for (let i = 0; i < warStatus.calls.length; i++) {
    let call = warStatus.calls[i];
    if (call.posy == baseNumber - 1
        && call.playername.toLowerCase() == playerName.toLowerCase()) {
          logger.warn('findcallposx 2');
      return call.posx;
    }
  }

  throw `Unable to find call on base ${baseNumber} for ${playerName}`;
};