import { describe, it, expect } from 'vitest';
import { currencyDecimals, formatDate, formatTime, dayTotalCost } from '../../utils/formatters';
import type { AssignmentsMap } from '../../types';

// ---------------------------------------------------------------------------
// currencyDecimals
// ---------------------------------------------------------------------------
describe('currencyDecimals', () => {
  it('returns 0 for zero-decimal currencies (uppercase)', () => {
    expect(currencyDecimals('JPY')).toBe(0);
    expect(currencyDecimals('KRW')).toBe(0);
    expect(currencyDecimals('VND')).toBe(0);
    expect(currencyDecimals('CLP')).toBe(0);
    expect(currencyDecimals('ISK')).toBe(0);
    expect(currencyDecimals('HUF')).toBe(0);
  });

  it('returns 0 for zero-decimal currencies (lowercase — case-insensitive)', () => {
    expect(currencyDecimals('jpy')).toBe(0);
    expect(currencyDecimals('krw')).toBe(0);
  });

  it('returns 2 for standard currencies', () => {
    expect(currencyDecimals('USD')).toBe(2);
    expect(currencyDecimals('EUR')).toBe(2);
    expect(currencyDecimals('GBP')).toBe(2);
    expect(currencyDecimals('TWD')).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------
describe('formatDate', () => {
  it('returns null for null/undefined/empty input', () => {
    expect(formatDate(null, 'en-US')).toBeNull();
    expect(formatDate(undefined, 'en-US')).toBeNull();
    expect(formatDate('', 'en-US')).toBeNull();
  });

  it('formats a valid date string (UTC timezone)', () => {
    // 2024-06-15 should produce a string with the day and month visible
    const result = formatDate('2024-06-15', 'en-US', 'UTC');
    expect(result).not.toBeNull();
    // Should contain "Jun" or "15" — locale-dependent but the date should be present
    expect(result).toMatch(/Jun|15/);
  });

  it('formats correctly using the UTC timezone to avoid off-by-one errors', () => {
    // Regardless of the local machine timezone, UTC input should give June 15
    const result = formatDate('2024-06-15', 'en-US', 'UTC');
    expect(result).toContain('15');
  });

  it('uses UTC when no timeZone is provided', () => {
    const withTZ = formatDate('2024-01-01', 'en-US', 'UTC');
    const withoutTZ = formatDate('2024-01-01', 'en-US');
    // Both should produce the same result since the fallback is UTC
    expect(withTZ).toBe(withoutTZ);
  });
});

// ---------------------------------------------------------------------------
// formatTime
// ---------------------------------------------------------------------------
describe('formatTime', () => {
  it('returns empty string for null/undefined input', () => {
    expect(formatTime(null, 'en-US', '24h')).toBe('');
    expect(formatTime(undefined, 'en-US', '24h')).toBe('');
  });

  it('formats 24h time correctly', () => {
    expect(formatTime('09:30', 'en-US', '24h')).toBe('09:30');
    expect(formatTime('14:00', 'en-US', '24h')).toBe('14:00');
    expect(formatTime('00:05', 'en-US', '24h')).toBe('00:05');
  });

  it('formats 12h time correctly — AM', () => {
    expect(formatTime('09:30', 'en-US', '12h')).toBe('9:30 AM');
    expect(formatTime('00:00', 'en-US', '12h')).toBe('12:00 AM');
  });

  it('formats 12h time correctly — PM', () => {
    expect(formatTime('14:00', 'en-US', '12h')).toBe('2:00 PM');
    expect(formatTime('12:00', 'en-US', '12h')).toBe('12:00 PM');
    expect(formatTime('23:59', 'en-US', '12h')).toBe('11:59 PM');
  });

  it('appends "Uhr" suffix for German locale in 24h mode', () => {
    expect(formatTime('09:30', 'de-DE', '24h')).toBe('09:30 Uhr');
  });

  it('does NOT append "Uhr" suffix for German locale in 12h mode', () => {
    const result = formatTime('09:30', 'de-DE', '12h');
    expect(result).not.toContain('Uhr');
    expect(result).toBe('9:30 AM');
  });
});

// ---------------------------------------------------------------------------
// dayTotalCost
// ---------------------------------------------------------------------------
describe('dayTotalCost', () => {
  it('returns null when the day has no assignments', () => {
    const assignments: AssignmentsMap = {};
    expect(dayTotalCost(1, assignments, 'USD')).toBeNull();
  });

  it('returns null when all assignments have no price', () => {
    const assignments: AssignmentsMap = {
      '1': [
        { id: 10, day_id: 1, order_index: 0, notes: null, place: { id: 1, trip_id: 1, name: 'Park', price: null } as any },
      ],
    };
    expect(dayTotalCost(1, assignments, 'USD')).toBeNull();
  });

  it('sums prices and appends the currency code', () => {
    const assignments: AssignmentsMap = {
      '5': [
        { id: 10, day_id: 5, order_index: 0, notes: null, place: { id: 1, trip_id: 1, name: 'Hotel', price: '150.00' } as any },
        { id: 11, day_id: 5, order_index: 1, notes: null, place: { id: 2, trip_id: 1, name: 'Dinner', price: '45.50' } as any },
      ],
    };
    // 150 + 45.50 = 195.50 → toFixed(0) = "196" (rounding)
    const result = dayTotalCost(5, assignments, 'EUR');
    expect(result).not.toBeNull();
    expect(result).toContain('EUR');
  });

  it('ignores places with empty or non-numeric price strings', () => {
    const assignments: AssignmentsMap = {
      '7': [
        { id: 20, day_id: 7, order_index: 0, notes: null, place: { id: 3, trip_id: 1, name: 'Museum', price: '' } as any },
        { id: 21, day_id: 7, order_index: 1, notes: null, place: { id: 4, trip_id: 1, name: 'Tour', price: '80' } as any },
      ],
    };
    const result = dayTotalCost(7, assignments, 'USD');
    expect(result).toBe('80 USD');
  });
});
