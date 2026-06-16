require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  REST,
  Routes,
  ActivityType,
} = require('discord.js');
const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Client setup
// ---------------------------------------------------------------------------

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,       // needed to fetch members for guild lookup
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
  ],
  // Partials are required to receive DM messages and reactions
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.Reaction,
  ],
});

client.commands = new Collection();

// ---------------------------------------------------------------------------
// Load commands
// ---------------------------------------------------------------------------

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    console.log(`[commands] Loaded: ${command.data.name}`);
  }
}

// ---------------------------------------------------------------------------
// Load events
// ---------------------------------------------------------------------------

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));

for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
  console.log(`[events] Loaded: ${event.name}`);
}

// ---------------------------------------------------------------------------
// Ready — register slash commands
// ---------------------------------------------------------------------------

client.once('ready', async () => {
  console.log(`[bot] Logged in as ${client.user.tag}`);

  const commands = client.commands.map(cmd => cmd.data.toJSON());
  const rest     = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.DISCORD_BOT_ID, process.env.GUILD_ID),
        { body: commands },
      );
      console.log(`[commands] Registered ${commands.length} guild command(s) to guild ${process.env.GUILD_ID}`);
    } else {
      await rest.put(
        Routes.applicationCommands(process.env.DISCORD_BOT_ID),
        { body: commands },
      );
      console.log(`[commands] Registered ${commands.length} global command(s)`);
    }
  } catch (error) {
    console.error('[commands] Failed to register commands:', error);
  }

  client.user.setActivity('our DMs', { type: ActivityType.Watching });
  console.log('[bot] Status set to "Watching our DMs"');
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

client.login(process.env.DISCORD_TOKEN);

