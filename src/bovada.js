/**
 * Bovada event fetching and caching
 * 
 * Note: Bovada doesn't have a public API. Options:
 * 1. Use The Odds API (paid, but reliable)
 * 2. Scrape Bovada directly (fragile, ToS concerns)
 * 3. Use mock data for development
 * 
 * This module provides an abstraction layer so we can swap implementations.
 */

// In-memory cache for events
const eventCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches events from Bovada for a given sport
 * @param {string} sport - Sport to fetch (e.g., "tennis", "basketball")
 * @returns {Promise<Array>} List of events
 */
export async function fetchBovadaEvents(sport) {
  const cacheKey = sport || 'all';
  const cached = eventCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`  ↳ Using cached events for ${cacheKey}`);
    return cached.events;
  }

  // Try different data sources in order of preference
  let events = [];

  // Option 1: Try The Odds API if configured
  if (process.env.ODDS_API_KEY) {
    events = await fetchFromOddsAPI(sport);
  }

  // Option 2: Try scraping Bovada directly
  if (events.length === 0) {
    events = await fetchFromBovadaDirect(sport);
  }

  // Option 3: Fall back to mock data for development
  if (events.length === 0) {
    console.log('  ↳ Using mock event data (configure ODDS_API_KEY for live data)');
    events = getMockEvents(sport);
  }

  // Cache the results
  eventCache.set(cacheKey, {
    events,
    timestamp: Date.now(),
  });

  return events;
}

/**
 * Fetches events from The Odds API
 * @param {string} sport - Sport to fetch
 * @returns {Promise<Array>} Events
 */
async function fetchFromOddsAPI(sport) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return [];

  // Map our sport names to The Odds API sport keys
  const sportKeyMap = {
    tennis: 'tennis_atp_aus_open_singles', // TODO: Support multiple tennis leagues
    basketball: 'basketball_nba',
    football: 'americanfootball_nfl',
    baseball: 'baseball_mlb',
    hockey: 'icehockey_nhl',
    soccer: 'soccer_epl',
    mma: 'mma_mixed_martial_arts',
  };

  const sportKey = sport ? sportKeyMap[sport.toLowerCase()] : null;
  if (!sportKey) {
    console.log(`  ↳ Unknown sport for Odds API: ${sport}`);
    return [];
  }

  try {
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${apiKey}&regions=us&markets=h2h,spreads,totals&bookmakers=bovada`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`  ↳ Odds API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    // Transform to our event format
    return data.map(event => ({
      id: event.id,
      sport: sport,
      league: event.sport_title,
      description: `${event.home_team} vs ${event.away_team}`,
      displayName: `${event.home_team} vs ${event.away_team}`,
      participant1: event.home_team,
      participant2: event.away_team,
      startTime: event.commence_time,
      markets: event.bookmakers?.find(b => b.key === 'bovada')?.markets || [],
      // Store raw data for URL building
      _raw: event,
    }));
  } catch (error) {
    console.error(`  ↳ Odds API fetch error: ${error.message}`);
    return [];
  }
}

/**
 * Fetches events by scraping Bovada directly
 * @param {string} sport - Sport to fetch (null = fetch all sports)
 * @returns {Promise<Array>} Events
 */
