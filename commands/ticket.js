/**
 * ticket.js command
 * Subcommands:
 *   /ticket setup   — configure the staff channel for this guild
 *   /ticket dashboard — show current configuration and open ticket stats
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} = require('discord.js');
const { getConfig, setConfig } = require('../services/guildConfig');
const fs   = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket system management')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // /ticket setup
    .addSubcommand(sub =>
      sub
        .setName('setup')
        .setDescription('Configure the staff channel where ticket threads will be created')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('The text channel to create ticket threads in')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addRoleOption(opt =>
          opt
            .setName('mod-role')
            .setDescription('The moderation role to ping when a new ticket is opened (default: built-in mod role)')
            .setRequired(false),
        ),
    )

    // /ticket dashboard
    .addSubcommand(sub =>
      sub
        .setName('dashboard')
        .setDescription('View current ticket system configuration and stats'),
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup')     return runSetup(interaction);
    if (sub === 'dashboard') return runDashboard(interaction);
  },
};

// ---------------------------------------------------------------------------
// /ticket setup
// ---------------------------------------------------------------------------

const DEFAULT_MOD_ROLE_ID = '1506696956334968885';

async function runSetup(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const channel = interaction.options.getChannel('channel');
  const modRole = interaction.options.getRole('mod-role');
  const guildId = interaction.guildId;

  // Verify the bot can create threads in that channel
  const botMember = interaction.guild.members.me;
  const perms     = channel.permissionsFor(botMember);

  if (!perms.has(PermissionFlagsBits.CreatePublicThreads) || !perms.has(PermissionFlagsBits.SendMessages)) {
    return interaction.editReply({
      content:
        `❌ I don't have permission to create threads or send messages in ${channel}.\n` +
        `Please grant me **Create Public Threads** and **Send Messages** in that channel.`,
    });
  }

  const modRoleId = modRole?.id ?? DEFAULT_MOD_ROLE_ID;
  setConfig(guildId, { staffChannelId: channel.id, modRoleId });

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('✅ Ticket system configured')
    .setDescription(
      `The staff channel has been set to ${channel}.\n\n` +
      `Users can now DM the bot to open a support ticket. ` +
      `A thread will be created in ${channel} for each new ticket.`,
    )
    .addFields(
      { name: 'Staff Channel', value: `${channel} (\`${channel.id}\`)`, inline: false },
      { name: 'Mod Role',      value: `<@&${modRoleId}> (\`${modRoleId}\`)`, inline: false },
    )
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

// ---------------------------------------------------------------------------
// /ticket dashboard
// ---------------------------------------------------------------------------

async function runDashboard(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId;
  const config  = getConfig(guildId);

  if (!config?.staffChannelId) {
    return interaction.editReply({
      content: '❌ The ticket system has not been configured yet. Run `/ticket setup` first.',
    });
  }

  // Load ticket stats
  const ticketsFile = path.join(__dirname, '..', 'data', 'tickets.json');
  let tickets = {};
  if (fs.existsSync(ticketsFile)) {
    try { tickets = JSON.parse(fs.readFileSync(ticketsFile, 'utf8')); } catch { tickets = {}; }
  }

  const allTickets    = Object.values(tickets).filter(t => t.guildId === guildId);
  const openTickets   = allTickets.filter(t => t.status === 'open');
  const closedTickets = allTickets.filter(t => t.status === 'closed');

  const staffChannel = await interaction.guild.channels.fetch(config.staffChannelId).catch(() => null);
  const channelMention = staffChannel ? `${staffChannel}` : `\`${config.staffChannelId}\` *(not found)*`;

  const modRoleMention = config.modRoleId
    ? `<@&${config.modRoleId}> (\`${config.modRoleId}\`)`
    : '*not set*';

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎫 Ticket System Dashboard')
    .addFields(
      { name: 'Staff Channel',   value: channelMention,              inline: false },
      { name: 'Mod Role',        value: modRoleMention,              inline: false },
      { name: 'Open Tickets',    value: `${openTickets.length}`,     inline: true  },
      { name: 'Closed Tickets',  value: `${closedTickets.length}`,   inline: true  },
      { name: 'Total Tickets',   value: `${allTickets.length}`,      inline: true  },
    )
    .setTimestamp()
    .setFooter({ text: 'Use /ticket setup to change the staff channel.' });

  // List open tickets (up to 10)
  if (openTickets.length > 0) {
    const lines = openTickets.slice(0, 10).map(t => {
      const priority = t.priority !== 'none' ? ` ${getPriorityEmoji(t.priority)}` : '';
      const claimed  = t.claimedBy ? ` 👤 <@${t.claimedBy}>` : '';
      return `• **#${t.ticketId}** — <@${t.userId}>${priority}${claimed}`;
    });
    if (openTickets.length > 10) lines.push(`*…and ${openTickets.length - 10} more*`);
    embed.addFields({ name: 'Open Ticket List', value: lines.join('\n'), inline: false });
  }

  return interaction.editReply({ embeds: [embed] });
}

function getPriorityEmoji(priority) {
  const map = { low: '🟢', medium: '🟡', high: '🔴' };
  return map[priority] ?? '';
}
