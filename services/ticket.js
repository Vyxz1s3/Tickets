/**
 * ticket.js
 * Core ticket service — thread creation, message forwarding, claim/close/priority.
 *
 * Ticket record schema (stored in data/tickets.json):
 * {
 *   [ticketId]: {
 *     ticketId:    number,   // auto-incrementing integer
 *     guildId:     string,
 *     userId:      string,   // the user who opened the ticket via DM
 *     threadId:    string,   // Discord thread ID in the staff channel
 *     status:      'open' | 'closed',
 *     priority:    'none' | 'low' | 'medium' | 'high',
 *     claimedBy:   string | null,  // staff member user ID
 *     reason:      string | null,  // user-provided reason for opening the ticket
 *     createdAt:   string,  // ISO timestamp
 *     closedAt:    string | null,
 *   }
 * }
 *
 * Two lookup maps are also maintained:
 *   threadToTicket: { [threadId]: ticketId }
 *   userToTicket:   { [userId]:   ticketId }   (only open tickets)
 */

const fs   = require('fs');
const path = require('path');
const { EmbedBuilder, ThreadAutoArchiveDuration } = require('discord.js');

const TICKETS_FILE        = path.join(__dirname, '..', 'data', 'tickets.json');
const THREAD_MAP_FILE     = path.join(__dirname, '..', 'data', 'threadToTicket.json');
const USER_MAP_FILE       = path.join(__dirname, '..', 'data', 'userToTicket.json');

// Priority display config
const PRIORITY_CONFIG = {
  none:   { emoji: '',   label: 'None',   color: 0x5865f2 },
  low:    { emoji: '🟢', label: 'Low',    color: 0x57f287 },
  medium: { emoji: '🟡', label: 'Medium', color: 0xfee75c },
  high:   { emoji: '🔴', label: 'High',   color: 0xed4245 },
};

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

function _loadJSON(file) {
  if (!fs.existsSync(file)) return {};
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

function _saveJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function _loadTickets()   { return _loadJSON(TICKETS_FILE); }
function _loadThreadMap() { return _loadJSON(THREAD_MAP_FILE); }
function _loadUserMap()   { return _loadJSON(USER_MAP_FILE); }

function _saveTickets(d)   { _saveJSON(TICKETS_FILE, d); }
function _saveThreadMap(d) { _saveJSON(THREAD_MAP_FILE, d); }
function _saveUserMap(d)   { _saveJSON(USER_MAP_FILE, d); }

function _nextId() {
  const tickets = _loadTickets();
  const ids = Object.keys(tickets).map(Number);
  return ids.length === 0 ? 1 : Math.max(...ids) + 1;
}

// ---------------------------------------------------------------------------
// Thread name helpers
// ---------------------------------------------------------------------------

function _buildThreadName(ticketId, username, priority) {
  const pc = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.none;
  const prefix = pc.emoji ? `${pc.emoji} ` : '';
  return `${prefix}#${ticketId} – ${username}`.slice(0, 100);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up an open ticket by the user's ID.
 * @param {string} userId
 * @returns {object|null}
 */
function getOpenTicketByUser(userId) {
  const userMap = _loadUserMap();
  const ticketId = userMap[userId];
  if (!ticketId) return null;
  const tickets = _loadTickets();
  const ticket = tickets[ticketId];
  if (!ticket || ticket.status !== 'open') return null;
  return ticket;
}

/**
 * Look up a ticket by thread ID.
 * @param {string} threadId
 * @returns {object|null}
 */
function getTicketByThread(threadId) {
  const threadMap = _loadThreadMap();
  const ticketId = threadMap[threadId];
  if (!ticketId) return null;
  const tickets = _loadTickets();
  return tickets[ticketId] ?? null;
}

/**
 * Creates a new ticket: opens a thread in the staff channel and records it.
 *
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').Message} dmMessage  — the triggering DM
 * @param {string} guildId
 * @param {string} staffChannelId
 * @param {string} [modRoleId]  — optional role ID to ping in the thread
 * @param {string} [reason]     — user-provided reason for opening the ticket
 * @returns {Promise<object>} the new ticket record
 */
async function createTicket(client, dmMessage, guildId, staffChannelId, modRoleId, reason) {
  const user     = dmMessage.author;
  const ticketId = _nextId();

  // Fetch the staff channel
  const staffChannel = await client.channels.fetch(staffChannelId);
  if (!staffChannel) throw new Error(`Staff channel ${staffChannelId} not found.`);

  // Build the opening embed posted into the thread
  const openEmbedFields = [
    { name: 'User',     value: `<@${user.id}> (${user.tag})`, inline: true },
    { name: 'User ID',  value: user.id,                        inline: true },
    { name: 'Opened',   value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
  ];

  if (reason) {
    openEmbedFields.push({ name: 'Reason', value: reason, inline: false });
  }

  const openEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🎫 Ticket #${ticketId}`)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .addFields(...openEmbedFields)
    .setFooter({ text: 'Reply in this thread — messages are forwarded to the user\'s DM.' });


  // Create the thread
  const threadName = _buildThreadName(ticketId, user.username, 'none');
  const thread = await staffChannel.threads.create({
    name:                 threadName,
    autoArchiveDuration:  ThreadAutoArchiveDuration.OneWeek,
    reason:               `Support ticket #${ticketId} opened by ${user.tag}`,
  });

  // Post the opening embed + the user's first message into the thread
  await thread.send({ embeds: [openEmbed] });

  // Ping the moderation role so staff are immediately notified
  if (modRoleId) {
    await thread.send({
      content: `<@&${modRoleId}> New ticket #${ticketId} opened by <@${user.id}>`,
    });
  }

  if (dmMessage.content) {
    const firstMsgEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ dynamic: true }) })
      .setDescription(dmMessage.content)
      .setTimestamp(dmMessage.createdAt)
      .setFooter({ text: '📨 First message from user' });

    // Forward any attachments
    const files = dmMessage.attachments.map(a => a.url);
    await thread.send({ embeds: [firstMsgEmbed], files });
  }

  // Persist
  const ticket = {
    ticketId,
    guildId,
    userId:    user.id,
    threadId:  thread.id,
    status:    'open',
    priority:  'none',
    claimedBy: null,
    reason:    reason ?? null,
    createdAt: new Date().toISOString(),
    closedAt:  null,
  };


  const tickets   = _loadTickets();
  const threadMap = _loadThreadMap();
  const userMap   = _loadUserMap();

  tickets[ticketId]      = ticket;
  threadMap[thread.id]   = ticketId;
  userMap[user.id]       = ticketId;

  _saveTickets(tickets);
  _saveThreadMap(threadMap);
  _saveUserMap(userMap);

  return ticket;
}

