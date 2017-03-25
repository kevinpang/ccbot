var request = require('request');
var XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;

exports.commands = [ "cc", "startwar", ]

var CC_API = "http://clashcaller.com/api.php";

// Get channel data.
try {
  var Channels = require("../../channels.json");
} catch (e) {
  console.log("Missing channels.json file\n" + e.stack);
  process.exit();
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
        "timer" : "3",
        "searchable" : 1,
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

exports.cc = {
  description : "Get CC link",
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
