/**
 * authStore tests
 *
 * We mock the API layer and websocket module so the store logic can be
 * exercised in isolation — no HTTP requests, no real sockets.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';

// ─── mocks ──────────────────────────────────────────────────────────────────
// vi.hoisted() ensures these exist before vi.mock() factories run.
const apiMocks = vi.hoisted(() => ({
  login: vi.fn(),
  me: vi.fn(),
  register: vi.fn(),
  verifyMfaLogin: vi.fn(),
  demoLogin: vi.fn(),
  updateMapsKey: vi.fn(),
  updateApiKeys: vi.fn(),
  updateSettings: vi.fn(),
  uploadAvatar: vi.fn(),
  deleteAvatar: vi.fn(),
}));

vi.mock('../../api/client', () => ({
  authApi: apiMocks,
}));

vi.mock('../../api/websocket', () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  getSocketId: vi.fn(() => null),
}));

// ─── module under test (import after mocks) ─────────────────────────────────
import { useAuthStore } from '../../store/authStore';

// ─── helper: reset store between tests ──────────────────────────────────────
function resetStore() {
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
    demoMode: false,
    devMode: false,
    hasMapsKey: false,
    appRequireMfa: false,
    tripRemindersEnabled: false,
  });
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('useAuthStore — initial state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it('has null user and isAuthenticated=false by default', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(true);
    expect(state.error).toBeNull();
  });
});

describe('useAuthStore — login()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it('sets user and isAuthenticated=true on successful login', async () => {
    const fakeUser = { id: 1, username: 'alice', email: 'alice@example.com' };
    apiMocks.login.mockResolvedValue({ user: fakeUser, token: 'tok' });

    await act(async () => {
      await useAuthStore.getState().login('alice@example.com', 'password');
    });

    const state = useAuthStore.getState();
    expect(state.user).toEqual(fakeUser);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('returns { mfa_required, mfa_token } when server signals MFA is needed', async () => {
    apiMocks.login.mockResolvedValue({ mfa_required: true, mfa_token: 'mfa-abc' });

    let result: unknown;
    await act(async () => {
      result = await useAuthStore.getState().login('bob@example.com', 'password');
    });

    expect(result).toEqual({ mfa_required: true, mfa_token: 'mfa-abc' });
    // Should NOT be authenticated yet
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('sets error state and throws when login fails', async () => {
    apiMocks.login.mockRejectedValue({
      response: { data: { message: 'Invalid credentials' } },
    });

    await act(async () => {
      await expect(
        useAuthStore.getState().login('bad@example.com', 'wrong'),
      ).rejects.toThrow();
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toBeTruthy();
    expect(state.isLoading).toBe(false);
  });
});

describe('useAuthStore — logout()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Seed an authenticated state
    useAuthStore.setState({
      user: { id: 1, username: 'alice' } as any,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
    // Provide a stub for fetch (logout calls fetch internally)
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
  });

  it('resets user and isAuthenticated to null/false', () => {
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toBeNull();
  });
});

describe('useAuthStore — loadUser()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it('sets user and isAuthenticated=true from API response', async () => {
    const fakeUser = { id: 2, username: 'carol', email: 'carol@example.com' };
    apiMocks.me.mockResolvedValue({ user: fakeUser });

    await act(async () => {
      await useAuthStore.getState().loadUser();
    });

    const state = useAuthStore.getState();
    expect(state.user).toEqual(fakeUser);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it('clears auth state when the API returns 401', async () => {
    apiMocks.me.mockRejectedValue({ response: { status: 401 } });

    await act(async () => {
      await useAuthStore.getState().loadUser();
    });

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it('does NOT clear auth state on network errors (non-401)', async () => {
    // Pre-seed with an authenticated user
    useAuthStore.setState({ user: { id: 5 } as any, isAuthenticated: true, isLoading: true });
    apiMocks.me.mockRejectedValue(new Error('Network error'));

    await act(async () => {
      await useAuthStore.getState().loadUser();
    });

    const state = useAuthStore.getState();
    // isAuthenticated should be preserved — only 401 clears it
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
  });
});

describe('useAuthStore — setters', () => {
  beforeEach(() => resetStore());

  it('setDemoMode sets demoMode flag', () => {
    useAuthStore.getState().setDemoMode(true);
    expect(useAuthStore.getState().demoMode).toBe(true);
    useAuthStore.getState().setDemoMode(false);
    expect(useAuthStore.getState().demoMode).toBe(false);
  });

  it('setDevMode sets devMode flag', () => {
    useAuthStore.getState().setDevMode(true);
    expect(useAuthStore.getState().devMode).toBe(true);
  });

  it('setHasMapsKey sets hasMapsKey flag', () => {
    useAuthStore.getState().setHasMapsKey(true);
    expect(useAuthStore.getState().hasMapsKey).toBe(true);
  });
});