/**
 * Forwards a DM message from the user into the ticket thread.
 *
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').Message} dmMessage
 * @param {object} ticket
 */
async function forwardDMToThread(client, dmMessage, ticket) {
  const thread = await client.channels.fetch(ticket.threadId);
  if (!thread) return;

  const user = dmMessage.author;
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ dynamic: true }) })
    .setDescription(dmMessage.content || '*[no text content]*')
    .setTimestamp(dmMessage.createdAt);

  const files = dmMessage.attachments.map(a => a.url);
  await thread.send({ embeds: [embed], files });
}

/**
 * Forwards a staff thread message back to the user's DM.
 *
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').Message} threadMessage
 * @param {object} ticket
 */
async function forwardThreadToDM(client, threadMessage, ticket) {
  const user = await client.users.fetch(ticket.userId);
  if (!user) return;

  const staff = threadMessage.author;
  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setAuthor({ name: `${staff.tag} (Support)`, iconURL: staff.displayAvatarURL({ dynamic: true }) })
    .setDescription(threadMessage.content || '*[no text content]*')
    .setTimestamp(threadMessage.createdAt)
    .setFooter({ text: 'Reply to this DM to respond to the support team.' });

  const files = threadMessage.attachments.map(a => a.url);

  try {
    await user.send({ embeds: [embed], files });
  } catch {
    // User has DMs closed — post a warning in the thread
    await threadMessage.channel.send({
      content: `⚠️ Could not deliver message to <@${ticket.userId}> — their DMs may be closed.`,
    });
  }
}

/**
 * Claims a ticket thread for a staff member.
 *
 * @param {import('discord.js').Client} client
 * @param {string} threadId
 * @param {import('discord.js').GuildMember} staffMember
 * @returns {Promise<object>} updated ticket
 */
