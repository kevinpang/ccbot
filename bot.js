var logger = require('winston');
var configs = require('./configs.js');
var utils = require('./utils.js');

logger.configure({
  transports: [
    new (logger.transports.File)({
      filename: 'logs/log.txt',
      maxsize: 1000000,
      maxFiles: 100,
      level: 'debug'
    }),
    new (logger.transports.Console)({
      colorize: true,
      timestamp: true
    })
  ]
});

// Initialize serverConfigs if not defined.
var cfgs = configs.get();
if (!cfgs.serverConfigs) {
  cfgs.serverConfigs = {};
  configs.save(cfgs);
}

try {
	var Discord = require("discord.js");
} catch (e) {
	logger.error(e.stack);
	logger.error(process.version);
	logger.error("Please run npm install and ensure it passes with no errors!");
	process.exit();
}
logger.info("Starting DiscordBot\nNode version: " + process.version + "\nDiscord.js version: " + Discord.version);

try {
  var Auth = require("./auth.json");
} catch (e) {
  logger.error("Please create an auth.json file like auth.json.example " + e);
  process.exit();
}

var commands = {};

var bot = new Discord.Client();

bot.on("ready", function () {
  var guilds = bot.guilds.array();
  logger.info("Logged in! Serving in " + guilds.length + " server" +
      (guilds.length == 1 ? "" : "s") + ":");
  for (var i = 0; i < guilds.length; i++) {
    logger.info((i + 1) + ". " + guilds[i].name);
  }
  
	require("./plugins.js").init();
	bot.user.setGame("Clash of Clans | " + bot.guilds.array().length +" Servers"); 
});

bot.on("disconnected", function () {
  logger.error("Disconnected!");
	process.exit(1); // exit node.js with an error
});

function checkMessageForCommand(msg, isEdit) {
  var serverConfig = configs.getServerConfig(msg);
  var commandPrefix = serverConfig.commandPrefix;
  
	// check if message is a command
	if(msg.author.id != bot.user.id && (msg.content.startsWith(commandPrefix))){
	  var guildAndChannel = (msg.channel.guild ? msg.channel.guild.name + "/" : "") + 
        msg.channel.name;
	  logger.info("\"" + msg.content + "\" from " + utils.getAuthorName(msg) + 
        " in " + guildAndChannel);
	  // No-op if we don't have write priviledges on the channel.
	  if (msg.channel.permissionsFor && 
	      !msg.channel.permissionsFor(bot.user).hasPermission('SEND_MESSAGES')) {
	    logger.warn("Ignoring because bot lacks SEND_MESSAGES permission in " +
	        guildAndChannel);
	    return; 
	  }
		var cmdTxt = msg.content.split(" ")[0].substring(commandPrefix.length);
		// add one for the ! and one for the space
    var suffix = msg.content.substring(cmdTxt.length+commandPrefix.length+1);
    if(msg.isMentioned(bot.user)){
			try {
				cmdTxt = msg.content.split(" ")[1];
				suffix = msg.content.substring(bot.user.mention().length+cmdTxt.length+commandPrefix.length+1);
			} catch(e){ // no command
				msg.channel.sendMessage("Yes?");
				return;
			}
    }
		var cmd = commands[cmdTxt];
    if(cmdTxt === "help"){
        // help is special since it iterates over the other commands
				if(suffix){
					var cmds = suffix.split(" ").filter(function(cmd){return commands[cmd]});
					var info = "";
					for(var i=0;i<cmds.length;i++) {
						var cmd = cmds[i];
						info += "";
						var help = commands[cmd].help;
						for (var j = 0; j < help.length; j++) {
						  info += "**" + commandPrefix + cmd + "**";
						  
						  var usage = help[j].usage;
	            if(usage){
	              info += " " + usage;
	            }
	            var description = help[j].description;
	            if(description instanceof Function){
	              description = description();
	            }
	            if(description){
	              info += "\n\t" + description;
	            }
	            info += "\n"
						}
					}
					msg.channel.sendMessage(info);
				} else {
					var batch = "";
					var sortedCommands = Object.keys(commands).sort();
					for(var i in sortedCommands) {
						var cmd = sortedCommands[i];
						var info = "";
						
						var help = commands[cmd].help;
						for (var j = 0; j < help.length; j++) {
						  info += "**" + commandPrefix + cmd + "**";
						  
						  var usage = help[j].usage;
	            if(usage){
	              info += " " + usage;
	            }
	            var description = help[j].description;
	            if(description instanceof Function){
	              description = description();
	            }
	            if(description){
	              info += "\n\t" + description;
	            }
	            if (j < help.length - 1) {
	              info += "\n";
	            }
						}
						
						var newBatch = batch + "\n" + info;
						if(newBatch.length > (1024 - 8)){ // limit message length
							msg.channel.sendMessage(batch);
							batch = info;
						} else {
							batch = newBatch
						}
					}
					if(batch.length > 0){
						msg.channel.sendMessage(batch);
					}
			}
    } else if(cmd) {
			cmd.process(bot, msg, suffix, isEdit);
		} else {
			msg.channel.sendMessage(cmdTxt + " not recognized as a command!").then((message => message.delete(5000)))
		}
	} else {
		// message isn't a command or is from us
    // drop our own messages to prevent feedback loops
    if(msg.author == bot.user){
        return;
    }

    if (msg.author != bot.user && msg.isMentioned(bot.user)) {
        msg.channel.sendMessage(msg.author + ", you called?");
    }
  }
}

bot.on("message", function(msg) {
  try {
    checkMessageForCommand(msg, false)  
  } catch (e) {
    logger.warn("Error processing message: " + msg + ". Exception: " + e);
    var msgTxt = "Error processing message \"" + msg + "\". Please report the issue " +
        "at <https://discordapp.com/invite/jwpU9J6>";
    msg.channel.sendMessage(msgTxt);
  }
});

bot.on("messageUpdate", (oldMessage, newMessage) => {
  try {
    checkMessageForCommand(newMessage, true);
  } catch (e) {
    logger.warn("Error processing messageUpdate: " + msg + ". Exception: " + e);
    var msgTxt = "Error processing message \"" + msg + "\". Please report the issue " +
        "at <https://discordapp.com/invite/jwpU9J6>";
    msg.channel.sendMessage(msgTxt);
  }
});

exports.addCommand = function(commandName, commandObject){
  try {
    commands[commandName] = commandObject;
  } catch(err){
    logger.warn(err);
  }
};

exports.commandCount = function(){
  return Object.keys(commands).length;
};

if (Auth.botToken) {
  bot.login(Auth.botToken);
} else {
  logger.error("No bot token specified");
  process.exit();
}
