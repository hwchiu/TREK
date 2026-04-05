/**
 * tripStore tests
 *
 * Focus areas:
 *  - initial state shape
 *  - setSelectedDay()
 *  - handleRemoteEvent() for place:updated event
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';

// ─── mocks ──────────────────────────────────────────────────────────────────
const apiMocks = vi.hoisted(() => ({
  tripsGet: vi.fn(),
  daysList: vi.fn(),
  placesList: vi.fn(),
  packingList: vi.fn(),
  tagsList: vi.fn(),
  categoriesList: vi.fn(),
}));

vi.mock('../../api/client', () => ({
  tripsApi: { get: apiMocks.tripsGet, update: vi.fn(), list: vi.fn(), create: vi.fn(), delete: vi.fn() },
  daysApi: { list: apiMocks.daysList, update: vi.fn() },
  placesApi: { list: apiMocks.placesList, create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  packingApi: { list: apiMocks.packingList, create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  tagsApi: { list: apiMocks.tagsList, create: vi.fn() },
  categoriesApi: { list: apiMocks.categoriesList, create: vi.fn() },
  assignmentsApi: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), reorder: vi.fn() },
  budgetApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  reservationsApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  filesApi: { list: vi.fn(), upload: vi.fn(), delete: vi.fn() },
  dayNotesApi: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock('../../api/websocket', () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  getSocketId: vi.fn(() => null),
}));

// ─── module under test ───────────────────────────────────────────────────────
import { useTripStore } from '../../store/tripStore';
import type { Place } from '../../types';

// ─── helper ──────────────────────────────────────────────────────────────────
function resetStore() {
  useTripStore.setState({
    trip: null,
    days: [],
    places: [],
    assignments: {},
    dayNotes: {},
    packingItems: [],
    tags: [],
    categories: [],
    budgetItems: [],
    files: [],
    reservations: [],
    selectedDayId: null,
    isLoading: false,
    error: null,
  });
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('useTripStore — initial state', () => {
  beforeEach(resetStore);

  it('starts with null trip and empty collections', () => {
    const state = useTripStore.getState();
    expect(state.trip).toBeNull();
    expect(state.days).toEqual([]);
    expect(state.places).toEqual([]);
    expect(state.selectedDayId).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });
});

describe('useTripStore — setSelectedDay()', () => {
  beforeEach(resetStore);

  it('updates selectedDayId to the given value', () => {
    useTripStore.getState().setSelectedDay(42);
    expect(useTripStore.getState().selectedDayId).toBe(42);
  });

  it('clears selectedDayId when null is passed', () => {
    useTripStore.setState({ selectedDayId: 10 });
    useTripStore.getState().setSelectedDay(null);
    expect(useTripStore.getState().selectedDayId).toBeNull();
  });
});

describe('useTripStore — handleRemoteEvent() — place:updated', () => {
  beforeEach(resetStore);

  it('updates the matching place in the places array', () => {
    const original: Place = {
      id: 7,
      trip_id: 1,
      name: 'Old Name',
      description: null,
      lat: null,
      lng: null,
      address: null,
      category_id: null,
      icon: null,
      price: null,
      image_url: null,
      google_place_id: null,
      osm_id: null,
      route_geometry: null,
      place_time: null,
      end_time: null,
      created_at: '2024-01-01T00:00:00Z',
    };

    useTripStore.setState({ places: [original] });

    const updated: Place = { ...original, name: 'New Name' };

    useTripStore.getState().handleRemoteEvent({ type: 'place:updated', place: updated });

    const places = useTripStore.getState().places;
    expect(places).toHaveLength(1);
    expect(places[0].name).toBe('New Name');
  });

  it('also updates the place inside existing assignments', () => {
    const original: Place = {
      id: 7,
      trip_id: 1,
      name: 'Old Name',
      description: null,
      lat: null,
      lng: null,
      address: null,
      category_id: null,
      icon: null,
      price: '10',
      image_url: null,
      google_place_id: null,
      osm_id: null,
      route_geometry: null,
      place_time: null,
      end_time: null,
      created_at: '2024-01-01T00:00:00Z',
    };

    useTripStore.setState({
      places: [original],
      assignments: {
        '3': [
          { id: 100, day_id: 3, order_index: 0, notes: null, place: original },
        ],
      },
    });

    const updated: Place = { ...original, name: 'Updated Name', price: '20' };
    useTripStore.getState().handleRemoteEvent({ type: 'place:updated', place: updated });

    const dayAssignments = useTripStore.getState().assignments['3'];
    expect(dayAssignments[0].place.name).toBe('Updated Name');
    expect(dayAssignments[0].place.price).toBe('20');
  });

  it('does not mutate unrelated places', () => {
    const placeA: Place = { id: 1, trip_id: 1, name: 'A', description: null, lat: null, lng: null, address: null, category_id: null, icon: null, price: null, image_url: null, google_place_id: null, osm_id: null, route_geometry: null, place_time: null, end_time: null, created_at: '' };
    const placeB: Place = { id: 2, trip_id: 1, name: 'B', description: null, lat: null, lng: null, address: null, category_id: null, icon: null, price: null, image_url: null, google_place_id: null, osm_id: null, route_geometry: null, place_time: null, end_time: null, created_at: '' };

    useTripStore.setState({ places: [placeA, placeB] });

    const updatedB: Place = { ...placeB, name: 'B Updated' };
    useTripStore.getState().handleRemoteEvent({ type: 'place:updated', place: updatedB });

    const places = useTripStore.getState().places;
    expect(places.find(p => p.id === 1)?.name).toBe('A');
    expect(places.find(p => p.id === 2)?.name).toBe('B Updated');
  });
});

describe('useTripStore — handleRemoteEvent() — place:created', () => {
  beforeEach(resetStore);

  it('prepends a new place to the places array', () => {
    const newPlace: Place = { id: 99, trip_id: 1, name: 'New Place', description: null, lat: null, lng: null, address: null, category_id: null, icon: null, price: null, image_url: null, google_place_id: null, osm_id: null, route_geometry: null, place_time: null, end_time: null, created_at: '' };

    useTripStore.getState().handleRemoteEvent({ type: 'place:created', place: newPlace });

    expect(useTripStore.getState().places).toHaveLength(1);
    expect(useTripStore.getState().places[0].id).toBe(99);
  });

  it('ignores duplicate place:created events', () => {
    const place: Place = { id: 5, trip_id: 1, name: 'Dup', description: null, lat: null, lng: null, address: null, category_id: null, icon: null, price: null, image_url: null, google_place_id: null, osm_id: null, route_geometry: null, place_time: null, end_time: null, created_at: '' };

    useTripStore.setState({ places: [place] });
    useTripStore.getState().handleRemoteEvent({ type: 'place:created', place });

    expect(useTripStore.getState().places).toHaveLength(1);
  });
});

describe('useTripStore — handleRemoteEvent() — place:deleted', () => {
  beforeEach(resetStore);

  it('removes the deleted place from the places array', () => {
    const p: Place = { id: 3, trip_id: 1, name: 'ToDelete', description: null, lat: null, lng: null, address: null, category_id: null, icon: null, price: null, image_url: null, google_place_id: null, osm_id: null, route_geometry: null, place_time: null, end_time: null, created_at: '' };
    useTripStore.setState({ places: [p] });

    useTripStore.getState().handleRemoteEvent({ type: 'place:deleted', placeId: 3 });

    expect(useTripStore.getState().places).toHaveLength(0);
  });
});

describe('useTripStore — loadTrip()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it('populates trip, days, and places from API responses', async () => {
    const fakeTrip = { id: 1, name: 'Hawaii', description: null, start_date: '2024-06-01', end_date: '2024-06-10', cover_url: null, is_archived: false, reminder_days: 7, owner_id: 1, created_at: '', updated_at: '' };
    const fakeDay = { id: 10, trip_id: 1, date: '2024-06-01', title: null, notes: null, assignments: [], notes_items: [] };
    const fakePlace = { id: 20, trip_id: 1, name: 'Beach', description: null, lat: null, lng: null, address: null, category_id: null, icon: null, price: null, image_url: null, google_place_id: null, osm_id: null, route_geometry: null, place_time: null, end_time: null, created_at: '' };

    apiMocks.tripsGet.mockResolvedValue({ trip: fakeTrip });
    apiMocks.daysList.mockResolvedValue({ days: [fakeDay] });
    apiMocks.placesList.mockResolvedValue({ places: [fakePlace] });
    apiMocks.packingList.mockResolvedValue({ items: [] });
    apiMocks.tagsList.mockResolvedValue({ tags: [] });
    apiMocks.categoriesList.mockResolvedValue({ categories: [] });

    await act(async () => {
      await useTripStore.getState().loadTrip(1);
    });

    const state = useTripStore.getState();
    expect(state.trip).toEqual(fakeTrip);
    expect(state.days).toHaveLength(1);
    expect(state.places).toHaveLength(1);
    expect(state.isLoading).toBe(false);
  });
});
