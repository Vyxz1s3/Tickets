import { getGuildConfigKey } from '../utils/database.js';
import { logger } from '../utils/logger.js';

/**
 * Default guild configuration applied when no config exists yet.
 */
const DEFAULT_CONFIG = {
    ticketPanelChannelId: null,
    ticketPanelMessage: 'Click the button below to create a support ticket.',
    ticketButtonLabel: 'Create Ticket',
    ticketCategoryId: null,
    ticketClosedCategoryId: null,
    ticketStaffRoleId: null,
    ticketLogsChannelId: null,
    ticketTranscriptChannelId: null,
    maxTicketsPerUser: 3,
    dmOnClose: true,
    ticketCounter: 0,
};

/**
 * Retrieves the guild configuration from the database, merging in defaults for
 * any missing keys. Creates the record if it does not exist.
 *
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @returns {Promise<object>}
 */
export async function getGuildConfig(client, guildId) {
    if (!client.db) {
        logger.warn('getGuildConfig called but client.db is not initialised');
        return { ...DEFAULT_CONFIG };
    }

    const key = getGuildConfigKey(guildId);
    const stored = await client.db.get(key);

    if (!stored) {
        const fresh = { ...DEFAULT_CONFIG };
        await client.db.set(key, fresh);
        return fresh;
    }

    // Merge defaults so new config keys are always present
    return { ...DEFAULT_CONFIG, ...stored };
}

// Re-export the key helper so ticket_dashboard.js can import it from here
export { getGuildConfigKey };
