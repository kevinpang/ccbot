exports.getServerId = function(msg) {
  return msg.channel.guild ? msg.channel.guild.id : msg.channel.id;
};
