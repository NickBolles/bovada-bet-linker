/**
 * Builds Bovada URLs from event data
 * 
 * Bovada URL structure:
 * https://www.bovada.lv/sports/{sport}/{league}/{sub-category}/{event-slug}-{YYYYMMDDHHMM}
 * 
 * Example:
 * https://www.bovada.lv/sports/tennis/atp/buenos-aires/daniel-elahi-galan-lautaro-midon-202602081100
 */

const BOVADA_BASE_URL = 'https://www.bovada.lv';

/**
 * Builds a Bovada URL for an event
 * @param {Object} event - Event data
 * @returns {string} Bovada URL
 */
export function buildBovadaUrl(event) {
  // If the event already has a link, use it
  if (event.link) {
    // Ensure it's a full URL
    if (event.link.startsWith('http')) {
      return event.link;
    }
    return `${BOVADA_BASE_URL}${event.link}`;
  }

  // If we have raw Bovada data with path info, construct from that
  if (event._raw && event._path) {
    return constructUrlFromPath(event._path, event._raw);
  }

  // Fall back to constructing URL from event data
  return constructUrl(event);
}

/**
 * Constructs URL from Bovada path data
 * @param {Array} path - Bovada path array
 * @param {Object} rawEvent - Raw event data
 * @returns {string} URL
 */
function constructUrlFromPath(path, rawEvent) {
  // Path is typically: [{sport}, {league}, {sub-category?}]
  const pathParts = path.map(p => p.link || slugify(p.description));
  
  // Add the event slug
  const eventSlug = rawEvent.link || createEventSlug(rawEvent);
  
  return `${BOVADA_BASE_URL}/sports/${pathParts.join('/')}/${eventSlug}`;
}

/**
 * Constructs URL from basic event data
 * @param {Object} event - Event data
 * @returns {string} URL
 */
function constructUrl(event) {
  const sport = slugify(event.sport || 'sports');
  const league = slugify(event.league || 'events');
  const eventSlug = createEventSlug(event);

  return `${BOVADA_BASE_URL}/sports/${sport}/${league}/${eventSlug}`;
}

/**
 * Creates an event slug from event data
 * @param {Object} event - Event data
 * @returns {string} Event slug
 */
function createEventSlug(event) {
  const participants = [event.participant1, event.participant2]
    .filter(Boolean)
    .map(p => slugify(p))
    .join('-');

  // Add timestamp if available
  let timestamp = '';
  if (event.startTime) {
    const date = new Date(event.startTime);
    timestamp = formatTimestamp(date);
  }

  return timestamp ? `${participants}-${timestamp}` : participants;
}

/**
 * Converts a string to a URL-friendly slug
 * @param {string} str - String to slugify
 * @returns {string} Slugified string
 */
export function slugify(str) {
  if (!str) return '';
  
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Formats a date as Bovada timestamp (YYYYMMDDHHMM)
 * @param {Date} date - Date to format
 * @returns {string} Formatted timestamp
 */
export function formatTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}${month}${day}${hours}${minutes}`;
}

/**
 * Parses a Bovada URL to extract event information
 * @param {string} url - Bovada URL
 * @returns {Object} Parsed URL data
 */
export function parseBovadaUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);

    // Expected: ['sports', sport, league, sub-category?, event-slug]
    if (pathParts[0] !== 'sports') {
      return null;
    }

    const sport = pathParts[1];
    const league = pathParts[2];
    const eventSlug = pathParts[pathParts.length - 1];

    // Extract timestamp from event slug (last 12 digits)
    const timestampMatch = eventSlug.match(/(\d{12})$/);
    const timestamp = timestampMatch ? timestampMatch[1] : null;

    // Extract participant names (everything before timestamp)
    const participantsPart = timestamp 
      ? eventSlug.slice(0, -timestamp.length - 1) 
      : eventSlug;
    const participants = participantsPart.split('-');

    return {
      sport,
      league,
      eventSlug,
      timestamp,
      participants,
    };
  } catch (error) {
    return null;
  }
}
