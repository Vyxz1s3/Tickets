import 'dotenv/config';
import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { join, dirname } from 'path';
import { logger } from './utils/logger.js';
import { initDb } from './utils/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Client Setup ─────────────────────────────────────────────────────────────

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
    ],
});

client.commands = new Collection();

// ─── Database ─────────────────────────────────────────────────────────────────

client.db = initDb();

// ─── Load Commands ────────────────────────────────────────────────────────────

async function loadCommands() {
    const commandsPath = join(__dirname, 'commands');
    const commandFiles = readdirSync(commandsPath).filter(f => f.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = pathToFileURL(join(commandsPath, file)).href;
        const command = (await import(filePath)).default;
        if (command?.data && command?.execute) {
            client.commands.set(command.data.name, command);
            logger.info(`Loaded command: ${command.data.name}`);
        } else {
            logger.warn(`Skipping ${file} — missing data or execute export`);
        }
    }
}

// ─── Load Events ─────────────────────────────────────────────────────────────

async function loadEvents() {
    const eventsPath = join(__dirname, 'events');
    const eventFiles = readdirSync(eventsPath).filter(f => f.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = pathToFileURL(join(eventsPath, file)).href;
        const event = (await import(filePath)).default;
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
        logger.info(`Loaded event: ${event.name}`);
    }
}

// ─── Register Slash Commands ──────────────────────────────────────────────────

async function registerCommands() {
    const token = process.env.DISCORD_TOKEN;
    const clientId = process.env.DISCORD_BOT_ID;
    const guildId = process.env.GUILD_ID;

    if (!token || !clientId) {
        logger.warn('DISCORD_TOKEN or DISCORD_BOT_ID not set — skipping command registration');
        return;
    }

    const commands = [...client.commands.values()].map(cmd => cmd.data.toJSON());
    const rest = new REST().setToken(token);

    try {
        if (guildId) {
            // Guild-scoped registration (instant, good for development)
            await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
            logger.info(`Registered ${commands.length} guild commands to ${guildId}`);
        } else {
            // Global registration (up to 1 hour propagation)
            await rest.put(Routes.applicationCommands(clientId), { body: commands });
            logger.info(`Registered ${commands.length} global commands`);
        }
    } catch (error) {
        logger.error('Failed to register slash commands', { error: error.message });
    }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function main() {
    await loadCommands();
    await loadEvents();
    await registerCommands();

    const token = process.env.DISCORD_TOKEN;
    if (!token) {
        logger.error('DISCORD_TOKEN is not set. Cannot start the bot.');
        process.exit(1);
    }

    await client.login(token);
}

main().catch(err => {
    logger.error('Fatal error during startup', { error: err.message, stack: err.stack });
    process.exit(1);
});
