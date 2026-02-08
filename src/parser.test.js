import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parsePickSimple } from './parser.js';

describe('parsePickSimple', () => {
  describe('valid picks', () => {
    it('parses a simple ML pick', () => {
      const result = parsePickSimple('Galan ml -110: 1 unit');
      
      assert.strictEqual(result.isValidPick, true);
      assert.strictEqual(result.betType, 'ML');
      assert.strictEqual(result.odds, '-110');
      assert.strictEqual(result.units, 1);
      assert.deepStrictEqual(result.players, ['Galan']);
    });

    it('parses an over/under pick', () => {
      const result = parsePickSimple('Hidalgo/Escobar vs Hijikata/Thompson Doubles Over 23.5 -120');
      
      assert.strictEqual(result.isValidPick, true);
      assert.strictEqual(result.betType, 'over');
      assert.strictEqual(result.line, 23.5);
      assert.strictEqual(result.odds, '-120');
    });

    it('parses a pick with positive odds', () => {
      const result = parsePickSimple('Lakers +150: 2u');
      
      assert.strictEqual(result.isValidPick, true);
      assert.strictEqual(result.odds, '+150');
      assert.strictEqual(result.units, 2);
    });

    it('parses shorthand unit notation', () => {
      const result = parsePickSimple('Chiefs -3 -110 2u');
      
      assert.strictEqual(result.isValidPick, true);
      assert.strictEqual(result.units, 2);
    });

    it('parses under bets', () => {
      const result = parsePickSimple('Total Under 45.5 -105');
      
      assert.strictEqual(result.isValidPick, true);
      assert.strictEqual(result.betType, 'under');
      assert.strictEqual(result.line, 45.5);
    });
  });

  describe('invalid picks', () => {
    it('rejects casual conversation', () => {
      const result = parsePickSimple('Hey guys, how are you doing today?');
      
      assert.strictEqual(result.isValidPick, false);
    });

    it('rejects simple greetings', () => {
      const result = parsePickSimple('Good morning!');
      
      assert.strictEqual(result.isValidPick, false);
    });

    it('rejects questions about picks', () => {
      const result = parsePickSimple('What do you think about the Lakers game?');
      
      assert.strictEqual(result.isValidPick, false);
    });
  });

  describe('edge cases', () => {
    it('handles missing units', () => {
      const result = parsePickSimple('Galan ML -110');
      
      assert.strictEqual(result.isValidPick, true);
      assert.strictEqual(result.units, null);
    });

    it('handles decimal units', () => {
      const result = parsePickSimple('Warriors -5.5 -110 1.5 units');
      
      assert.strictEqual(result.isValidPick, true);
      assert.strictEqual(result.units, 1.5);
    });
  });
});
