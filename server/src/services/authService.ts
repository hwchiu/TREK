import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/database';
import { JWT_SECRET } from '../config';
import { validatePassword } from './passwordPolicy';
import { getAllPermissions } from './permissions';
import { maybe_encrypt_api_key, decrypt_api_key } from './apiKeyCrypto';
import { generateToken } from './tokenService';
import { User } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ADMIN_SETTINGS_KEYS = [
  'allow_registration', 'allowed_file_types', 'require_mfa',
  'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from', 'smtp_skip_tls_verify',
  'notification_webhook_url', 'notification_channel',
  'notify_trip_invite', 'notify_booking_change', 'notify_trip_reminder',
  'notify_vacay_invite', 'notify_photos_shared', 'notify_collab_message', 'notify_packing_tagged',
];

// ---------------------------------------------------------------------------
// Helpers (exported for use by other service modules)
// ---------------------------------------------------------------------------

export function utcSuffix(ts: string | null | undefined): string | null {
  if (!ts) return null;
  return ts.endsWith('Z') ? ts : ts.replace(' ', 'T') + 'Z';
}

export function stripUserForClient(user: User): Record<string, unknown> {
  const {
    password_hash: _p,
    maps_api_key: _m,
    openweather_api_key: _o,
    unsplash_api_key: _u,
    mfa_secret: _mf,
    mfa_backup_codes: _mbc,
    ...rest
  } = user;
  return {
    ...rest,
    created_at: utcSuffix(rest.created_at),
    updated_at: utcSuffix(rest.updated_at),
    last_login: utcSuffix(rest.last_login),
    mfa_enabled: !!(user.mfa_enabled === 1 || user.mfa_enabled === true),
    must_change_password: !!(user.must_change_password === 1 || user.must_change_password === true),
  };
}

export function maskKey(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.length <= 8) return '--------';
  return '----' + key.slice(-4);
}

export function mask_stored_api_key(key: string | null | undefined): string | null {
  const plain = decrypt_api_key(key);
  return maskKey(plain);
}

export function avatarUrl(user: { avatar?: string | null }): string | null {
  return user.avatar ? `/uploads/avatars/${user.avatar}` : null;
}

export function isOidcOnlyMode(): boolean {
  const get = (key: string) =>
    (db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as { value: string } | undefined)?.value || null;
  const enabled = process.env.OIDC_ONLY === 'true' || get('oidc_only') === 'true';
  if (!enabled) return false;
  const oidcConfigured = !!(
    (process.env.OIDC_ISSUER || get('oidc_issuer')) &&
    (process.env.OIDC_CLIENT_ID || get('oidc_client_id'))
  );
  return oidcConfigured;
}

// ---------------------------------------------------------------------------
// Invite tokens
// ---------------------------------------------------------------------------

interface InviteToken {
  id: number;
  token: string;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
}

// ---------------------------------------------------------------------------
// App config (public endpoint)
// ---------------------------------------------------------------------------

