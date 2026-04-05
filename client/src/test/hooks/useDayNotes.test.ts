/**
 * useDayNotes hook tests
 *
 * The hook wraps tripStore actions (addDayNote, updateDayNote, deleteDayNote).
 * We mock the store and verify the hook delegates correctly.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ─── mocks ──────────────────────────────────────────────────────────────────

const mockAddDayNote = vi.fn();
const mockUpdateDayNote = vi.fn();
const mockDeleteDayNote = vi.fn();

vi.mock('../../store/tripStore', () => ({
  useTripStore: vi.fn(() => ({
    addDayNote: mockAddDayNote,
    updateDayNote: mockUpdateDayNote,
    deleteDayNote: mockDeleteDayNote,
    dayNotes: {
      '1': [
        { id: 10, day_id: 1, text: 'Buy sunscreen', time: '09:00', icon: 'Sun', sort_order: 0, created_at: '' },
      ],
    },
  })),
}));

// Toast mock — useToast returns an object with error/success helpers
vi.mock('../../components/shared/Toast', () => ({
  useToast: vi.fn(() => ({
    error: vi.fn(),
    success: vi.fn(),
  })),
}));

// ─── module under test ───────────────────────────────────────────────────────
import { useDayNotes } from '../../hooks/useDayNotes';

// ─── tests ───────────────────────────────────────────────────────────────────

describe('useDayNotes — noteUi state management', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts with an empty noteUi map', () => {
    const { result } = renderHook(() => useDayNotes(1));
    expect(result.current.noteUi).toEqual({});
  });

  it('openAddNote() adds an entry for the given dayId in "add" mode', () => {
    const { result } = renderHook(() => useDayNotes(1));

    act(() => {
      result.current.openAddNote(1, () => []);
    });

    expect(result.current.noteUi[1]).toBeDefined();
    expect(result.current.noteUi[1].mode).toBe('add');
    expect(result.current.noteUi[1].text).toBe('');
  });

  it('openEditNote() adds an entry for the given dayId in "edit" mode with note data', () => {
    const { result } = renderHook(() => useDayNotes(1));
    const note = { id: 10, day_id: 1, text: 'Buy sunscreen', time: '09:00', icon: 'Sun', sort_order: 0, created_at: '' };

    act(() => {
      result.current.openEditNote(1, note);
    });

    const ui = result.current.noteUi[1];
    expect(ui.mode).toBe('edit');
    expect(ui.noteId).toBe(10);
    expect(ui.text).toBe('Buy sunscreen');
    expect(ui.time).toBe('09:00');
  });

  it('cancelNote() removes the entry for the given dayId', () => {
    const { result } = renderHook(() => useDayNotes(1));

    act(() => {
      result.current.openAddNote(1, () => []);
    });
    expect(result.current.noteUi[1]).toBeDefined();

    act(() => {
      result.current.cancelNote(1);
    });
    expect(result.current.noteUi[1]).toBeUndefined();
  });
});

describe('useDayNotes — saveNote()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls addDayNote with the correct args when in "add" mode', async () => {
    const savedNote = { id: 11, day_id: 1, text: 'Pack hat', time: '', icon: 'FileText', sort_order: 1, created_at: '' };
    mockAddDayNote.mockResolvedValue(savedNote);

    const { result } = renderHook(() => useDayNotes(1));

    // Open add note UI, set text
    act(() => {
      result.current.openAddNote(1, () => []);
      result.current.setNoteUi((prev) => ({
        ...prev,
        1: { ...prev[1], text: 'Pack hat' },
      }));
    });

    await act(async () => {
      await result.current.saveNote(1);
    });

    expect(mockAddDayNote).toHaveBeenCalledWith(
      1, // tripId
      1, // dayId
      expect.objectContaining({ text: 'Pack hat' }),
    );
  });

  it('does NOT call addDayNote when text is empty', async () => {
    const { result } = renderHook(() => useDayNotes(1));

    // Open add note but leave text blank
    act(() => {
      result.current.openAddNote(1, () => []);
    });

    await act(async () => {
      await result.current.saveNote(1);
    });

    expect(mockAddDayNote).not.toHaveBeenCalled();
  });

  it('calls updateDayNote in "edit" mode', async () => {
    const existingNote = { id: 10, day_id: 1, text: 'Buy sunscreen', time: '09:00', icon: 'Sun', sort_order: 0, created_at: '' };
    mockUpdateDayNote.mockResolvedValue(existingNote);

    const { result } = renderHook(() => useDayNotes(1));

    act(() => {
      result.current.openEditNote(1, existingNote);
      result.current.setNoteUi((prev) => ({
        ...prev,
        1: { ...prev[1], text: 'Buy extra sunscreen' },
      }));
    });

    await act(async () => {
      await result.current.saveNote(1);
    });

    expect(mockUpdateDayNote).toHaveBeenCalledWith(
      1, 1, 10,
      expect.objectContaining({ text: 'Buy extra sunscreen' }),
    );
  });
});

describe('useDayNotes — deleteNote()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls deleteDayNote with tripId, dayId, and noteId', async () => {
    mockDeleteDayNote.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDayNotes(1));

    await act(async () => {
      await result.current.deleteNote(1, 10);
    });

    expect(mockDeleteDayNote).toHaveBeenCalledWith(1, 1, 10);
  });
});

describe('useDayNotes — dayNotes exposure', () => {
  it('exposes dayNotes from the trip store', () => {
    const { result } = renderHook(() => useDayNotes(1));

    expect(result.current.dayNotes).toHaveProperty('1');
    expect(result.current.dayNotes['1']).toHaveLength(1);
    expect(result.current.dayNotes['1'][0].text).toBe('Buy sunscreen');
  });
});