async function claimTicket(client, threadId, staffMember) {
  const tickets   = _loadTickets();
  const threadMap = _loadThreadMap();
  const ticketId  = threadMap[threadId];
  if (!ticketId) throw new Error('No ticket found for this thread.');

  const ticket = tickets[ticketId];
  if (!ticket) throw new Error('Ticket record not found.');
  if (ticket.status === 'closed') throw new Error('This ticket is already closed.');

  ticket.claimedBy = staffMember.id;
  _saveTickets(tickets);

  // Rename the thread to show the claimer
  const thread = await client.channels.fetch(threadId);
  const newName = _buildThreadName(ticket.ticketId, await _getUsername(client, ticket.userId), ticket.priority);
  const claimerTag = staffMember.user.tag;
  const claimedName = `${newName} [${claimerTag}]`.slice(0, 100);
  await thread.setName(claimedName).catch(() => {});

  return ticket;
}

/**
 * Closes a ticket: archives the thread and optionally DMs the user.
 *
 * @param {import('discord.js').Client} client
 * @param {string} threadId
 * @param {import('discord.js').User} closedBy
 * @param {string} [reason]
 * @returns {Promise<object>} updated ticket
 */
async function closeTicket(client, threadId, closedBy, reason) {
  const tickets   = _loadTickets();
  const threadMap = _loadThreadMap();
  const userMap   = _loadUserMap();
  const ticketId  = threadMap[threadId];
  if (!ticketId) throw new Error('No ticket found for this thread.');

  const ticket = tickets[ticketId];
  if (!ticket) throw new Error('Ticket record not found.');
  if (ticket.status === 'closed') throw new Error('This ticket is already closed.');

  ticket.status   = 'closed';
  ticket.closedAt = new Date().toISOString();

  // Remove from active user map
  delete userMap[ticket.userId];

  _saveTickets(tickets);
  _saveUserMap(userMap);

  // Archive the thread
  const thread = await client.channels.fetch(threadId);
  if (thread) {
    const closedName = `[CLOSED] ${thread.name}`.slice(0, 100);
    await thread.setName(closedName).catch(() => {});
    await thread.setArchived(true).catch(() => {});
  }

  // DM the user
  try {
    const user = await client.users.fetch(ticket.userId);
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('🔒 Your support ticket has been closed')
      .setDescription(reason ? `**Reason:** ${reason}` : 'Your ticket has been resolved and closed.')
      .addFields({ name: 'Closed by', value: closedBy.tag, inline: true })
      .setTimestamp()
      .setFooter({ text: 'Send a new DM to open another ticket.' });
    await user.send({ embeds: [embed] });
  } catch {
    // DMs closed — silently ignore
  }

  return ticket;
}

/**
 * Sets the priority of a ticket and renames the thread accordingly.
 *
 * @param {import('discord.js').Client} client
 * @param {string} threadId
 * @param {'none'|'low'|'medium'|'high'} priority
 * @returns {Promise<object>} updated ticket
 */
async function setPriority(client, threadId, priority) {
  if (!PRIORITY_CONFIG[priority]) throw new Error(`Invalid priority: ${priority}`);

  const tickets   = _loadTickets();
  const threadMap = _loadThreadMap();
  const ticketId  = threadMap[threadId];
  if (!ticketId) throw new Error('No ticket found for this thread.');

  const ticket = tickets[ticketId];
  if (!ticket) throw new Error('Ticket record not found.');
  if (ticket.status === 'closed') throw new Error('This ticket is already closed.');

  ticket.priority = priority;
  _saveTickets(tickets);

  // Rename thread with new priority emoji
  const thread   = await client.channels.fetch(threadId);
  const username = await _getUsername(client, ticket.userId);
  const newName  = _buildThreadName(ticket.ticketId, username, priority);

  // Preserve claimer suffix if present
  let finalName = newName;
  if (ticket.claimedBy) {
    const claimer = await client.users.fetch(ticket.claimedBy).catch(() => null);
    if (claimer) finalName = `${newName} [${claimer.tag}]`.slice(0, 100);
  }

  await thread.setName(finalName).catch(() => {});

  return ticket;
}

// ---------------------------------------------------------------------------
// Internal utility
// ---------------------------------------------------------------------------

async function _getUsername(client, userId) {
  try {
    const user = await client.users.fetch(userId);
    return user.username;
  } catch {
    return userId;
  }
}

module.exports = {
  PRIORITY_CONFIG,
  getOpenTicketByUser,
  getTicketByThread,
  createTicket,
  forwardDMToThread,
  forwardThreadToDM,
  claimTicket,
  closeTicket,
  setPriority,
};
