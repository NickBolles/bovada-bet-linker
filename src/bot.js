import { Client, GatewayIntentBits, Events } from 'discord.js';
import { parsePick } from './parser.js';
import { findMatchingEvent } from './matcher.js';
import { buildBovadaUrl } from './urlBuilder.js';
import { fetchBovadaEvents } from './bovada.js';

/**
 * Creates and configures the Discord bot
 * @param {Object} config - Bot configuration
 * @param {string} config.discordToken - Discord bot token
 * @param {string} config.picksChannelId - Channel ID to monitor (optional, monitors all if not set)
 * @param {string} config.anthropicApiKey - Anthropic API key
 * @returns {Object} Bot instance with start/stop methods
 */
export function createBot(config) {
  const { discordToken, picksChannelId, anthropicApiKey } = config;

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`✅ Logged in as ${readyClient.user.tag}`);
    if (picksChannelId) {
      console.log(`👀 Monitoring channel: ${picksChannelId}`);
    } else {
      console.log('👀 Monitoring all channels (no PICKS_CHANNEL_ID set)');
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;

    // If a specific channel is configured, only process messages from that channel
    if (picksChannelId && message.channel.id !== picksChannelId) return;

    // Skip messages that look like commands or are too short
    if (message.content.startsWith('!') || message.content.length < 5) return;

    try {
      await handlePickMessage(message, anthropicApiKey);
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  return {
    start: async () => {
      await client.login(discordToken);
    },
    stop: () => {
      client.destroy();
    },
    client, // Expose for testing
  };
}

/**
 * Handles a potential pick message
 * @param {Message} message - Discord message
 * @param {string} anthropicApiKey - Anthropic API key
 */
async function handlePickMessage(message, anthropicApiKey) {
  console.log(`📨 Processing: "${message.content}"`);

  // Step 1: Parse the pick using LLM
  const parsedPick = await parsePick(message.content, anthropicApiKey);
  
  if (!parsedPick || !parsedPick.isValidPick) {
    console.log('  ↳ Not a valid pick, skipping');
    return;
  }

  console.log('  ↳ Parsed pick:', JSON.stringify(parsedPick, null, 2));

  // Step 2: Fetch current Bovada events
  const events = await fetchBovadaEvents(parsedPick.sport);

  // Step 3: Find matching event
  const matchedEvent = await findMatchingEvent(parsedPick, events, anthropicApiKey);

  if (!matchedEvent) {
    console.log('  ↳ No matching event found');
    await message.reply({
      content: `⚠️ Couldn't find a matching Bovada event for: **${parsedPick.description || message.content}**`,
    });
    return;
  }

  console.log('  ↳ Matched event:', matchedEvent);

  // Step 4: Build Bovada URL
  const url = buildBovadaUrl(matchedEvent);

  // Step 5: Reply with the link
  const replyContent = formatReply(parsedPick, matchedEvent, url);
  await message.reply({ content: replyContent });

  console.log('  ↳ Replied with link:', url);
}

/**
 * Formats the reply message
 * @param {Object} parsedPick - Parsed pick data
 * @param {Object} matchedEvent - Matched event data
 * @param {string} url - Bovada URL
 * @returns {string} Formatted reply
 */
function formatReply(parsedPick, matchedEvent, url) {
  const betType = parsedPick.betType || 'bet';
  const odds = parsedPick.odds ? ` (${parsedPick.odds})` : '';
  const eventName = matchedEvent.displayName || matchedEvent.description;

  return `🎯 **${eventName}**\n📊 ${betType}${odds}\n🔗 ${url}`;
}
