## Containerized Local Development

Set up and run everything (database and app) nicely isolated in local
docker containers with just one command!

### How?
* Install Docker Desktop with WSL2 via this guide:
https://docs.docker.com/desktop/wsl/
  * Or, install docker and docker-compose on your platform of choice.
* Copy `.env.sample` to `.env` and configure your `TOKEN`/`CLIENT_ID` and log file paths.
* Run `docker-compose up --build`
  * Re-run this command any time you make code or config changes.
  * If you'd prefer not to run everquest clients for the log files, you can tell the app to fake them: `$env:FAKE_LOGS='true'; docker-compose up --build`. This runs `npm run dev` in the container, which runs logFaker.ts in paralell

## Running In Production

TODO: update this to reflect upstream image workflow once merged and set up.

Running `docker-compose up --build -d` defaults to production.

## Discord Template

This repo is based on the following template for discordjs:

https://github.com/MericcaN41/discordjs-v14-template-ts

This was done with that hope that any breaking changes from discordjs can be cross referenced and implemented.

## Linter Config  & TypeScript Config

This project enforces eslint rules in a pre-commit hook.  This can be overridden with the --no-verify flag, but should be avoided.  Rather, if you have a good reason for disabling any of the eslint rules, feel free to do so.

Similarily, if there are any TypeScript config you feel should be changed, please do so.  The goal of TypeScript is to aid development by enforcing type safety.  If you are confident in your approach and TypeScript is being difficult, it is preferrable to cast the type with `as [TYPE]` rather than make your code hard to read.

## Extensibility

Special care was taken to handle dynamic server name in the Server Enum in prisma schema.  This bot was developed for Project 1999, which uses Blue, Green, and Red for server names.  Other EverQuest server may use different names, in which case this enum can be modified without compile errors.  ENVs that reference a particular server are structured to be read dynamically based on the Server enum.

## Repo Organization

`/` - Directory root containing config files and directories created thru automated processes such as `/node_modules` and `/build`.

`/src/lib/` - the core of the repo that's specific to this project's purpose

`/src/lib/commands/` - contains files related to commands, like command options and autocomplete, as well as a `/slashCommands` folder for the actual commands themselves.

`/src/lib/content/` - contains files related to messages, like text copy, buttons, and Discord Messages.

`/src/lib/gameData` - contains files related to data from EverQuest.

`/src/lib/parser/` - contains files related to reading EverQuest log files, parsing the auction message, tracking watched items, and faking logs.

`/src/prisma/dbExecutors` - contains all functions that interact with the databae, separated by table.

## Auction Parser Functionality

The most complex aspect of the repo lies in parsing the auction contents from log files.  Here is a biref explanation of the functionality:

* a new line is read from the log file
* we check if the log line is from an auction channel
* if it is, we keep track of the timestamp, player, and begin parsing the player's message for auction data (we assume the auction message does not exist in our cache yet)
* we pre-process the auction message, removing common aconyms like "PST" and "OBO", and replacing "WTT" with "WTS", and cast the entire message to uppercase.
* we begin iterating over each word in the auction processed auction message
* we check if the first word is declaring the type of auction, like "WTB"/"Buying" or "WTS"/"Selling".
* if it is an auction type, update the auction type and continue on to the next word
* if it's not an auction type, use the search trie to test the string against known items.  The search trie will compare the word and the words that follow against all in-game items to return the longest match found
* if a match is found, we then attempt to parse any price that might follow, add the data to the corresponding results, and continue on to the next word
* if a match is not found, we add the word to the unknown item string and continue on.
* once the auction message has been completed parsed, we hash the message and use it as a key to store the parsed data to save time for future look ups.


## Handling Substrings

In earlier versions of this bot, a bug existed where users watching `Black Sapphire` would get false positive hits on items like `Black Sapphire Necklace`.  However, sometimes it makes sense to trigger a watch notification even if the watched "item" is part of a longer word.  For example, a user watching "Banded" expects to trigger watch notifications on "Banded Boots" as well as "Various Banded Armor Pieces".

To alleviate this issue, we check if each watched item is a known item from the game or not, and store them separately in state.  When checking auction data for matches, we handle matches differently for each case.  Known items only trigger watch notification if that exact item is listed (no substrings).  For example, "Black Sapphire" does not trigger on "Black Sapphire Necklace.  Unknown items trigger if any item auction contains the watched item (substrings).  This all happens behinds the scenes from a user perspective.
