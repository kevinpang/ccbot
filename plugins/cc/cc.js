var fs = require('fs');
var request = require('request');

var CC_API = "http://clashcaller.com/api.php";
var CC_WAR_URL = "http://www.clashcaller.com/war/";

try {
  var Configs = require("../../configs.json");
} catch (e) {
  console.log("Please create an configs.json file like configs.json.example " + e);
  process.exit();
}

exports.commands = ["attacked", "cc", "call", "calls", "config", "delete", "open",
    "setarchive", "setcalltimer", "setcc", "setclanname", "setclantag", "start",
    "wartimer"];

exports.cc = {
  description: "Get Clash Caller link to current war",
  process: function(bot, msg) {
    var ccId = getCcId_(msg);
    if (ccId) {
      msg.channel.sendMessage(getCcUrl_(ccId));
    }
  }
};

exports.start = {
  usage: "<war size> <enemy clan name>",
  description: "Starts a war on Clash Caller",
  process: function(bot, msg, suffix) {
    var regex = /(\d+)\s(.*)$/;
    if (!regex.test(suffix)) {
      msg.channel.sendMessage("Invalid format, please try again");
      return;
    }

    var arr = regex.exec(suffix);
    var warSize = parseInt(arr[1]);
    var enemyClanName = arr[2];
    
    var validWarSizes = [10, 15, 20, 25, 30, 35, 40, 45, 50];
    if (!validWarSizes.includes(warSize)) {
      msg.channel
        .sendMessage("War size must be set to one of the following values: " +
            validWarSizes.join(", "));
      return;
    }

    var config = getConfig_(msg);
    request.post(CC_API, {
      form: {
        "REQUEST": "CREATE_WAR",
        "cname": config.clanname ? config.clanname : "Unknown",
        "ename": enemyClanName,
        "size": warSize,
        "timer": convertCallTimer_(config.call_timer),
        "searchable": config.disableArchive ? 0 : 1,
        "clanid": config.clanid ? config.clanid : ""
      }
    }, function(error, response, body) {
      if (error) {
        msg.channel.sendMessage("Error creating war: " + error);
      } else {
        // Remove the "war/" from the start.
        var ccId = body.substring(4);
        config.cc_id = ccId;
        saveConfig_(msg.channel.id, config);
        msg.channel.sendMessage(getCcUrl_(ccId));  
      }
    });
  }
};

exports.call = {
  usage: "<enemy base #>",
  description: "Call a base",
  process: function(bot, msg, suffix) {
    var ccId = getCcId_(msg);
    if (!ccId) {
      return;
    }
    
    var regex = /^\d+$/;
    if (!regex.test(suffix)) {
      msg.channel.sendMessage("Invalid format for /call");
      return;
    }

    var enemyBaseNumber = parseInt(suffix);
    request.post(CC_API, {
      form: {
        "REQUEST": "APPEND_CALL",
        "warcode": ccId,
        "posy": enemyBaseNumber - 1,
        "value": msg.author.username
      }
    }, function(error, response, body) {
      if (error) {
        msg.channel.sendMessage("Unable to call base " + error);
      } else {
        msg.channel.sendMessage("Called base " + enemyBaseNumber + " for "
            + msg.author.username);
      }
    });      
  }
};

exports.attacked = {
  usage: "<enemy base #> for <# of stars>",
  description: "Log an attack",
  process: function(bot, msg, suffix) {
    var ccId = getCcId_(msg);
    if (!ccId) {
      return;
    }
  
    var args = suffix.split(' ');
    var enemyBaseNumber = parseInt(args[0]);
    var stars = parseInt(args[2]);
    
    if (stars < 0 || stars > 3) {
      msg.channel.sendMessage("Number of stars must be between 0-3");
      return;
    }

    getUpdate_(ccId, function(warStatus) {
      var posx = findCallPosX_(warStatus, msg, enemyBaseNumber);
      if (posx) {
        request.post(CC_API, {
          form: {
            "REQUEST": "UPDATE_STARS",
            "warcode": ccId,
            "posx": posx,
            "posy": enemyBaseNumber - 1,
            "value": stars + 2
          }
        }, function(error, response, body) {
          if (error) {
            msg.channel.sendMessage("Unable to record stars " + error);
          } else {
            msg.channel.sendMessage("Recorded " + stars + " star(s) for "
                + msg.author.username + " on base " + enemyBaseNumber);
          }
        });
      }
    });
  }
};

