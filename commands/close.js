/**
 * close.js command
 * /close [reason] — close and archive the current ticket thread.
 * Must be run inside a ticket thread.
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getTicketByThread, closeTicket } = require('../services/ticket');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close and archive this ticket thread')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(opt =>
      opt
        .setName('reason')
        .setDescription('Optional reason for closing the ticket (sent to the user)')
        .setRequired(false),
    ),

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const threadId = interaction.channelId;
    const ticket   = getTicketByThread(threadId);

    if (!ticket) {
      return interaction.editReply({
        content: '❌ This command can only be used inside a ticket thread.',
      });
    }

    if (ticket.status === 'closed') {
      return interaction.editReply({ content: '❌ This ticket is already closed.' });
    }

    const reason = interaction.options.getString('reason') ?? null;

    try {
      await closeTicket(client, threadId, interaction.user, reason);

      // The thread is now archived — reply before archiving happens
      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('🔒 Ticket closed')
        .setDescription(
          `Ticket **#${ticket.ticketId}** has been closed by <@${interaction.user.id}>.` +
          (reason ? `\n**Reason:** ${reason}` : ''),
        )
        .setTimestamp();

      // Send a final message in the thread before it archives
      await interaction.channel.send({ embeds: [embed] }).catch(() => {});

      return interaction.editReply({ content: '✅ Ticket closed and thread archived.' });
    } catch (err) {
      console.error('[close] Error:', err);
      return interaction.editReply({ content: `❌ ${err.message}` });
    }
  },
};
