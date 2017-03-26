# ccbot
A Clash Caller bot for Discord. Based off of <a href="https://github.com/butttons/cc-bot">cc-bot</a>
and <a href="https://github.com/chalda/DiscordBot">DiscordBot</a>.  

# Features:
- /help => returns full list of available commands
- /say text => echos text
- /ping => bot says "pong"


# Running
Create a Discord bot by visiting https://discordapp.com/developers/applications/me and click on "New App". Follow the
steps and you'll eventually be redirected to a page that contains your bot's client ID and token.

Create an `auth.json` file (see `auth.json.example` for an example of what this should look like) and plug in your
bot's token.

Then, to add your bot to a Discord server, visit https://discordapp.com/oauth2/authorize?&client_id=<ENTER_CLIENT_ID_HERE>&scope=bot&permissions=0 and add it to one of the servers you are logged into.

Lastly, to run the bot just run the following two commands:
`$ npm install`
`$ npm start`

Once that's done your bot should be up and running and hooked into your Discord server.