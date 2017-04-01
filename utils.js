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