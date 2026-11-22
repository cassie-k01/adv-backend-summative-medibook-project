'use strict';
const { calculateRefund } = require('../src/lib/refund');

const HOUR = 60 * 60 * 1000;

// A fixed "now", so these tests give the same answer on any day.
const now = new Date(2026, 10, 14, 12, 0, 0);

// An appointment that starts this many hours after "now".
const apptIn = (hours) => new Date(now.getTime() + hours * HOUR);

// Calculates the refund for an appointment this many hours away.
const refundFor = (hours, amountPaid = 150) =>
  calculateRefund({ amountPaid, apptDate: apptIn(hours), now });

describe('refund tiers', () => {
  test('more than 48 hours of notice refunds 100%', () => {
    expect(refundFor(72)).toMatchObject({ percent: 100, refundAmount: 150 });
  });

  test('between 24 and 48 hours of notice refunds 50%', () => {
    expect(refundFor(36)).toMatchObject({ percent: 50, refundAmount: 75 });
  });

  test('less than 24 hours of notice refunds nothing', () => {
    expect(refundFor(5)).toMatchObject({ percent: 0, refundAmount: 0 });
  });
});

describe('refund boundaries (24h and 48h both belong to the 50% tier)', () => {
  test('exactly 48 hours of notice refunds 50%', () => {
    expect(refundFor(48).percent).toBe(50);
  });

  test('1 millisecond more than 48 hours refunds 100%', () => {
    const apptDate = new Date(apptIn(48).getTime() + 1);
    expect(calculateRefund({ amountPaid: 150, apptDate, now }).percent).toBe(100);
  });

  test('exactly 24 hours of notice refunds 50%', () => {
    expect(refundFor(24).percent).toBe(50);
  });

  test('1 millisecond less than 24 hours refunds nothing', () => {
    const apptDate = new Date(apptIn(24).getTime() - 1);
    expect(calculateRefund({ amountPaid: 150, apptDate, now }).percent).toBe(0);
  });
});