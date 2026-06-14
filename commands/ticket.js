import { getColor } from '../config/bot.js';
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} from 'discord.js';
import { createEmbed, errorEmbed, successEmbed } from '../utils/embeds.js';
import { getGuildConfig } from '../services/guildConfig.js';
import { InteractionHelper } from '../utils/interactionHelper.js';
import { logger } from '../utils/logger.js';
import { handleInteractionError } from '../utils/errorHandler.js';
import { getGuildConfigKey } from '../utils/database.js';

import ticketDashboard from '../modules/ticket_dashboard.js';

export default {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription("Manages the server's ticket system.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Sets up the ticket creation panel in a specified channel.')
                .addChannelOption(option =>
                    option
                        .setName('panel_channel')
                        .setDescription('The channel where the ticket panel will be sent.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true),
                )
                .addStringOption(option =>
                    option
                        .setName('panel_message')
                        .setDescription('The main message/description for the ticket panel.')
                        .setRequired(true),
                )
                .addStringOption(option =>
                    option
                        .setName('button_label')
                        .setDescription('The label for the ticket creation button (default: Create Ticket)')
                        .setRequired(false),
                )
                .addChannelOption(option =>
                    option
                        .setName('category')
                        .setDescription('The category where new tickets will be created (optional).')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false),
                )
                .addChannelOption(option =>
                    option
                        .setName('closed_category')
                        .setDescription('The category where closed tickets will be moved (optional).')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false),
                )
                .addRoleOption(option =>
                    option
                        .setName('staff_role')
                        .setDescription('The role that can access tickets (optional).')
                        .setRequired(false),
                )
                .addIntegerOption(option =>
                    option
                        .setName('max_tickets_per_user')
                        .setDescription('Maximum number of tickets a user can create (default: 3)')
                        .setMinValue(1)
                        .setMaxValue(10)
                        .setRequired(false),
                )
                .addBooleanOption(option =>
                    option
                        .setName('dm_on_close')
                        .setDescription('Send DM to user when their ticket is closed (default: true)')
                        .setRequired(false),
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('dashboard')
                .setDescription('Open the interactive ticket system dashboard'),
        ),
    category: 'ticket',

    async execute(interaction, config, client) {
        try {
            const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
            if (!deferred) return;

            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                logger.warn('Ticket command permission denied', {
                    userId: interaction.user.id,
                    guildId: interaction.guildId,
                    commandName: 'ticket',
                });
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        errorEmbed(
                            'Permission Denied',
                            'You need the `Manage Channels` permission for this action.',
                        ),
                    ],
                });
            }

            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'dashboard') {
                return ticketDashboard.execute(interaction, config, client);
            }

            if (subcommand === 'setup') {
                const existingConfig = await getGuildConfig(client, interaction.guildId);
                if (existingConfig?.ticketPanelChannelId) {
                    return await InteractionHelper.safeEditReply(interaction, {
                        embeds: [
                            errorEmbed(
                                'Ticket System Already Active',
                                `This server already has a ticket system set up (panel in <#${existingConfig.ticketPanelChannelId}>).\n\nOnly one ticket system is supported per server. Use \`/ticket dashboard\` to modify the existing setup.`,
                            ),
                        ],
                    });
                }

                const panelChannel      = interaction.options.getChannel('panel_channel');
                const categoryChannel   = interaction.options.getChannel('category');
                const closedCategoryChannel = interaction.options.getChannel('closed_category');
                const staffRole         = interaction.options.getRole('staff_role');
                const panelMessage      = interaction.options.getString('panel_message') || 'Click the button below to create a support ticket.';
                const buttonLabel       = interaction.options.getString('button_label') || 'Create Ticket';
                const maxTicketsPerUser = interaction.options.getInteger('max_tickets_per_user') || 3;
                const dmOnClose         = interaction.options.getBoolean('dm_on_close') !== false;

                const setupEmbed = createEmbed({
                    title: '🎫 Support Tickets',
                    description: panelMessage,
                    color: getColor('info'),
                });

                const ticketButton = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('create_ticket')
                        .setLabel(buttonLabel)
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📩'),
                );

                try {
                    await panelChannel.send({ embeds: [setupEmbed], components: [ticketButton] });

                    if (client.db && interaction.guildId) {
                        const currentConfig = existingConfig;
                        currentConfig.ticketCategoryId        = categoryChannel?.id ?? null;
                        currentConfig.ticketClosedCategoryId  = closedCategoryChannel?.id ?? null;
                        currentConfig.ticketStaffRoleId       = staffRole?.id ?? null;
                        currentConfig.ticketPanelChannelId    = panelChannel.id;
                        currentConfig.ticketPanelMessage      = panelMessage;
                        currentConfig.ticketButtonLabel       = buttonLabel;
                        currentConfig.maxTicketsPerUser       = maxTicketsPerUser;
                        currentConfig.dmOnClose               = dmOnClose;

                        const configKey = getGuildConfigKey(interaction.guildId);
                        await client.db.set(configKey, currentConfig);

                        logger.info('Ticket configuration saved', {
                            guildId: interaction.guildId,
                            categoryId: categoryChannel?.id,
                            closedCategoryId: closedCategoryChannel?.id,
                            staffRoleId: staffRole?.id,
                            maxTickets: maxTicketsPerUser,
                            dmOnClose,
                        });
                    }

                    let successMessage = `The ticket creation panel has been sent to ${panelChannel}. `;
                    if (categoryChannel) {
                        successMessage += `New tickets will be created in the **${categoryChannel.name}** category. `;
                    } else {
                        successMessage += 'New tickets will be created in a new "Tickets" category. ';
                    }
                    if (closedCategoryChannel) {
                        successMessage += `Closed tickets will be moved to **${closedCategoryChannel.name}**. `;
                    }
                    if (staffRole) {
                        successMessage += `**${staffRole.name}** role will have access to tickets. `;
                    }
                    successMessage += `\n\n**Max Tickets Per User:** ${maxTicketsPerUser}\n**DM on Close:** ${dmOnClose ? 'Enabled' : 'Disabled'}`;

                    await InteractionHelper.safeEditReply(interaction, {
                        embeds: [successEmbed('Ticket Panel Set Up', successMessage)],
                    });

                    logger.info('Ticket panel setup completed', {
                        userId: interaction.user.id,
                        guildId: interaction.guildId,
                        panelChannelId: panelChannel.id,
                        categoryId: categoryChannel?.id,
                        closedCategoryId: closedCategoryChannel?.id,
                        staffRoleId: staffRole?.id,
                        maxTickets: maxTicketsPerUser,
                        dmOnClose,
                        commandName: 'ticket_setup',
                    });
                } catch (error) {
                    logger.error('Ticket setup error', {
                        error: error.message,
                        stack: error.stack,
                        userId: interaction.user.id,
                        guildId: interaction.guildId,
                        commandName: 'ticket_setup',
                    });
                    await InteractionHelper.safeEditReply(interaction, {
                        embeds: [
                            errorEmbed(
                                'Setup Failed',
                                "Could not send the ticket panel or save configuration. Check the bot's permissions and try again.",
                            ),
                        ],
                    });
                }
            }
        } catch (error) {
            logger.error('Error executing ticket command', {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'ticket',
            });
            await handleInteractionError(interaction, error, {
                commandName: 'ticket',
                source: 'ticket_command_main',
            });
        }
    },
};
