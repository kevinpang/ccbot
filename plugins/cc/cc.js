var request = require('request');

exports.commands = ["attacked", "cc", "call", "calls", "delete",
    "setcalltimer", "setcc", "setclanname", "setclantag", "start",
    "warstarttime", "warendtime"];

var CC_API = "http://clashcaller.com/api.php";
var CC_WAR_URL = "http://www.clashcaller.com/war/";

// Get channel data.
try {
  var Channels = require("../../channels.json");
} catch (e) {
  console.log("Missing channels.json file\n" + e.stack);
  process.exit();
}

exports.cc = {
  description: "Get Clash Caller link to current war",
  process: function(bot, msg) {
    if (!hasCurrentWar_(msg)) {
      return;
    }

    msg.channel.sendMessage(getCcUrl_(getChannel_(msg.channel.id).cc_id));
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

    // TODO: Validate input (war size is a number, enemy clan name is provided)

    var channel = getChannel_(msg.channel.id);
    request.post(CC_API, {
      form: {
        "REQUEST": "CREATE_WAR",
        "cname": channel && channel.clanname ? channel.clanname : "Unknown",
        "ename": enemyClanName,
        "size": warSize,
        "timer": channel && channel.call_timer ? parseInt(channel.call_timer) : 0,
        "searchable": 1,
        "clanid": channel && channel.clanid ? channel.clanid : ""
      }
    }, function(error, response, body) {
      if (error) {
        msg.channel.sendMessage("Error creating war: " + error);
      } else {
        // Remove the "war/" from the start.
        var ccId = body.substring(4);
        var channel = ensureChannel_(msg);
        channel.cc_id = ccId;
        saveChannel_(msg.channel.id, channel);
        msg.channel.sendMessage(getCcUrl_(ccId));
      }
    });
  }
};

