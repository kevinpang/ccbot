const clashapi = require('../../clashapi.js');
var decode = require('decode-html');
var logger = require('../../logger.js');
var request = require('request');
var configs = require('../../configs.js');
var utils = require('../../utils.js');

var CC_API = "http://clashcaller.com/api.php";
var CC_WAR_URL = "http://www.clashcaller.com/war/";

try {
  var Auth = require("../../auth.json");
} catch (e) {
  logger.error("Please create an auth.json file like auth.json.example " + e);
  process.exit();
}

exports.commands = [
    "about",
    "attacked",
    "cc",
    "call",
    "calls",
    "config",
    "congrats",
    "delete",
    "log",
    "note",
    "open",
    "setarchive",
    "setcalltimer",
    "setcc",
    "setclanname",
    "setclantag",
    "setcommandprefix",
    "start",
    "stats",
    "status",
    "summary",
    "wartimer"];

exports.about = {
  help: [{
    description: "About the bot" 
  }],
  process: function(bot, msg) {
    msg.channel.sendMessage(
        "Author: Jericho (Reddit Havoc)\n" +
        "Website: https://kevinpang.github.io/ccbot/\n" +
        "Source: <https://github.com/kevinpang/ccbot>\n" +
        "Discord: <https://discordapp.com/invite/jwpU9J6>\n" +
        "Install: <https://discordapp.com/oauth2/authorize?client_id=295229962045358083&scope=bot&permissions=0>\n");
  }
}

exports.attacked = {
  help: [{
    usage: "<enemy base #> for <# of stars>",
    description: "Log your attack"
  }],
  process: function(bot, msg, suffix) {
    var ccId = getCcId_(msg);
    if (!ccId) {
      return;
    }
    
    var regex = /^(\d{1,2}).+(\d).*$/;
    var arr = regex.exec(suffix);
    if (!arr) {
      msg.channel.sendMessage("Invalid format for /attacked");
      return;
    }

    var baseNumber = parseInt(arr[1]);
    var stars = parseInt(arr[2]);
    logAttack_(msg, ccId, utils.getAuthorName(msg), baseNumber, stars);
  }
};

exports.cc = {
  help: [{
    description: "Get Clash Caller link to current war"
  }],
  process: function(bot, msg) {
    var ccId = getCcId_(msg);
    if (ccId) {
      msg.channel.sendMessage("Current war: " + getCcUrl_(ccId));
    }
  }
};

exports.call = {
  help: [
    {
      usage: "<enemy base #>",
      description: "Call a base for yourself"
    },
    {
      usage: "<enemy base #> for <player name>",
      description: "Call a base for another player"
    }
  ],
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
    var playerName = utils.getAuthorName(msg);
    if (arr[3]) {
      playerName = utils.getPlayerName(msg, arr[3]);
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
          msg.channel.sendMessage("Unable to call base " + error);
        } else {
          getWarStatus_(ccId, msg, function(warStatus) {
            var message = "";
            
            var activeCallsOnBase = getActiveCallsOnBase_(baseNumber, warStatus);
            if (activeCallsOnBase.length > 1) {
              message += "**WARNING: THERE ARE OTHER ACTIVE CALLS ON THIS BASE!**\n\n";
            }

            message += "Called base " + baseNumber + " for " + playerName;
            
            // Print out existing note on this base
            var note = getNote_(baseNumber, warStatus);
            if (note) {
              message += "\n\nNote: " + note;
            }
            
            // Print out any active calls on this base
            if (activeCallsOnBase.length > 0) {
              message += "\n\n__Active Calls on #" + baseNumber + "__\n";
              for (var i = 0; i < activeCallsOnBase.length; i++) {
                var activeCallOnBase = activeCallsOnBase[i];
                message += formatActiveCall_(
                    activeCallOnBase.playername, activeCallOnBase.timeRemaining) + "\n";
              }
            }            
            
            msg.channel.sendMessage(message);
          });
        }
      });
    });
  }
};