exports.open = {
  description: "Returns all open bases",
  process: function(bot, msg, suffix) {
    var ccId = getCcId_(msg);
    if (!ccId) {
      return;
    }
  
    getUpdate_(ccId, function(warStatus) {
      var warTimeRemainingInfo = getWarTimeRemainingInfo_(warStatus);
      if (warTimeRemainingInfo.warOver) {
        msg.channel.sendMessage(warTimeRemainingInfo.message);
        return;
      }
      
      var message = warTimeRemainingInfo.message + "\n";
      
      var activeCalls = getActiveCalls_(warStatus);
      var openBases = [];
      for (var i = 0; i < parseInt(warStatus.general.size); i++) {
        var called = false;
        for (var j = 0; j < activeCalls.length; j++) {
          var activeCall = activeCalls[j];
          if (activeCall.baseNumber - 1 == i) {
            called = true;
            break;
          } else if (activeCall.baseNumber - 1 > i) {
            // Active calls are sorted so if we get past the base we're
            // looking for then it's not called.
            break;
          }
        }
        if (!called) {
          console.log('open bases adding base #' + (i + 1));
          openBases.push(i + 1);
        }
      }
      
      if (openBases.length == 0) {
        message += "No open bases";
      } else {
        message += "Open bases:\n";
        message += openBases.join("\n");
      }
      
      msg.channel.sendMessage(message);
    });
  }
};

exports.setarchive = {
  usage: "<on|off>",
  description: "Sets archive on/off for new wars",
  process: function(bot, msg, suffix) {
    if (suffix != 'on' && suffix != 'off') {
      msg.channel.sendMessage("Please specify whether archiving should be on or off");
      return;
    }
    
    var config = getConfig_(msg);
    config.disableArchive = suffix == 'off';
    saveConfig_(msg.channel.id, config);
    msg.channel.sendMessage("Archiving set to " + suffix);
  }
};

exports.setcalltimer = {
  usage: "<# hours>",
  description: "Sets the call timer for new wars (use 1/2 or 1/4 for flex timers)",
  process: function(bot, msg, suffix) {
    var validTimers = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
        "12", "24", "1/2", "1/4"];
    if (!validTimers.includes(suffix)) {
      msg.channel
        .sendMessage("Call timer must be set to one of the following values: "
            + validTimers.join(", "));
      return;
    }
    
    var config = getConfig_(msg);
    config.call_timer = suffix;
    saveConfig_(msg.channel.id, config);
    msg.channel.sendMessage("Call timer set to " + suffix);
  }
};

exports.setcc = {
  usage: "<war ID>",
  description: "Sets the current war ID",
  process: function(bot, msg, suffix) {
    var config = getConfig_(msg);
    config.cc_id = suffix;
    saveConfig_(msg.channel.id, config);
    msg.channel.sendMessage("Current war ID set to " + suffix);  
  }
};

exports.setclanname = {
  usage: "<clan name>",
  description: "Sets the clan name for new wars",
  process: function(bot, msg, suffix) {
    var config = getConfig_(msg);
    config.clanname = suffix;
    saveConfig_(msg.channel.id, config);
    msg.channel.sendMessage("Clan name set to " + suffix);  
  }
};

exports.setclantag = {
  usage: "<clan tag>",
  description: "Sets the clan tag for new wars",
  process: function(bot, msg, suffix) {
    var config = getConfig_(msg);
    config.clantag = suffix;
    saveConfig_(msg.channel.id, config);
    msg.channel.sendMessage("Clan tag set to " + suffix);  
  }
};

exports.wartimer = {
  usage: "<start|end> <##h##m>",
  description: "Updates the current war's start or end time",
  process: function(bot, msg, suffix) {
    var ccId = getCcId_(msg);
    if (!ccId) {
      return;
    }
  
    var regex = /^(start|end)\s([0-9]|0[0-9]|1[0-9]|2[0-3])h([0-9]|[0-5][0-9])m$/;
    if (!regex.test(suffix)) {
      msg.channel.sendMessage("Invalid format for /wartimer");
      return;
    }
    
    var arr = regex.exec(suffix);
    var start = arr[1] == "start" ? "s" : "e";
    var hours = parseInt(arr[2]);
    var minutes = parseInt(arr[3]);
    var totalMinutes = hours * 60 + minutes;
    
    request.post(CC_API, {
      form: {
        "REQUEST": "UPDATE_WAR_TIME",
        "warcode": ccId,
        "start": start,
        "minutes": totalMinutes
      }
    }, function(error, response, body) {
      if (error) {
        msg.channel.sendMessage("Unable to update war " + arr[1] + " time " + error);
      } else {
        msg.channel.sendMessage("War " + arr[1] + " time updated to " + suffix);
      }
    });
  }
};

