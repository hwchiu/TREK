import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuid } from 'uuid';
import rateLimit, { MemoryStore } from 'express-rate-limit';
import { authenticate, optionalAuth, demoUploadBlock } from '../middleware/auth';
import { AuthRequest, OptionalAuthRequest } from '../types';
import { writeAudit, getClientIp } from '../services/auditLog';
import { setAuthCookie, clearAuthCookie } from '../services/cookie';
import {
  getAppConfig,
  demoLogin,
  validateInviteToken,
  registerUser,
  loginUser,
} from '../services/authService';
import {
  getCurrentUser,
  changePassword,
  deleteAccount,
  updateMapsKey,
  updateApiKeys,
  updateSettings,
  getSettings,
  saveAvatar,
  deleteAvatar,
  listUsers,
  validateKeys,
  getAppSettings,
  updateAppSettings,
  getTravelStats,
} from '../services/userService';
import {
  setupMfa,
  enableMfa,
  disableMfa,
  verifyMfaLogin,
} from '../services/mfaService';
import {
  listMcpTokens,
  createMcpToken,
  deleteMcpToken,
  createWsToken,
  createResourceToken,
} from '../services/tokenService';

const router = express.Router();

// ---------------------------------------------------------------------------
// Avatar upload (multer config stays in route — middleware concern)
// ---------------------------------------------------------------------------

const avatarDir = path.join(__dirname, '../../uploads/avatars');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarDir),
  filename: (_req, file, cb) => cb(null, uuid() + path.extname(file.originalname)),
});
const ALLOWED_AVATAR_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: MAX_AVATAR_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!file.mimetype.startsWith('image/') || !ALLOWED_AVATAR_EXTS.includes(ext)) {
      const err: Error & { statusCode?: number } = new Error('Only image files (jpg, png, gif, webp) are allowed');
      err.statusCode = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

// ---------------------------------------------------------------------------
// Rate limiters (express-rate-limit with resettable stores for testing)
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes

const authStore = new MemoryStore();
const mfaStore = new MemoryStore();
const pwdStore = new MemoryStore();
const mcpStore = new MemoryStore();
const mfaDisableStore = new MemoryStore();

const authLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
  keyGenerator: (req) => req.ip ?? 'unknown',
  store: authStore,
});

const mfaLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
  keyGenerator: (req) => req.ip ?? 'unknown',
  store: mfaStore,
});

const pwdLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
  keyGenerator: (req) => req.ip ?? 'unknown',
  store: pwdStore,
});

const mcpCreateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
  keyGenerator: (req) => req.ip ?? 'unknown',
  store: mcpStore,
});

const mfaDisableLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
  keyGenerator: (req) => req.ip ?? 'unknown',
  store: mfaDisableStore,
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

router.get('/app-config', optionalAuth, (req: Request, res: Response) => {
  const user = (req as OptionalAuthRequest).user;
  res.json(getAppConfig(user));
});

router.post('/demo-login', (_req: Request, res: Response) => {
  const result = demoLogin();
  if (result.error) return res.status(result.status!).json({ error: result.error });
  setAuthCookie(res, result.token!);
  res.json({ token: result.token, user: result.user });
});

router.get('/invite/:token', authLimiter, (req: Request, res: Response) => {
  const result = validateInviteToken(req.params.token);
  if (result.error) return res.status(result.status!).json({ error: result.error });
  res.json({ valid: result.valid, max_uses: result.max_uses, used_count: result.used_count, expires_at: result.expires_at });
});

router.post('/register', authLimiter, (req: Request, res: Response) => {
  const result = registerUser(req.body);
  if (result.error) return res.status(result.status!).json({ error: result.error });
  writeAudit({ userId: result.auditUserId!, action: 'user.register', ip: getClientIp(req), details: result.auditDetails });
  setAuthCookie(res, result.token!);
  res.status(201).json({ token: result.token, user: result.user });
});

router.post('/login', authLimiter, (req: Request, res: Response) => {
  const result = loginUser(req.body);
  if (result.auditAction) {
    writeAudit({ userId: result.auditUserId ?? null, action: result.auditAction, ip: getClientIp(req), details: result.auditDetails });
  }
  if (result.error) return res.status(result.status!).json({ error: result.error });
  if (result.mfa_required) return res.json({ mfa_required: true, mfa_token: result.mfa_token });
  setAuthCookie(res, result.token!);
  res.json({ token: result.token, user: result.user });
});

router.get('/me', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const user = getCurrentUser(authReq.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

router.post('/logout', (_req: Request, res: Response) => {
  clearAuthCookie(res);
  res.json({ success: true });
});

router.put('/me/password', authenticate, pwdLimiter, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const result = changePassword(authReq.user.id, authReq.user.email, req.body);
  if (result.error) return res.status(result.status!).json({ error: result.error });
  writeAudit({ userId: authReq.user.id, action: 'user.password_change', ip: getClientIp(req) });
  res.json({ success: true });
});

router.delete('/me', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const result = deleteAccount(authReq.user.id, authReq.user.email, authReq.user.role);
  if (result.error) return res.status(result.status!).json({ error: result.error });
  writeAudit({ userId: authReq.user.id, action: 'user.account_delete', ip: getClientIp(req) });
  res.json({ success: true });
});

router.put('/me/maps-key', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  res.json(updateMapsKey(authReq.user.id, req.body.maps_api_key));
});

