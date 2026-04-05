/**
 * Unit tests for mapsService.ts
 * Covers MAPS-101 to MAPS-150
 *
 * All external network calls are mocked via vi.mock('node-fetch').
 * The photo-cache setInterval is suppressed with vi.useFakeTimers().
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Prevent the module-level setIntervals from running during tests
vi.useFakeTimers();

// Mock node-fetch before any imports
vi.mock('node-fetch', () => ({ default: vi.fn() }));

// Mock DB and apiKeyCrypto
vi.mock('../../../src/db/database', () => ({
  db: {
    prepare: vi.fn(() => ({
      get: vi.fn(() => undefined),
      all: vi.fn(() => []),
      run: vi.fn(),
    })),
  },
}));
vi.mock('../../../src/services/apiKeyCrypto', () => ({
  decrypt_api_key: vi.fn((v: unknown) => v as string | null),
  maybe_encrypt_api_key: vi.fn((v: unknown) => v),
}));

import fetch from 'node-fetch';

const mockFetch = vi.mocked(fetch);

// Helper to create a minimal Response-like object
function makeFetchResponse(body: unknown, ok = true, status = 200): ReturnType<typeof fetch> {
  return {
    ok,
    status,
    url: '',
    headers: { get: () => null },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as ReturnType<typeof fetch>;
}

import {
  getMapsKey,
  searchNominatim,
  parseOpeningHours,
  buildOsmDetails,
  reverseGeocode,
  searchPlaces,
  getPlacePhoto,
  getPlaceDetails,
  fetchOverpassDetails,
  fetchWikimediaPhoto,
  resolveGoogleMapsUrl,
} from '../../../src/services/mapsService';

// ── getMapsKey ───────────────────────────────────────────────────────────────

describe('getMapsKey', () => {
  it('MAPS-101 — returns null when no user or admin has a maps key', () => {
    // db.prepare().get() returns undefined
    const key = getMapsKey(1);
    expect(key).toBeNull();
  });
});

// ── parseOpeningHours ────────────────────────────────────────────────────────

describe('parseOpeningHours', () => {
  it('MAPS-110 — parses simple weekday range', () => {
    const result = parseOpeningHours('Mo-Fr 09:00-18:00');
    expect(result.weekdayDescriptions[0]).toBe('Monday: 09:00-18:00');
    expect(result.weekdayDescriptions[4]).toBe('Friday: 09:00-18:00');
    expect(result.weekdayDescriptions[5]).toBe('Saturday: ?');
  });

  it('MAPS-111 — parses semicolon-separated segments', () => {
    const result = parseOpeningHours('Mo-Fr 09:00-18:00; Sa 10:00-14:00');
    expect(result.weekdayDescriptions[0]).toBe('Monday: 09:00-18:00');
    expect(result.weekdayDescriptions[5]).toBe('Saturday: 10:00-14:00');
    expect(result.weekdayDescriptions[6]).toBe('Sunday: ?');
  });

  it('MAPS-112 — returns all "?" for empty string', () => {
    const result = parseOpeningHours('');
    expect(result.weekdayDescriptions).toHaveLength(7);
    expect(result.weekdayDescriptions.every(d => d.endsWith('?'))).toBe(true);
  });

  it('MAPS-113 — parses single day', () => {
    const result = parseOpeningHours('Su 11:00-16:00');
    expect(result.weekdayDescriptions[6]).toBe('Sunday: 11:00-16:00');
    expect(result.weekdayDescriptions[0]).toBe('Monday: ?');
  });

  it('MAPS-114 — openNow is a boolean or null', () => {
    const result = parseOpeningHours('Mo-Su 00:00-24:00');
    // With full week coverage, openNow should be deterministic
    expect(typeof result.openNow === 'boolean' || result.openNow === null).toBe(true);
  });
});

// ── buildOsmDetails ──────────────────────────────────────────────────────────

describe('buildOsmDetails', () => {
  it('MAPS-120 — returns correct osm_url', () => {
    const details = buildOsmDetails({}, 'way', '12345');
    expect(details.osm_url).toBe('https://www.openstreetmap.org/way/12345');
    expect(details.source).toBe('openstreetmap');
  });

  it('MAPS-121 — extracts website and phone from tags', () => {
    const tags = { website: 'https://example.com', phone: '+49 30 12345' };
    const details = buildOsmDetails(tags, 'node', '99');
    expect(details.website).toBe('https://example.com');
    expect(details.phone).toBe('+49 30 12345');
  });

  it('MAPS-122 — prefers contact:website over website', () => {
    const tags = { website: 'https://old.com', 'contact:website': 'https://new.com' };
    const details = buildOsmDetails(tags, 'node', '1');
    expect(details.website).toBe('https://new.com');
  });

  it('MAPS-123 — parses opening_hours when present', () => {
    const tags = { opening_hours: 'Mo-Fr 09:00-17:00' };
    const details = buildOsmDetails(tags, 'way', '42');
    expect(details.opening_hours).not.toBeNull();
    expect(Array.isArray(details.opening_hours)).toBe(true);
  });

  it('MAPS-124 — opening_hours is null when tags have none', () => {
    const details = buildOsmDetails({}, 'node', '5');
    expect(details.opening_hours).toBeNull();
    expect(details.open_now).toBeNull();
  });

  it('MAPS-125 — returns summary from description tag', () => {
    const tags = { description: 'A great café' };
    const details = buildOsmDetails(tags, 'node', '7');
    expect(details.summary).toBe('A great café');
  });
});

// ── searchNominatim ──────────────────────────────────────────────────────────

describe('searchNominatim', () => {
  beforeEach(() => mockFetch.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it('MAPS-130 — returns mapped results from Nominatim', async () => {
    const nominatimResponse = [
      {
        osm_type: 'node',
        osm_id: '123456',
        name: 'Eiffel Tower',
        display_name: 'Eiffel Tower, Paris, France',
        lat: '48.8584',
        lon: '2.2945',
      },
    ];
    mockFetch.mockResolvedValueOnce(makeFetchResponse(nominatimResponse, true, 200));

    const results = await searchNominatim('Eiffel Tower');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Eiffel Tower');
    expect(results[0].osm_id).toBe('node:123456');
    expect(results[0].lat).toBeCloseTo(48.8584);
    expect(results[0].source).toBe('openstreetmap');
  });

  it('MAPS-131 — throws when Nominatim returns non-OK', async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse({}, false, 500));

    await expect(searchNominatim('Paris')).rejects.toThrow('Nominatim API error');
  });

  it('MAPS-132 — uses display_name split as fallback name', async () => {
    const nominatimResponse = [
      {
        osm_type: 'way',
        osm_id: '789',
        display_name: 'Louvre Museum, Paris, Île-de-France, France',
        lat: '48.8606',
        lon: '2.3376',
      },
    ];
    mockFetch.mockResolvedValueOnce(makeFetchResponse(nominatimResponse, true, 200));

    const results = await searchNominatim('Louvre');
    expect(results[0].name).toBe('Louvre Museum');
    expect(results[0].address).toBe('Louvre Museum, Paris, Île-de-France, France');
  });

  it('MAPS-133 — passes accept-language header from lang param', async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse([], true, 200));
    await searchNominatim('Berlin', 'de');

    const calledUrl = (mockFetch.mock.calls[0][0] as string);
    expect(calledUrl).toContain('accept-language=de');
  });
});

// ── reverseGeocode ───────────────────────────────────────────────────────────

describe('reverseGeocode', () => {
  beforeEach(() => mockFetch.mockReset());

  it('MAPS-140 — returns name and address from Nominatim', async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse({
      name: 'Eiffel Tower',
      display_name: 'Eiffel Tower, Paris, France',
    }, true, 200));

    const result = await reverseGeocode('48.8584', '2.2945');
    expect(result.name).toBe('Eiffel Tower');
    expect(result.address).toBe('Eiffel Tower, Paris, France');
  });

  it('MAPS-141 — returns null values when Nominatim returns non-OK', async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse({}, false, 500));

    const result = await reverseGeocode('0', '0');
    expect(result.name).toBeNull();
    expect(result.address).toBeNull();
  });

  it('MAPS-142 — falls back to address fields when name is absent', async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse({
      display_name: 'Café de Flore, Paris',
      address: { amenity: 'Café de Flore' },
    }, true, 200));

    const result = await reverseGeocode('48.854', '2.333');
    expect(result.name).toBe('Café de Flore');
    expect(result.address).toBe('Café de Flore, Paris');
  });
});

// ── searchPlaces ─────────────────────────────────────────────────────────────

describe('searchPlaces', () => {
  beforeEach(() => mockFetch.mockReset());

  it('MAPS-150 — falls back to Nominatim when no API key', async () => {
    const nominatimResponse = [
      {
        osm_type: 'way',
        osm_id: '42',
        name: 'Brandenburger Tor',
        display_name: 'Brandenburger Tor, Berlin',
        lat: '52.5163',
        lon: '13.3777',
      },
    ];
    mockFetch.mockResolvedValueOnce(makeFetchResponse(nominatimResponse, true, 200));

    // userId=1: getMapsKey will return null because DB returns undefined
    const result = await searchPlaces(1, 'Brandenburger Tor');
    expect(result.source).toBe('openstreetmap');
    expect(result.places).toHaveLength(1);
    expect(result.places[0].name).toBe('Brandenburger Tor');
  });
});

// ── fetchOverpassDetails ─────────────────────────────────────────────────────

describe('fetchOverpassDetails', () => {
  beforeEach(() => mockFetch.mockReset());

  it('MAPS-160 — returns null for unknown osm type', async () => {
    const result = await fetchOverpassDetails('unknown', '123');
    expect(result).toBeNull();
  });

  it('MAPS-161 — returns null when Overpass returns non-OK', async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse({}, false, 503));
    const result = await fetchOverpassDetails('way', '12345');
    expect(result).toBeNull();
  });

  it('MAPS-162 — returns first element from Overpass response', async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse({
      elements: [{ tags: { name: 'Colosseum', website: 'https://colosseo.it' } }],
    }, true, 200));
    const result = await fetchOverpassDetails('way', '99999');
    expect(result).not.toBeNull();
    expect(result?.tags?.name).toBe('Colosseum');
  });

  it('MAPS-163 — returns null when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network failure'));
    const result = await fetchOverpassDetails('node', '1');
    expect(result).toBeNull();
  });
});

// ── getPlaceDetails with OSM placeId ─────────────────────────────────────────

describe('getPlaceDetails (OSM path)', () => {
  beforeEach(() => mockFetch.mockReset());

  it('MAPS-170 — resolves node:id via Overpass', async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse({
      elements: [{ tags: { name: 'Brandenburg Gate', website: 'https://bg.de' } }],
    }, true, 200));

    const { place } = await getPlaceDetails(1, 'node:123456');
    expect(place.source).toBe('openstreetmap');
    expect(place.website).toBe('https://bg.de');
  });

  it('MAPS-171 — returns empty OSM details when Overpass has no tags', async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse({ elements: [{}] }, true, 200));
    const { place } = await getPlaceDetails(1, 'way:9999');
    expect(place.source).toBe('openstreetmap');
    expect(place.website).toBeNull();
  });
});

// ── getPlacePhoto — cache behaviour ──────────────────────────────────────────

describe('getPlacePhoto (cache)', () => {
  beforeEach(() => mockFetch.mockReset());

  it('MAPS-180 — throws 404 for coords: placeId without lat/lng (NaN)', async () => {
    await expect(getPlacePhoto(1, 'coords:test', NaN, NaN)).rejects.toMatchObject({ status: 404 });
  });

  it('MAPS-181 — tries Wikimedia for coords: placeId with valid lat/lng', async () => {
    // Wikipedia search -> no result
    mockFetch.mockResolvedValueOnce(makeFetchResponse({
      query: { pages: { '-1': {} } },
    }, true, 200));
    // Wikimedia commons geosearch -> no result
    mockFetch.mockResolvedValueOnce(makeFetchResponse({
      query: { pages: {} },
    }, true, 200));

    await expect(getPlacePhoto(1, 'coords:48.8566_2.3522', 48.8566, 2.3522, 'Paris'))
      .rejects.toMatchObject({ status: 404 });
    expect(mockFetch).toHaveBeenCalled();
  });
});

// ── fetchWikimediaPhoto ──────────────────────────────────────────────────────

describe('fetchWikimediaPhoto', () => {
  beforeEach(() => mockFetch.mockReset());

  it('MAPS-190 — returns photo from Wikipedia page image', async () => {
    // Wikipedia search response
    mockFetch.mockResolvedValueOnce(makeFetchResponse({
      query: {
        pages: {
          '123': { thumbnail: { source: 'https://upload.wikimedia.org/test.jpg' } },
        },
      },
    }, true, 200));

    const result = await fetchWikimediaPhoto(48.8566, 2.3522, 'Eiffel Tower');
    expect(result?.photoUrl).toBe('https://upload.wikimedia.org/test.jpg');
    expect(result?.attribution).toBe('Wikipedia');
  });

  it('MAPS-191 — falls back to geosearch when Wikipedia has no thumbnail', async () => {
    // Wikipedia search -> no thumbnail
    mockFetch.mockResolvedValueOnce(makeFetchResponse({
      query: { pages: { '123': {} } },
    }, true, 200));

    // Commons geosearch -> has a valid JPEG
    mockFetch.mockResolvedValueOnce(makeFetchResponse({
      query: {
        pages: {
          '456': {
            imageinfo: [{
              url: 'https://commons.wikimedia.org/photo.jpg',
              mime: 'image/jpeg',
              extmetadata: { Artist: { value: 'John Doe' } },
            }],
          },
        },
      },
    }, true, 200));

    const result = await fetchWikimediaPhoto(48.8566, 2.3522, 'Eiffel Tower');
    expect(result?.photoUrl).toBe('https://commons.wikimedia.org/photo.jpg');
    expect(result?.attribution).toBe('John Doe');
  });

  it('MAPS-192 — returns null when geosearch has no valid image pages', async () => {
    // Wikipedia -> no thumbnail
    mockFetch.mockResolvedValueOnce(makeFetchResponse({
      query: { pages: { '-1': {} } },
    }, true, 200));
    // Commons -> empty pages
    mockFetch.mockResolvedValueOnce(makeFetchResponse({ query: { pages: {} } }, true, 200));

    const result = await fetchWikimediaPhoto(10, 20);
    expect(result).toBeNull();
  });

  it('MAPS-193 — returns null when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('net error'));
    const result = await fetchWikimediaPhoto(10, 20, 'Place');
    // Wikipedia fetch throws, falls through to geosearch, which also throws -> null
    expect(result).toBeNull();
  });
});

// ── resolveGoogleMapsUrl ─────────────────────────────────────────────────────

describe('resolveGoogleMapsUrl', () => {
  beforeEach(() => mockFetch.mockReset());

  it('MAPS-200 — extracts coordinates from /@lat,lng pattern', async () => {
    // Nominatim reverse geocode call
    mockFetch.mockResolvedValueOnce(makeFetchResponse({
      display_name: 'Eiffel Tower, Paris, France',
      name: 'Eiffel Tower',
    }, true, 200));

    const result = await resolveGoogleMapsUrl(
      'https://www.google.com/maps/@48.8584,2.2945,15z'
    );
    expect(result.lat).toBeCloseTo(48.8584);
    expect(result.lng).toBeCloseTo(2.2945);
    expect(result.address).toBe('Eiffel Tower, Paris, France');
  });

  it('MAPS-201 — extracts place name from /place/Name path', async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse({
      display_name: 'Eiffel Tower, Paris',
      name: 'Eiffel Tower',
    }, true, 200));

    const result = await resolveGoogleMapsUrl(
      'https://www.google.com/maps/place/Eiffel+Tower/@48.8584,2.2945,15z'
    );
    expect(result.name).toBe('Eiffel Tower');
  });

  it('MAPS-202 — extracts coords from ?q=lat,lng pattern', async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse({
      display_name: 'Some Place',
    }, true, 200));

    const result = await resolveGoogleMapsUrl(
      'https://www.google.com/maps?q=51.5074,-0.1278'
    );
    expect(result.lat).toBeCloseTo(51.5074);
    expect(result.lng).toBeCloseTo(-0.1278);
  });

  it('MAPS-203 — extracts coords from !3d!4d data pattern', async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse({
      display_name: 'Colosseum, Rome',
    }, true, 200));

    const result = await resolveGoogleMapsUrl(
      'https://www.google.com/maps/place/Colosseum/data=!3d41.8902!4d12.4922'
    );
    expect(result.lat).toBeCloseTo(41.8902);
    expect(result.lng).toBeCloseTo(12.4922);
  });

  it('MAPS-204 — throws 400 when no coordinates found in URL', async () => {
    await expect(
      resolveGoogleMapsUrl('https://www.google.com/maps/place/Paris/')
    ).rejects.toMatchObject({ status: 400 });
  });
});