exports["delete"] = {
  usage: "<enemy base #>",
  description: "Deletes your call on the specified base",
  process: function(bot, msg, suffix) {
    var ccId = getCcId_(msg);
    if (!ccId) {
      return;
    }
  
    var enemyBaseNumber = parseInt(suffix);
    getUpdate_(ccId, function(warStatus) {
      var posx = findCallPosX_(warStatus, msg, enemyBaseNumber);
      if (posx) {
        request.post(CC_API, {
          form: {
            "REQUEST": "DELETE_CALL",
            "warcode": ccId,
            "posx": posx,
            "posy": enemyBaseNumber - 1
          }
        }, function(error, response, body) {
          if (error) {
            msg.channel.sendMessage("Unable to delete call " + error);
          } else {
            msg.channel.sendMessage("Deleted call on " + enemyBaseNumber
                + " for " + msg.author.username);
          }
        })
      }
    });
  }
};

exports.calls = {
  description: "Gets all active calls",
  process: function(bot, msg, suffix) {
    var ccId = getCcId_(msg);
    if (!ccId) {
      return;
    }
  
    getUpdate_(ccId, function(warStatus) {
      var warTimeRemainingInfo = getWarTimeRemainingInfo_(warStatus);
      if (warTimeRemainingInfo.warOver) {
        msg.channel.sendMessage(warTimeRemainingInfo.message);
        return;
      }
      
      var message = warTimeRemainingInfo.message + "\n";
      
      var activeCalls = getActiveCalls_(warStatus);
      if (activeCalls.length == 0) {
        message += "No active calls";
      } else {
        message += "Active calls:\n";
        for (var i = 0; i < activeCalls.length; i++) {
          var activeCall = activeCalls[i];
          message += "#" + activeCall.baseNumber + " " + activeCall.playername
              + " " + formatTimeRemaining_(activeCall.timeRemaining) + "\n";
        }
      }
      
      msg.channel.sendMessage(message);
    });
  }
};

exports.config = {
  description: "Returns bot configuration for current channel",
  process: function(bot, msg) {
    var config = getConfig_(msg);
    var message = "Current war ID: " + config.cc_id + "\n" +
        "Clan name: " + config.clanname + "\n" +
        "Call timer: " + config.call_timer + "\n" +
        "Clan tag: " + config.clantag + "\n" +
        "Archive: " + (config.disableArchive ? "off" : "on");
    msg.channel.sendMessage(message);
  }
};

/**
 * Returns the X position of a user's call or null if call is not found.
 */
var findCallPosX_ = function(warStatus, msg, enemyBaseNumber) {
  for (var i = 0; i < warStatus.calls.length; i++) {
    var call = warStatus.calls[i];
    if (call.posy == enemyBaseNumber - 1
        && call.playername == msg.author.username) {
      return call.posx;
      break;
    }
  }
  msg.channel.sendMessage("Unable to find call on base " + enemyBaseNumber
      + " for " + msg.author.username);
  return null;
};

/**
 * Gets the current war's war ID or null if not found.
 */
var getCcId_ = function(msg) {
  var config = getConfig_(msg);
  if (!config.cc_id) {
    msg.channel.sendMessage("No current war.");
    return null;
  }
  return config.cc_id;
};

/**
 * Returns the Clash Caller url for the specified war ID.
 */
var getCcUrl_ = function(ccId) {
  return CC_WAR_URL + ccId;
};

/**
 * Returns a config from config.js or a default config if not found.
 */
var getConfig_ = function(msg) {
  var config = Configs[msg.channel.id];
  if (config) {
    return config;
  } else {
    // Return a default config.
    return {
      "channel_name": msg.channel.name,
      "guild_id": msg.member ? msg.member.guild.id : "",
      "guild_name": msg.member ? msg.member.guild.name : ""
    };
  }
};

/**
 * Saves a config to Redis.
 */
var saveConfig_ = function(id, config) {
  Configs[id] = config;
  try {
    fs.writeFile("./configs.json", JSON.stringify(Configs, null, 2), null);
  } catch (e) {
    console.log("Failed saving config " + e);
  }
};

/**
 * Gets the full war details for the specified war ID.
 */
var getUpdate_ = function(ccId, callback) {
  request.post(CC_API, {
    form: {
      "REQUEST": "GET_UPDATE",
      "warcode": ccId
    }
  }, function(error, response, body) {
    if (error) {
      msg.channel.sendMessage("Error retrieving data from Clash Caller: "
          + error);
    } else {
      callback(JSON.parse(body));
    }
  });
};

