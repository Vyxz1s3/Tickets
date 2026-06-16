/**
 * interactionCreate.js
 * Routes interactions to the appropriate handler:
 *   - Slash commands → command files
 *   - Button (open_ticket_modal) → show the reason modal
 *   - Modal submit (ticket_reason_modal) → create the ticket
 */

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { createTicket } = require('../services/ticket');

module.exports = {
  name: 'interactionCreate',

  /**
   * @param {import('discord.js').Interaction} interaction
   * @param {import('discord.js').Client} client
   */
  async execute(interaction, client) {
    // -----------------------------------------------------------------------
    // Slash commands
    // -----------------------------------------------------------------------
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`[interactionCreate] Error executing /${interaction.commandName}:`, error);
        const reply = {
          content: '❌ An error occurred while executing this command.',
          ephemeral: true,
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
      return;
    }

    // -----------------------------------------------------------------------
    // Button: open the reason modal
    // -----------------------------------------------------------------------
    if (interaction.isButton() && interaction.customId === 'open_ticket_modal') {
      const modal = new ModalBuilder()
        .setCustomId('ticket_reason_modal')
        .setTitle('Open a Support Ticket');

      const reasonInput = new TextInputBuilder()
        .setCustomId('ticket_reason')
        .setLabel('Reason for contacting support')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Please briefly describe your issue or question…')
        .setRequired(true)
        .setMaxLength(500);

      modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));

      await interaction.showModal(modal);
      return;
    }

    // -----------------------------------------------------------------------
    // Modal submit: create the ticket with the provided reason
    // -----------------------------------------------------------------------
    if (interaction.isModalSubmit() && interaction.customId === 'ticket_reason_modal') {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});

      const userId = interaction.user.id;
      const reason = interaction.fields.getTextInputValue('ticket_reason').trim();

      // Retrieve the pending ticket context stored by messageCreate
      const pending = client._pendingTickets?.get(userId);
      if (!pending) {
        await interaction.editReply(
          '❌ Your session has expired. Please send a new DM to the bot to start again.',
        ).catch(() => {});
        return;
      }

      client._pendingTickets.delete(userId);

      try {
        const ticket = await createTicket(
          client,
          pending.dmMessage,
          pending.guildId,
          pending.staffChannelId,
          pending.modRoleId,
          reason,
        );

        await interaction.editReply(
          `Watching our dms 👀\n\n` +
          `Your support ticket **#${ticket.ticketId}** has been opened! ` +
          `A staff member will be with you shortly.\n\n` +
          `Simply reply to this DM to send messages to the support team.`,
        ).catch(() => {});
      } catch (err) {
        console.error('[interactionCreate] Failed to create ticket from modal:', err);
        await interaction.editReply(
          '❌ Something went wrong while opening your ticket. Please try again later.',
        ).catch(() => {});
      }
      return;
    }
  },
};