exports.calls = {
  help: [{
    description: "Gets all active calls"
  }],
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
        message += "__Active Calls__\n";
        for (var i = 0; i < activeCalls.length; i++) {
          var activeCall = activeCalls[i];
          message += "#" + activeCall.baseNumber + ": ";
          message += formatActiveCall_(activeCall.playername, activeCall.timeRemaining) + "\n";
        }
      }
      
      msg.channel.sendMessage(message);
    });
  }
};

exports.config = {
  help: [{
    description: "Returns bot configuration for current channel"
  }],
  process: function(bot, msg) {
    var serverConfig = configs.getServerConfig(msg);
    var message = "__Server Config__\n";
    message += "Command prefix: " + serverConfig.commandPrefix + "\n";
    message += "\n";

    var config = configs.getChannelConfig(msg);
    message += "__Channel Config__\n" +
        "Current war ID: " + config.cc_id + 
        (config.cc_id ? (" (" + getCcUrl_(config.cc_id) + ")") : "")+ "\n" +
        "Clan name: " + config.clanname + "\n" +
        "Call timer: " + config.call_timer + "\n" +
        "Clan tag: " + config.clantag + "\n" +
        "Archive: " + (config.disableArchive ? "off" : "on") + "\n" +
        "Congrats messages: ";
    if (config.congratsMessages && config.congratsMessages.length > 0) {
      message += "\n";
      for (var i = 0; i < config.congratsMessages.length; i++) {
        message += "\t#" + (i + 1) + ": " + config.congratsMessages[i] + "\n";
      }
    } else {
      message += "none\n";
    }
    
    msg.channel.sendMessage(message);
  }
};

