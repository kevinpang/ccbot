let decode = require('decode-html');
let logger = require('./logger.js');
let request = require('request');

const CC_API = 'http://clashcaller.com/api.php';
const CC_WAR_URL = 'http://www.clashcaller.com/war/';

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
 * Calls a base for a player.
 */
exports.call = function(ccId, playerName, baseNumber) {
  return exports.getWarStatus(ccId)
      .then((warStatus) => {
        let size = parseInt(warStatus.general.size);
        if (baseNumber > size) {
          throw `Invalid base number. War size is ${size}.`;
        }
        
        let warTimeRemaining = exports.calculateWarTimeRemaining(warStatus);
        if (warTimeRemaining < 0) {
          throw `The war is over (${getCcUrl_(ccId)})`;
        }
        
        return new Promise((resolve, reject) => {
          request.post(CC_API, {
            form: {
              'REQUEST': 'APPEND_CALL',
              'warcode': ccId,
              'posy': baseNumber - 1,
              'value': playerName
            }
          }, function(error, response, body) {
            if (error) {
              logger.warn(`Unable to call base ${baseNumber} for ${playerName} in war ${ccId}: ${error}`);
              reject(`Unable to call base: ${error}`);
              return;
            }
            resolve();
          });
        });
      });
};

/**
 * Logs an attack.
 */
exports.logAttack = function(ccId, playerName, baseNumber, stars) {
  if (stars < 0 || stars > 3) {
    return Promise.reject('Number of stars must be between 0-3');
  }

  return exports.getWarStatus(ccId)
      .then((warStatus) => {
        let posx = findCallPosX_(warStatus, playerName, baseNumber);
        if (posx) {
          return new Promise((resolve, reject) => {
            request.post(CC_API, {
              form: {
                'REQUEST': 'UPDATE_STARS',
                'warcode': ccId,
                'posx': posx,
                'posy': baseNumber - 1,
                'value': stars + 2
              }
            }, function(error, response, body) {
              if (error) {
                logger.warn(`Unable to record stars: ${error}`);
                reject(`Unable to record stars: ${error}`);
                return;
              }
              resolve();
            });
          });
        }
      });
};

/**
 * Returns a promise for deleting the specified call.
 */
exports.deleteCall = function(ccId, playerName, baseNumber) {
  return exports.getWarStatus(ccId)
      .then(warStatus => {
        let posx = findCallPosX_(warStatus, playerName, baseNumber);
        request.post(CC_API, {
          form: {
            'REQUEST': 'DELETE_CALL',
            'warcode': ccId,
            'posx': posx,
            'posy': baseNumber - 1
          }
        }, function(error, response, body) {
          if (error) {
            throw `Unable to delete call: ${error}`;
          }
        })
      });
};

/**
 * Adds a note to the specified base.
 */
exports.addNote = function(ccId, baseNumber, note) {
  return new Promise((resolve, reject) => {
    request.post(CC_API, {
      form: {
        'REQUEST': 'UPDATE_TARGET_NOTE',
        'warcode': ccId,
        'posy': baseNumber - 1,
        'value': note
      }
    }, function(error, response, body) {
      if (error) {
        logger.warn(`Error updating note: ${error}`);
        reject(`Error updating note: ${error}`);
        return;
      }
      resolve();
    });
  });
};

/**
 * Returns the Clash Caller url for the specified war ID.
 */
let getCcUrl_ = function(ccId) {
  return `<${CC_WAR_URL + ccId}>`;
};

/**
 * Returns the X position of a user's call or null if call is not found.
 */
let findCallPosX_ = function(warStatus, playerName, baseNumber) {
  for (let i = 0; i < warStatus.calls.length; i++) {
    let call = warStatus.calls[i];
    if (call.posy == baseNumber - 1
        && call.playername.toLowerCase() == playerName.toLowerCase()) {
      return call.posx;
    }
  }

  throw `Unable to find call on base ${baseNumber} for ${playerName}`;
};

/**
 * Returns the time remaining (in milliseconds) for the war, or null if
 * timers are not enabled for the war. Return value can be negative if
 * the war is over.
 */
