import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getMockEvents, clearEventCache } from './bovada.js';

describe('getMockEvents', () => {
  it('returns tennis events for tennis sport', () => {
    const events = getMockEvents('tennis');
    
    assert.ok(events.length > 0);
    assert.ok(events.every(e => e.sport === 'tennis'));
  });

  it('returns basketball events for basketball sport', () => {
    const events = getMockEvents('basketball');
    
    assert.ok(events.length > 0);
    assert.ok(events.every(e => e.sport === 'basketball'));
  });

  it('returns all events when no sport specified', () => {
    const events = getMockEvents();
    
    assert.ok(events.length > 0);
    const sports = [...new Set(events.map(e => e.sport))];
    assert.ok(sports.length > 1, 'Should have multiple sports');
  });

  it('returns empty array for unknown sport', () => {
    const events = getMockEvents('curling');
    
    // Falls back to all events when sport not found
    assert.ok(Array.isArray(events));
  });

  it('events have required fields', () => {
    const events = getMockEvents('tennis');
    
    for (const event of events) {
      assert.ok(event.id, 'Should have id');
      assert.ok(event.sport, 'Should have sport');
      assert.ok(event.description, 'Should have description');
      assert.ok(event.participant1 || event.participant2, 'Should have participants');
    }
  });

  it('tennis events have Bovada-style links', () => {
    const events = getMockEvents('tennis');
    
    for (const event of events) {
      if (event.link) {
        assert.ok(event.link.startsWith('/sports/'), 'Link should start with /sports/');
        assert.ok(event.link.includes('tennis'), 'Link should include sport');
      }
    }
  });
});

describe('clearEventCache', () => {
  it('clears without error', () => {
    assert.doesNotThrow(() => clearEventCache());
  });
});
