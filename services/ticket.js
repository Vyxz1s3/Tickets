import { ChannelType, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getColor } from '../config/bot.js';
import { getTicketKey, getTicketKeyPrefix } from '../utils/database.js';
import { logger } from '../utils/logger.js';

// ─── Ticket Record Helpers ────────────────────────────────────────────────────

/**
 * Retrieves the ticket record for a given channel, or null if none exists.
 *
 * @param {string} guildId
 * @param {string} channelId
 * @param {import('keyv').default} db
 */
export async function getTicketByChannel(guildId, channelId, db) {
    if (!db) return null;
    return (await db.get(getTicketKey(guildId, channelId))) ?? null;
}

/**
 * Counts how many open tickets a user has in a guild.
 *
 * @param {string} guildId
 * @param {string} userId
 * @param {import('keyv').default} db
 */
export async function getUserTicketCount(guildId, userId, db) {
    if (!db) return 0;
    // Keyv doesn't support prefix scans natively; we store a per-user counter
    const key = `ticket_count:${guildId}:${userId}`;
    return (await db.get(key)) ?? 0;
}

// ─── Ticket Lifecycle ─────────────────────────────────────────────────────────

/**
 * Claims a ticket channel, assigning it to the given user.
 * Renames the channel to include the claimer's username.
 *
 * @param {import('discord.js').TextChannel} channel
 * @param {import('discord.js').User} user
 * @param {import('keyv').default} db
 * @returns {{ success: boolean, error?: string }}
 */
export async function claimTicket(channel, user, db) {
    try {
        const guildId = channel.guild.id;
        const ticketData = await getTicketByChannel(guildId, channel.id, db);

        if (!ticketData) {
            return { success: false, error: 'This channel is not a registered ticket.' };
        }

        if (ticketData.claimedBy) {
            return {
                success: false,
                error: `This ticket has already been claimed by <@${ticketData.claimedBy}>.`,
            };
        }

        ticketData.claimedBy = user.id;
        ticketData.claimedAt = new Date().toISOString();
        await db.set(getTicketKey(guildId, channel.id), ticketData);

        // Rename channel to reflect claimer
        const baseName = channel.name.replace(/^ticket-/, '');
        await channel.setName(`claimed-${baseName}`).catch(() => {});

        // Post a notice in the channel
        const embed = new EmbedBuilder()
            .setTitle('🎫 Ticket Claimed')
            .setDescription(`This ticket has been claimed by ${user}.`)
            .setColor(getColor('info'))
            .setTimestamp();
        await channel.send({ embeds: [embed] }).catch(() => {});

        logger.info('Ticket claimed', { channelId: channel.id, guildId, claimedBy: user.id });
        return { success: true };
    } catch (error) {
        logger.error('claimTicket error', { error: error.message });
        return { success: false, error: 'An internal error occurred while claiming the ticket.' };
    }
}

/**
 * Closes a ticket channel by moving it to the closed category (if configured)
 * and locking it.
 *
 * @param {import('discord.js').TextChannel} channel
 * @param {import('discord.js').User} user
 * @param {string} reason
 * @param {import('keyv').default} db
 * @param {object} [guildConfig]
 * @returns {{ success: boolean, error?: string }}
 */
export async function closeTicket(channel, user, reason, db, guildConfig) {
    try {
        const guildId = channel.guild.id;
        const ticketData = await getTicketByChannel(guildId, channel.id, db);

        if (!ticketData) {
            return { success: false, error: 'This channel is not a registered ticket.' };
        }

        ticketData.status = 'closed';
        ticketData.closedBy = user.id;
        ticketData.closedAt = new Date().toISOString();
        ticketData.closeReason = reason;
        await db.set(getTicketKey(guildId, channel.id), ticketData);

        // Post a closure notice
        const embed = new EmbedBuilder()
            .setTitle('🔒 Ticket Closed')
            .setDescription(`This ticket was closed by ${user}.\n**Reason:** ${reason}`)
            .setColor(getColor('warning'))
            .setTimestamp();
        await channel.send({ embeds: [embed] }).catch(() => {});

        // Move to closed category if configured
        const closedCategoryId = guildConfig?.ticketClosedCategoryId;
        if (closedCategoryId) {
            await channel.setParent(closedCategoryId, { lockPermissions: false }).catch(() => {});
        }

        // Lock the channel for the ticket creator
        if (ticketData.creatorId) {
            await channel.permissionOverwrites
                .edit(ticketData.creatorId, { SendMessages: false })
                .catch(() => {});
        }

        // DM the creator if configured
        if (guildConfig?.dmOnClose !== false && ticketData.creatorId) {
            try {
                const creator = await channel.guild.members.fetch(ticketData.creatorId);
                const dmEmbed = new EmbedBuilder()
                    .setTitle('Your ticket has been closed')
                    .setDescription(
                        `Your ticket **${channel.name}** in **${channel.guild.name}** was closed.\n**Reason:** ${reason}`,
                    )
                    .setColor(getColor('info'))
                    .setTimestamp();
                await creator.send({ embeds: [dmEmbed] }).catch(() => {});
            } catch {
                // User may have DMs disabled — silently ignore
            }
        }

        logger.info('Ticket closed', { channelId: channel.id, guildId, closedBy: user.id, reason });
        return { success: true };
    } catch (error) {
        logger.error('closeTicket error', { error: error.message });
        return { success: false, error: 'An internal error occurred while closing the ticket.' };
    }
}