exports.calculateWarTimeRemaining = function(warStatus) {
  try {
    let checkTime = new Date(warStatus.general.checktime);
    let timerLength = warStatus.general.timerlength;
    let endTime = new Date(warStatus.general.starttime).addHours(24);
    
    if (timerLength == '0') {
      // Timers not enabled for this war
      return null;
    } else {
      return endTime - checkTime;
    }
  } catch (e) {
    logger.warn(`Unable to calculate war time remaining: ${JSON.stringify(warStatus)}`);
    return null;
  }
};

/**
 * Returns the time remaining (in milliseconds) for a specific call, or null if
 * timers are not enabled for the war, war has not started yet, or war is over.
 * Return value can be negative if call has expired.
 */
let calculateCallTimeRemaining_ = function(call, warStatus) {
  try {
    let callTime = new Date(call.calltime);
    let checkTime = new Date(warStatus.general.checktime);
    let startTime = new Date(warStatus.general.starttime);
    let timerLength = warStatus.general.timerlength;
    let endTime = new Date(warStatus.general.starttime).addHours(24);
    
    if (callTime < startTime) {
      callTime = startTime;
    }
    
    if (timerLength == '0') {
      // Timers not enabled for this war
      return null;
    } else if (checkTime < startTime) {
      // War has not started
      return null;
    } else if (checkTime > endTime) {
      // War is over
      return null;
    } else if (timerLength == '-2' || timerLength == '-4') {
      // Flex timer
      let divisor = parseInt(timerLength.substring(1));
      let callEndTime = callTime.addMilliseconds((endTime - callTime) / divisor);
      return callEndTime - checkTime;
    } else {
      // Fixed timer
      let callEndTime = callTime.addHours(parseInt(timerLength));
      return callEndTime - checkTime;
    }
  } catch (e) {
    logger.warn(`Error calculating call time remaining. Call: ${call}. War status: ${JSON.stringify(warStatus)}`);
    throw e;
  }
};

/**
 * Returns the note on the specified base number, or null if no note exists.
 */
exports.getNote = function(baseNumber, warStatus) {
  for (let i = 0; i < warStatus.targets.length; i++) {
    let target = warStatus.targets[i];
    if (parseInt(target.position) == baseNumber - 1) {
      if (target.note != null && target.note != '') {
        // Hack since cc escapes apostrophes as &#039; instead of &#39
        return decode(target.note).replace('&#039;', '\'');
      }
    }
  }
  return null;
};

/**
 * Returns active calls on the specified base for the given war.
 */
exports.getActiveCallsOnBase = function(baseNumber, warStatus) {
  let activeCalls = exports.getActiveCalls(warStatus);
  let activeCallsOnBase = [];
  if (activeCalls.length > 0) {
    for (let i = 0; i < activeCalls.length; i++) {
      let activeCall = activeCalls[i];
      if (activeCall.baseNumber == baseNumber) {
        activeCallsOnBase.push(activeCall);
      }
    }
  }
  return activeCallsOnBase;
};

/**
 * Returns active calls for the given war.
 */
exports.getActiveCalls = function(warStatus) {
  let activeCalls = [];
  for (let i = 0; i < warStatus.calls.length; i++) {
    let call = warStatus.calls[i];
    
    if (call.stars == '1') {
      // Has an un-starred call.
      let timeRemaining = calculateCallTimeRemaining_(call, warStatus);
      
      if (timeRemaining == null || timeRemaining > 0) {
        // Has an active call.
        activeCalls.push({
          'baseNumber': parseInt(call.posy) + 1,
          'playername': call.playername,
          'timeRemaining': timeRemaining
        });  
      }
    }
  }

  activeCalls.sort(function(a, b) {
    if (a.baseNumber == b.baseNumber) {
      return a.timeRemaining - b.timeRemaining;
    }
    
    return a.baseNumber - b.baseNumber;
  }); 
  
  return activeCalls;
};

/**
 * Formats time remaining (in ms) in XXhYYm.
 */
let formatTimeRemaining_ = function(timeRemaining) {
  if (timeRemaining == null) {
    return '';
  }
  
  timeRemaining /= 60000;
  let minutes = Math.floor(timeRemaining % 60);
  timeRemaining /= 60
  if (timeRemaining > 24) {
    logger.warn(`Received time remaining >24h ${timeRemaining}`);
    return '??h??m';
  }
  let hours = Math.floor(timeRemaining);
  return (hours > 0 ? hours + 'h' : '') + minutes + 'm';
};