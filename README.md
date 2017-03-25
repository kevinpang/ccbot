# ccbot
A Clash Caller bot for Discord. Based off of <a href="https://github.com/butttons/cc-bot/blob/master/cc.php">cc-bot</a>
and <a href="https://github.com/hydrabolt/discord.js/">discord.js</a>.  

# Features:
- !help => returns full list of available commands
- !say text => echos text
- !ping => bot says "pong"

# Running
Before first run you will need to create an `auth.json` file. A bot token or the email and password for a discord account are required. The other credentials are not required for the bot to run, but highly recommended as commands that depend on them will malfunction. See `auth.json.example`.

To start the bot just run
`$ npm install`
`$ npm start`