exports.congrats = {
  help: [{
    usage: "<add|remove> <congrats message|congrats number>",
    description: "Adds/removes a congrats message (message displayed when someone 3-stars)"
  }],
  process: function(bot, msg, suffix) {
    var regex = /^(add|remove)\s(.*)$/;
    var arr = regex.exec(suffix);
    if (!arr) {
      msg.channel.sendMessage("Invalid format for /congrats");
      return;
    }
    
    var config = configs.getChannelConfig(msg);
    if (arr[1] == "add") {
      if (!config.congratsMessages) {
        config.congratsMessages = [];
      }
      if (config.congratsMessages.length > 100) {
        msg.channel.sendMessage("Too many congrats messages. Please remove some before adding more.");
        return;
      }
      config.congratsMessages.push(arr[2]);
      configs.saveChannelConfig(msg.channel.id, config);
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
          configs.saveChannelConfig(msg.channel.id, config);
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
  help: [
    {
      usage: "<enemy base #>",
      description: "Delete call on a base for yourself"
    },
    {
      usage: "<enemy base #> for <player name>",
      description: "Delete call on a base for another player"
    }
  ],
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
    var playerName = utils.getAuthorName(msg);
    if (arr[3]) {
      playerName = utils.getPlayerName(msg, arr[3]);
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
  help: [{
    usage: "<# of stars> on <enemy base #> <by|for> <player name>",
    description: "Logs an attack for another player"
  }],
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
    var playerName = utils.getPlayerName(msg, arr[4]);
    logAttack_(msg, ccId, playerName, baseNumber, stars);
  }
};

exports.note = {
  help: [{
    usage: "<enemy base #> <note text>",
    description: "Updates the note on the specified enemy base"
  }],
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
  help: [{
    description: "Returns all non-3 starred bases without active calls"
  }],
  process: function(bot, msg) {
    var ccId = getCcId_(msg);
    if (!ccId) {
      return;
    }
    
    getWarStatus_(ccId, msg, function(warStatus) {
      sendStatus_(ccId, warStatus, true, msg);
    });
  }
}

exports.setarchive = {
  help: [{
    usage: "<on|off>",
    description: "Sets archive on/off for new wars"
  }],
  process: function(bot, msg, suffix) {
    if (suffix != 'on' && suffix != 'off') {
      msg.channel.sendMessage("Please specify whether archiving should be on or off");
      return;
    }
    
    var config = configs.getChannelConfig(msg);
    config.disableArchive = suffix == 'off';
    configs.saveChannelConfig(msg.channel.id, config);
    msg.channel.sendMessage("Archiving set to " + suffix);
  }
};

exports.setcalltimer = {
  help: [{
    usage: "<# hours>",
    description: "Sets the call timer for new wars (use 1/2 or 1/4 for flex timers)"
  }],
  process: function(bot, msg, suffix) {
    var validTimers = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
        "12", "24", "1/2", "1/4"];
    if (!validTimers.includes(suffix)) {
      msg.channel
        .sendMessage("Call timer must be set to one of the following values: "
            + validTimers.join(", "));
      return;
    }
    
    var config = configs.getChannelConfig(msg);
    config.call_timer = suffix;
    configs.saveChannelConfig(msg.channel.id, config);
    msg.channel.sendMessage("Call timer set to " + suffix);
  }
};

exports.setcc = {
  help: [{
    usage: "<war ID>",
    description: "Sets the current war ID"
  }],
  process: function(bot, msg, suffix) {
    var config = configs.getChannelConfig(msg);
    var prevCcId = config.cc_id;
    config.cc_id = suffix;
    configs.saveChannelConfig(msg.channel.id, config);
    
    var message = "";
    if (prevCcId) {
      message += "Previous war id: " + prevCcId + "\n";
    }
    message += "Current war ID set to " + suffix + " (" + getCcUrl_(suffix) + ")";
    msg.channel.sendMessage(message);  
  }
};

exports.setclanname = {
  help: [{
    usage: "<clan name>",
    description: "Sets the clan name for new wars"
  }],
  process: function(bot, msg, suffix) {
    var config = configs.getChannelConfig(msg);
    config.clanname = suffix;
    configs.saveChannelConfig(msg.channel.id, config);
    msg.channel.sendMessage("Clan name set to " + suffix);  
  }
};

exports.setclantag = {
  help: [{
    usage: "<clan tag>",
    description: "Sets the clan tag for new wars. Required if you want war statistics returned from /summary command."
  }],
  process: function(bot, msg, suffix) {
    var config = configs.getChannelConfig(msg);
    config.clantag = suffix;
    configs.saveChannelConfig(msg.channel.id, config);
    msg.channel.sendMessage("Clan tag set to " + suffix);  
  }
};

exports.setcommandprefix = {
  help: [{
    usage: "<command prefix>",
    description: "Sets the command prefix for ccbot. Default is /"
  }],
  process: function(bot, msg, suffix) {
    var regex = /^\S*$/;
    if (!regex.test(suffix)) {
      msg.channel.sendMessage("Prefix must be one continuous string of characters (no spaces)");
      return;
    }
    
    var serverConfig = configs.getServerConfig(msg);
    serverConfig.commandPrefix = suffix;
    configs.saveServerConfig(utils.getServerId(msg), serverConfig);
    msg.channel.sendMessage("Command prefix set to " + suffix);
  }
};

exports.start = {
  help: [{
    usage: "<war size> <enemy clan name>",
    description: "Starts a war on Clash Caller"
  }],
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

    var config = configs.getChannelConfig(msg);
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
        configs.saveChannelConfig(msg.channel.id, config);
        
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
  help: [
    {
      description: "View your stats"
    },
    {
      usage: "for <player name>",
      description: "View stats for another player"
    }
  ],
  process: function(bot, msg, suffix) {
    var config = configs.getChannelConfig(msg);
    if (!config.clantag) {
      msg.channel.sendMessage("Use /setclantag to specify a clan tag first");
      return;
    }
    
    var playerName = utils.getAuthorName(msg);
    if (suffix) {
      var regex = /^for\s(.*)?$/;
      var arr = regex.exec(suffix);
      if (!arr) {
        msg.channel.sendMessage("Invalid format for /stats");
        return;
      }
      
      playerName = utils.getPlayerName(msg, arr[1]);
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
          
          var message = "__Stats for " + playerName + "__\n";
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
              playerName + " in clan " + config.clantag + ".\n\n" +
              "Please verify that:\n" +
              "1. Archiving is enabled (use \"/setarchive on\" to enable it for future wars created from ccbot\n" +
              "2. Your name on this channel matches the name you've been using in previous Clash Caller wars");
        }
      }
    });
  }
};

