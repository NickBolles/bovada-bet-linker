import Anthropic from '@anthropic-ai/sdk';

/**
 * Finds the best matching event for a parsed pick
 * @param {Object} parsedPick - The parsed pick data
 * @param {Array} events - List of available events from Bovada
 * @param {string} apiKey - Anthropic API key
 * @returns {Promise<Object|null>} Matched event or null
 */
export async function findMatchingEvent(parsedPick, events, apiKey) {
  const result = await findMatchingEventWithDebug(parsedPick, events, apiKey);
  return result?.event || null;
}

/**
 * Finds the best matching event with debug info
 * @param {Object} parsedPick - The parsed pick data
 * @param {Array} events - List of available events from Bovada
 * @param {string} apiKey - Anthropic API key
 * @returns {Promise<Object>} Result with event, confidence, and candidates
 */
export async function findMatchingEventWithDebug(parsedPick, events, apiKey) {
  if (!events || events.length === 0) {
    return { event: null, confidence: 0, candidates: [] };
  }

  // Get all candidates with scores
  const simpleResult = findMatchingEventSimple(parsedPick, events);
  const candidates = simpleResult?.allCandidates || [];
  
  // First, try simple matching
  if (simpleResult && simpleResult.confidence >= 0.5) {
    // Good enough match - use it directly
    if (simpleResult.confidence >= 0.7 || !apiKey) {
      return {
        event: simpleResult.event,
        confidence: simpleResult.confidence,
        candidates,
      };
    }
  }

  // If simple matching is inconclusive and we have an API key, use LLM
  if (apiKey) {
    const llmMatch = await findMatchingEventLLM(parsedPick, events, apiKey);
    if (llmMatch) {
      return {
        event: llmMatch,
        confidence: 0.9, // LLM match assumed high confidence
        candidates,
      };
    }
  }

  // Fall back to best simple match if we have one
  if (simpleResult && simpleResult.confidence >= 0.3) {
    return {
      event: simpleResult.event,
      confidence: simpleResult.confidence,
      candidates,
    };
  }

  return { event: null, confidence: 0, candidates };
}

/**
 * Simple matching without LLM - uses string matching
 * @param {Object} parsedPick - The parsed pick data
 * @param {Array} events - List of available events
 * @returns {Object|null} Match result with confidence score and all candidates
 */
export function findMatchingEventSimple(parsedPick, events) {
  const { players, sport, league } = parsedPick;
  
  if (!players || players.length === 0) {
    return null;
  }

  let bestMatch = null;
  let bestScore = 0;
  const allCandidates = [];

  for (const event of events) {
    let score = 0;

    // Check sport match
    if (sport && event.sport) {
      if (event.sport.toLowerCase() === sport.toLowerCase()) {
        score += 0.2;
      }
    }

    // Check league match
    if (league && event.league) {
      if (event.league.toLowerCase().includes(league.toLowerCase())) {
        score += 0.1;
      }
    }

    // Check player/team name matches
    for (const playerName of players) {
      const normalizedPlayer = normalizePlayerName(playerName);
      
      // Check against event participants
      const participants = [
        event.participant1,
        event.participant2,
        event.description,
        event.displayName,
      ].filter(Boolean).map(p => normalizePlayerName(p));

      let playerMatched = false;
      for (const participant of participants) {
        if (playerMatched) break;
        
        // Exact full name match
        if (participant === normalizedPlayer) {
          score += 0.7;
          playerMatched = true;
          break;
        }
        
        // Player name is contained in participant (e.g., "pegula" in "jessica pegula")
        if (participant.includes(normalizedPlayer) && normalizedPlayer.length >= 3) {
          score += 0.6;
          playerMatched = true;
          break;
        }
        
        // Participant name is contained in player (e.g., "jessica pegula" starts with "jessica")
        if (normalizedPlayer.includes(participant) && participant.length >= 3) {
          score += 0.5;
          playerMatched = true;
          break;
        }
        
        // Partial match (last name match)
        const playerParts = normalizedPlayer.split(' ');
        const participantParts = participant.split(' ');
        for (const part of playerParts) {
          if (part.length > 2 && participantParts.some(pp => pp === part || pp.includes(part))) {
            score += 0.4;
            playerMatched = true;
            break;
          }
        }
      }
    }

    // Track all candidates with scores > 0
    if (score > 0) {
      allCandidates.push({ event, score });
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = event;
    }
  }

  // Sort candidates by score descending
  allCandidates.sort((a, b) => b.score - a.score);

  if (bestMatch) {
    return {
      event: bestMatch,
      confidence: Math.min(bestScore, 1.0),
      allCandidates,
    };
  }

  return { event: null, confidence: 0, allCandidates };
}

/**
 * LLM-powered matching for ambiguous cases
 * @param {Object} parsedPick - The parsed pick data
 * @param {Array} events - List of available events
 * @param {string} apiKey - Anthropic API key
 * @returns {Promise<Object|null>} Matched event or null
 */
async function findMatchingEventLLM(parsedPick, events, apiKey) {
  const client = new Anthropic({ apiKey });

  // Limit events to prevent token overflow
  const eventSummaries = events.slice(0, 50).map((event, index) => ({
    index,
    sport: event.sport,
    league: event.league,
    description: event.description || event.displayName,
    participant1: event.participant1,
    participant2: event.participant2,
    startTime: event.startTime,
  }));

  const systemPrompt = `You are a sports betting event matcher. Given a betting pick and a list of events, find the best matching event.

Consider:
- Player/team name similarity (including partial matches, nicknames, last names)
- Sport and league context
- Timing (prefer upcoming events)

If no good match exists, respond with: {"matchIndex": null, "confidence": 0, "reasoning": "..."}
Otherwise respond with: {"matchIndex": <number>, "confidence": <0-1>, "reasoning": "..."}

Respond with valid JSON only.`;

  const userPrompt = `Find the matching event for this pick:

Pick: ${JSON.stringify(parsedPick, null, 2)}

Available events:
${JSON.stringify(eventSummaries, null, 2)}

Which event index best matches? JSON only:`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      system: systemPrompt,
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return null;
    }

    const result = JSON.parse(content.text.trim());

    if (result.matchIndex !== null && result.matchIndex >= 0 && result.matchIndex < events.length) {
      console.log(`  ↳ LLM match: ${result.reasoning} (confidence: ${result.confidence})`);
      return events[result.matchIndex];
    }

    return null;
  } catch (error) {
    console.error('Error in LLM matching:', error.message);
    return null;
  }
}

/**
 * Normalizes a player/team name for matching
 * @param {string} name - Name to normalize
 * @returns {string} Normalized name
 */
function normalizePlayerName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ')
    .trim();
}
