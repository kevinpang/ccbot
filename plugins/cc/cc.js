var logger = require('winston');
var fs = require('fs');
var request = require('request');

var CC_API = "http://clashcaller.com/api.php";
var CC_WAR_URL = "http://www.clashcaller.com/war/";

try {
  var Configs = require("../../configs.json");
} catch (e) {
  logger.error("Please create an configs.json file like configs.json.example " + e);
  process.exit();
}

exports.commands = ["attacked", "cc", "call", "calls", "config", "congrats", "delete", "log",
    "note", "setarchive", "setcalltimer", "setcc", "setclanname", "setclantag",
    "start", "stats", "status", "wartimer"];

exports.attacked = {
  usage: "<enemy base #> for <# of stars>",
  description: "Log your attack",
  process: function(bot, msg, suffix) {
    var ccId = getCcId_(msg);
    if (!ccId) {
      return;
    }
    
    var regex = /^(\d+)\sfor\s(\d+).*$/;
    var arr = regex.exec(suffix);
    if (!arr) {
      msg.channel.sendMessage("Invalid format for /attacked");
      return;
    }

    var baseNumber = parseInt(arr[1]);
    var stars = parseInt(arr[2]);
    logAttack_(msg, ccId, getAuthorName_(msg), baseNumber, stars);
  }
};

exports.cc = {
  description: "Get Clash Caller link to current war",
  process: function(bot, msg) {
    var ccId = getCcId_(msg);
    if (ccId) {
      msg.channel.sendMessage("Current war: " + getCcUrl_(ccId));
    }
  }
};

