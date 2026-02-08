import Anthropic from '@anthropic-ai/sdk';

/**
 * Parses a betting pick from natural language using Claude
 * @param {string} text - The pick text to parse
 * @param {string} apiKey - Anthropic API key
 * @returns {Promise<Object|null>} Parsed pick data or null if not a valid pick
 */
export async function parsePick(text, apiKey) {
  const client = new Anthropic({ apiKey });

  const systemPrompt = `You are a sports betting pick parser. Your job is to extract structured data from betting picks.

Given a betting pick message, extract:
1. isValidPick: boolean - Is this actually a betting pick? (not just casual conversation)
2. sport: string - The sport (e.g., "tennis", "basketball", "football", "baseball", "hockey", "soccer", "mma")
3. league: string | null - The league/tournament if identifiable (e.g., "ATP", "NFL", "NBA", "NHL", "MLB", "UFC")
4. players: string[] - Player or team names mentioned (even partial names like last names)
5. betType: string - Type of bet: "ML" (moneyline), "spread", "over", "under", "prop", or description
6. line: number | null - The line/spread number if applicable (e.g., -3.5, 23.5)
7. odds: string | null - The odds (e.g., "-110", "+150")
8. units: number | null - The unit size if mentioned
9. description: string - A clean description of the bet

Context clues for sport identification:
- Tennis: Player last names, "doubles", ATP/WTA, Grand Slam names
- Basketball: Team cities, NBA teams, "points", college team names
- Football: NFL teams, college teams, "spread"
- Baseball: MLB teams, "run line"
- Hockey: NHL teams, "puck line"
- Soccer: Club names, leagues like EPL, La Liga, Serie A
- MMA/UFC: Fighter names, "by KO", "by submission"

Respond with valid JSON only. No markdown, no explanation.`;

  const userPrompt = `Parse this betting pick:

"${text}"

Respond with JSON only:`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      system: systemPrompt,
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return null;
    }

    // Parse the JSON response
    const jsonStr = content.text.trim();
    const parsed = JSON.parse(jsonStr);

    return parsed;
  } catch (error) {
    console.error('Error parsing pick:', error.message);
    return null;
  }
}

/**
 * Parses a pick without using an API (for testing)
 * Uses simple pattern matching
 * @param {string} text - The pick text to parse
 * @returns {Object|null} Parsed pick data
 */
export function parsePickSimple(text) {
  const lowerText = text.toLowerCase();

  // Check if it looks like a betting pick
  const betPatterns = [
    /\b(ml|moneyline)\b/i,
    /[+-]\d+(\.\d+)?/,  // Odds or spreads
    /\b(over|under|o|u)\s*\d+/i,
    /\b\d+(\.\d+)?\s*(units?|u)\b/i,
  ];

  const isValidPick = betPatterns.some(pattern => pattern.test(text));
  if (!isValidPick) {
    return { isValidPick: false };
  }

  // Extract odds (e.g., -110, +150)
  const oddsMatch = text.match(/([+-]\d{3,})/);
  const odds = oddsMatch ? oddsMatch[1] : null;

  // Extract line for over/under or spread
  const lineMatch = text.match(/(?:over|under|o|u|[+-])\s*(\d+\.?\d*)/i);
  const line = lineMatch ? parseFloat(lineMatch[1]) : null;

  // Extract units
  const unitsMatch = text.match(/(\d+\.?\d*)\s*(?:units?|u)\b/i);
  const units = unitsMatch ? parseFloat(unitsMatch[1]) : null;

  // Determine bet type
  let betType = 'ML';
  if (/\b(over|o)\s*\d/i.test(text)) betType = 'over';
  else if (/\b(under|u)\s*\d/i.test(text)) betType = 'under';
  // Spread detection: look for point spreads like -7.5, +3.5 (with .5 usually)
  // Exclude odds which are typically 3+ digits (like -110, +150)
  else if (/[+-]\d+\.5\b/.test(text)) betType = 'spread';
  // Also catch whole number spreads followed by odds (e.g., -7 -110)
  else if (/[+-]\d{1,2}\s+[+-]\d{3}/.test(text)) betType = 'spread';

  // Extract player/team names (everything before the bet indicators)
  const nameMatch = text.match(/^([^+-]+?)(?:\s+(?:ml|moneyline|over|under|[+-]\d))/i);
  const players = nameMatch 
    ? [nameMatch[1].trim()]
    : [text.split(/\s+/)[0]]; // Fall back to first word

  return {
    isValidPick: true,
    sport: null, // Can't reliably determine without context
    league: null,
    players,
    betType,
    line,
    odds,
    units,
    description: text.trim(),
  };
}