/**
 * Converts the call_timer stored in the config to a format the Clash Caller
 * API is expecting when starting a war.
 */
var convertCallTimer_ = function(callTimer) {
  if (!callTimer) {
    return 0;
  }
  
  if (callTimer == "1/2") {
    return -2;
  } else if (callTimer == "1/4") {
    return -4;
  } else {
    return parseInt(callTimer);
  }
};

/**
 * Returns war time remaining information.
 * 
 * Message will be blank if war isn't using timers. This is used for display at the
 * beginning of commands that return the status of the war (e.g. /calls, /open).
 */
var getWarTimeRemainingInfo_ = function(warStatus) {
  var warOver = false;
  var message = "";
  var warTimeRemaining = calculateWarTimeRemaining_(warStatus);
  if (warTimeRemaining != null) {
    if (warTimeRemaining < 0) {
      warOver = true;
      message = "The war is over. See results here: " + getCcUrl_(ccId);
    }
    
    var oneDay = 24 * 60 * 60 * 1000;
    if (warTimeRemaining > oneDay) {
      message = "War starts in " + formatTimeRemaining_(warTimeRemaining - oneDay);
    } else {
      message = "War ends in " + formatTimeRemaining_(warTimeRemaining);
    }
  }
  
  return {
    "warOver": warOver,
    "message": message,
    "warTimeRemaining": warTimeRemaining
  }
};

/**
 * Returns the time remaining (in milliseconds) for the war, or null if
 * timers are not enabled for the war.
 */
var calculateWarTimeRemaining_ = function(warStatus) {
  try {
    var checkTime = new Date(warStatus.general.checktime);
    var timerLength = warStatus.general.timerlength;
    var endTime = new Date(warStatus.general.starttime).addHours(24);
    
    if (timerLength == "0") {
      // Timers not enabled for this war
      return null;
    } else {
      return endTime - checkTime;
    }
  } catch (e) {
    console.log("")
  }
};

/**
 * Returns the time remaining (in milliseconds) for a specific call, or null if
 * timers are not enabled for the war, war has not started yet, or war is over.
 */
var calculateCallTimeRemaining_ = function(call, warStatus) {
  try {
    var callTime = new Date(call.calltime);
    var checkTime = new Date(warStatus.general.checktime);
    var startTime = new Date(warStatus.general.starttime);
    var timerLength = warStatus.general.timerlength;
    var endTime = new Date(warStatus.general.starttime).addHours(24);
    
    if (callTime < startTime) {
      callTime = startTime;
    }
    
    if (timerLength == "0") {
      // Timers not enabled for this war
      return null;
    } else if (checkTime < startTime) {
      // War has not started
      return null;
    } else if (checkTime > endTime) {
      // War is over
      return null;
    } else if (timerLength == "-2" || timerLength == "-4") {
      // Flex timer
      var divisor = parseInt(timerLength.substring(1));
      var callEndTime = callTime.addMilliseconds((endTime - callTime) / divisor);
      return callEndTime - checkTime;
    } else {
      // Fixed timer
      var callEndTime = callTime.addHours(parseInt(timerLength));
      return callEndTime - checkTime;
    }
  } catch (e) {
    console.log("Error calculating call time remaining. Call: " + call
        + ". War status: " + warStatus);
    throw e;
  }
};

/**
 * Formats time remaining (in ms) in XXhYYm.
 */
var formatTimeRemaining_ = function(timeRemaining) {
  if (timeRemaining == null) {
    return "";
  }
  
  timeRemaining /= 60000;
  var minutes = Math.floor(timeRemaining % 60);
  timeRemaining /= 60
  if (timeRemaining > 24) {
    console.log("Received time remaining >24h " + timeRemaining);
    return "??h??m";
  }
  var hours = Math.floor(timeRemaining);
  return (hours > 0 ? hours + "h" : "") + minutes + "m";
};

/**
 * Returns an array of active calls for the given war.
 */
var getActiveCalls_ = function(warStatus) {
  var activeCalls = [];
  for (var i = 0; i < warStatus.calls.length; i++) {
    var call = warStatus.calls[i];
    
    if (call.stars == 1) {
      var timeRemaining = calculateCallTimeRemaining_(call, warStatus);
      
      if (timeRemaining == null || timeRemaining > 0) {
        activeCalls.push({
          "baseNumber": parseInt(call.posy) + 1,
          "playername": call.playername,
          "timeRemaining": timeRemaining
        });  
      }
    }
  }

  activeCalls.sort(function(a, b) {
    return a.baseNumber - b.baseNumber;
  }); 
  
  return activeCalls;
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
