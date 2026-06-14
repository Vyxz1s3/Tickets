/**
 * Bot-wide configuration and colour palette.
 * All colours are standard Discord embed hex integers.
 */

export const BOT_CONFIG = {
    name: 'Tickets',
    version: '1.0.0',
    defaultPrefix: '/',
};

const COLORS = {
    default: 0x5865F2,  // Discord blurple
    success: 0x57F287,  // Green
    error:   0xED4245,  // Red
    warning: 0xFEE75C,  // Yellow
    info:    0x5865F2,  // Blurple
    primary: 0x5865F2,
};

/**
 * Returns the hex colour integer for the given key.
 * Falls back to the default colour if the key is unknown.
 *
 * @param {keyof typeof COLORS} key
 * @returns {number}
 */
export function getColor(key) {
    return COLORS[key] ?? COLORS.default;
}
