var fs = require('fs');

try {
	var Discord = require("discord.js");
} catch (e){
	console.log(e.stack);
	console.log(process.version);
	console.log("Please run npm install and ensure it passes with no errors!");
	process.exit();
}
console.log("Starting DiscordBot\nNode version: " + process.version + "\nDiscord.js version: " + Discord.version);

// Get authentication data
try {
	var AuthDetails = require("./auth.json");
} catch (e){
	console.log("Please create an auth.json like auth.json.example with a bot token or an email and password.\n"+e.stack);
	process.exit();
}

// load config data
var Config = {};
try{
	Config = require("./config.json");
} catch(e){ // no config file, use defaults
	Config.debug = false;
	Config.commandPrefix = '!';
	try{
		if(fs.lstatSync("./config.json").isFile()){
			console.log("WARNING: config.json found but we couldn't read it!\n" + e.stack);
		}
	} catch(e2){
		fs.writeFile("./config.json",JSON.stringify(Config,null,2));
	}
}
if(!Config.hasOwnProperty("commandPrefix")){
	Config.commandPrefix = '!';
}

var commands = {	
  "ping": {
    description: "responds pong, useful for checking if bot is alive",
    process: function(bot, msg, suffix) {
      msg.channel.sendMessage(msg.author + " pong!");
      if(suffix){
          msg.channel.sendMessage( "note that !ping takes no arguments!");
      }
    }
  },
  "say": {
    usage: "<message>",
    description: "bot says message",
    process: function(bot, msg, suffix){
      msg.channel.sendMessage(suffix);
    }
  },
  "about": {
    description: "About the bot",
    process: function(bot, msg) {
      msg.channel.sendMessage("Developed by Jericho from Reddit Havoc. Source code " +
          "can be found here: https://github.com/kevinpang/ccbot");
    }
  }
};

var bot = new Discord.Client();

bot.on("ready", function () {
	console.log("Logged in! Serving in " + bot.guilds.array().length + " servers");
	require("./plugins.js").init();
	console.log("type "+Config.commandPrefix+"help in Discord for a commands list.");
	bot.user.setGame(Config.commandPrefix+"help | " + bot.guilds.array().length +" Servers"); 
});

bot.on("disconnected", function () {
	console.log("Disconnected!");
	process.exit(1); // exit node.js with an error
});

function checkMessageForCommand(msg, isEdit) {
	// check if message is a command
	if(msg.author.id != bot.user.id && (msg.content.startsWith(Config.commandPrefix))){
    console.log("treating " + msg.content + " from " + msg.author + " as command");
		var cmdTxt = msg.content.split(" ")[0].substring(Config.commandPrefix.length);
		// add one for the ! and one for the space
    var suffix = msg.content.substring(cmdTxt.length+Config.commandPrefix.length+1);
    if(msg.isMentioned(bot.user)){
			try {
				cmdTxt = msg.content.split(" ")[1];
				suffix = msg.content.substring(bot.user.mention().length+cmdTxt.length+Config.commandPrefix.length+1);
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
						info += "**"+Config.commandPrefix + cmd+"**";
						var usage = commands[cmd].usage;
						if(usage){
							info += " " + usage;
						}
						var description = commands[cmd].description;
						if(description instanceof Function){
							description = description();
						}
						if(description){
							info += "\n\t" + description;
						}
						info += "\n"
					}
					msg.channel.sendMessage(info);
				} else {
					msg.channel.sendMessage("**Available Commands:**").then(function(){
						var batch = "";
						var sortedCommands = Object.keys(commands).sort();
						for(var i in sortedCommands) {
							var cmd = sortedCommands[i];
							var info = "**"+Config.commandPrefix + cmd+"**";
							var usage = commands[cmd].usage;
							if(usage){
								info += " " + usage;
							}
							var description = commands[cmd].description;
							if(description instanceof Function){
								description = description();
							}
							if(description){
								info += "\n\t" + description;
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
				});
			}
    } else if(cmd) {
			try{
				cmd.process(bot, msg, suffix, isEdit);
			} catch(e){
			  console.log("command " + cmdTxt + " failed: " + e);
			  var msgTxt = "command " + cmdTxt + " failed :(";
				if(Config.debug){
					 msgTxt += "\n" + e.stack;
				}
				msg.channel.sendMessage(msgTxt);
			}
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

bot.on("message", (msg) => checkMessageForCommand(msg, false));
bot.on("messageUpdate", (oldMessage, newMessage) => {
	checkMessageForCommand(newMessage,true);
});

exports.addCommand = function(commandName, commandObject){
  try {
    commands[commandName] = commandObject;
  } catch(err){
    console.log(err);
  }
}

exports.commandCount = function(){
  return Object.keys(commands).length;
}

if(AuthDetails.bot_token){
	console.log("logging in with token");
	bot.login(AuthDetails.bot_token);
} else {
	console.log("Logging in with user credentials is no longer supported!\nYou can use token based log in with a user account, see\nhttps://discord.js.org/#/docs/main/master/general/updating");
}
