# Contributing

Thanks for helping out. This is a Discord bot that watches Project 1999 auction
channels and notifies people when items they care about are being sold.

## Getting set up

You need Docker and Node 24 (`.nvmrc` pins it). You do **not** need EverQuest —
the dev loop generates fake auction lines.

```sh
npm install
cp .env.example .env      # then fill in the Discord section
npm run setup -- <guild-id>   # creates the channels, writes their ids into .env
npm run dev:deps          # postgres + redis in docker
npm run dev               # migrates, then runs the bot on your host, reloading on save
```

`npm run doctor` reports anything missing or malformed in `.env`, all at once.
The bot runs the same check at startup and refuses to boot on a bad config.

**Use your own bot application, never the production token.** Create one at
<https://discord.com/developers/applications>, invite it to a server you control
with the *Manage Channels* permission, and point `npm run setup` at that server.

Full detail, including the container-based workflow, is in the [README](README.md).

## Before you open a PR

```sh
npm run check   # lint + typecheck + unit tests — the same gates CI runs
```

`npm run test:integration` needs Docker running; it starts real Postgres and
Redis via testcontainers. CI runs it too, so it's worth running locally if you
touched anything under `src/prisma/`.

A pre-commit hook formats and lints staged files. You can skip it with
`--no-verify`, but CI runs the same checks, so that only defers the failure.

## How the code is laid out

| Path | What lives there |
| --- | --- |
| `src/lib/commands/slashCommands/` | one file per slash command |
| `src/lib/commands/autocomplete/` | autocomplete handlers |
| `src/lib/content/` | message copy, embeds, buttons |
| `src/lib/parser/` | log tailing and auction parsing — the interesting part |
| `src/lib/gameData/` | scraped EverQuest item and spell data |
| `src/prisma/dbExecutors/` | database access, one file per table |
| `src/config.ts` | every environment variable, validated at startup |

## Adding a slash command

1. Create `src/lib/commands/slashCommands/<name>.ts`. The loader picks up every
   file in that directory automatically — nothing to register by hand. Files
   starting with `_` are skipped.

2. Export a default `SlashCommand`. The smallest useful shape:

   ```ts
   import { MessageFlags, SlashCommandBuilder } from 'discord.js';
   import type { SlashCommand } from '../../../types';
   import { gracefullyHandleError } from '../../helpers/errors';

   const command: SlashCommand = {
       command: new SlashCommandBuilder()
           .setName('ping')
           .setDescription('check the bot is alive'),
       execute: async (interaction) => {
           try {
               await interaction.reply({
                   content: 'pong',
                   flags: MessageFlags.Ephemeral,
               });
           } catch (error) {
               await gracefullyHandleError(error, interaction, command);
           }
       },
       cooldown: 3,
   };

   export default command;
   ```

3. Wrap the body in `try`/`catch` and route failures through
   `gracefullyHandleError`. An unhandled rejection in a command handler takes
   the process down; the helper reports to the error channel and keeps the bot
   up. `commandContract.test.ts` checks every command does this.

4. Use `flags: MessageFlags.Ephemeral`, not the deprecated `ephemeral: true`.

5. Reusable option builders live in `commandOptions.ts`; read arguments with
   `getInteractionArgs`. User-visible strings belong in `messageCopy.ts`, not
   inline.

6. Add a test next to it. Copy the shape of an existing one — the mocks in
   `src/test/mocks/` and builders in `src/test/factories.ts` do most of the work.

Commands are registered globally, which can take up to an hour to propagate.
For faster iteration, register against your test guild instead.

## Touching the parser

`src/lib/parser/` is the most subtle code here, and the substring rules are
easy to break: a watch on `Black Sapphire` must **not** fire on
`Black Sapphire Necklace`, but a watch on `Banded` **must** fire on
`Banded Boots`. The README explains why.

If you change parsing behaviour, add a case to `parser.test.ts` or
`unknownItems.test.ts` first. A failing test that captures the auction line you
saw is a genuinely useful PR on its own, even without a fix.

## Style

Biome handles formatting and linting; don't hand-format. If a rule is wrong for
one line, suppress it with a single-line
`// biome-ignore lint/<group>/<rule>: <reason>` comment rather than turning it
off repo-wide.

Write comments that explain *why*, not *what* — the code already says what.

## Reporting bugs

Include the auction line verbatim if it's a parser issue. That single line is
usually enough to write a failing test from.
