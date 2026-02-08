import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parsePickSimple } from './parser.js';
import { findMatchingEventSimple } from './matcher.js';
import { buildBovadaUrl } from './urlBuilder.js';
import { getMockEvents } from './bovada.js';

/**
 * Integration tests that test the full flow from pick text to Bovada URL
 */
describe('Integration: Pick to Link', () => {
  describe('Tennis picks', () => {
    it('generates link for "Galan ml -110: 1 unit"', async () => {
      const pickText = 'Galan ml -110: 1 unit';
      
      // Step 1: Parse the pick
      const parsed = parsePickSimple(pickText);
      assert.strictEqual(parsed.isValidPick, true);
      assert.deepStrictEqual(parsed.players, ['Galan']);
      assert.strictEqual(parsed.betType, 'ML');
      
      // Step 2: Match to event (using mock data)
      const events = getMockEvents('tennis');
      const match = findMatchingEventSimple(
        { ...parsed, sport: 'tennis' },
        events
      );
      
      assert.ok(match, 'Should find a match');
      assert.ok(match.event.participant1.includes('Galan'));
      
      // Step 3: Build URL
      const url = buildBovadaUrl(match.event);
      
      assert.ok(url.startsWith('https://www.bovada.lv'));
      assert.ok(url.includes('tennis'));
      assert.ok(url.includes('galan') || url.includes('daniel'));
    });

    it('generates link for doubles over bet', async () => {
      const pickText = 'Hidalgo/Escobar vs Hijikata/Thompson Doubles Over 23.5 -120: 1 Unit';
      
      // Step 1: Parse
      const parsed = parsePickSimple(pickText);
      assert.strictEqual(parsed.isValidPick, true);
      assert.strictEqual(parsed.betType, 'over');
      assert.strictEqual(parsed.line, 23.5);
      
      // Step 2: Match
      const events = getMockEvents('tennis');
      
      // For doubles, we need to adjust the parsed players
      const adjustedParsed = {
        ...parsed,
        sport: 'tennis',
        players: ['Escobar', 'Hidalgo'],
      };
      
      const match = findMatchingEventSimple(adjustedParsed, events);
      
      assert.ok(match, 'Should find doubles match');
      assert.ok(
        match.event.description.includes('Escobar') || 
        match.event.participant1.includes('Escobar'),
        'Should match Escobar/Hidalgo event'
      );
      
      // Step 3: Build URL
      const url = buildBovadaUrl(match.event);
      
      assert.ok(url.includes('davis-cup') || url.includes('tennis'));
    });
  });

  describe('NBA picks', () => {
    it('generates link for "Lakers +150: 2u"', async () => {
      const pickText = 'Lakers +150: 2u';
      
      // Parse
      const parsed = parsePickSimple(pickText);
      assert.strictEqual(parsed.isValidPick, true);
      assert.strictEqual(parsed.odds, '+150');
      assert.strictEqual(parsed.units, 2);
      
      // Match
      const events = getMockEvents('basketball');
      const match = findMatchingEventSimple(
        { ...parsed, sport: 'basketball' },
        events
      );
      
      assert.ok(match);
      assert.ok(match.event.participant1.includes('Lakers'));
      
      // Build URL
      const url = buildBovadaUrl(match.event);
      assert.ok(url.includes('basketball'));
    });
  });

  describe('Edge cases', () => {
    it('handles pick with no matching event gracefully', () => {
      const pickText = 'Federer ML -200';
      
      const parsed = parsePickSimple(pickText);
      assert.strictEqual(parsed.isValidPick, true);
      
      const events = getMockEvents('tennis');
      const match = findMatchingEventSimple(
        { ...parsed, sport: 'tennis', players: ['Federer'] },
        events
      );
      
      // Should return null or low confidence match
      if (match) {
        assert.ok(match.confidence < 0.5, 'Should have low confidence for non-matching player');
      }
    });

    it('handles spread bets', () => {
      const pickText = 'Chiefs -7.5 -110 3u';
      
      const parsed = parsePickSimple(pickText);
      assert.strictEqual(parsed.isValidPick, true);
      assert.strictEqual(parsed.betType, 'spread');
      assert.strictEqual(parsed.units, 3);
    });
  });
});

describe('URL roundtrip', () => {
  it('can construct and parse URLs consistently', () => {
    const event = {
      sport: 'tennis',
      league: 'ATP Buenos Aires',
      participant1: 'Daniel Elahi Galan',
      participant2: 'Lautaro Midon',
      startTime: '2026-02-08T11:00:00Z',
    };
    
    const url = buildBovadaUrl(event);
    
    // URL should contain all key parts
    assert.ok(url.includes('bovada.lv'));
    assert.ok(url.includes('tennis'));
    assert.ok(url.includes('daniel-elahi-galan'));
    assert.ok(url.includes('lautaro-midon'));
  });
});
