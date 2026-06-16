/**
 * messageCreate.js
 * Handles two cases:
 *   1. A user sends a DM to the bot → create or forward to ticket thread
 *   2. A staff member replies in a ticket thread → forward to user DM
 */

const { ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getConfig }           = require('../services/guildConfig');
const {
  getOpenTicketByUser,
  getTicketByThread,
  forwardDMToThread,
  forwardThreadToDM,
} = require('../services/ticket');

module.exports = {
  name: 'messageCreate',

  /**
   * @param {import('discord.js').Message} message
   * @param {import('discord.js').Client} client
   */
  async execute(message, client) {
    // Ignore all bot messages (prevents infinite loops)
    if (message.author.bot) return;

    // -----------------------------------------------------------------------
    // Case 1: Direct Message from a user
    // -----------------------------------------------------------------------
    if (message.channel.type === ChannelType.DM) {
      await handleDM(message, client);
      return;
    }

    // -----------------------------------------------------------------------
    // Case 2: Message in a thread (staff reply)
    // -----------------------------------------------------------------------
    if (
      message.channel.type === ChannelType.PublicThread ||
      message.channel.type === ChannelType.PrivateThread
    ) {
      await handleThreadMessage(message, client);
      return;
    }
  },
};

// ---------------------------------------------------------------------------
// DM handler
// ---------------------------------------------------------------------------

async function handleDM(message, client) {
  const userId = message.author.id;

  // Find a guild that has the bot configured — we need to know which guild
  // to create the thread in. We iterate over mutual guilds.
  // If the bot is in multiple guilds, we pick the first configured one.
  const configuredGuild = await findConfiguredGuild(client, userId);

  if (!configuredGuild) {
    await message.reply(
      '❌ This bot has not been set up yet. Please ask a server administrator to run `/ticket setup`.',
    ).catch(() => {});
    return;
  }

  const { guild, config } = configuredGuild;

  // Check if the user already has an open ticket
  const existing = getOpenTicketByUser(userId);

  if (existing) {
    // Forward the new DM message to the existing thread
    await forwardDMToThread(client, message, existing);
    await message.react('✅').catch(() => {});
    return;
  }

  // No open ticket — prompt the user for a reason via a modal.
  // Modals can only be shown in response to an interaction, so we send a
  // message with a button; clicking it triggers the modal in interactionCreate.
  try {
    // Stash the pending context so the modal handler can retrieve it later.
    if (!client._pendingTickets) client._pendingTickets = new Map();
    client._pendingTickets.set(message.author.id, {
      dmMessage:      message,
      guildId:        guild.id,
      staffChannelId: config.staffChannelId,
      modRoleId:      config.modRoleId ?? null,
    });

    const button = new ButtonBuilder()
      .setCustomId('open_ticket_modal')
      .setLabel('Open Support Ticket')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎫');

    const row = new ActionRowBuilder().addComponents(button);

    await message.reply({
      content:
        `👋 Thanks for reaching out!\n\n` +
        `Before we open a ticket, please click the button below and briefly describe ` +
        `why you're contacting support. This helps our staff assist you faster.`,
      components: [row],
    }).catch(() => {});
  } catch (err) {
    console.error('[messageCreate] Failed to prompt for ticket reason:', err);
    await message.reply(
      '❌ Something went wrong while opening your ticket. Please try again later.',
    ).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Thread message handler
// ---------------------------------------------------------------------------

async function handleThreadMessage(message, client) {
  const threadId = message.channel.id;
  const ticket   = getTicketByThread(threadId);

  if (!ticket) return; // Not a ticket thread
  if (ticket.status === 'closed') return; // Ticket is closed

  await forwardThreadToDM(client, message, ticket);
  await message.react('📨').catch(() => {});
}

// ---------------------------------------------------------------------------
// Helper: find the first guild the user shares with the bot that is configured
// ---------------------------------------------------------------------------

async function findConfiguredGuild(client, userId) {
  // Fetch all guilds the bot is in
  for (const [, guild] of client.guilds.cache) {
    const config = getConfig(guild.id);
    if (!config?.staffChannelId) continue;

    // Check if the user is a member of this guild
    try {
      await guild.members.fetch(userId);
      return { guild, config };
    } catch {
      // User is not in this guild — skip
    }
  }
  return null;
}
