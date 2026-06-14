const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Opens a support ticket'),

  async execute(interaction, client) {
    await interaction.reply({
      content: '🎫 Ticket system coming soon! This bot is ready for you to build out your ticket logic.',
      ephemeral: true,
    });
  },
};
