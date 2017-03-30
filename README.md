# Description
A Clash Caller bot for Discord. Based off of <a href="https://github.com/butttons/cc-bot">cc-bot</a>
and <a href="https://github.com/chalda/DiscordBot">DiscordBot</a>.

Screenshots of ccbot in action:
![/status](http://i.imgur.com/Dfjy09V.png)
![/call and /attacked](http://i.imgur.com/oij2FMF.png)
![/stats](http://i.imgur.com/teYsCpe.png)

# Features
- /help => returns full list of available commands
- /say text => echos text
- /ping => bot says "pong"
- /start <war size> <Enemy Clan Name> => starts a war on clashcaller.com
- /call <enemy base #> => calls a base for you in the current war
- /attacked <enemy base #> for <# stars> => records your attack in the current war

# Adding bot to your Discord server
If you want to add the existing ccbot to your own Discord server just visit
https://discordapp.com/oauth2/authorize?&client_id=295229962045358083&scope=bot&permissions=0 and select which
server to add the bot to.

Note that by default the bot will work in all channels on your server that it has READ access to. If you want to only
enable it for certain channels you'll need to disable its READ access on all channels you want it disabled on (disable
WRITE access on the default channel since you can't disable reading on that one).

# Creating your own bot
Create a Discord bot by visiting https://discordapp.com/developers/applications/me and click on "New App". Follow the
steps and you'll eventually be redirected to a page that contains your bot's client ID and token.

To add your bot to a Discord server, visit https://discordapp.com/oauth2/authorize?&client_id=ENTER_YOUR_CLIENT_ID_HERE&scope=bot&permissions=0 and add it to one of the servers you are logged into.

# Running locally
Create an auth.json and configs.json file (see auth.json.example and configs.json.example for what these should look
like) then run `npm start`.