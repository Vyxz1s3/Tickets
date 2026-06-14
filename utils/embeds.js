import { EmbedBuilder } from 'discord.js';
import { getColor } from '../config/bot.js';

/**
 * Generic embed factory. Accepts an options object and returns an EmbedBuilder
 * so callers can chain additional methods (e.g. .addFields()).
 *
 * @param {{ title?: string, description?: string, color?: number|string }} opts
 */
export function createEmbed({ title, description, color } = {}) {
    const embed = new EmbedBuilder();
    if (title)       embed.setTitle(title);
    if (description) embed.setDescription(description);
    embed.setColor(color ?? getColor('default'));
    return embed;
}

/**
 * Red error embed.
 */
export function errorEmbed(title, description) {
    return new EmbedBuilder()
        .setTitle(`❌ ${title}`)
        .setDescription(description)
        .setColor(getColor('error'));
}

/**
 * Green success embed.
 */
export function successEmbed(title, description) {
    return new EmbedBuilder()
        .setTitle(`✅ ${title}`)
        .setDescription(description)
        .setColor(getColor('success'));
}

/**
 * Blue informational embed.
 */
export function infoEmbed(title, description) {
    return new EmbedBuilder()
        .setTitle(`ℹ️ ${title}`)
        .setDescription(description)
        .setColor(getColor('info'));
}

/**
 * Yellow warning embed.
 */
export function warningEmbed(title, description) {
    return new EmbedBuilder()
        .setTitle(`⚠️ ${title}`)
        .setDescription(description)
        .setColor(getColor('warning'));
}