exports.call = {
  usage: "<enemy base #>",
  description: "Call a base for yourself.\n" +
      "**/call** <enemy base #> for <player name>\n" +
      "\tCall a base for another player.",
  process: function(bot, msg, suffix) {
    var ccId = getCcId_(msg);
    if (!ccId) {
      return;
    }
    
    var regex = /^(\d+)(\sfor\s(.*))?$/;
    var arr = regex.exec(suffix);
    if (!arr) {
      msg.channel.sendMessage("Invalid format for /call");
      return;
    }
    
    var baseNumber = parseInt(arr[1]);
    var playerName = getAuthorName_(msg);
    if (arr[3]) {
      playerName = getPlayerName_(msg, arr[3]);
    }
    
    getWarStatus_(ccId, msg, function(warStatus) {
      var size = parseInt(warStatus.general.size);
      if (baseNumber > size) {
        msg.channel.sendMessage("Invalid base number. War size is " + size + ".");
        return;
      }
      
      var warTimeRemaining = calculateWarTimeRemaining_(warStatus);
      if (warTimeRemaining < 0) {
        msg.channel.sendMessage(getWarTimeRemainingMessage_(ccId, warTimeRemaining));
        return;
      }

      var message = "";
      
      // Print out existing note on this base
      var note = getNote_(baseNumber, warStatus);
      if (note) {
        message += "Note: " + note + "\n";
      }
      
      // Print out any active calls on this base
      var activeCallsOnBase = getActiveCallsOnBase_(baseNumber, warStatus);
      if (activeCallsOnBase.length > 0) {
        message += "Active calls:\n";
        for (var i = 0; i < activeCallsOnBase.length; i++) {
          var activeCallOnBase = activeCallsOnBase[i];
          message += "\t" + activeCallOnBase.playername + " " +
              formatTimeRemaining_(activeCallOnBase.timeRemaining) + "\n";          
        }
      }
      
      request.post(CC_API, {
        form: {
          "REQUEST": "APPEND_CALL",
          "warcode": ccId,
          "posy": baseNumber - 1,
          "value": playerName
        }
      }, function(error, response, body) {
        if (error) {
          logger.warn("Unable to call base " + error);
          message += "Unable to call base " + error;
        } else {
          message += "Called base " + baseNumber + " for " + playerName;
        }
        
        msg.channel.sendMessage(message);
      });
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
  
    getWarStatus_(ccId, msg, function(warStatus) {
      var warTimeRemaining = calculateWarTimeRemaining_(warStatus);
      var message = getWarTimeRemainingMessage_(ccId, warTimeRemaining);
      if (warTimeRemaining < 0) {
        msg.channel.sendMessage(message);
        return;
      }
      
      message += "\n\n";
      
      var activeCalls = getActiveCalls_(warStatus);
      if (activeCalls.length == 0) {
        message += "No active calls";
      } else {
        message += "Active calls:\n";
        for (var i = 0; i < activeCalls.length; i++) {
          var activeCall = activeCalls[i];
          message += "#" + activeCall.baseNumber + ": " + activeCall.playername
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
    var message = "Current war ID: " + config.cc_id + 
        (config.cc_id ? (" (" + getCcUrl_(config.cc_id) + ")") : "")+ "\n" +
        "Clan name: " + config.clanname + "\n" +
        "Call timer: " + config.call_timer + "\n" +
        "Clan tag: " + config.clantag + "\n" +
        "Archive: " + (config.disableArchive ? "off" : "on") + "\n" +
        "Congrats message(s): ";
    if (config.congratsMessages && config.congratsMessages.length > 0) {
      message += "\n";
      for (var i = 0; i < config.congratsMessages.length; i++) {
        message += "\t#" + (i + 1) + ": " + config.congratsMessages[i] + "\n";
      }
    } else {
      message += "none";
    }
    msg.channel.sendMessage(message);
  }
};

exports.congrats = {
  usage: "<add|remove> <congrats message|congrats number>",
  description: "Adds/removes a congrats message (message displayed when someone 3-stars)",
  process: function(bot, msg, suffix) {
    var regex = /^(add|remove)\s(.*)$/;
    var arr = regex.exec(suffix);
    if (!arr) {
      msg.channel.sendMessage("Invalid format for /congrats");
      return;
    }
    
    var config = getConfig_(msg);
    if (arr[1] == "add") {
      if (!config.congratsMessages) {
        config.congratsMessages = [];
      }
      if (config.congratsMessages.length > 100) {
        msg.channel.sendMessage("Too many congrats messages. Please remove some before adding more.");
        return;
      }
      config.congratsMessages.push(arr[2]);
      saveConfig_(msg.channel.id, config);
      msg.channel.sendMessage("Added congrats message: " + arr[2]);
    } else {
      if (config.congratsMessages == null || config.congratsMessages.length == 0) {
        msg.channel.sendMessage("No congrats messages configured");
        return;
      }
      
      regex = /\d+/;
      var invalid = false;
      if (!regex.test(arr[2])) {
        invalid = true;
      } else {
        var congratsNumber = parseInt(arr[2]);
        if (congratsNumber < 1 || congratsNumber > config.congratsMessages.length) {
          invalid = true;
        } else {
          var congratsMessage = config.congratsMessages[congratsNumber - 1];
          config.congratsMessages.splice(congratsNumber - 1, 1);
          saveConfig_(msg.channel.id, config);
          msg.channel.sendMessage("Removed congrats message: " + congratsMessage);
        }
      }
      
      if (invalid) {
        msg.channel.sendMessage("Invalid congrats number. Valid numbers are: 1" +
            (config.congratsMessages.length == 1 ? "" : "-" + config.congratsMessages.length));
      }
    }
  }
};

exports["delete"] = {
  usage: "<enemy base #>",
  description: "Deletes your call on the specified base\n" +
      "**/delete** <enemy base #> for <player name>\n" +
      "\tDelete a base for another player.",
  process: function(bot, msg, suffix) {
    var ccId = getCcId_(msg);
    if (!ccId) {
      return;
    }
    
    var regex = /^(\d+)(\sfor\s(.*))?$/;
    var arr = regex.exec(suffix);
    if (!arr) {
      msg.channel.sendMessage("Invalid format for /delete");
      return;
    }
    
    var baseNumber = parseInt(arr[1]);
    var playerName = getAuthorName_(msg);
    if (arr[3]) {
      playerName = getPlayerName_(msg, arr[3]);
    }
  
    getWarStatus_(ccId, msg, function(warStatus) {
      var posx = findCallPosX_(warStatus, msg, playerName, baseNumber);
      if (posx) {
        request.post(CC_API, {
          form: {
            "REQUEST": "DELETE_CALL",
            "warcode": ccId,
            "posx": posx,
            "posy": baseNumber - 1
          }
        }, function(error, response, body) {
          if (error) {
            logger.warn("Unable to delete call " + error);
            msg.channel.sendMessage("Unable to delete call " + error);
          } else {
            msg.channel.sendMessage("Deleted call on " + baseNumber
                + " for " + playerName);
          }
        })
      }
    });
  }
};

exports.log = {
  usage: "<# of stars> on <enemy base #> <by|for> <player name>",
  description: "Logs an attack for another player",
  process: function(bot, msg, suffix) {
    var ccId = getCcId_(msg);
    if (!ccId) {
      return;
    }
    
    var regex = /^(\d+)\son\s(\d+)\s(by|for)\s(.*)$/;
    var arr = regex.exec(suffix);
    if (!arr) {
      msg.channel.sendMessage("Invalid format for /log");
      return
    }
    
    var stars = parseInt(arr[1]);
    var baseNumber = parseInt(arr[2]);
    var playerName = getPlayerName_(msg, arr[4]);
    logAttack_(msg, ccId, playerName, baseNumber, stars);
  }
};

exports.note = {
  usage: "<enemy base #> <note text>",
  description: "Updates the note on the specified enemy base",
  process: function(bot, msg, suffix) {
    var ccId = getCcId_(msg);
    if (!ccId) {
      return;
    }
    
    var regex = /^(\d+)\s(.*)$/;
    var arr = regex.exec(suffix);
    if (!arr) {
      msg.channel.sendMessage("Invalid format for /note");
      return;
    }
    
    var baseNumber = parseInt(arr[1]);
    var note = arr[2];
    
    request.post(CC_API, {
      form: {
        "REQUEST": "UPDATE_TARGET_NOTE",
        "warcode": ccId,
        "posy": baseNumber - 1,
        "value": note
      }
    }, function(error, response, body) {
      if (error) {
        logger.warn("Error updating note " + error);
        msg.channel.sendMessage("Error updating note " + error);
      } else {
        msg.channel.sendMessage("Updated note on base #" + baseNumber);  
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
  
    getWarStatus_(ccId, msg, function(warStatus) {
      var warTimeRemaining = calculateWarTimeRemaining_(warStatus);
      var message = getWarTimeRemainingMessage_(ccId, warTimeRemaining);
      if (warTimeRemaining < 0) {
        msg.channel.sendMessage(message);
        return;
      }
      
      message += "\n\n";
      
      var openBases = getOpenBases_(warStatus);
      if (openBases.length == 0) {
        message += "No open bases";
      } else {
        message += "Open bases:\n";
        for (var i = 0; i < openBases.length; i++) {
          if (openBases[i].open) {
            message += "#" + (i + 1) + ": ";
            if (openBases[i].stars == null) {
              message += "not attacked";
            } else {
              message += "(" + formatStars_(openBases[i].stars) + ")";
            }
            message += "\n";
            
            // Print out existing note on this base
            var note = getNote_(i + 1, warStatus);
            if (note) {
              message += "\tNote: " + note + "\n";
            }
          }
        }
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
    var prevCcId = config.cc_id;
    config.cc_id = suffix;
    saveConfig_(msg.channel.id, config);
    
    var message = "";
    if (prevCcId) {
      message += "Previous war id: " + prevCcId + "\n";
    }
    message += "Current war ID set to " + suffix + " (" + getCcUrl_(suffix) + ")";
    msg.channel.sendMessage(message);  
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

exports.start = {
  usage: "<war size> <enemy clan name>",
  description: "Starts a war on Clash Caller",
  process: function(bot, msg, suffix) {
    var regex = /(\d+)\s(.*)$/;
    var arr = regex.exec(suffix);
    if (!arr) {
      msg.channel.sendMessage("Invalid format for /start");
      return;
    }

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
        "clanid": config.clantag ? config.clantag : ""
      }
    }, function(error, response, body) {
      if (error) {
        logger.warn("Error creating war " + error);
        msg.channel.sendMessage("Error creating war: " + error);
      } else {
        // Remove the "war/" from the start.
        var ccId = body.substring(4);
        var prevCcId = config.cc_id;
        config.cc_id = ccId;
        saveConfig_(msg.channel.id, config);
        
        var message = "";
        if (prevCcId) {
          message += "Previous war id: " + prevCcId + "\n";
        }
        
        message += "New war created: " + getCcUrl_(ccId);
        msg.channel.sendMessage(message);  
      }
    });
  }
};

exports.stats = {
  description: "View your stats. This requires archiving to be enabled.\n" +
      "**/stats** for <player name>\n" +
      "\tView stats for another player. This requires archiving to be enabled.",
  process: function(bot, msg, suffix) {
    var config = getConfig_(msg);
    if (!config.clantag) {
      msg.channel.sendMessage("Use /setclantag to specify a clan tag first");
      return;
    }
    
    var playerName = getAuthorName_(msg);
    if (suffix) {
      var regex = /^for\s(.*)?$/;
      var arr = regex.exec(suffix);
      if (!arr) {
        msg.channel.sendMessage("Invalid format for /stats");
        return;
      }
      
      playerName = getPlayerName_(msg, arr[1]);
    }
    
    request.post(CC_API, {
      form: {
        "REQUEST": "SEARCH_FOR_PLAYER",
        "clan": config.clantag,
        "name": playerName
      }
    }, function(error, response, body) {
      if (error) {
        logger.warn("Unable to find player " + playerName +
            " in clan " + config.clantag + ": " + error);
        msg.channel.sendMessage("Unable to find player " + playerName +
            " in clan " + config.clantag + ": " + error);
      } else {
        body = JSON.parse(body);
        
        if (body.attacks && body.attacks.length > 0) {
          var wars = {};
          var numWars = 0;
          var stars = 0;
          var attacks = 0;
          var threeStars = 0;
          var twoStars = 0;
          var oneStars = 0;
          var zeroStars = 0;
          
          for (var i = 0; i < body.attacks.length; i++) {
            var attack = body.attacks[i];
            attacks++;
            if (!wars[attack.ID]) {
              wars[attack.ID] = true;
              numWars++;
            }
            var numStars = parseInt(attack.STAR);
            if (numStars > 1) {
              numStars -= 2;
              
              stars += numStars;
              if (numStars == 0) {
                zeroStars++;
              } else if (numStars == 1) {
                oneStars++;
              } else if (numStars == 2) {
                twoStars++;
              } else if (numStars == 3) {
                threeStars++;
              }
            }
          }
          
          var message = "Stats for " + playerName + "\n";
          message += "Wars participated: " + numWars + "\n";
          message += "Total stars: " + stars + "\n";
          message += "Total attacks: " + attacks + "\n";
          message += "Average stars: " + Number(stars / attacks).toFixed(2) + "\n\n";
          message += "3 stars: " + threeStars + " (" + Number(threeStars / attacks * 100).toFixed(2) + "%)\n";
          message += "2 stars: " + twoStars + " (" + Number(twoStars / attacks * 100).toFixed(2) + "%)\n";
          message += "1 stars: " + oneStars + " (" + Number(oneStars / attacks * 100).toFixed(2) + "%)\n";
          message += "0 stars: " + zeroStars + " (" + Number(zeroStars / attacks * 100).toFixed(2) + "%)\n";
          
          msg.channel.sendMessage(message);
        } else {
          msg.channel.sendMessage("No attacks found for player " + 
              playerName + " in clan " + config.clantag);
        }
      }
    });
  }
};

exports.status = {
  description: "Returns the current war status",
  process: function(bot, msg) {
    var ccId = getCcId_(msg);
    if (!ccId) {
      return;
    }
    
    getWarStatus_(ccId, msg, function(warStatus) {
      var warTimeRemaining = calculateWarTimeRemaining_(warStatus);
      var message = getWarTimeRemainingMessage_(ccId, warTimeRemaining) + "\n\nWar status:\n";
      
      var enemyBases = getEnemyBases_(warStatus);
      for (var i = 0; i < enemyBases.length; i++) {
        var baseNumber = i + 1;
        message += "#" + baseNumber + ": ";
        
        var enemyBase = enemyBases[i];
        if (enemyBase.numAttacks == 0) {
          message += "not attacked\n";
        } else {
          message += "(" + enemyBase.numThreeStars + "/" + enemyBase.numAttacks + ") " +
          		enemyBase.bestAttack.playerName + " (" +
          		formatStars_(enemyBase.bestAttack.stars) + ")\n";
        }
        
        // Print out existing note on this base
        var note = getNote_(baseNumber, warStatus);
        if (note) {
          message += "\tNote: " + note + "\n";
        }
        
        // Print out calls on this base
        var calls = getCallsOnBase_(baseNumber, warStatus);
        for (var j = 0; j < calls.length; j++) {
          var call = calls[j];
          if (enemyBase.bestAttack && call.calltime == enemyBase.bestAttack.calltime) {
            // Already displaying this as the best attack.
            continue;
          }
          
          message += "\t";
          if (call.attacked) {
            message += call.playername + " (" + formatStars_(call.stars) + ")";
          } else {
            if (call.timeRemaining != null) {
              if (call.timeRemaining < 0) {
                // Expired call.
                message += call.playername + " (expired)";
              } else {
                // Active call.
                message += call.playername + " (" + formatTimeRemaining_(call.timeRemaining) + ")";
              }
            }
          }
          message += "\n";
        }
      }
      
      msg.channel.sendMessage(message);
    });
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
    var arr = regex.exec(suffix);
    if (!arr) {
      msg.channel.sendMessage("Invalid format for /wartimer");
      return;
    }
    
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
        logger.warn("Unable to update war " + arr[1] + " time " + error);
        msg.channel.sendMessage("Unable to update war " + arr[1] + " time " + error);
      } else {
        msg.channel.sendMessage("War " + arr[1] + " time updated to " + suffix);
      }
    });
  }
};

/**
 * Returns the X position of a user's call or null if call is not found.
 */
var findCallPosX_ = function(warStatus, msg, playerName, baseNumber) {
  for (var i = 0; i < warStatus.calls.length; i++) {
    var call = warStatus.calls[i];
    if (call.posy == baseNumber - 1
        && call.playername == playerName) {
      return call.posx;
      break;
    }
  }
  msg.channel.sendMessage("Unable to find call on base " + baseNumber
      + " for " + playerName);
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
  return "<" + CC_WAR_URL + ccId + ">";
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
      "guild_name": msg.member ? msg.member.guild.name : "",
      "congratsMessages": []
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
    logger.warn("Failed saving config " + e);
  }
};

/**
 * Gets the war status from Clash Caller for the specified war.
 */
var getWarStatus_ = function(ccId, msg, callback) {
  request.post(CC_API, {
    form: {
      "REQUEST": "GET_UPDATE",
      "warcode": ccId
    }
  }, function(error, response, body) {
    if (error) {
      logger.warn("Error retrieving data from Clash Caller: " + error);
      msg.channel.sendMessage("Error retrieving data from Clash Caller: "
          + error);
    } else {
      try {
        callback(JSON.parse(body));  
      } catch (e) {
        logger.warn("Error in getWarStatus_ callback. " + e + ". War status: " + body);
        msg.channel.sendMessage("Error getting war status for war ID: " + ccId);
      }
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
 * Returns war time remaining message.
 */
var getWarTimeRemainingMessage_ = function(ccId, warTimeRemaining) {
  var oneDay = 24 * 60 * 60 * 1000;
  if (warTimeRemaining == null) {
    return ""
  } else if (warTimeRemaining < 0) {
    return "The war is over (" + getCcUrl_(ccId) + ")";
  } else if (warTimeRemaining > oneDay) {
    return "War starts in " + formatTimeRemaining_(warTimeRemaining - oneDay) +
        " (" + getCcUrl_(ccId) + ")";
  } else {
    return "War ends in " + formatTimeRemaining_(warTimeRemaining) +
        " (" + getCcUrl_(ccId) + ")";;
  }
};

/**
 * Returns the time remaining (in milliseconds) for the war, or null if
 * timers are not enabled for the war. Return value can be negative if
 * the war is over.
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
    logger.warn("Unable to calculate war time remaining: " + JSON.stringify(warStatus));
  }
};

/**
 * Returns the time remaining (in milliseconds) for a specific call, or null if
 * timers are not enabled for the war, war has not started yet, or war is over.
 * Return value can be negative if call has expired.
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
    logger.warn("Error calculating call time remaining. Call: " + call
        + ". War status: " + JSON.stringify(warStatus));
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
    logger.warn("Received time remaining >24h " + timeRemaining);
    return "??h??m";
  }
  var hours = Math.floor(timeRemaining);
  return (hours > 0 ? hours + "h" : "") + minutes + "m";
};

/**
 * Returns an array of enemy base statuses for the given war.
 */
var getEnemyBases_ = function(warStatus) {
  var enemyBases = [];
  for (var i = 0; i < parseInt(warStatus.general.size); i++) {
    enemyBases[i] = {
      "numAttacks": 0,
      "bestAttack": null,
      "numThreeStars": 0
    };
  }
  
  for (var i = 0; i < warStatus.calls.length; i++) {
    var call = warStatus.calls[i];
    var stars = parseInt(call.stars);
    
    if (stars != 1) {
      enemyBases[call.posy].numAttacks += 1;
      if (enemyBases[call.posy].bestAttack == null ||
          enemyBases[call.posy].bestAttack.stars < stars - 2) {
        enemyBases[call.posy].bestAttack = {
          "playerName": call.playername,
          "stars": stars - 2,
          "calltime": call.calltime
        };
      }
    }
    if (stars == 5) {
      enemyBases[call.posy].numThreeStars += 1;
    }
  }
  
  return enemyBases;
};

/**
 * Returns the note on the specified base number, or null if no note exists.
 */
var getNote_ = function(baseNumber, warStatus) {
  for (var i = 0; i < warStatus.targets.length; i++) {
    var target = warStatus.targets[i];
    if (parseInt(target.position) == baseNumber - 1) {
      if (target.note != null && target.note != "") {
        return target.note;
      }
    }
  }
  return null;
};

/**
 * Returns all calls (expired/active/attacks) on the specified
 * base for the given war.
 */
var getCallsOnBase_ = function(baseNumber, warStatus) {
  var calls = [];
  for (var i = 0; i < warStatus.calls.length; i++) {
    var call = warStatus.calls[i];
    if (baseNumber != parseInt(call.posy) + 1) {
      continue;
    }
    
    var stars = parseInt(call.stars);
    var call = {
      "playername": call.playername,
      "posx": call.posx,
      "calltime": call.calltime
    };

    if (stars == 1) {
      // Un-starred call.
      call.timeRemaining = calculateCallTimeRemaining_(call, warStatus);
      call.attacked = false;
    } else {
      // Attacked base.
      call.stars = stars - 2;
      call.attacked = true;
    }
    
    calls.push(call);
  }

  calls.sort(function(a, b) {
    return a.posx - b.posx;
  });
  
  return calls;
};

/**
 * Returns active calls for the given war.
 */
var getActiveCalls_ = function(warStatus) {
  var activeCalls = [];
  for (var i = 0; i < warStatus.calls.length; i++) {
    var call = warStatus.calls[i];
    
    if (call.stars == "1") {
      // Has an un-starred call.
      var timeRemaining = calculateCallTimeRemaining_(call, warStatus);
      
      if (timeRemaining == null || timeRemaining > 0) {
        // Has an active call.
        activeCalls.push({
          "baseNumber": parseInt(call.posy) + 1,
          "playername": call.playername,
          "timeRemaining": timeRemaining
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
 * Returns active calls on the specified base for the given war.
 */
var getActiveCallsOnBase_ = function(baseNumber, warStatus) {
  var activeCalls = getActiveCalls_(warStatus);
  var activeCallsOnBase = [];
  if (activeCalls.length > 0) {
    for (var i = 0; i < activeCalls.length; i++) {
      var activeCall = activeCalls[i];
      if (activeCall.baseNumber == baseNumber) {
        activeCallsOnBase.push(activeCall);
      }
    }
  }
  return activeCallsOnBase;
};

/**
 * Returns previous calls (expired calls and previous attacks) on the
 * specified base for the given war.
 */
var getPreviousCallsOnBase_ = function(baseNumber, warStatus) {
  var previousCalls = [];
  for (var i = 0; i < warStatus.calls.length; i++) {
    var call = warStatus.calls[i];
    if (baseNumber != parseInt(call.posy) + 1) {
      continue;
    }
   
    var stars = parseInt(call.stars);
    if (stars == 1) {
      // Un-starred call.
      var timeRemaining = calculateCallTimeRemaining_(call, warStatus);
      if (timeRemaining < 0) {
        // Expired call.
        previousCalls.push({
          "playername": call.playername,
          "expired": true,
          "posx": call.posx
        });
      }
    } else if (stars > 1) {
      // Attacked base
      previousCalls.push({
        "playername": call.playername,
        "stars": stars - 2,
        "posx": call.posx
      });
    }
  }
  
  previousCalls.sort(function(a, b) {
    return a.posx - b.posx;
  });
  
  return previousCalls;
}

/**
 * Logs an attack.
 */
var logAttack_ = function(msg, ccId, playerName, baseNumber, stars) {
  if (stars < 0 || stars > 3) {
    msg.channel.sendMessage("Number of stars must be between 0-3");
    return;
  }

  getWarStatus_(ccId, msg, function(warStatus) {
    var posx = findCallPosX_(warStatus, msg, playerName, baseNumber);
    if (posx) {
      request.post(CC_API, {
        form: {
          "REQUEST": "UPDATE_STARS",
          "warcode": ccId,
          "posx": posx,
          "posy": baseNumber - 1,
          "value": stars + 2
        }
      }, function(error, response, body) {
        if (error) {
          logger.warn("Unable to record stars " + error);
          msg.channel.sendMessage("Unable to record stars " + error);
        } else {
          var message = "Recorded " + stars + " star" + 
              (stars == 1 ? "" : "s") + " for " + playerName + 
              " on base " + baseNumber;
          var config = getConfig_(msg);
          if (stars == 3 && config.congratsMessages && config.congratsMessages.length > 0) {
            message += "\n" + config.congratsMessages[Math.floor(Math.random() * config.congratsMessages.length)];
          }
          msg.channel.sendMessage(message);
        }
      });
    }
  });
};

/**
 * Returns the player name given a player name passed to us. This is to handle
 * scenarios where someone @'s another player and the player name passed to us
 * looks like <@123456789>
 */
var getPlayerName_ = function(msg, playerName) {
  var regex = /^<@!?(.*)>$/;
  var arr = regex.exec(playerName);
  if (!arr) {
    return playerName;
  }
  
  var id = arr[1];
  var member = msg.channel.members.get(id);
  if (member) {
    if (member.nickname) {
      return member.nickname;
    } else {
      return member.user.username;
    }
  } else {
    logger.warn("Unable to figure out player name: " + playerName);
    return "Unknown player name";
  }
};

/**
 * Formats stars for display.
 */
var formatStars_ = function(stars) {
  return stars + " star" + (stars == 1 ? "" : "s");
};

/**
 * Returns the author's nickname if available, or username if no nickname is provided.
 */
var getAuthorName_ = function(msg) {
  if (msg.member.nickname) {
    return msg.member.nickname;
  }
  return msg.author.username;
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
