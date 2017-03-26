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

# Running locally
Make sure you've installed the Heroku CLI: https://devcenter.heroku.com/articles/getting-started-with-nodejs#set-up

Then create an `.env` file (see `example.env` for an example) and plug in your bot's token and client ID.

Then run `heroku local web` to start the bot up locally.

#Running on Heroku
Set up your Heroku config vars, either by calling `heroku config:set <ENTER_CONFIG_VAR>=<ENTER VALUE>` for each
of the config vars defined in your `.env` file or via the Heroku app's settings tab.

Set up a Heroku application: https://devcenter.heroku.com/articles/getting-started-with-nodejs#deploy-the-app

Then run `heroku open`

To view logs, run `heroku logs --tail`

#Update bot
Commit changes to git, then run `git push heroku master`