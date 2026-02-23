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
  // Check for debug mode
  const debugMode = message.content.toLowerCase().includes('/debug');
  const cleanContent = message.content.replace(/\/debug/gi, '').trim();
  
  console.log(`📨 Processing: "${cleanContent}"${debugMode ? ' (DEBUG)' : ''}`);

  // Step 1: Parse the pick using LLM
  const parsedPick = await parsePick(cleanContent, anthropicApiKey);
  
  if (!parsedPick || !parsedPick.isValidPick) {
    console.log('  ↳ Not a valid pick, skipping');
    if (debugMode) {
      await message.reply({
        content: `🔍 **Debug:** Not recognized as a valid pick\n\`\`\`json\n${JSON.stringify(parsedPick, null, 2)}\n\`\`\``,
      });
    }
    return;
  }

  console.log('  ↳ Parsed pick:', JSON.stringify(parsedPick, null, 2));

  // Step 2: Fetch current Bovada events
  const events = await fetchBovadaEvents(parsedPick.sport);

  // Step 3: Find matching event (with debug info)
  const { findMatchingEventWithDebug } = await import('./matcher.js');
  const matchResult = await findMatchingEventWithDebug(parsedPick, events, anthropicApiKey);
  const matchedEvent = matchResult?.event || null;

  if (debugMode) {
    const debugInfo = formatDebugInfo(parsedPick, events, matchResult);
    await message.reply({ content: debugInfo });
  }

  if (!matchedEvent) {
    console.log('  ↳ No matching event found');
    if (!debugMode) {
      await message.reply({
        content: `⚠️ Couldn't find a matching Bovada event for: **${parsedPick.description || cleanContent}**`,
      });
    }
    return;
  }

  console.log('  ↳ Matched event:', matchedEvent);

  // Step 4: Build Bovada URL
  const url = buildBovadaUrl(matchedEvent);

  // Step 5: Reply with the link (skip if debug mode already replied)
  if (!debugMode) {
    const replyContent = formatReply(parsedPick, matchedEvent, url);
    await message.reply({ content: replyContent });
  }

  console.log('  ↳ Replied with link:', url);
}

/**
 * Formats debug information
 * @param {Object} parsedPick - Parsed pick data
 * @param {Array} events - All events fetched
 * @param {Object} matchResult - Match result with candidates
 * @returns {string} Formatted debug output
 */
function formatDebugInfo(parsedPick, events, matchResult) {
  const lines = ['🔍 **Debug Output**\n'];
  
  // Parsed pick
  lines.push('**Parsed Pick:**');
  lines.push(`• Players: ${parsedPick.players?.join(', ') || 'none'}`);
  lines.push(`• Sport: ${parsedPick.sport || 'not detected'}`);
  lines.push(`• Bet Type: ${parsedPick.betType || 'unknown'}`);
  lines.push(`• Odds: ${parsedPick.odds || 'unknown'}`);
  lines.push('');
  
  // Events summary
  lines.push(`**Events Found:** ${events?.length || 0}`);
  if (events && events.length > 0) {
    const sportCounts = {};
    events.forEach(e => {
      const sport = e.sport || 'unknown';
      sportCounts[sport] = (sportCounts[sport] || 0) + 1;
    });
    lines.push(`• By sport: ${Object.entries(sportCounts).map(([k, v]) => `${k}(${v})`).join(', ')}`);
  }
  lines.push('');
  
  // Top candidates
  if (matchResult?.candidates && matchResult.candidates.length > 0) {
    lines.push('**Top 5 Matches:**');
    matchResult.candidates.slice(0, 5).forEach((c, i) => {
      const name = c.event.displayName || c.event.description || 'Unknown';
      lines.push(`${i + 1}. \`${(c.score * 100).toFixed(0)}%\` ${name.substring(0, 40)}`);
    });
  } else {
    lines.push('**Top Matches:** No candidates found');
  }
  lines.push('');
  
  // Final result
  if (matchResult?.event) {
    const url = buildBovadaUrl(matchResult.event);
    lines.push(`**✅ Best Match:** ${matchResult.event.displayName || matchResult.event.description}`);
    lines.push(`**Confidence:** ${((matchResult.confidence || 0) * 100).toFixed(0)}%`);
    lines.push(`**Link:** ${url}`);
  } else {
    lines.push('**❌ No Match Found**');
  }
  
  return lines.join('\n');
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
