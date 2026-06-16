/**
 * guildConfig.js
 * Persists per-guild configuration to data/guildConfigs.json.
 * Schema per guild:
 *   {
 *     staffChannelId: string,   // ID of the channel where ticket threads are created
 *     logChannelId:   string,   // (optional) ID of a log channel
 *     modRoleId:      string,   // (optional) ID of the moderation role to ping on new tickets
 *   }
 */

const fs   = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'guildConfigs.json');

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _load() {
  if (!fs.existsSync(FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}

function _save(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the config object for a guild, or null if not configured.
 * @param {string} guildId
 * @returns {{ staffChannelId: string, logChannelId?: string, modRoleId?: string } | null}
 */
function getConfig(guildId) {
  const all = _load();
  return all[guildId] ?? null;
}

/**
 * Merges the provided fields into the guild's config and persists.
 * @param {string} guildId
 * @param {{ staffChannelId?: string, logChannelId?: string, modRoleId?: string }} fields
 */
function setConfig(guildId, fields) {
  const all = _load();
  all[guildId] = { ...(all[guildId] ?? {}), ...fields };
  _save(all);
  return all[guildId];
}

/**
 * Deletes the config for a guild.
 * @param {string} guildId
 */
function deleteConfig(guildId) {
  const all = _load();
  delete all[guildId];
  _save(all);
}

module.exports = { getConfig, setConfig, deleteConfig };
