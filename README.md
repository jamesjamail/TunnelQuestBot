# TunnelQuestBot

**TunnelQuestBot is an EverQuest auction watcher for Project1999 Servers
interfaced via Discord.**

#### SUMMARY

TunnelQuestBot allows Discord users to add watches for in game items
items on Project 1999 Everquest Servers. When an item auction in game meets
the specified minimum price, TunnelQuestBot notifies the user.

> "TunnelQuestBot takes the chore out of trading items." - James Jamail (TunnelQuestBot creator)

> "This looks a lot like the bot I was going to make. I guess I'll make a PR..." - rm_you (Star contributor)

#### GETTING STARTED

0. Join the TunnelQuest Discord Server [here](https://discord.gg/6XwXttJ).
1. Send `!help` as a direct message to TunnelQuestBot or a message in the
   `#public_command_space` channel. 
2. Set up watches for items you want to buy, then sit back and relax!
---

# TECHNICAL DOCUMENTATION

## Dependencies

### Required

+ Node v18.x

+ PostgreSQL 

### Optional

+ Redis

---

## Database And Caching Setup

You will need a db to get started. This project uses PostgreSQL. See latest schema files in schema_files directory. Once PostgreSQL is installed, run pgAdmin4 and execute the import.

Redis running locally is an optional dependency.
   + If Redis is not installed, you will see `ECONNREFUSED 127.0.0.1:6379` in your console.

---

## Discord Application Creation
You will need either an already existing application or you'll need to create a new application in the [Discord Developer Portal](https://discord.com/developers/applications).

>1. Navigate to [Discord Developer Portal](https://discord.com/developers/applications).
>2. Login or create a new account.
>3. Create a new application called TunnelQuestBot.
>4. Click your application and navigate to `Bot` on the navigation menu.
<span id="step5">
>5. Reset your token and copy it. You will need this later.
</span>

---

<span name="dss"></span>
## Discord Server Setup
You will need your own Discord Server with several channels already created before running the bot. The names do not matter, but this is what one dev used.

### General Channels
>+ General
>+ error_log
>+ command
>+ feedback

### Green Server Channels 
>+ stream_channel_green
>+ stream_channel_classic_green

### Blue Server Channels
>+ stream_channel_blue 
>+ stream_channel_classic_blue

---

## Settings File Creation
>1. Create a copy of `src/example.settings.json` in `src` called `settings.json`
>2. Open `src/settings.json`
>3. Update `log_file_path` to your character's path. 
>     + This file must exist for both the blue and green server for the bot to run.
>4. Update `token` with the value you copied [here](#step5)
>     + You can reset your token in the [Discord Developer Portal](https://discord.com/developers/applications). 
>5. You will need to get the tokens for the channels you created during [Discord Server Setup](#dss)
>     + See [Retrieving Discord Guild And Channel Tokens](#rdgact)
>6. Replace all of the values in the `discord` object with the ids retrieved from step 5.
>7. Replace all of the values in `servers` object with the ids for `stream_channel` and `stream_channel_classic` for both `green` and `blue` servers with the ids retrieved from step 5.

You should be ready to install dependencies and start the bot.

## Running The Bot

>1. Run `npm i` to install modules 
>2. Run `npm run dev` to get started.

---

# Project Structure

Command files are stored in src/client/commands directory. See example command for details. These commands are parsed and registered in client.js. Note that global commands can take up to 24 hours to sync on Discord's end, so guild commands are used for local dev.

Eventually, I'd like to containerize this <3
