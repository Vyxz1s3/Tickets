import Keyv from 'keyv';
import KeyvSqlite from '@keyv/sqlite';
import { logger } from './logger.js';

const DB_PATH = process.env.DB_PATH || './data/bot.sqlite';

/**
 * Initialises and returns a Keyv instance backed by SQLite.
 * The database file is created automatically if it does not exist.
 */
export function initDb() {
    const store = new KeyvSqlite(`sqlite://${DB_PATH}`);
    const db = new Keyv({ store });

    db.on('error', err => logger.error('Database error', { error: err.message }));

    logger.info('Database initialised', { path: DB_PATH });
    return db;
}

// ─── Key Helpers ──────────────────────────────────────────────────────────────

/**
 * Returns the database key used to store per-guild configuration.
 * @param {string} guildId
 */
export function getGuildConfigKey(guildId) {
    return `guild_config:${guildId}`;
}

/**
 * Returns the database key used to store a single ticket record.
 * @param {string} guildId
 * @param {string} channelId
 */
export function getTicketKey(guildId, channelId) {
    return `ticket:${guildId}:${channelId}`;
}

/**
 * Returns the prefix used for all ticket keys in a guild, useful for
 * scanning open tickets.
 * @param {string} guildId
 */
export function getTicketKeyPrefix(guildId) {
    return `ticket:${guildId}:`;
}
