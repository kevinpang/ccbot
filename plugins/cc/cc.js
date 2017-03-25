var request = require('request');
var XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;

exports.commands = [ "cc", "startwar", "call", "attacked"]

var CC_API = "http://clashcaller.com/api.php";

// Get channel data.
try {
  var Channels = require("../../channels.json");
} catch (e) {
  console.log("Missing channels.json file\n" + e.stack);
  process.exit();
}

exports.cc = {
  description : "Get Clash Caller link to current war",
  process : function(bot, msg) {
    var channel = Channels[msg.channel.id];
    if (channel) {
      msg.channel
          .sendMessage("http://www.clashcaller.com/war/" + channel.cc_id);
    } else {
      msg.channel
          .sendMessage("No current war declared. Use !startwar to start a new war.");
    }
  }
}

exports.startwar = {
  usage : "<war size> <enemy clan name>",
  description : "Starts a war on Clash Caller",
  process : function(bot, msg, suffix) {
    var args = suffix.split(' ');
    var warSize = args.shift();
    var enemyClanName = args.join(' ');

    // TODO: Validate input (war size is a number, enemy clan name is provided)
    
    request.post(CC_API, {
      form : {
        "REQUEST" : "CREATE_WAR",
        "cname" : "Reddit Havoc", // TODO: stop hardcoding this
        "ename" : enemyClanName,
        "size" : parseInt(warSize),
        "timer" : "3", // TODO: stop hardcoding this
        "searchable" : 1, // TODO: stop hardcoding this
        "clanid" : "#JY9GU99" // TODO: stop hardcoding this
      }
    }, function(error, response, body) {
      if (error) {
        msg.channel.sendMessage("Error creating war: " + error);
      } else {
        // Remove the "war/" from the start.
        var ccId = body.substring(4);
        msg.channel.sendMessage("http://www.clashcaller.com/war/" + ccId);

        Channels[msg.channel.id] = {
          "channel_name" : msg.channel.name,
          "guild_id" : msg.member ? msg.member.guild.id : "",
          "guild_name" : msg.member ? msg.member.guild.name : "",
          "cc_id" : ccId
        }

        console.log('saving channels.json');
        try {
          require("fs").writeFile("./channels.json",
              JSON.stringify(Channels, null, 2), null);
        } catch (e) {
          console.log('failed saving channels.json ' + e);
        }
      }
    });
  }
}

exports.call = {
  usage: "<enemy base #>",
  description: "Call a base",
  process: function(bot, msg, suffix) {
    var channel = Channels[msg.channel.id];
    if (!channel || !channel.cc_id) {
      msg.channel.sendMessage("No current war. Use !startwar to start a war.");
      return;
    }
    
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
        msg.channel.sendMessage("Called base " + enemyBaseNumber + " for " + msg.author.username);
      }
    })  
  }
}

exports.attacked = {
  usage: "<enemy base #> for <# of stars> stars",
  description: "Log an attack",
  process: function(bot, msg, suffix) {
    var channel = Channels[msg.channel.id];
    if (!channel || !channel.cc_id) {
      msg.channel.sendMessage("No current war. Use !startwar to start a war.");
      return;
    }
    
    var args = suffix.split(' ');
    var enemyBaseNumber = parseInt(args[0]);
    var stars = parseInt(args[2]);
    
    getUpdate_(channel.cc_id, function(warStatus) {
      var posx = null;
      for (var i = 0; i < warStatus.calls.length; i++) {
        var call = warStatus.calls[i];
        if (call.posy == enemyBaseNumber - 1 && call.playername == msg.author.username) {
          posx = call.posx;
          break;
        }
      }
      
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
      } else {
        msg.channel.sendMessage("Unable to find call on base "
            + enemyBaseNumber + " for " + msg.author.username);
      }
    });
  }
}

var getUpdate_ = function(ccId, callback) {
  request.post(CC_API, {
    form : {
      "REQUEST" : "GET_UPDATE",
      "warcode" : ccId
    }
  }, function(error, response, body) {
    if (error) {
      msg.channel.sendMessage("Error retrieving data from Clash Caller: " + error);
    } else {
      callback(JSON.parse(body));
    }
  });
};
