import { logger } from './logger.js';

/**
 * Utility wrappers around common Discord.js interaction methods that swallow
 * "interaction already acknowledged" errors gracefully.
 */
export const InteractionHelper = {
    /**
     * Safely defers an interaction reply. Returns true on success, false if the
     * interaction was already acknowledged or the deferral failed.
     *
     * @param {import('discord.js').Interaction} interaction
     * @param {import('discord.js').InteractionDeferReplyOptions} [options]
     */
    async safeDefer(interaction, options = {}) {
        try {
            if (interaction.deferred || interaction.replied) return true;
            await interaction.deferReply(options);
            return true;
        } catch (error) {
            // Code 40060 = interaction already acknowledged
            if (error.code !== 40060) {
                logger.warn('safeDefer failed', { error: error.message });
            }
            return false;
        }
    },

    /**
     * Safely edits the deferred/replied interaction message.
     *
     * @param {import('discord.js').Interaction} interaction
     * @param {import('discord.js').InteractionEditReplyOptions} payload
     */
    async safeEditReply(interaction, payload) {
        try {
            if (interaction.deferred || interaction.replied) {
                return await interaction.editReply(payload);
            }
            return await interaction.reply({ ...payload, fetchReply: true });
        } catch (error) {
            if (error.code !== 40060) {
                logger.warn('safeEditReply failed', { error: error.message });
            }
            return null;
        }
    },

    /**
     * Safely follows up on an interaction.
     *
     * @param {import('discord.js').Interaction} interaction
     * @param {import('discord.js').InteractionReplyOptions} payload
     */
    async safeFollowUp(interaction, payload) {
        try {
            return await interaction.followUp(payload);
        } catch (error) {
            logger.warn('safeFollowUp failed', { error: error.message });
            return null;
        }
    },
};
