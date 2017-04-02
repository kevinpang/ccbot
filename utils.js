var logger = require('./logger.js');

/**
 * Returns the server ID if available, otherwise returns the channel ID.
 */
exports.getServerId = function(msg) {
  return msg.channel.guild ? msg.channel.guild.id : msg.channel.id;
};

/**
 * Returns the author's nickname if available, or username if no nickname is provided.
 */
exports.getAuthorName = function(msg) {
  if (msg.member && msg.member.nickname) {
    return msg.member.nickname;
  }
  return msg.author.username;
}

/**
 * Returns the player name given a player name passed to us. This is to handle
 * scenarios where someone @'s another player and the player name passed to us
 * looks like <@123456789>
 */
exports.getPlayerName = function(msg, playerName) {
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