async function fetchFromBovadaDirect(sport) {
  // Bovada has a JSON API that powers their site
  // This is undocumented and may break, but works for now
  
  const sportPaths = {
    tennis: '/services/sports/event/coupon/events/A/description/tennis',
    basketball: '/services/sports/event/coupon/events/A/description/basketball',
    football: '/services/sports/event/coupon/events/A/description/football',
    baseball: '/services/sports/event/coupon/events/A/description/baseball',
    hockey: '/services/sports/event/coupon/events/A/description/hockey',
    soccer: '/services/sports/event/coupon/events/A/description/soccer',
    mma: '/services/sports/event/coupon/events/A/description/ufc-mma',
  };

  // If no sport specified, fetch all sports in parallel
  if (!sport) {
    console.log('  ↳ Fetching all sports from Bovada...');
    const allSports = Object.keys(sportPaths);
    const results = await Promise.all(
      allSports.map(s => fetchFromBovadaDirect(s).catch(() => []))
    );
    return results.flat();
  }

  const path = sportPaths[sport.toLowerCase()];
  if (!path) {
    return [];
  }

  try {
    const url = `https://www.bovada.lv${path}?marketFilterId=def&preMatchOnly=true&lang=en`;
    console.log(`  ↳ Fetching: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://www.bovada.lv',
        'Referer': 'https://www.bovada.lv/sports/tennis',
      },
    });

    if (!response.ok) {
      console.error(`  ↳ Bovada direct fetch error: ${response.status} for ${sport}`);
      console.error(`  ↳ URL: ${url}`);
      return [];
    }

    const data = await response.json();
    
    // Parse Bovada's response format
    return parseBovadaResponse(data, sport);
  } catch (error) {
    console.error(`  ↳ Bovada direct fetch error: ${error.message}`);
    return [];
  }
}

/**
 * Parses Bovada's API response into our event format
 * @param {Array} data - Raw Bovada response
 * @param {string} sport - Sport name
 * @returns {Array} Parsed events
 */
function parseBovadaResponse(data, sport) {
  const events = [];

  if (!Array.isArray(data)) return events;

  for (const group of data) {
    if (!group.events) continue;

    // Get league info from path
    const pathInfo = group.path || [];
    const leaguePath = pathInfo.find(p => p.type === 'LEAGUE');
    const tourPath = pathInfo.find(p => p.type === 'TOUR');

    for (const event of group.events) {
      const competitors = event.competitors || [];
      const participant1 = competitors[0]?.name || '';
      const participant2 = competitors[1]?.name || '';

      events.push({
        id: event.id,
        sport: sport,
        league: leaguePath?.description || tourPath?.description || group.description,
        description: event.description,
        displayName: event.description,
        participant1,
        participant2,
        startTime: event.startTime ? new Date(event.startTime).toISOString() : null,
        link: event.link, // Direct link from Bovada!
        live: event.live || false,
        // Store for URL building
        _raw: event,
        _path: pathInfo,
      });
    }
  }

  return events;
}

/**
 * Returns mock events for development/testing
 * @param {string} sport - Sport to get mocks for
 * @returns {Array} Mock events
 */
export function getMockEvents(sport) {
  const mockEvents = {
    tennis: [
      {
        id: 'mock-tennis-1',
        sport: 'tennis',
        league: 'ATP Buenos Aires',
        description: 'Daniel Elahi Galan vs Lautaro Midon',
        displayName: 'Galan vs Midon',
        participant1: 'Daniel Elahi Galan',
        participant2: 'Lautaro Midon',
        startTime: new Date(Date.now() + 3600000).toISOString(),
        link: '/sports/tennis/atp/buenos-aires/daniel-elahi-galan-lautaro-midon-202602081100',
      },
      {
        id: 'mock-tennis-2',
        sport: 'tennis',
        league: 'WTA Austin',
        description: 'Jessica Pegula vs Rebecca Sramkova',
        displayName: 'Pegula vs Sramkova',
        participant1: 'Jessica Pegula',
        participant2: 'Rebecca Sramkova',
        startTime: new Date(Date.now() + 86400000).toISOString(),
        link: '/sports/tennis/wta/austin/jessica-pegula-rebecca-sramkova-202602241100',
      },
      {
        id: 'mock-tennis-3',
        sport: 'tennis',
        league: 'ATP Acapulco',
        description: 'Sebastian Korda vs Mattia Bellucci',
        displayName: 'Korda vs Bellucci',
        participant1: 'Sebastian Korda',
        participant2: 'Mattia Bellucci',
        startTime: new Date(Date.now() + 86400000).toISOString(),
        link: '/sports/tennis/atp/acapulco/sebastian-korda-mattia-bellucci-202602241100',
      },
      {
        id: 'mock-tennis-4',
        sport: 'tennis',
        league: 'Davis Cup',
        description: 'Escobar/Hidalgo vs Hijikata/Thompson',
        displayName: 'Escobar/Hidalgo vs Hijikata/Thompson',
        participant1: 'G. Escobar / D. Hidalgo',
        participant2: 'Rinky Hijikata / Jordan Thompson',
        startTime: new Date(Date.now() + 7200000).toISOString(),
        link: '/sports/tennis/davis-cup/davis-cup/g-escobar-d-hidalgo-rinky-hijikata-jordan-thompson-202602081100',
      },
    ],
    basketball: [
      {
        id: 'mock-nba-1',
        sport: 'basketball',
        league: 'NBA',
        description: 'Los Angeles Lakers vs Boston Celtics',
        displayName: 'Lakers vs Celtics',
        participant1: 'Los Angeles Lakers',
        participant2: 'Boston Celtics',
        startTime: new Date(Date.now() + 86400000).toISOString(),
        link: '/sports/basketball/nba/los-angeles-lakers-boston-celtics-202602091900',
      },
    ],
  };

  if (sport && mockEvents[sport.toLowerCase()]) {
    return mockEvents[sport.toLowerCase()];
  }

  // Return all mock events if no sport specified
  return Object.values(mockEvents).flat();
}

/**
 * Clears the event cache
 */
export function clearEventCache() {
  eventCache.clear();
}
