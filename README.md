[kevinpang.github.io/ccbot/](kevinpang.github.io/ccbot/)

# Description
A Clash Caller bot for Discord. Based off of <a href="https://github.com/butttons/cc-bot">cc-bot</a>
and <a href="https://github.com/chalda/DiscordBot">DiscordBot</a>.

Screenshots of ccbot in action:
![/status](http://i.imgur.com/Dfjy09V.png)

![/call and /attacked](http://i.imgur.com/oij2FMF.png)

![/stats](http://i.imgur.com/teYsCpe.png)

# Installation
Visit
[https://discordapp.com/oauth2/authorize?client_id=295229962045358083&scope=bot&permissions=0](https://discordapp.com/oauth2/authorize?client_id=295229962045358083&scope=bot&permissions=0) and select which
server to add the bot to.

Note that by default the bot will work in all channels on your server that it has READ and WRITE access to. If you want to only enable it for certain channels, disable its READ access on those channels (disable
WRITE access on the default channel since you can't disable READ on that one).

Also note that the war data is unique per channel. This means that you can have multiple channels in different wars on the
same server, which is useful for clans who have feeders or sister clans all in the same server.

# Usage
* /start <war size> <enemy clan name>
  * Starts a new war  
* /call <enemy base #>
  * Calls a base for you in the current war  
* /attacked <enemy base #> for <# stars>
  * Records an attack for you in the current war  
* /status
  * Shows the current war status
* /calls
  * Shows all active calls

There are lots of other features including member stats and configuration options. Type "/help" to get a full list of available commands.

# Running locally
Create an auth.json and configs.json file (see auth.json.example and configs.json.example for what these should look
like) then run `npm start`.

# Creating your own bot
Create a Discord bot by visiting [https://discordapp.com/developers/applications/me](https://discordapp.com/developers/applications/me) and click on "New App". Follow the
steps and you'll eventually be redirected to a page that contains your bot's client ID and token.

To add your bot to a Discord server, visit [https://discordapp.com/oauth2/authorize?client_id=ENTER_YOUR_CLIENT_ID_HERE&scope=bot&permissions=0](https://discordapp.com/oauth2/authorize?client_id=ENTER_YOUR_CLIENT_ID_HERE&scope=bot&permissions=0) and add it to one of the servers you are logged into.