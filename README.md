# TunnelQuestBot

**TunnelQuestBot is an EverQuest auction watcher for Project1999 Servers
interfaced via Discord.**

#### SUMMARY
TunnelQuestBot allows Discord users to add watches for in game items
items on Project 1999 Everquest Servers.  When an item auction in game meets
the specified minimum price, TunnelQuestBot notifies the user.

> "TunnelQuestBot takes the chore out of trading items." - James Jamail (TunnelQuestBot creator)

> "This looks a lot like the bot I was going to make. I guess I'll make a PR..." - rm_you (Star contributor)
 

#### GETTING STARTED

0. Join the TunnelQuest Discord Server [here](https://discord.gg/6XwXttJ).
0. Send `!help` as a direct message to TunnelQuestBot or a message in the
   `#public_command_space` channel.
0. Set up watches for items you want to buy, then sit back and relax!

##### TECHNICAL DOCUMENTATION

# Requirements

Node v16

You will need a db to get started.  This project uses PostgreSQL. See latest schema files in schema_files directory.  Once PostgreSQL is installed, run pgAdmin4 and execute the import.

See the example settings file in src/settings directory, and create your own based on your discord server and local log file path.

Run `npm i` to install modules and then `npm run dev` to get started.

Command files are stored in src/client/commands directory.  See example command for details.  These commands are parsed and registered in client.js.  Note that global commands can take up to 24 hours to sync on Discord's end, so guild commands are used for local dev.

Eventually, I'd like to containerize this <3