# Description
A Clash Caller bot for Discord. Based off of <a href="https://github.com/butttons/cc-bot">cc-bot</a>
and <a href="https://github.com/chalda/DiscordBot">DiscordBot</a>.  

# Features
- /help => returns full list of available commands
- /say text => echos text
- /ping => bot says "pong"
- /start <war size> <Enemy Clan Name> => starts a war on clashcaller.com
- /call <enemy base #> => calls a base for you in the current war
- /attacked <enemy base #> for <# stars> => records your attack in the current war

# Creating your bot
Create a Discord bot by visiting https://discordapp.com/developers/applications/me and click on "New App". Follow the
steps and you'll eventually be redirected to a page that contains your bot's client ID and token.

To add your bot to a Discord server, visit https://discordapp.com/oauth2/authorize?&client_id=<ENTER_CLIENT_ID_HERE>&scope=bot&permissions=0 and add it to one of the servers you are logged into.

#Setting up Heroku
Create an app on Heroku: https://devcenter.heroku.com/articles/getting-started-with-nodejs#introduction

Install Heroku Redis on your app: https://elements.heroku.com/addons/heroku-redis 

# Running locally
Install the Heroku CLI: https://devcenter.heroku.com/articles/getting-started-with-nodejs#set-up

Create an `.env` file (see `example.env` for an example) and plug in your bot's token and client ID.

Check your Heroku app's config vars by running `heroku config`. Copy the REDIS_URL to your .env file.

Run `heroku local web` to start the bot up locally.

#Running on Heroku
Set up your Heroku config vars, either by calling `heroku config:set <ENTER_CONFIG_VAR>=<ENTER VALUE>` or via the Heroku app's settings tab. This likely should be a different bot's credentials to avoid having your local and prod
bots handling the same traffic.

To view production logs, run `heroku logs --tail`