export function getAppConfig(authenticatedUser: { id: number } | null) {
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  const setting = db.prepare("SELECT value FROM app_settings WHERE key = 'allow_registration'").get() as { value: string } | undefined;
  const allowRegistration = userCount === 0 || (setting?.value ?? 'true') === 'true';
  const isDemo = process.env.DEMO_MODE === 'true';
  const { version } = require('../../package.json');
  const adminMapsRow = db.prepare("SELECT maps_api_key, maps_provider FROM users WHERE role = 'admin' LIMIT 1").get() as { maps_api_key: string | null; maps_provider: string } | undefined;
  const hasGoogleKey = !!(adminMapsRow?.maps_api_key);
  const oidcDisplayName = process.env.OIDC_DISPLAY_NAME ||
    (db.prepare("SELECT value FROM app_settings WHERE key = 'oidc_display_name'").get() as { value: string } | undefined)?.value || null;
  const oidcConfigured = !!(
    (process.env.OIDC_ISSUER || (db.prepare("SELECT value FROM app_settings WHERE key = 'oidc_issuer'").get() as { value: string } | undefined)?.value) &&
    (process.env.OIDC_CLIENT_ID || (db.prepare("SELECT value FROM app_settings WHERE key = 'oidc_client_id'").get() as { value: string } | undefined)?.value)
  );
  const oidcOnlySetting = process.env.OIDC_ONLY ||
    (db.prepare("SELECT value FROM app_settings WHERE key = 'oidc_only'").get() as { value: string } | undefined)?.value;
  const oidcOnlyMode = oidcConfigured && oidcOnlySetting === 'true';
  const requireMfaRow = db.prepare("SELECT value FROM app_settings WHERE key = 'require_mfa'").get() as { value: string } | undefined;
  const notifChannel = (db.prepare("SELECT value FROM app_settings WHERE key = 'notification_channel'").get() as { value: string } | undefined)?.value || 'none';
  const tripReminderSetting = (db.prepare("SELECT value FROM app_settings WHERE key = 'notify_trip_reminder'").get() as { value: string } | undefined)?.value;
  const hasSmtpHost = !!(process.env.SMTP_HOST || (db.prepare("SELECT value FROM app_settings WHERE key = 'smtp_host'").get() as { value: string } | undefined)?.value);
  const hasWebhookUrl = !!(process.env.NOTIFICATION_WEBHOOK_URL || (db.prepare("SELECT value FROM app_settings WHERE key = 'notification_webhook_url'").get() as { value: string } | undefined)?.value);
  const channelConfigured = (notifChannel === 'email' && hasSmtpHost) || (notifChannel === 'webhook' && hasWebhookUrl);
  const tripRemindersEnabled = channelConfigured && tripReminderSetting !== 'false';
  const setupComplete = userCount > 0 && !(db.prepare("SELECT id FROM users WHERE role = 'admin' AND must_change_password = 1 LIMIT 1").get());

  return {
    allow_registration: isDemo ? false : allowRegistration,
    has_users: userCount > 0,
    setup_complete: setupComplete,
    version,
    has_maps_key: hasGoogleKey,
    maps_provider: adminMapsRow?.maps_provider ?? 'openstreetmap',
    maps_api_key: hasGoogleKey ? adminMapsRow!.maps_api_key : undefined,
    oidc_configured: oidcConfigured,
    oidc_display_name: oidcConfigured ? (oidcDisplayName || 'SSO') : undefined,
    oidc_only_mode: oidcOnlyMode,
    require_mfa: requireMfaRow?.value === 'true',
    allowed_file_types: (db.prepare("SELECT value FROM app_settings WHERE key = 'allowed_file_types'").get() as { value: string } | undefined)?.value || 'jpg,jpeg,png,gif,webp,heic,pdf,doc,docx,xls,xlsx,txt,csv',
    demo_mode: isDemo,
    demo_email: isDemo ? 'demo@trek.app' : undefined,
    demo_password: isDemo ? 'demo12345' : undefined,
    timezone: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    notification_channel: notifChannel,
    trip_reminders_enabled: tripRemindersEnabled,
    permissions: authenticatedUser ? getAllPermissions() : undefined,
    dev_mode: process.env.NODE_ENV === 'development',
  };
}

// ---------------------------------------------------------------------------
// Auth: demo, register, login
// ---------------------------------------------------------------------------

