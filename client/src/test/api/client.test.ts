/**
 * API client tests
 *
 * Strategy: mock the underlying axios instance that api/client.ts creates so we
 * can verify each API helper calls the right method + endpoint without a real
 * HTTP server.  We also exercise the 401 response-interceptor redirect logic.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ─── axios mock ────────────────────────────────────────────────────────────
// We need to mock *before* the module under test is imported, so vi.mock is
// hoisted to the top of the file automatically.

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

// Intercept callbacks captured during module initialisation
let requestInterceptorFulfilled: ((cfg: unknown) => unknown) | null = null;
let responseInterceptorRejected: ((err: unknown) => unknown) | null = null;

vi.mock('axios', () => {
  const mockInstance = {
    get: mockGet,
    post: mockPost,
    put: mockPut,
    delete: mockDelete,
    interceptors: {
      request: {
        use: vi.fn((fulfilled) => {
          requestInterceptorFulfilled = fulfilled;
        }),
      },
      response: {
        use: vi.fn((_ok, rejected) => {
          responseInterceptorRejected = rejected;
        }),
      },
    },
  };

  return {
    default: {
      create: vi.fn(() => mockInstance),
    },
  };
});

// ─── websocket mock ─────────────────────────────────────────────────────────
vi.mock('../api/websocket', () => ({
  getSocketId: vi.fn(() => null),
  connect: vi.fn(),
  disconnect: vi.fn(),
}));

// ─── module under test ───────────────────────────────────────────────────────
// Import AFTER mocks are registered so hoisted vi.mock applies.
import { authApi, tripsApi } from '../../api/client';

// ─── helpers ────────────────────────────────────────────────────────────────
const ok = (data: unknown) => Promise.resolve({ data });

// ─── tests ──────────────────────────────────────────────────────────────────

describe('authApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('login() calls POST /auth/login with the correct body', async () => {
    mockPost.mockReturnValue(ok({ user: { id: 1 }, token: 'tok' }));
    await authApi.login({ email: 'a@b.com', password: 'secret' });
    expect(mockPost).toHaveBeenCalledWith('/auth/login', { email: 'a@b.com', password: 'secret' });
  });

  it('me() calls GET /auth/me', async () => {
    mockGet.mockReturnValue(ok({ user: { id: 1 } }));
    await authApi.me();
    expect(mockGet).toHaveBeenCalledWith('/auth/me');
  });

  it('register() calls POST /auth/register with correct body', async () => {
    mockPost.mockReturnValue(ok({ user: { id: 2 }, token: 'tok2' }));
    await authApi.register({ username: 'tester', email: 't@test.com', password: 'pw' });
    expect(mockPost).toHaveBeenCalledWith(
      '/auth/register',
      { username: 'tester', email: 't@test.com', password: 'pw', invite_token: undefined },
    );
  });

  it('demoLogin() calls POST /auth/demo-login', async () => {
    mockPost.mockReturnValue(ok({ user: { id: 99 }, token: 'demo' }));
    await authApi.demoLogin();
    expect(mockPost).toHaveBeenCalledWith('/auth/demo-login');
  });
});

describe('tripsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('list() calls GET /trips', async () => {
    mockGet.mockReturnValue(ok({ trips: [] }));
    await tripsApi.list();
    expect(mockGet).toHaveBeenCalledWith('/trips', { params: undefined });
  });

  it('list() forwards query params', async () => {
    mockGet.mockReturnValue(ok({ trips: [] }));
    await tripsApi.list({ archived: true });
    expect(mockGet).toHaveBeenCalledWith('/trips', { params: { archived: true } });
  });

  it('create() calls POST /trips with body', async () => {
    mockPost.mockReturnValue(ok({ trip: { id: 5, name: 'Hawaii' } }));
    await tripsApi.create({ name: 'Hawaii' });
    expect(mockPost).toHaveBeenCalledWith('/trips', { name: 'Hawaii' });
  });

  it('delete() calls DELETE /trips/:id', async () => {
    mockDelete.mockReturnValue(ok({}));
    await tripsApi.delete(42);
    expect(mockDelete).toHaveBeenCalledWith('/trips/42');
  });
});

describe('401 AUTH_REQUIRED interceptor', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects to /login when AUTH_REQUIRED 401 is received outside of auth pages', async () => {
    // Simulate being on a non-auth page
    Object.defineProperty(window, 'location', {
      value: { pathname: '/dashboard', href: '' },
      writable: true,
    });

    const err = {
      response: {
        status: 401,
        data: { code: 'AUTH_REQUIRED' },
      },
    };

    // The interceptor should redirect and re-reject the error
    expect(responseInterceptorRejected).not.toBeNull();
    await expect(responseInterceptorRejected!(err)).rejects.toEqual(err);
    expect(window.location.href).toBe('/login');
  });

  it('does NOT redirect when already on the /login page', async () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/login', href: '' },
      writable: true,
    });

    const err = {
      response: { status: 401, data: { code: 'AUTH_REQUIRED' } },
    };

    expect(responseInterceptorRejected).not.toBeNull();
    await expect(responseInterceptorRejected!(err)).rejects.toEqual(err);
    // href should NOT be mutated to '/login' again (already there)
    expect(window.location.href).toBe('');
  });
});
