# Tickets — Discord Ticket Bot

A self-hosted Discord ticket management bot built with [discord.js v14](https://discord.js.org/). Supports slash commands, per-guild configuration, an interactive dashboard, and SQLite-backed persistence.

## Features

- `/ticket setup` — deploy a ticket panel to any channel with a single command
- `/ticket dashboard` — interactive embed to manage all ticket settings live
- `/claim` — assign a ticket to yourself
- `/close [reason]` — close a ticket with an optional reason
- `/priority <level>` — set ticket priority (Urgent / High / Medium / Low / None)
- Automatic DM to ticket creator on close (configurable)
- Per-guild max-tickets-per-user limit
- Configurable staff role, open/closed categories, logs channel, and transcript channel

## Requirements

- Node.js >= 18
- A Discord bot application with the **bot** and **applications.commands** scopes

## Setup

### 1. Clone and install

```bash
git clone https://github.com/Vyxz1s3/Tickets.git
cd Tickets
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in:

| Variable         | Required | Description                                                  |
|------------------|----------|--------------------------------------------------------------|
| `DISCORD_TOKEN`  | Yes      | Bot token from the Discord Developer Portal                  |
| `DISCORD_BOT_ID` | Yes      | Application (client) ID                                      |
| `GUILD_ID`       | No       | Guild ID for instant command registration during development |
| `DB_PATH`        | No       | Path to the SQLite file (default: `./data/bot.sqlite`)       |
| `LOG_LEVEL`      | No       | `debug` / `info` / `warn` / `error` (default: `info`)       |

### 3. Start the bot

```bash
npm start
```

On first start the bot will:
1. Load all commands from `commands/`
2. Load all events from `events/`
3. Register slash commands (guild-scoped if `GUILD_ID` is set, otherwise global)
4. Log in to Discord

### 4. Invite the bot

Generate an invite URL in the Discord Developer Portal with the following scopes and permissions:

- **Scopes:** `bot`, `applications.commands`
- **Bot permissions:** `Manage Channels`, `Send Messages`, `Read Message History`, `Embed Links`

## Project Structure

```
.
├── index.js                  # Entry point — loads commands, events, and logs in
├── package.json
├── .env.example
│
├── commands/                 # Slash command modules
│   ├── claim.js
│   ├── close.js
│   ├── priority.js
│   └── ticket.js
│
├── events/                   # Discord.js event handlers
│   ├── ready.js
│   └── interactionCreate.js  # Routes commands + handles create_ticket button
│
├── modules/                  # Sub-modules used by commands
│   └── ticket_dashboard.js   # Interactive ticket configuration dashboard
│
├── services/                 # Business logic
│   ├── ticket.js             # Ticket CRUD (create, claim, close, priority)
│   └── guildConfig.js        # Per-guild configuration helpers
│
├── utils/                    # Shared utilities
│   ├── database.js           # Keyv/SQLite initialisation and key helpers
│   ├── embeds.js             # Embed factory helpers
│   ├── errorHandler.js       # TitanBotError class + interaction error handler
│   ├── interactionHelper.js  # Safe defer/reply/followUp wrappers
│   ├── logger.js             # Structured JSON logger
│   └── ticketPermissions.js  # Resolves staff/creator permissions for a ticket
│
└── config/
    └── bot.js                # Colour palette and bot-wide constants
```

## Deploying on Railway

1. Push this repository to GitHub.
2. Create a new Railway project and connect the repo.
3. Add the required environment variables (`DISCORD_TOKEN`, `DISCORD_BOT_ID`) in the Railway dashboard.
4. Railway will detect `package.json` and run `npm start` automatically.

## License

MIT