export function demoLogin(): { error?: string; status?: number; token?: string; user?: Record<string, unknown> } {
  if (process.env.DEMO_MODE !== 'true') {
    return { error: 'Not found', status: 404 };
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get('demo@trek.app') as User | undefined;
  if (!user) return { error: 'Demo user not found', status: 500 };
  const token = generateToken(user);
  const safe = stripUserForClient(user) as Record<string, unknown>;
  return { token, user: { ...safe, avatar_url: avatarUrl(user) } };
}

export function validateInviteToken(token: string): { error?: string; status?: number; valid?: boolean; max_uses?: number; used_count?: number; expires_at?: string } {
  const invite = db.prepare('SELECT * FROM invite_tokens WHERE token = ?').get(token) as InviteToken | undefined;
  if (!invite) return { error: 'Invalid invite link', status: 404 };
  if (invite.max_uses > 0 && invite.used_count >= invite.max_uses) return { error: 'Invite link has been fully used', status: 410 };
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return { error: 'Invite link has expired', status: 410 };
  return { valid: true, max_uses: invite.max_uses, used_count: invite.used_count, expires_at: invite.expires_at ?? undefined };
}

export function registerUser(body: {
  username?: string;
  email?: string;
  password?: string;
  invite_token?: string;
}): { error?: string; status?: number; token?: string; user?: Record<string, unknown>; auditUserId?: number; auditDetails?: Record<string, unknown> } {
  const { username, email, password, invite_token } = body;

  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;

  let validInvite: InviteToken | null = null;
  if (invite_token) {
    validInvite = db.prepare('SELECT * FROM invite_tokens WHERE token = ?').get(invite_token) as InviteToken | null;
    if (!validInvite) return { error: 'Invalid invite link', status: 400 };
    if (validInvite.max_uses > 0 && validInvite.used_count >= validInvite.max_uses) return { error: 'Invite link has been fully used', status: 410 };
    if (validInvite.expires_at && new Date(validInvite.expires_at) < new Date()) return { error: 'Invite link has expired', status: 410 };
  }

  if (userCount > 0 && !validInvite) {
    if (isOidcOnlyMode()) {
      return { error: 'Password authentication is disabled. Please sign in with SSO.', status: 403 };
    }
    const setting = db.prepare("SELECT value FROM app_settings WHERE key = 'allow_registration'").get() as { value: string } | undefined;
    if (setting?.value === 'false') {
      return { error: 'Registration is disabled. Contact your administrator.', status: 403 };
    }
  }

  if (!username || !email || !password) {
    return { error: 'Username, email and password are required', status: 400 };
  }

  const pwCheck = validatePassword(password);
  if (!pwCheck.ok) return { error: pwCheck.reason, status: 400 };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { error: 'Invalid email format', status: 400 };
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)').get(email, username);
  if (existingUser) {
    return { error: 'Registration failed. Please try different credentials.', status: 409 };
  }

  const password_hash = bcrypt.hashSync(password, 12);
  const isFirstUser = userCount === 0;
  const role = isFirstUser ? 'admin' : 'user';

  try {
    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run(username, email, password_hash, role);

    const user = { id: result.lastInsertRowid, username, email, role, avatar: null, mfa_enabled: false };
    const token = generateToken(user);

    if (validInvite) {
      const updated = db.prepare(
        'UPDATE invite_tokens SET used_count = used_count + 1 WHERE id = ? AND (max_uses = 0 OR used_count < max_uses) RETURNING used_count'
      ).get(validInvite.id);
      if (!updated) {
        console.warn(`[Auth] Invite token ${validInvite.token.slice(0, 8)}... exceeded max_uses due to race condition`);
      }
    }

    return {
      token,
      user: { ...user, avatar_url: null },
      auditUserId: Number(result.lastInsertRowid),
      auditDetails: { username, email, role },
    };
  } catch {
    return { error: 'Error creating user', status: 500 };
  }
}

export function loginUser(body: {
  email?: string;
  password?: string;
}): {
  error?: string;
  status?: number;
  token?: string;
  user?: Record<string, unknown>;
  mfa_required?: boolean;
  mfa_token?: string;
  auditUserId?: number | null;
  auditAction?: string;
  auditDetails?: Record<string, unknown>;
} {
  if (isOidcOnlyMode()) {
    return { error: 'Password authentication is disabled. Please sign in with SSO.', status: 403 };
  }

  const { email, password } = body;
  if (!email || !password) {
    return { error: 'Email and password are required', status: 400 };
  }

  const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email) as User | undefined;
  if (!user) {
    return {
      error: 'Invalid email or password', status: 401,
      auditUserId: null, auditAction: 'user.login_failed', auditDetails: { email, reason: 'unknown_email' },
    };
  }

  const validPassword = bcrypt.compareSync(password, user.password_hash!);
  if (!validPassword) {
    return {
      error: 'Invalid email or password', status: 401,
      auditUserId: Number(user.id), auditAction: 'user.login_failed', auditDetails: { email, reason: 'wrong_password' },
    };
  }

  if (user.mfa_enabled === 1 || user.mfa_enabled === true) {
    const mfa_token = jwt.sign(
      { id: Number(user.id), purpose: 'mfa_login' },
      JWT_SECRET,
      { expiresIn: '5m', algorithm: 'HS256' }
    );
    return { mfa_required: true, mfa_token };
  }

  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
  const token = generateToken(user);
  const userSafe = stripUserForClient(user) as Record<string, unknown>;

  return {
    token,
    user: { ...userSafe, avatar_url: avatarUrl(user) },
    auditUserId: Number(user.id),
    auditAction: 'user.login',
    auditDetails: { email },
  };
}

