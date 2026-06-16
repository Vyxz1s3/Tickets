/**
 * priority.js command
 * /priority <level> — set the priority of the current ticket thread.
 * Must be run inside a ticket thread.
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getTicketByThread, setPriority, PRIORITY_CONFIG } = require('../services/ticket');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('priority')
    .setDescription('Set the priority level of this ticket thread')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(opt =>
      opt
        .setName('level')
        .setDescription('Priority level')
        .setRequired(true)
        .addChoices(
          { name: '⬛ None',    value: 'none'   },
          { name: '🟢 Low',    value: 'low'    },
          { name: '🟡 Medium', value: 'medium' },
          { name: '🔴 High',   value: 'high'   },
        ),
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

    const level = interaction.options.getString('level');

    try {
      await setPriority(client, threadId, level);

      const pc = PRIORITY_CONFIG[level];
      const label = pc.emoji ? `${pc.emoji} ${pc.label}` : pc.label;

      const embed = new EmbedBuilder()
        .setColor(pc.color)
        .setTitle('🏷️ Priority updated')
        .setDescription(
          `Ticket **#${ticket.ticketId}** priority set to **${label}** by <@${interaction.user.id}>.`,
        )
        .setTimestamp();

      await interaction.channel.send({ embeds: [embed] });

      return interaction.editReply({ content: `✅ Priority set to **${label}**.` });
    } catch (err) {
      console.error('[priority] Error:', err);
      return interaction.editReply({ content: `❌ ${err.message}` });
    }
  },
};
