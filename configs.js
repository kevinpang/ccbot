var logger = require('winston');

try {
  var Configs = require("./configs.json");
} catch (e) {
  logger.error("Please create an configs.json file like configs.json.example " + e);
  process.exit();
}

/**
 * Returns a config from config.js or a default config if not found.
 */
exports.get = function(msg) {
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
exports.save = function(id, config) {
  Configs[id] = config;
  try {
    fs.writeFile("./configs.json", JSON.stringify(Configs, null, 2), null);
  } catch (e) {
    logger.warn("Failed saving config " + e);
  }
};