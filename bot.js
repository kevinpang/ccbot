var COMMAND_PREFIX = '/';

try {
	var Discord = require("discord.js");
} catch (e){
	console.log(e.stack);
	console.log(process.version);
	console.log("Please run npm install and ensure it passes with no errors!");
	process.exit();
}
console.log("Starting DiscordBot\nNode version: " + process.version + "\nDiscord.js version: " + Discord.version);

try {
  var Auth = require("./auth.json");
} catch (e) {
  console.log("Please create an auth.json file like auth.json.example " + e);
  process.exit();
}

var commands = {	
  "about": {
    description: "About the bot",
    process: function(bot, msg) {
      msg.channel.sendMessage("Written by Jericho from Reddit Havoc. Based off of the GroupMe bot written by Kannabis from Reddit Mu.\n" +
          "To add this ccbot to a Discord server, visit https://discordapp.com/oauth2/authorize?&client_id=" +
          Auth.clientId + "&scope=bot&permissions=0\n" +
          "Source code can be found at https://github.com/kevinpang/ccbot\n" +
          "File feature requests/bugs at https://github.com/kevinpang/ccbot/issues\n" +
          "For discussions about the bot, please join our Discord server: https://discordapp.com/invite/jwpU9J6");
    }
  }
};

var bot = new Discord.Client();

bot.on("ready", function () {
	console.log("Logged in! Serving in " + bot.guilds.array().length + " servers");
	require("./plugins.js").init();
	console.log("type "+COMMAND_PREFIX+"help in Discord for a commands list.");
	bot.user.setGame(COMMAND_PREFIX+"help | " + bot.guilds.array().length +" Servers"); 
});

bot.on("disconnected", function () {
	console.log("Disconnected!");
	process.exit(1); // exit node.js with an error
});

function checkMessageForCommand(msg, isEdit) {
  // No-op if we don't have write priveledges on the channel.
  if (msg.channel.permissionsFor && 
      !msg.channel.permissionsFor(bot.user).hasPermission('SEND_MESSAGES')) {
    return; 
  }
  
	// check if message is a command
	if(msg.author.id != bot.user.id && (msg.content.startsWith(COMMAND_PREFIX))){
    console.log("treating " + msg.content + " from " + msg.author.username + 
        " in " + (msg.channel.guild ? msg.channel.guild.name + "/" : "") + 
        msg.channel.name + " as command");
		var cmdTxt = msg.content.split(" ")[0].substring(COMMAND_PREFIX.length);
		// add one for the ! and one for the space
    var suffix = msg.content.substring(cmdTxt.length+COMMAND_PREFIX.length+1);
    if(msg.isMentioned(bot.user)){
			try {
				cmdTxt = msg.content.split(" ")[1];
				suffix = msg.content.substring(bot.user.mention().length+cmdTxt.length+COMMAND_PREFIX.length+1);
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
						info += "**"+COMMAND_PREFIX + cmd+"**";
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
							var info = "**"+COMMAND_PREFIX + cmd+"**";
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
};

exports.commandCount = function(){
  return Object.keys(commands).length;
};

if (Auth.botToken) {
  bot.login(Auth.botToken);
} else {
  console.log("No bot token specified");
  process.exit();
}
