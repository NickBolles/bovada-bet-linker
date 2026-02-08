# Bovada Bet Linker

A Discord bot that parses natural language betting picks and generates clickable Bovada deep links.

## Features

- 🎯 **Natural Language Parsing** — Understands picks like "Galan ML -110: 1 unit"
- 🔗 **Deep Link Generation** — Creates direct links to Bovada event pages
- 🤖 **LLM-Powered Matching** — Uses Claude to fuzzy match player names and infer context
- ⚡ **Real-time** — Monitors a Discord channel and responds instantly

## How It Works

1. User posts a pick in the monitored channel: `Galan ml -110: 1 unit`
2. Bot parses the pick using Claude to extract structured data
3. Bot matches against current Bovada events
4. Bot replies with a clickable link: [Galan ML -110](https://www.bovada.lv/sports/tennis/...)

## Setup

### Prerequisites

- Node.js 20+
- Discord Bot Token ([create one here](https://discord.com/developers/applications))
- Anthropic API Key ([get one here](https://console.anthropic.com/))

### Installation

```bash
# Clone the repo
git clone https://github.com/NickBolles/bovada-bet-linker.git
cd bovada-bet-linker

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env

# Start the bot
npm start
```

### Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section, create a bot, copy the token
4. Go to "OAuth2" > "URL Generator"
5. Select scopes: `bot`, `applications.commands`
6. Select permissions: `Send Messages`, `Read Message History`, `View Channels`
7. Use the generated URL to invite the bot to your server

## Configuration

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Your Discord bot token |
| `PICKS_CHANNEL_ID` | Channel ID to monitor for picks |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `ODDS_API_KEY` | (Optional) The Odds API key for live data |

## Architecture

```
src/
├── index.js        # Entry point
├── bot.js          # Discord bot setup
├── parser.js       # LLM pick parsing
├── matcher.js      # Event matching logic
├── bovada.js       # Bovada data fetching
└── urlBuilder.js   # URL construction
```

## Development

```bash
# Run with auto-reload
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## License

MIT