exports.call = {
  usage: "<enemy base #>",
  description: "Call a base",
  process: function(bot, msg, suffix) {
    if (!hasCurrentWar_(msg)) {
      return;
    }

    var channel = getChannel_(msg.channel.id);
    var enemyBaseNumber = parseInt(suffix);

    request.post(CC_API, {
      form: {
        "REQUEST": "APPEND_CALL",
        "warcode": channel.cc_id,
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
    })
  }
};

exports.attacked = {
  usage: "<enemy base #> for <# of stars>",
  description: "Log an attack",
  process: function(bot, msg, suffix) {
    if (!hasCurrentWar_(msg)) {
      return;
    }

    var channel = getChannel_(msg.channel.id);
    var args = suffix.split(' ');
    var enemyBaseNumber = parseInt(args[0]);
    var stars = parseInt(args[2]);
    
    if (stars < 0 || stars > 3) {
      msg.channel.sendMessage("Number of stars must be between 0-3");
      return;
    }

    getUpdate_(channel.cc_id, function(warStatus) {
      var posx = findCallPosX_(warStatus, msg, enemyBaseNumber);
      if (posx) {
        request.post(CC_API, {
          form: {
            "REQUEST": "UPDATE_STARS",
            "warcode": channel.cc_id,
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
        })
      }
    });
  }
};

exports.setcalltimer = {
    usage: "<# hours>",
    description: "Sets the call timer for new wars",
    process: function(bot, msg, suffix) {
      var validTimers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 24];
      if (!validTimers.includes(parseInt(suffix))) {
        msg.channel
          .sendMessage("Call timer must be set to one of the following values: "
              + validTimers.join(", "));
        return;
      }
      
      var channel = ensureChannel_(msg);
      channel.call_timer = suffix;
      saveChannel_(msg.channel.id, channel);
      msg.channel.sendMessage("Call timer set to " + suffix);
    }
  };

exports.setcc = {
  usage: "<war ID>",
  description: "Sets the current war ID",
  process: function(bot, msg, suffix) {
    var channel = ensureChannel_(msg);
    channel.cc_id = suffix;
    saveChannel_(msg.channel.id, channel);
    msg.channel.sendMessage("Current war ID set to " + suffix);
  }
};

exports.setclanname = {
  usage: "<clan name>",
  description: "Sets the clan name for new wars",
  process: function(bot, msg, suffix) {
    var channel = ensureChannel_(msg);
    channel.clanname = suffix;
    saveChannel_(msg.channel.id, channel);
    msg.channel.sendMessage("Clan name set to " + suffix);
  }
};

exports.setclantag = {
  usage: "<clan tag>",
  description: "Sets the clan tag for new wars",
  process: function(bot, msg, suffix) {
    var channel = ensureChannel_(msg);
    channel.clantag = suffix;
    saveChannel_(msg.channel.id, channel);
    msg.channel.sendMessage("Clan tag set to " + suffix);
  }
};

exports.warstarttime = {
  usage: "<##h##m>",
  description: "Updates the current war's start time",
  process: function(bot, msg, suffix) {
    if (!hasCurrentWar_(msg)) {
      return;
    }
    
    var regex = /^([0-9]|0[0-9]|1[0-9]|2[0-3])h([0-9]|[0-5][0-9])m$/;
    if (!regex.test(suffix)) {
      msg.channel.sendMessage("Please specify a start time in ##h##m format");
      return;
    }
    
    var arr = regex.exec(suffix);
    var hours = parseInt(arr[1]);
    var minutes = parseInt(arr[2]);
    var totalMinutes = hours * 60 + minutes;
    
    var channel = getChannel_(msg.channel.id);
    request.post(CC_API, {
      form: {
        "REQUEST": "UPDATE_WAR_TIME",
        "warcode": channel.cc_id,
        "start": "s",
        "minutes": totalMinutes
      }
    }, function(error, response, body) {
      if (error) {
        msg.channel.sendMessage("Unable to update war start time " + error);
      } else {
        msg.channel.sendMessage("War start time updated to " + suffix);
      }
    })
  }
};

exports.warendtime = {
  usage: "<##h##m>",
  description: "Updates the current war's end time",
  process: function(bot, msg, suffix) {
    if (!hasCurrentWar_(msg)) {
      return;
    }
    
    var regex = /^([0-9]|0[0-9]|1[0-9]|2[0-3])h([0-9]|[0-5][0-9])m$/;
    if (!regex.test(suffix)) {
      msg.channel.sendMessage("Please specify a start time in ##h##m format");
      return;
    }
    
    var arr = regex.exec(suffix);
    var hours = parseInt(arr[1]);
    var minutes = parseInt(arr[2]);
    var totalMinutes = hours * 60 + minutes;
    
    var channel = getChannel_(msg.channel.id);
    request.post(CC_API, {
      form: {
        "REQUEST": "UPDATE_WAR_TIME",
        "warcode": channel.cc_id,
        "start": "e",
        "minutes": totalMinutes
      }
    }, function(error, response, body) {
      if (error) {
        msg.channel.sendMessage("Unable to update war end time " + error);
      } else {
        msg.channel.sendMessage("War end time updated to " + suffix);
      }
    })
  }
};

exports["delete"] = {
  usage: "<enemy base #>",
  description: "Deletes your call on the specified base",
  process: function(bot, msg, suffix) {
    if (!hasCurrentWar_(msg)) {
      return;
    }

    var channel = getChannel_(msg.channel.id);
    var enemyBaseNumber = parseInt(suffix);
    getUpdate_(channel.cc_id, function(warStatus) {
      var posx = findCallPosX_(warStatus, msg, enemyBaseNumber);
      if (posx) {
        request.post(CC_API, {
          form: {
            "REQUEST": "DELETE_CALL",
            "warcode": channel.cc_id,
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
      } else {
        msg.channel.sendMessage("Unable to find call on " + enemyBaseNumber +
            " for " + msg.author.username);
      }
    });
  }
};

exports.calls = {
  description: "Gets all active calls",
  process: function(bot, msg, suffix) {
    if (!hasCurrentWar_(msg)) {
      return;
    }

    var channel = getChannel_(msg.channel.id);
    getUpdate_(channel.cc_id, function(warStatus) {
      var activeCalls = [];
      for (var i = 0; i < warStatus.calls.length; i++) {
        var call = warStatus.calls[i];
        if (call.stars == 1) {
          activeCalls.push({
            "baseNumber": parseInt(call.posy) + 1,
            "playername": call.playername
          });
        }
      }

      activeCalls.sort(function(a, b) {
        return a.baseNumber - b.baseNumber;
      });

      if (activeCalls.length == 0) {
        msg.channel.sendMessage("No active calls");
      } else {
        var message = "Active calls:\n";
        for (var i = 0; i < activeCalls.length; i++) {
          var activeCall = activeCalls[i];
          message += "#" + activeCall.baseNumber + " " + activeCall.playername;
        }
        msg.channel.sendMessage(message);
      }
    });
  }
};

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

var hasCurrentWar_ = function(msg) {
  var channel = getChannel_(msg.channel.id);
  if (!channel || !channel.cc_id) {
    msg.channel.sendMessage("No current war. Use !startwar to start a war.");
    return false;
  }
  return true;
};

var getCcUrl_ = function(ccId) {
  return CC_WAR_URL + ccId;
};

var buildChannelFromMsg_ = function(msg) {
  return {
    "channel_name": msg.channel.name,
    "guild_id": msg.member ? msg.member.guild.id : "",
    "guild_name": msg.member ? msg.member.guild.name : ""
  };
};

var getChannel_ = function(id) {
  return Channels[id];
};

var ensureChannel_ = function(msg) {
  var channel = getChannel_(msg.channel.id);
  if (!channel) {
    channel = buildChannelFromMsg_(msg);
  }
  return channel;
};

var saveChannel_ = function(id, channel) {
  Channels[id] = channel;
  console.log('Saving channels.json');
  try {
    require("fs").writeFile("./channels.json",
        JSON.stringify(Channels, null, 2), null);
  } catch (e) {
    console.log('Failed saving channels.json ' + e);
  }
};

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
