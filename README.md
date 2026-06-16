# Tickets — DM-based Discord Support Bot

A Discord support ticket bot where users open tickets by DMing the bot. Each ticket becomes a thread in a designated staff channel, with full bidirectional message forwarding between the user's DM and the thread.

---

## How it works

1. **User DMs the bot** → a thread is created in the configured staff channel
2. **User replies to the DM** → message is forwarded into the thread
3. **Staff replies in the thread** → message is forwarded back to the user's DM
4. Staff can **claim**, **close**, and set **priority** on threads via slash commands

---

## Setup

### Environment variables

| Variable           | Description                                              |
|--------------------|----------------------------------------------------------|
| `DISCORD_TOKEN`    | Your bot's token                                         |
| `DISCORD_BOT_ID`   | Your bot's application/client ID                         |
| `GUILD_ID`         | *(optional)* Guild ID for instant guild-scoped commands  |

### Required bot permissions

- **Send Messages**
- **Create Public Threads**
- **Send Messages in Threads**
- **Manage Threads** (for renaming/archiving)
- **Read Message History**
- **Add Reactions**

### Required privileged intents (Discord Developer Portal)

- **Server Members Intent** — needed to look up which guild a DM user belongs to
- **Message Content Intent** — needed to read message content

### First-time configuration

Run `/ticket setup #channel` in your server to point the bot at a staff channel. The bot will create one thread per ticket in that channel.

---

## Commands

| Command              | Permission       | Description                                              |
|----------------------|------------------|----------------------------------------------------------|
| `/ticket setup`      | Manage Server    | Set the staff channel for ticket threads                 |
| `/ticket dashboard`  | Manage Server    | View config and open ticket stats                        |
| `/claim`             | Manage Messages  | Claim the current ticket thread                          |
| `/close [reason]`    | Manage Messages  | Close and archive the current ticket thread              |
| `/priority <level>`  | Manage Messages  | Set priority: `none`, `low`, `medium`, `high`            |

---

## Data storage

All data is persisted as JSON files in the `data/` directory:

| File                      | Contents                                      |
|---------------------------|-----------------------------------------------|
| `data/tickets.json`       | All ticket records                            |
| `data/threadToTicket.json`| Thread ID → ticket ID lookup                  |
| `data/userToTicket.json`  | User ID → open ticket ID lookup               |
| `data/guildConfigs.json`  | Per-guild configuration (staff channel, etc.) |

---

## Running

```bash
npm install
npm start
```
