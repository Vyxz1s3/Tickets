import { MessageFlags } from 'discord.js';
import { errorEmbed } from './embeds.js';
import { logger } from './logger.js';

// ─── Custom Error Class ───────────────────────────────────────────────────────

export const ErrorTypes = {
    PERMISSION:    'PERMISSION',
    VALIDATION:    'VALIDATION',
    CONFIGURATION: 'CONFIGURATION',
    NOT_FOUND:     'NOT_FOUND',
    DISCORD_API:   'DISCORD_API',
    DATABASE:      'DATABASE',
    UNKNOWN:       'UNKNOWN',
};

export class TitanBotError extends Error {
    /**
     * @param {string} message        Internal/log message
     * @param {string} type           One of ErrorTypes
     * @param {string} [userMessage]  Human-readable message shown to the user
     */
    constructor(message, type = ErrorTypes.UNKNOWN, userMessage) {
        super(message);
        this.name = 'TitanBotError';
        this.type = type;
        this.userMessage = userMessage ?? message;
    }
}

// ─── Interaction Error Handler ────────────────────────────────────────────────

/**
 * Attempts to reply to (or follow up on) an interaction with a generic error
 * embed. Swallows any secondary errors so the caller never crashes.
 *
 * @param {import('discord.js').Interaction} interaction
 * @param {Error} error
 * @param {{ commandName?: string, source?: string }} [context]
 */
export async function handleInteractionError(interaction, error, context = {}) {
    const userMessage =
        error instanceof TitanBotError
            ? error.userMessage
            : 'An unexpected error occurred. Please try again later.';

    logger.error('Interaction error', {
        error: error.message,
        type: error instanceof TitanBotError ? error.type : 'UNKNOWN',
        ...context,
    });

    const payload = {
        embeds: [errorEmbed('Something went wrong', userMessage)],
        flags: MessageFlags.Ephemeral,
    };

    try {
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(payload);
        } else {
            await interaction.reply(payload);
        }
    } catch (replyError) {
        logger.warn('Could not send error reply to interaction', {
            error: replyError.message,
            ...context,
        });
    }
}
