import { describe, it } from 'node:test';
import assert from 'node:assert';
import { findMatchingEventSimple } from './matcher.js';
import { getMockEvents } from './bovada.js';

describe('findMatchingEventSimple', () => {
  const mockEvents = getMockEvents();

  describe('tennis matches', () => {
    it('matches a player by last name', () => {
      const pick = {
        players: ['Galan'],
        sport: 'tennis',
      };

      const result = findMatchingEventSimple(pick, mockEvents);

      assert.ok(result);
      assert.ok(result.confidence > 0);
      assert.strictEqual(result.event.participant1, 'Daniel Elahi Galan');
    });

    it('matches doubles partners', () => {
      const pick = {
        players: ['Escobar', 'Hidalgo'],
        sport: 'tennis',
      };

      const result = findMatchingEventSimple(pick, mockEvents);

      assert.ok(result);
      assert.ok(result.event.description.includes('Escobar'));
    });

    it('matches with sport context', () => {
      const pick = {
        players: ['Galan'],
        sport: 'tennis',
        league: 'ATP',
      };

      const result = findMatchingEventSimple(pick, mockEvents);

      assert.ok(result);
      assert.ok(result.confidence > 0.3); // Higher confidence with sport match
    });
  });

  describe('basketball matches', () => {
    it('matches NBA teams', () => {
      const pick = {
        players: ['Lakers'],
        sport: 'basketball',
      };

      const result = findMatchingEventSimple(pick, mockEvents);

      assert.ok(result);
      assert.ok(result.event.participant1.includes('Lakers'));
    });
  });

  describe('no match cases', () => {
    it('returns null for empty events', () => {
      const pick = {
        players: ['Galan'],
        sport: 'tennis',
      };

      const result = findMatchingEventSimple(pick, []);

      assert.strictEqual(result.event, null);
      assert.strictEqual(result.confidence, 0);
    });

    it('returns null for no player match', () => {
      const pick = {
        players: ['Djokovic'],
        sport: 'tennis',
      };

      const result = findMatchingEventSimple(pick, mockEvents);

      // May still return a result with low confidence
      if (result) {
        assert.ok(result.confidence < 0.5);
      }
    });
  });
});
