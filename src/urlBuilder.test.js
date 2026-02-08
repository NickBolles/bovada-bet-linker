import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildBovadaUrl, slugify, formatTimestamp, parseBovadaUrl } from './urlBuilder.js';

describe('slugify', () => {
  it('converts to lowercase', () => {
    assert.strictEqual(slugify('HELLO'), 'hello');
  });

  it('replaces spaces with hyphens', () => {
    assert.strictEqual(slugify('hello world'), 'hello-world');
  });

  it('removes special characters', () => {
    assert.strictEqual(slugify('hello! @world#'), 'hello-world');
  });

  it('removes accents', () => {
    assert.strictEqual(slugify('José García'), 'jose-garcia');
  });

  it('collapses multiple hyphens', () => {
    assert.strictEqual(slugify('hello   world'), 'hello-world');
  });

  it('handles empty strings', () => {
    assert.strictEqual(slugify(''), '');
  });

  it('handles player names correctly', () => {
    assert.strictEqual(slugify('Daniel Elahi Galan'), 'daniel-elahi-galan');
  });
});

describe('formatTimestamp', () => {
  it('formats date correctly', () => {
    const date = new Date('2026-02-08T11:00:00Z');
    const result = formatTimestamp(date);
    
    // Note: result depends on local timezone
    assert.ok(/^\d{12}$/.test(result), 'Should be 12 digits');
    assert.ok(result.startsWith('2026'), 'Should start with year');
  });

  it('pads single digit months and days', () => {
    const date = new Date('2026-02-08T05:05:00Z');
    const result = formatTimestamp(date);
    
    assert.ok(/^\d{12}$/.test(result));
  });
});

describe('buildBovadaUrl', () => {
  it('uses existing link if present', () => {
    const event = {
      link: '/sports/tennis/atp/buenos-aires/test-match-202602081100',
    };

    const result = buildBovadaUrl(event);

    assert.strictEqual(
      result,
      'https://www.bovada.lv/sports/tennis/atp/buenos-aires/test-match-202602081100'
    );
  });

  it('returns full URL if link is already absolute', () => {
    const event = {
      link: 'https://www.bovada.lv/sports/tennis/test',
    };

    const result = buildBovadaUrl(event);

    assert.strictEqual(result, 'https://www.bovada.lv/sports/tennis/test');
  });

  it('constructs URL from event data', () => {
    const event = {
      sport: 'tennis',
      league: 'ATP Buenos Aires',
      participant1: 'Daniel Elahi Galan',
      participant2: 'Lautaro Midon',
      startTime: '2026-02-08T11:00:00Z',
    };

    const result = buildBovadaUrl(event);

    assert.ok(result.startsWith('https://www.bovada.lv/sports/'));
    assert.ok(result.includes('tennis'));
    assert.ok(result.includes('daniel-elahi-galan'));
    assert.ok(result.includes('lautaro-midon'));
  });
});

describe('parseBovadaUrl', () => {
  it('parses a valid Bovada URL', () => {
    const url = 'https://www.bovada.lv/sports/tennis/atp/buenos-aires/daniel-elahi-galan-lautaro-midon-202602081100';
    const result = parseBovadaUrl(url);

    assert.ok(result);
    assert.strictEqual(result.sport, 'tennis');
    assert.strictEqual(result.league, 'atp');
    assert.strictEqual(result.timestamp, '202602081100');
  });

  it('extracts participants from URL', () => {
    const url = 'https://www.bovada.lv/sports/tennis/atp/buenos-aires/daniel-elahi-galan-lautaro-midon-202602081100';
    const result = parseBovadaUrl(url);

    assert.ok(result.participants.includes('daniel'));
    assert.ok(result.participants.includes('galan'));
  });

  it('returns null for invalid URLs', () => {
    const result = parseBovadaUrl('not-a-url');
    assert.strictEqual(result, null);
  });

  it('returns null for non-Bovada sports URLs', () => {
    const url = 'https://www.bovada.lv/casino/slots/game';
    const result = parseBovadaUrl(url);
    assert.strictEqual(result, null);
  });
});