exports.status = {
  help: [{
    description: "Returns the current call statuses from Clash Caller"
  }],
  process: function(bot, msg) {
    var ccId = getCcId_(msg);
    if (!ccId) {
      return;
    }
    
    getWarStatus_(ccId, msg, function(warStatus) {
      sendStatus_(ccId, warStatus, false, msg);
    });
  }
};

exports.summary = {
  help: [{
    description: "Returns a summary of your clan's current war based on data from the Clash of Clans API. " +
        "Requires in-game war log to be public and clan tag to be set via /setclantag command."
  }],
  process: function(bot, msg) {
    let config = configs.getChannelConfig(msg);
    if (config && config.clantag) {
      sendWarSummary_(config.clantag, msg.channel);
    } else {
      msg.channel.sendMessage('Please configure your clan tag via /setclantag');
    }
  }
};

exports.wartimer = {
  help: [{
    usage: "<start|end> <##h##m>",
    description: "Updates the current war's start or end time"
  }],
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
        && call.playername.toLowerCase() == playerName.toLowerCase()) {
      return call.posx;
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
  var config = configs.getChannelConfig(msg);
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
      // CC API returns <success> when it can't find the war ID.
      if (body == '<success>') {
        msg.channel.sendMessage("Cannot find war: " + ccId + ". Please make sure war still exists " + getCcUrl_(ccId));
        return;
      }

      try {
        logger.debug("GET_UPDATE response for war " + ccId + ": " + body);
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
    return "Current war: " + getCcUrl_(ccId);
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
 * Returns the current star status of every enemy base.
 */
var getCurrentStars_ = function(warStatus) {
  var currentStars = [];
  for (var i = 0; i < parseInt(warStatus.general.size); i++) {
    currentStars[i] = null;
  }
  
  for (var i = 0; i < warStatus.calls.length; i++) {
    var call = warStatus.calls[i];
    var stars = parseInt(call.stars);
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
 * Returns the note on the specified base number, or null if no note exists.
 */
var getNote_ = function(baseNumber, warStatus) {
  for (var i = 0; i < warStatus.targets.length; i++) {
    var target = warStatus.targets[i];
    if (parseInt(target.position) == baseNumber - 1) {
      if (target.note != null && target.note != "") {
        // Hack since cc escapes apostrophes as &#039; instead of &#39
        return decode(target.note).replace('&#039;', '\'');
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
  var callsOnBase = [];
  for (var i = 0; i < warStatus.calls.length; i++) {
    var call = warStatus.calls[i];
    if (baseNumber != parseInt(call.posy) + 1) {
      continue;
    }
    
    var stars = parseInt(call.stars);
    var callOnBase = {
      "playername": call.playername,
      "posx": call.posx,
    };

    if (stars == 1) {
      // Un-starred call.
      callOnBase.timeRemaining = calculateCallTimeRemaining_(call, warStatus);
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
          var config = configs.getChannelConfig(msg);
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
 * Sends war status.
 */
var sendStatus_ = function(ccId, warStatus, onlyShowOpenBases, msg) {
  var warTimeRemaining = calculateWarTimeRemaining_(warStatus);
  var message = getWarTimeRemainingMessage_(ccId, warTimeRemaining);
  if (onlyShowOpenBases) {
    message += "\n\n__Open Bases__\n";
  } else {
    message += "\n\n__War Status__\n";
  }
  message += "```\n";

  var currentStars = getCurrentStars_(warStatus);
  for (var i = 0; i < currentStars.length; i++) {
    var baseNumber = i + 1;
    var stars = currentStars[i];
    var calls = getCallsOnBase_(baseNumber, warStatus);
    var note = getNote_(baseNumber, warStatus);

    if (onlyShowOpenBases) {
      if (stars == 3) {
        continue;
      }

      var hasActiveCall = false;
      for (var j = 0; j < calls.length; j++) {
        var call = calls[j];
        if (!call.attacked && (call.timeRemaining == null || call.timeRemaining > 0)) {
          hasActiveCall = true;
          break;
        }
      }

      if (hasActiveCall) {
        continue;
      }
    }

    var formattedBase = formatBase_(stars, baseNumber, calls, note);
    message += formattedBase;

    // Send message in chunks to avoid hitting Discord's message character limit.
    if (message.length > 1000) {
      message += "```";
      msg.channel.sendMessage(message);
      message = "```\n";
    }
  }

  message += "```";
  msg.channel.sendMessage(message);
}

/**
 * Sends current war statistics retrieved from Clash of Clans API.
 */
let sendWarSummary_ = function(clanTag, channel) {
  clashapi.getCurrentWar(clanTag).then(currentWar => {
    if (!currentWar) {
      logger.warning(`currentWar == null for ${clanTag}`);
      return;
    }

    let clanName = currentWar.clan.name;
    let clanTag = currentWar.clan.tag;
    let enemyName = currentWar.opponent.name;
    let enemyClanTag = currentWar.opponent.tag;
    let warSize = currentWar.teamSize;
    let numStars = currentWar.clan.stars;
    let numEnemyStars = currentWar.opponent.stars;
    let percentage = currentWar.clan.destructionPercentage;
    let enemyPercentage = currentWar.opponent.destructionPercentage;
    let numAttacks = currentWar.clan.attacks;
    let numEnemyAttacks = currentWar.opponent.attacks;

    let playerTagToThLevelMap = getPlayerTagToThLevelMap_(currentWar);
    let clanStatistics = getCurrentWarStatisticsForClan_(currentWar.clan, playerTagToThLevelMap);
    let enemyStatistics = getCurrentWarStatisticsForClan_(currentWar.opponent, playerTagToThLevelMap);

    // Format current war statistics
    let message = '__War Summary (Beta)__\n';
    message += '```';
    message += `${clanName} (${clanTag}) vs ${enemyName} (${enemyClanTag})\n`;
    message += `Stars: ${numStars} - ${numEnemyStars}\n`;
    message += `Percentage: ${percentage}% - ${enemyPercentage}%\n\n`;
    message += `Attacks: ${numAttacks}/${warSize * 2} - ${numEnemyAttacks}/${warSize * 2}\n`;
    message += `Breakdown: ${clanStatistics.numTh11s}/${clanStatistics.numTh10s}/${clanStatistics.numTh9s} - ` +
        `${enemyStatistics.numTh11s}/${enemyStatistics.numTh10s}/${enemyStatistics.numTh9s}\n`;
    message += `Attacks left: ${clanStatistics.numTh11AttacksLeft}/${clanStatistics.numTh10AttacksLeft}/${clanStatistics.numTh9AttacksLeft} - ` +
        `${enemyStatistics.numTh11AttacksLeft}/${enemyStatistics.numTh10AttacksLeft}/${enemyStatistics.numTh9AttacksLeft}\n\n`;
    message += `11v11 3*: ${formatThvTh_(clanStatistics.num11v11ThreeStars, clanStatistics.num11v11Attempts)} - ` +
        `${formatThvTh_(enemyStatistics.num11v11ThreeStars, enemyStatistics.num11v11Attempts)}\n`;
    message += `10v10 3*: ${formatThvTh_(clanStatistics.num10v10ThreeStars, clanStatistics.num10v10Attempts)} - ` +
        `${formatThvTh_(enemyStatistics.num10v10ThreeStars, enemyStatistics.num10v10Attempts)}\n`;
    message += `9v9   3*: ${formatThvTh_(clanStatistics.num9v9ThreeStars, clanStatistics.num9v9Attempts)} - ` +
        `${formatThvTh_(enemyStatistics.num9v9ThreeStars, enemyStatistics.num9v9Attempts)}\n`;
    message += `11v10 3*: ${formatThvTh_(clanStatistics.num11v10ThreeStars, clanStatistics.num11v10Attempts)} - ` +
        `${formatThvTh_(enemyStatistics.num11v10ThreeStars, enemyStatistics.num11v10Attempts)}\n`;
    message += `10v9  3*: ${formatThvTh_(clanStatistics.num10v9ThreeStars, clanStatistics.num10v9Attempts)} - ` +
        `${formatThvTh_(enemyStatistics.num10v9ThreeStars, enemyStatistics.num10v9Attempts)}\n`;
    message += `10v11 2*: ${formatThvTh_(clanStatistics.num10v11TwoStars, clanStatistics.num10v11Attempts)} - ` +
        `${formatThvTh_(enemyStatistics.num10v11TwoStars, enemyStatistics.num10v11Attempts)}\n`;
    message += `9v10  2*: ${formatThvTh_(clanStatistics.num9v10TwoStars, clanStatistics.num9v10Attempts)} - ` +
        `${formatThvTh_(enemyStatistics.num9v10TwoStars, enemyStatistics.num9v10Attempts)}`;

    message += '```';

    channel.sendMessage(message);
  }).catch(err => {
    channel.sendMessage(`Unable to retrieve current war from Clash of Clans API for clan tag ${clanTag}. ` +
        `Please make sure your clan tag is correct and that your clan's war log is public.`);
  });
};

let formatThvTh_ = function(numSuccess, numAttempts) {
  return `${numSuccess}/${numAttempts}` + (numAttempts > 0 ? ` (${Math.floor(numSuccess/numAttempts*100)}%)` : '');
};

/**
 * Returns the current war statistics for the given clan.
 * 
 * @param {*} clan either the clan or opponent JSON object returned by the Clash of Clans API
 */
let getCurrentWarStatisticsForClan_ = function(clan, playerTagToThLevelMap) {
  let statistics = {
    'numTh9s': 0,
    'numTh10s': 0,
    'numTh11s': 0,
    'numTh11AttacksLeft': 0,
    'numTh10AttacksLeft': 0,
    'numTh9AttacksLeft': 0,
    'num11v11ThreeStars': 0,
    'num11v11Attempts': 0,
    'num10v10ThreeStars': 0,
    'num10v10Attempts': 0,
    'num9v9ThreeStars': 0,
    'num9v9Attempts': 0,
    'num11v10ThreeStars': 0,
    'num11v10Attempts': 0,
    'num10v9ThreeStars': 0,
    'num10v9Attempts': 0,
    'num10v11TwoStars': 0,
    'num10v11Attempts': 0,
    'num9v10TwoStars': 0,
    'num9v10Attempts': 0
  };

  for (let i = 0; i < clan.members.length; i++) {
    let member = clan.members[i];   
    switch (member.townhallLevel) {
      case 9:
        statistics.numTh9s++;
        if (member.attacks) {
          statistics.numTh9AttacksLeft += 2 - member.attacks.length;

          for (let j = 0; j < member.attacks.length; j++) {
            let attack = member.attacks[j];
            let defenderThLevel = playerTagToThLevelMap[attack.defenderTag];
            switch (defenderThLevel) {
              case 9:
                statistics.num9v9Attempts++;
                if (attack.stars == 3) {
                  statistics.num9v9ThreeStars++;
                }
                break;
              case 10:
                statistics.num9v10Attempts++;
                if (attack.stars == 2) {
                  statistics.num9v10TwoStars++;
                }
                break;
            }
          }
        } else {
          statistics.numTh9AttacksLeft += 2;
        }
        break;
      case 10:
        statistics.numTh10s++;
        if (member.attacks) {
          statistics.numTh10AttacksLeft += 2 - member.attacks.length;

          for (let j = 0; j < member.attacks.length; j++) {
            let attack = member.attacks[j];
            let defenderThLevel = playerTagToThLevelMap[attack.defenderTag];
            switch (defenderThLevel) {
              case 9:
                statistics.num10v9Attempts++;
                if (attack.stars == 3) {
                  statistics.num10v9ThreeStars++;
                }
                break;
              case 10:
                statistics.num10v10Attempts++;
                if (attack.stars == 3) {
                  statistics.num10v10ThreeStars++;
                }
                break;
              case 11:
                statistics.num10v11Attempts++;
                if (attack.stars == 2) {
                  statistics.num10v11TwoStars++;
                }
                break;
            }
          }
        } else {
          statistics.numTh10AttacksLeft += 2;
        }
        break;
      case 11:
        statistics.numTh11s++;
        if (member.attacks) {
          statistics.numTh11AttacksLeft += 2 - member.attacks.length;

          for (let j = 0; j < member.attacks.length; j++) {
            let attack = member.attacks[j];
            let defenderThLevel = playerTagToThLevelMap[attack.defenderTag];
            switch (defenderThLevel) {
              case 10:
                statistics.num11v10Attempts++;
                if (attack.stars == 3) {
                  statistics.num11v10ThreeStars++;
                }
                break;
              case 11:
                statistics.num11v11Attempts++;
                if (attack.stars == 2) {
                  statistics.num11v11ThreeStars++;
                }
                break;
            }
          }
        } else {
          statistics.numTh11AttacksLeft += 2;
        }
        break;
    }
  }

  return statistics;
}

/**
 * Returns a map of player tag to th level given the current war returned by Clash of Clans API.
 */
let getPlayerTagToThLevelMap_ = function(currentWar) {
  let map = {};

  for (let i = 0; i < currentWar.clan.members.length; i++) {
    let member = currentWar.clan.members[i];
    map[member.tag] = member.townhallLevel;
  }

  for (let i = 0; i < currentWar.opponent.members.length; i++) {
    let member = currentWar.opponent.members[i];
    map[member.tag] = member.townhallLevel;
  }

  return map;
};

/**
 * Formats a base for display. Assumes we're in monospace mode.
 */
var formatBase_ = function(stars, baseNumber, calls, note) {
  var message = formatStars_(stars);
  message += (baseNumber < 10 ? "  " : " ") + "#" + baseNumber + ": ";
  
  var additionalLineLeftPadding = "         ";
  
  // Print out calls on this base
  if (calls.length == 0) {
    message += "OPEN\n";
  } else {
    for (var j = 0; j < calls.length; j++) {
      var call = calls[j];
      if (j > 0) {
        message += additionalLineLeftPadding;
      }
      
      if (call.attacked) {
        message += call.playername + " [" + formatStars_(call.stars) + "]";
      } else {
        if (call.timeRemaining == null) {
          message += call.playername;
        } else {
          if (call.timeRemaining < 0) {
            // Expired call.
            message += call.playername + " (expired)";
          } else {
            // Active call.
            message += formatActiveCall_(call.playername, call.timeRemaining);
          }
        }
      }
      message += "\n";
    }
  }
  
  // Print out existing note on this base
  if (note) {
    var noteStr = "Note: " + note;
    var noteLines = noteStr.split('\n');
    var noteArr = [];
    for (var i = 0; i < noteLines.length; i++) {
      noteArr = noteArr.concat(split_(noteLines[i], 45));
    }
    for (var i = 0; i < noteArr.length; i++) {
      message += additionalLineLeftPadding + noteArr[i] + "\n";
    }
  }

  return message;
};

/**
 * Splits the input string into an array of strings no longer than length l.
 */
var split_ = function(str, l) {
  var strs = [];
  while(str.length > l) {
    var pos = str.substring(0, l).lastIndexOf(' ');
    pos = pos <= 0 ? l : pos;
    strs.push(str.substring(0, pos));
    var i = str.indexOf(' ', pos)+1;
    if (i < pos || i > pos+l) {
      i = pos;
    }
    str = str.substring(i);
  }
  strs.push(str);
  return strs;
}

/**
 * Formats stars for display.
 */
var formatStars_ = function(stars) {
  if (stars == null) {
    return "   ";
  }
  
  return " ".repeat(3 - stars) + "*".repeat(stars);
};

/**
 * Formats an active call on a base.
 */
var formatActiveCall_ = function(playername, timeRemaining) {
  var message = playername;
  if (timeRemaining) {
    message += " (" + formatTimeRemaining_(timeRemaining) + ")";
  }
  return message;
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
