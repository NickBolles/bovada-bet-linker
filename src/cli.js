#!/usr/bin/env node
/**
 * CLI tool for testing pick parsing and link generation
 * Usage: node src/cli.js "Galan ML -110"
 */

import 'dotenv/config';
import { parsePick, parsePickSimple } from './parser.js';
import { findMatchingEvent, findMatchingEventSimple } from './matcher.js';
import { buildBovadaUrl } from './urlBuilder.js';
import { fetchBovadaEvents } from './bovada.js';

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
Bovada Bet Linker - CLI Demo

Usage:
  node src/cli.js "<pick text>"              Parse a pick and generate link
  node src/cli.js --mock "<pick text>"       Use mock data only (no API calls)
  node src/cli.js --parse "<pick text>"      Only parse, don't match
  node src/cli.js --events [sport]           List available events

Examples:
  node src/cli.js "Galan ML -110: 1 unit"
  node src/cli.js --mock "Lakers +150: 2u"
  node src/cli.js --events tennis

Options:
  --mock      Use mock event data (no API key needed)
  --parse     Only parse the pick, don't match to events
  --events    List available events for a sport
  --simple    Use simple parser (no LLM)
  --help, -h  Show this help
`);
  process.exit(0);
}

async function main() {
  const useMock = args.includes('--mock');
  const parseOnly = args.includes('--parse');
  const listEvents = args.includes('--events');
  const useSimple = args.includes('--simple');

  // Filter out flags to get the actual input
  const input = args.filter(a => !a.startsWith('--')).join(' ');

  if (listEvents) {
    await showEvents(input || undefined);
    return;
  }

  if (!input) {
    console.error('Error: Please provide a pick to parse');
    process.exit(1);
  }

  console.log('📝 Input:', input);
  console.log('');

  // Step 1: Parse
  let parsed;
  if (useSimple || !process.env.ANTHROPIC_API_KEY) {
    console.log('🔍 Parsing (simple mode)...');
    parsed = parsePickSimple(input);
  } else {
    console.log('🤖 Parsing (LLM mode)...');
    parsed = await parsePick(input, process.env.ANTHROPIC_API_KEY);
  }

  console.log('📊 Parsed:', JSON.stringify(parsed, null, 2));
  console.log('');

  if (!parsed || !parsed.isValidPick) {
    console.log('❌ Not recognized as a valid betting pick');
    process.exit(1);
  }

  if (parseOnly) {
    return;
  }

  // Step 2: Fetch events
  let sport = parsed.sport;
  
  // Force mock mode if requested or no API key
  if (useMock) {
    process.env.ODDS_API_KEY = '';
  }
  
  // If no sport detected, fetch all events (for demo/mock mode)
  if (!sport) {
    console.log('📅 Fetching all events (sport not detected)...');
  } else {
    console.log(`📅 Fetching ${sport} events...`);
  }
  
  const events = await fetchBovadaEvents(sport);
  console.log(`   Found ${events.length} events`);
  console.log('');

  if (events.length === 0) {
    console.log('⚠️  No events found. Try --mock for demo data.');
    process.exit(1);
  }

  // Step 3: Match
  console.log('🎯 Matching to event...');
  let matched;
  if (useSimple || !process.env.ANTHROPIC_API_KEY) {
    const result = findMatchingEventSimple(parsed, events);
    matched = result?.event;
    if (result) {
      console.log(`   Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    }
  } else {
    matched = await findMatchingEvent(parsed, events, process.env.ANTHROPIC_API_KEY);
  }

  if (!matched) {
    console.log('❌ No matching event found');
    process.exit(1);
  }

  console.log('✅ Matched:', matched.description || matched.displayName);
  console.log('');

  // Step 4: Build URL
  const url = buildBovadaUrl(matched);
  console.log('🔗 Bovada Link:');
  console.log(`   ${url}`);
}

async function showEvents(sport) {
  console.log(`📅 Available ${sport || 'all'} events:\n`);
  
  const events = await fetchBovadaEvents(sport);
  
  if (events.length === 0) {
    console.log('No events found. Using mock data might not have this sport.');
    return;
  }

  for (const event of events) {
    console.log(`• ${event.description || event.displayName}`);
    console.log(`  Sport: ${event.sport} | League: ${event.league}`);
    console.log(`  ${event.participant1} vs ${event.participant2}`);
    if (event.startTime) {
      console.log(`  Time: ${new Date(event.startTime).toLocaleString()}`);
    }
    console.log('');
  }
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
