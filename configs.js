var fs = require('fs');
var logger = require('./logger.js');
var utils = require('./utils.js');

try {
  var Configs = require("./configs.json");
} catch (e) {
  logger.error("Please create an configs.json file like configs.json.example " + e);
  process.exit();
}

exports.DEFAULT_COMMAND_PREFIX = "/";

/**
 * Returns the entire configs.json file.
 */
exports.get = function() {
  return Configs;
};

/**
 * Saves the entire configs.json file.
 */
exports.save = function() {
  try {
    fs.writeFile("./configs.json", JSON.stringify(Configs, null, 2), null);
  } catch (e) {
    logger.warn("Failed saving config " + e);
  }
};

/**
 * Returns a channel config from config.js or a default channel config if not found.
 */
exports.getChannelConfig = function(msg) {
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
 * Saves a channel config.
 */
exports.saveChannelConfig = function(id, config) {
  Configs[id] = config;
  exports.save();
};

/**
 * Returns a server config from config.js or a default server config if not found.
 */
exports.getServerConfig = function(msg) {
  var config = Configs.serverConfigs[utils.getServerId(msg)];
  if (config) {
    return config;
  } else {
    // Return a default config.
    return {
      "commandPrefix": exports.DEFAULT_COMMAND_PREFIX
    };
  }
};

/**
 * Saves a server config.
 */
exports.saveServerConfig = function(id, config) {
  Configs.serverConfigs[id] = config;
  exports.save();
};
