let decode = require('decode-html');
let logger = require('../logger.js');
let request = require('request');

const CC_API = 'http://clashcaller.com/api.php';
const CC_WAR_URL = 'http://www.clashcaller.com/war/';

/**
 * Starts a new war on Clash Caller and returns a promise containing the new war ID
 * and previous war ID (if one existed).
 */
exports.startWar = function(config, warSize, enemyClanName) {
  let validWarSizes = [10, 15, 20, 25, 30, 35, 40, 45, 50];
  if (!validWarSizes.includes(warSize)) {
    return Promise.reject(
        `War size must be set to one of the following values: ${validWarSizes.join(', ')}`);
  }

  return new Promise((resolve, reject) => {
    request.post(CC_API, {
      form: {
        'REQUEST': 'CREATE_WAR',
        'cname': config.clanname ? config.clanname : 'Unknown',
        'ename': enemyClanName,
        'size': warSize,
        'timer': convertCallTimer_(config.call_timer),
        'searchable': config.disableArchive ? 0 : 1,
        'clanid': config.clantag ? config.clantag : ''
      }
    }, function(error, response, body) {
      if (error) {
        logger.warn(`Error creating war: ${error}`);
        reject(`Error creating war: ${error}`);
      } else {
        resolve({
          'ccId': body.substring(4), // Remove the 'war/' from the start.
          'prevCcId': config.cc_id
        });
      }
    });
  });
};

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
      } else {
        // CC API returns <success> when it can't find the war ID.
        if (body == '<success>') {
          reject(`Cannot find war: ${ccId}. Please make sure war still exists on ` +
              `Clash Caller: ${exports.getCcUrl(ccId)}`);
        } else {
          try {
            logger.debug(`GET_UPDATE response for war ${ccId}: ${body}`);
            resolve(JSON.parse(body));
          } catch (e) {
            logger.warn(`Error parsing war status ${body}: ${e}`);
            reject(`Error getting war status for war ID ${ccId}: e`);
          }
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
          throw `The war is over (${exports.getCcUrl(ccId)})`;
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
            } else {
              resolve();
            }
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
              } else {
                resolve();
              }
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
      } else {
        resolve();
      }
    });
  });
};

/**
 * Returns stats from Clash Caller for the specified player in the specified clan.
 * 
 * Requires that the clan tag be set on previous wars and that archiving be enabled.
 */
exports.getPlayerStats = function(playerName, clanTag) {
  return new Promise((resolve, reject) => {
    request.post(CC_API, {
      form: {
        'REQUEST': 'SEARCH_FOR_PLAYER',
        'clan': clanTag,
        'name': playerName
      }
    }, function(error, response, body) {
      if (error) {
        logger.warn(`Unable to find player ${playerName} in clan ${clanTag}: ${error}`);
        reject(`Unable to find player ${playerName} in clan ${clanTag}: ${error}`);
      } else {
        try {
          body = JSON.parse(body);
          if (!body.attacks || body.attacks.length == 0) {
            reject(`No attacks found for player ${playerName} in clan ${clanTag}.\n\n` +
                'Please verify that:\n' +
                '1. Archiving is enabled (use \'/setarchive on\' to enable it for future wars created from ccbot\n' +
                '2. Your name on this channel matches the name youve been using in previous Clash Caller wars')
          } else {
            let stats = {
              'wars': {},
              'numWars': 0,
              'stars': 0,
              'attacks': 0,
              'threeStars': 0,
              'twoStars': 0,
              'oneStars': 0,
              'zeroStars': 0
            };
            
            for (let i = 0; i < body.attacks.length; i++) {
              let attack = body.attacks[i];
              stats.attacks++;
              if (!stats.wars[attack.ID]) {
                stats.wars[attack.ID] = true;
                stats.numWars++;
              }
              let numStars = parseInt(attack.STAR);
              if (numStars > 1) {
                numStars -= 2;
                
                stats.stars += numStars;
                if (numStars == 0) {
                  stats.zeroStars++;
                } else if (numStars == 1) {
                  stats.oneStars++;
                } else if (numStars == 2) {
                  stats.twoStars++;
                } else if (numStars == 3) {
                  stats.threeStars++;
                }
              }
            }
            
            resolve(stats);
          }
        } catch(e) {
          logger.warn(`Error retrieving stats from Clash Caller ${body}: ${e}`);
          reject(`Error retrieving stats from Clash Caller: ${e}`);
        }
      }
    });
  });
};

