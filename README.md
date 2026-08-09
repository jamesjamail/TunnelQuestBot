## Local Development

You need Docker and Node 24 (`.nvmrc` pins it). You do **not** need EverQuest —
the dev loop generates fake auction lines.

```sh
npm install
cp .env.example .env      # then fill in the Discord section
npm run dev:deps          # postgres + redis in docker
npm run dev               # the bot, on your host, reloading on save
```

`npm run dev` runs the bot on your machine while its dependencies stay in
containers. A save recompiles and restarts in about a second, rather than
rebuilding an image. It sets `DATABASE_URL`, `REDIS_URL` and `FAKE_LOGS` for
you, so the only thing `.env` needs is your Discord configuration.

Stop the dependencies with `npm run dev:deps:down`.

### Getting the Discord configuration

You need your own bot application — never develop against the production token.

1. Create an app at https://discord.com/developers/applications, add a bot, and
   copy the token into `TOKEN` and the Application ID into `CLIENT_ID`.
2. Invite it to a server you control, with the **Manage Channels** permission.
3. Run `npm run setup -- <guild-id>`.

`setup` creates the nine channels the bot needs and writes their ids into
`.env`. To get the guild id, enable Developer Mode (Settings → Advanced), then
right-click the **server** — not a channel — and pick "Copy Server ID".

```sh
npm run setup -- 123456789012345678 --dry-run   # show the plan, change nothing
npm run setup -- 123456789012345678             # create, after confirming
npm run setup -- 123456789012345678 --force     # re-resolve ids already in .env
```

It shows what it will create and asks before touching your server, adopts
channels that already exist by name rather than duplicating them, and leaves
ids already present in `.env` alone. Re-running after a partial failure is
safe. It uses the REST API only — no gateway connection, no slash-command
registration — so it cannot disturb a bot that is already live.

The list of servers comes from the `Server` enum in `schema.prisma`, so adding
one there is all that is needed for `setup` to provision its channels.

If anything is missing or malformed, `npm run doctor` reports every problem at
once and tells you what it expected. The bot performs the same check at startup
and refuses to boot on a bad `.env`.

### Running the whole stack in containers

Closer to production, and the way to run against real EverQuest logs. Slower to
iterate on, because every change needs a rebuild.

```sh
docker compose up --build
```

Set `LOG_SOURCE_PATH` and the `SERVERS_*_LOG_FILE` names in `.env` first, or set
`FAKE_LOGS=true` to run the container stack without a game client.

## Running In Production

### Updating to a new version

Two commands, from the repo directory:

```sh
git pull
docker compose up -d --build
```

That is the whole update. Database migrations are applied automatically when the
bot container starts, so there is never a separate migration step to remember.
Applying migrations twice is harmless, so re-running the command is always safe.

Compose waits for Postgres and Redis to report healthy before it starts the bot,
so a cold start on a brand new machine works the same way as a restart.

### When something goes wrong

Check the logs:

```sh
docker compose logs -f tunnelquestbot
```

Lines prefixed with `[entrypoint]` come from the startup sequence:

* `database not reachable yet (attempt N/30)` — normal on a cold start; the
  container waits for Postgres and continues on its own.
* `database schema is up to date` — migrations finished and the bot is starting.
* `ERROR: migrations could not be applied.` — the bot deliberately does **not**
  start, because running against a schema that disagrees with the code would
  corrupt data. This needs a developer; the Prisma output just above the error
  explains what it found.

To confirm the running version, use the bot's `/version` command.

## Testing

```sh
npm test              # unit tests
npm run test:watch    # unit tests, watching
npm run test:coverage # unit tests + coverage thresholds (what CI runs)
npm run test:integration   # needs Docker running
npm run test:all      # both suites
npm run check         # lint + typecheck + unit tests, i.e. everything CI gates on
```

**`test:integration` requires Docker.** It starts real Postgres and Redis via
testcontainers, applies migrations, and truncates between tests. Without Docker
running it fails on a container-start timeout rather than anything informative,
so start Docker first. The unit suite has no such requirement.

Most tests are unit tests over logic pulled out of the Discord handlers.
`src/test/mocks/` holds the discord.js, Prisma and Redis fakes, `src/test/env.ts`
the environment both suites share, and `src/test/factories.ts` the object
builders.

## Editor setup

VS Code will offer the Biome extension via `.vscode/extensions.json`, and
`.vscode/settings.json` turns on format-on-save with it. `.editorconfig` covers
editors that read it. Nothing here is required — CI checks the same rules.

`.debug/` holds shared JetBrains run configurations for the containerised
workflow: **Run App** brings up `docker-compose.yml --build`, and **Remote Node
Debug** attaches to the inspector on port 9229. They live outside the gitignored
`.idea/` on purpose so they can be checked in.

## Discord Template

This repo is based on the following template for discordjs:

https://github.com/MericcaN41/discordjs-v14-template-ts

This was done with that hope that any breaking changes from discordjs can be cross referenced and implemented.

## Linting, Formatting & TypeScript

[Biome](https://biomejs.dev) handles both linting and formatting, configured in
`biome.json`. Install the Biome editor extension and you get format-on-save
matching CI; VS Code will offer it automatically via `.vscode/extensions.json`.

```sh
npm run lint       # check (fails on warnings)
npm run lint:fix   # check and apply fixes
npm run typecheck  # tsc --noEmit
```

A pre-commit hook formats and lints staged files. It can be skipped with
`--no-verify`, but CI runs the same checks, so that only defers the failure.

If a rule is wrong for a specific line, suppress it with a
`// biome-ignore lint/<group>/<rule>: <reason>` comment (single line — a wrapped
comment silently stops working) rather than turning it off repo-wide. If a rule
is wrong everywhere, change `biome.json`.

Note that a malformed `biome.json` does **not** fail the run: Biome falls back to
its defaults and reports success. `test/config.test.ts` guards against this.

For TypeScript config, change it if you have reason to. The goal is to aid
development by enforcing type safety — if you are confident in your approach and
TypeScript is being difficult, `as [TYPE]` is preferable to code that is hard to
read.

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

TODO: update the overview below to reflect new aho corasick parser

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
