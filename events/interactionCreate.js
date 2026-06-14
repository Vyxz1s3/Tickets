import { InteractionType, MessageFlags, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import { logger } from '../utils/logger.js';
import { handleInteractionError } from '../utils/errorHandler.js';
import { getGuildConfig } from '../services/guildConfig.js';
import { createTicket } from '../services/ticket.js';
import { getColor } from '../config/bot.js';

export default {
    name: 'interactionCreate',
    once: false,

    async execute(interaction, client) {
        // ── Slash Commands ────────────────────────────────────────────────────
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) {
                logger.warn(`Unknown command: ${interaction.commandName}`);
                return;
            }

            try {
                const guildConfig = interaction.guildId
                    ? await getGuildConfig(client, interaction.guildId)
                    : null;
                await command.execute(interaction, guildConfig, client);
            } catch (error) {
                logger.error('Unhandled command error', {
                    command: interaction.commandName,
                    error: error.message,
                    stack: error.stack,
                });
                await handleInteractionError(interaction, error, {
                    commandName: interaction.commandName,
                    source: 'interactionCreate',
                });
            }
            return;
        }

        // ── Button: Create Ticket ─────────────────────────────────────────────
        if (interaction.isButton() && interaction.customId === 'create_ticket') {
            try {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                const guildConfig = await getGuildConfig(client, interaction.guildId);
                const result = await createTicket(
                    interaction.guild,
                    interaction.user,
                    guildConfig,
                    client.db,
                );

                if (!result.success) {
                    return await interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('❌ Could not create ticket')
                                .setDescription(result.error)
                                .setColor(getColor('error')),
                        ],
                    });
                }

                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('✅ Ticket Created')
                            .setDescription(`Your ticket has been created: ${result.channel}`)
                            .setColor(getColor('success')),
                    ],
                });
            } catch (error) {
                logger.error('Error handling create_ticket button', { error: error.message });
                await handleInteractionError(interaction, error, { source: 'create_ticket_button' });
            }
            return;
        }
    },
};