/**
 * Updates the war timer for the specified war.
 * 
 * start - boolean indicating whether to update start or end timer
 * minutes - total minutes until start or end
 */
exports.updateWarTime = function(ccId, start, minutes) {
  logger.warn('updateWarTime 1');
  return new Promise((resolve, reject) => {
    logger.warn('updateWarTime 2');
    request.post(CC_API, {
      form: {
        'REQUEST': 'UPDATE_WAR_TIME',
        'warcode': ccId,
        'start': start ? 's' : 'e',
        'minutes': minutes
      }
    }, function(error, response, body) {
      logger.warn('updateWarTime 3');
      if (error) {
        logger.warn('updateWarTime 4');
        logger.warn(`Unable to update war time ${error}`);
        reject(`Unable to update war time ${error}`);
      } else {
        logger.warn('updateWarTime 5');
        resolve();
      }
    });
  });
};

/**
 * Returns the Clash Caller url for the specified war ID.
 */
exports.getCcUrl = function(ccId) {
  return `<${CC_WAR_URL + ccId}>`;
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
exports.calculateCallTimeRemaining = function(call, warStatus) {
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
      let timeRemaining = exports.calculateCallTimeRemaining(call, warStatus);
      
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
 * Returns all calls (expired/active/attacks) on the specified
 * base for the given war.
 */
exports.getCallsOnBase = function(baseNumber, warStatus) {
  let callsOnBase = [];
  for (let i = 0; i < warStatus.calls.length; i++) {
    let call = warStatus.calls[i];
    if (baseNumber != parseInt(call.posy) + 1) {
      continue;
    }
    
    let stars = parseInt(call.stars);
    let callOnBase = {
      'playername': call.playername,
      'posx': call.posx,
    };

    if (stars == 1) {
      // Un-starred call.
      callOnBase.timeRemaining = exports.calculateCallTimeRemaining(call, warStatus);
      callOnBase.attacked = false;
    } else {
      // Attacked base.
      callOnBase.stars = stars - 2;
      callOnBase.attacked = true;
    }
    
    callsOnBase.push(callOnBase);
  }

  callsOnBase.sort(function(a, b) {
    return a.posx - b.posx;
  });
  
  return callsOnBase;
};

/**
 * Returns the current star status of every enemy base.
 */
exports.getCurrentStars = function(warStatus) {
  let currentStars = [];
  for (let i = 0; i < parseInt(warStatus.general.size); i++) {
    currentStars[i] = null;
  }
  
  for (let i = 0; i < warStatus.calls.length; i++) {
    let call = warStatus.calls[i];
    let stars = parseInt(call.stars);
    if (stars > 1) {
      // Base has been attacked.
      stars = stars - 2;
      if (currentStars[call.posy] == null ||
          currentStars[call.posy] < stars) {
        currentStars[call.posy] = stars;
      }
    }
  }
  
  return currentStars;
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
 * Converts the call_timer stored in the config to a format the Clash Caller
 * API is expecting when starting a war.
 */
let convertCallTimer_ = function(callTimer) {
  if (!callTimer) {
    return 0;
  }
  
  if (callTimer == '1/2') {
    return -2;
  } else if (callTimer == '1/4') {
    return -4;
  } else {
    return parseInt(callTimer);
  }
};

/**
 * Monkey-patched method for adding hours to a Date object.
 */
Date.prototype.addHours = function(h) {
  this.addMilliseconds(h*60*60*1000);
  return this;   
};

/**
 * Monkey-patched method for adding milliseconds to a Date object.
 */
Date.prototype.addMilliseconds = function(ms) {
  this.setTime(this.getTime() + (ms));
  return this;
};
