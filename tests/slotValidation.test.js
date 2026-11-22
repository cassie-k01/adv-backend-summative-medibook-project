'use strict';
const { validateSlot } = require('../src/lib/validation');

// A fixed "now": Saturday 14 November 2026, 12:00.
const now = new Date(2026, 10, 14, 12, 0, 0);

describe('validateSlot', () => {
  test('accepts a future slot on a half hour', () => {
    const result = validateSlot('2026-12-07T09:30', now);
    expect(result.valid).toBe(true);
    expect(result.sqlDatetime).toBe('2026-12-07 09:30:00');
    expect(result.dayStart).toBe('2026-12-07 00:00:00');
    expect(result.dayEnd).toBe('2026-12-08 00:00:00');
  });

  test('09:00 (first slot) and 16:30 (last slot) are valid, and a space works instead of T', () => {
    expect(validateSlot('2026-12-07T09:00', now).valid).toBe(true);
    expect(validateSlot('2026-12-07 16:30', now).valid).toBe(true);
  });

  test('17:00 exactly is rejected, the slot would end after closing time', () => {
    expect(validateSlot('2026-12-07T17:00', now)).toMatchObject({ valid: false, code: 'OUTSIDE_WORKING_HOURS' });
  });

  test('09:15 is rejected, it is not on a half hour', () => {
    expect(validateSlot('2026-12-07T09:15', now)).toMatchObject({ valid: false, code: 'NOT_ON_SLOT_BOUNDARY' });
  });

  test('wrong formats and fake dates are reported as MALFORMED', () => {
    const bad = ['tomorrow', '2026-12-07', '2026-12-07T9:30', '2026-02-30T09:00', '2026-12-07T24:00', 42, null, undefined];
    for (const value of bad) {
      expect(validateSlot(value, now)).toMatchObject({ valid: false, code: 'MALFORMED' });
    }
  });

  test('past times are rejected, and so is a slot starting exactly now', () => {
    expect(validateSlot('2026-11-13T10:00', now)).toMatchObject({ valid: false, code: 'IN_THE_PAST' });
    expect(validateSlot('2026-11-14T12:00', now)).toMatchObject({ valid: false, code: 'IN_THE_PAST' });
  });
});