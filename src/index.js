import 'dotenv/config';
import { createBot } from './bot.js';

const requiredEnvVars = ['DISCORD_TOKEN', 'ANTHROPIC_API_KEY'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Error: Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

console.log('🚀 Starting Bovada Bet Linker...');

const bot = createBot({
  discordToken: process.env.DISCORD_TOKEN,
  picksChannelId: process.env.PICKS_CHANNEL_ID,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
});

bot.start().catch((error) => {
  console.error('Failed to start bot:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  bot.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down...');
  bot.stop();
  process.exit(0);
});
