import { PermissionFlagsBits } from 'discord.js';
import { getTicketByChannel } from '../services/ticket.js';
import { getGuildConfig } from '../services/guildConfig.js';
import { logger } from './logger.js';

/**
 * Resolves the permission context for a ticket-related interaction.
 *
 * Returns an object with:
 *   - ticketData   — the ticket record (or null if not a ticket channel)
 *   - guildConfig  — the guild configuration object
 *   - isStaff      — true if the user has the staff role or Manage Channels
 *   - isCreator    — true if the user opened this ticket
 *   - canManageTicket — staff or admin
 *   - canCloseTicket  — staff, admin, or ticket creator
 *
 * @param {{ client: import('discord.js').Client, interaction: import('discord.js').Interaction }} param0
 */
export async function getTicketPermissionContext({ client, interaction }) {
    const { member, channel, guildId } = interaction;

    const [ticketData, guildConfig] = await Promise.all([
        getTicketByChannel(guildId, channel.id),
        getGuildConfig(client, guildId),
    ]);

    const hasManageChannels = member.permissions.has(PermissionFlagsBits.ManageChannels);
    const staffRoleId = guildConfig?.ticketStaffRoleId;
    const hasStaffRole = staffRoleId ? member.roles.cache.has(staffRoleId) : false;

    const isStaff = hasManageChannels || hasStaffRole;
    const isCreator = ticketData?.creatorId === interaction.user.id;

    return {
        ticketData,
        guildConfig,
        isStaff,
        isCreator,
        canManageTicket: isStaff,
        canCloseTicket: isStaff || isCreator,
    };
}