router.put('/me/api-keys', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  res.json(updateApiKeys(authReq.user.id, req.body));
});

router.put('/me/settings', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const result = updateSettings(authReq.user.id, req.body);
  if (result.error) return res.status(result.status!).json({ error: result.error });
  res.json({ success: result.success, user: result.user });
});

router.get('/me/settings', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const result = getSettings(authReq.user.id);
  if (result.error) return res.status(result.status!).json({ error: result.error });
  res.json({ settings: result.settings });
});

router.post('/avatar', authenticate, demoUploadBlock, avatarUpload.single('avatar'), (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  res.json(saveAvatar(authReq.user.id, req.file.filename));
});

router.delete('/avatar', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  res.json(deleteAvatar(authReq.user.id));
});

router.get('/users', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  res.json({ users: listUsers(authReq.user.id) });
});

router.get('/validate-keys', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const result = await validateKeys(authReq.user.id);
  if (result.error) return res.status(result.status!).json({ error: result.error });
  res.json({ maps: result.maps, weather: result.weather, maps_details: result.maps_details });
});

router.get('/app-settings', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const result = getAppSettings(authReq.user.id);
  if (result.error) return res.status(result.status!).json({ error: result.error });
  res.json(result.data);
});

router.put('/app-settings', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const result = updateAppSettings(authReq.user.id, req.body);
  if (result.error) return res.status(result.status!).json({ error: result.error });
  writeAudit({
    userId: authReq.user.id,
    action: 'settings.app_update',
    ip: getClientIp(req),
    details: result.auditSummary,
    debugDetails: result.auditDebugDetails,
  });
  res.json({ success: true });
});

router.get('/travel-stats', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  res.json(getTravelStats(authReq.user.id));
});

router.post('/mfa/verify-login', mfaLimiter, (req: Request, res: Response) => {
  const result = verifyMfaLogin(req.body);
  if (result.error) return res.status(result.status!).json({ error: result.error });
  writeAudit({ userId: result.auditUserId!, action: 'user.login', ip: getClientIp(req), details: { mfa: true } });
  setAuthCookie(res, result.token!);
  res.json({ token: result.token, user: result.user });
});

router.post('/mfa/setup', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const result = setupMfa(authReq.user.id, authReq.user.email);
  if (result.error) return res.status(result.status!).json({ error: result.error });
  result.qrPromise!
    .then((qr_data_url: string) => {
      res.json({ secret: result.secret, otpauth_url: result.otpauth_url, qr_data_url });
    })
    .catch((err: unknown) => {
      console.error('[MFA] QR code generation error:', err);
      res.status(500).json({ error: 'Could not generate QR code' });
    });
});

router.post('/mfa/enable', authenticate, mfaLimiter, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const result = enableMfa(authReq.user.id, req.body.code);
  if (result.error) return res.status(result.status!).json({ error: result.error });
  writeAudit({ userId: authReq.user.id, action: 'user.mfa_enable', ip: getClientIp(req) });
  res.json({ success: true, mfa_enabled: result.mfa_enabled, backup_codes: result.backup_codes });
});

router.post('/mfa/disable', authenticate, mfaDisableLimiter, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const result = disableMfa(authReq.user.id, authReq.user.email, req.body);
  if (result.error) return res.status(result.status!).json({ error: result.error });
  writeAudit({ userId: authReq.user.id, action: 'user.mfa_disable', ip: getClientIp(req) });
  res.json({ success: true, mfa_enabled: result.mfa_enabled });
});

// --- MCP Token Management ---

router.get('/mcp-tokens', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  res.json({ tokens: listMcpTokens(authReq.user.id) });
});

router.post('/mcp-tokens', authenticate, mcpCreateLimiter, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const result = createMcpToken(authReq.user.id, req.body.name);
  if (result.error) return res.status(result.status!).json({ error: result.error });
  res.status(201).json({ token: result.token });
});

router.delete('/mcp-tokens/:id', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const result = deleteMcpToken(authReq.user.id, req.params.id);
  if (result.error) return res.status(result.status!).json({ error: result.error });
  res.json({ success: true });
});

// Short-lived single-use token for WebSocket connections
router.post('/ws-token', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const result = createWsToken(authReq.user.id);
  if (result.error) return res.status(result.status!).json({ error: result.error });
  res.json({ token: result.token });
});

// Short-lived single-use token for direct resource URLs
router.post('/resource-token', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const result = createResourceToken(authReq.user.id, req.body.purpose);
  if (result.error) return res.status(result.status!).json({ error: result.error });
  res.json({ token: result.token });
});

export default router;

// Exported for test resets only — resets all rate limiter state between tests
export function resetRateLimiters(): void {
  authStore.resetKey('::ffff:127.0.0.1');
  authStore.resetKey('127.0.0.1');
  mfaStore.resetKey('::ffff:127.0.0.1');
  mfaStore.resetKey('127.0.0.1');
  pwdStore.resetKey('::ffff:127.0.0.1');
  pwdStore.resetKey('127.0.0.1');
  mcpStore.resetKey('::ffff:127.0.0.1');
  mcpStore.resetKey('127.0.0.1');
  mfaDisableStore.resetKey('::ffff:127.0.0.1');
  mfaDisableStore.resetKey('127.0.0.1');
}