/**
 * Updates the priority of a ticket channel by prepending an emoji to its name.
 *
 * @param {import('discord.js').TextChannel} channel
 * @param {string} priority  One of: urgent | high | medium | low | none
 * @param {import('discord.js').User} user
 * @param {import('keyv').default} db
 * @returns {{ success: boolean, error?: string }}
 */
export async function updateTicketPriority(channel, priority, user, db) {
    try {
        const guildId = channel.guild.id;
        const ticketData = await getTicketByChannel(guildId, channel.id, db);

        if (!ticketData) {
            return { success: false, error: 'This channel is not a registered ticket.' };
        }

        const PRIORITY_EMOJIS = {
            urgent: '🔴',
            high:   '🟠',
            medium: '🟡',
            low:    '🟢',
            none:   '',
        };

        ticketData.priority = priority;
        await db.set(getTicketKey(guildId, channel.id), ticketData);

        // Strip any existing priority emoji prefix and apply the new one
        const baseName = channel.name.replace(/^[🔴🟠🟡🟢]-/, '');
        const emoji = PRIORITY_EMOJIS[priority];
        const newName = emoji ? `${emoji}-${baseName}` : baseName;
        await channel.setName(newName).catch(() => {});

        const embed = new EmbedBuilder()
            .setTitle('🏷️ Priority Updated')
            .setDescription(
                `Ticket priority set to **${priority.toUpperCase()}** by ${user}.`,
            )
            .setColor(getColor('info'))
            .setTimestamp();
        await channel.send({ embeds: [embed] }).catch(() => {});

        logger.info('Ticket priority updated', {
            channelId: channel.id,
            guildId,
            priority,
            updatedBy: user.id,
        });
        return { success: true };
    } catch (error) {
        logger.error('updateTicketPriority error', { error: error.message });
        return { success: false, error: 'An internal error occurred while updating the priority.' };
    }
}

/**
 * Creates a new ticket channel for a user.
 *
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').User} user
 * @param {object} guildConfig
 * @param {import('keyv').default} db
 * @returns {{ success: boolean, channel?: import('discord.js').TextChannel, error?: string }}
 */
export async function createTicket(guild, user, guildConfig, db) {
    try {
        const openCount = await getUserTicketCount(guild.id, user.id, db);
        const maxTickets = guildConfig?.maxTicketsPerUser ?? 3;

        if (openCount >= maxTickets) {
            return {
                success: false,
                error: `You already have ${openCount} open ticket${openCount !== 1 ? 's' : ''}. Please close an existing ticket before opening a new one.`,
            };
        }

        const ticketNumber = (guildConfig.ticketCounter ?? 0) + 1;
        const channelName = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${ticketNumber}`;

        const permissionOverwrites = [
            {
                id: guild.id, // @everyone
                deny: [PermissionFlagsBits.ViewChannel],
            },
            {
                id: user.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                ],
            },
        ];

        if (guildConfig.ticketStaffRoleId) {
            permissionOverwrites.push({
                id: guildConfig.ticketStaffRoleId,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.ManageChannels,
                ],
            });
        }

        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: guildConfig.ticketCategoryId ?? null,
            permissionOverwrites,
            topic: `Support ticket for ${user.tag} | Ticket #${ticketNumber}`,
        });

        const ticketData = {
            channelId: channel.id,
            guildId: guild.id,
            creatorId: user.id,
            creatorTag: user.tag,
            ticketNumber,
            status: 'open',
            priority: 'none',
            claimedBy: null,
            createdAt: new Date().toISOString(),
        };

        await db.set(getTicketKey(guild.id, channel.id), ticketData);

        // Increment per-user counter
        const countKey = `ticket_count:${guild.id}:${user.id}`;
        await db.set(countKey, openCount + 1);

        // Increment guild-wide ticket counter
        guildConfig.ticketCounter = ticketNumber;
        const { getGuildConfigKey } = await import('./guildConfig.js');
        await db.set(getGuildConfigKey(guild.id), guildConfig);

        // Welcome message
        const embed = new EmbedBuilder()
            .setTitle(`🎫 Ticket #${ticketNumber}`)
            .setDescription(
                `Welcome ${user}! A member of our support team will be with you shortly.\n\nUse \`/close\` to close this ticket when your issue is resolved.`,
            )
            .setColor(getColor('info'))
            .setTimestamp();

        await channel.send({ content: `${user}`, embeds: [embed] });

        logger.info('Ticket created', {
            channelId: channel.id,
            guildId: guild.id,
            creatorId: user.id,
            ticketNumber,
        });

        return { success: true, channel };
    } catch (error) {
        logger.error('createTicket error', { error: error.message });
        return { success: false, error: 'An internal error occurred while creating the ticket.' };
    }
}
