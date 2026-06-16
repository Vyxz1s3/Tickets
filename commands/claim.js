/**
 * claim.js command
 * /claim — claim the current ticket thread as the responding staff member.
 * Must be run inside a ticket thread.
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getTicketByThread, claimTicket } = require('../services/ticket');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('claim')
    .setDescription('Claim this ticket thread as your own')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

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

    if (ticket.claimedBy) {
      return interaction.editReply({
        content: `❌ This ticket is already claimed by <@${ticket.claimedBy}>.`,
      });
    }

    try {
      await claimTicket(client, threadId, interaction.member);

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('✅ Ticket claimed')
        .setDescription(`<@${interaction.user.id}> has claimed ticket **#${ticket.ticketId}**.`)
        .setTimestamp();

      // Post a visible message in the thread so the team knows
      await interaction.channel.send({ embeds: [embed] });

      return interaction.editReply({ content: '✅ You have claimed this ticket.' });
    } catch (err) {
      console.error('[claim] Error:', err);
      return interaction.editReply({ content: `❌ ${err.message}` });
    }
  },
};
