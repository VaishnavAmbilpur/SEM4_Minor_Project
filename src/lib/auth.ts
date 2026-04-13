import crypto from 'crypto';

export const AUTH_COOKIE_NAME = 'auth_token';
const JWT_ALGORITHM = 'HS256';
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
}

interface JwtPayload extends SessionUser {
  iat: number;
  exp: number;
}

function getJwtSecret(): string {
  const value = process.env.JWT_SECRET?.trim();
  if (!value) {
    throw new Error('Missing required environment variable: JWT_SECRET');
  }
  return value;
}

function base64UrlEncode(value: Buffer | string): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + '='.repeat(padding), 'base64');
}

function sign(input: string): string {
  return base64UrlEncode(
    crypto.createHmac('sha256', getJwtSecret()).update(input).digest(),
  );
}

export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(`${salt}:${Buffer.from(derivedKey).toString('hex')}`);
    });
  });
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const [salt, storedHash] = passwordHash.split(':');
  if (!salt || !storedHash) {
    return false;
  }

  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      const incomingHash = Buffer.from(derivedKey).toString('hex');
      const left = Buffer.from(incomingHash, 'hex');
      const right = Buffer.from(storedHash, 'hex');
      if (left.length !== right.length) {
        resolve(false);
        return;
      }

      resolve(crypto.timingSafeEqual(left, right));
    });
  });
}

export function createJwt(user: SessionUser): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    ...user,
    iat: now,
    exp: now + DEFAULT_SESSION_TTL_SECONDS,
  };

  const header = {
    alg: JWT_ALGORITHM,
    typ: 'JWT',
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(`${encodedHeader}.${encodedPayload}`);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyJwt(token: string): SessionUser | null {
  const [encodedHeader, encodedPayload, signature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`);
  const left = Buffer.from(signature);
  const right = Buffer.from(expectedSignature);

  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    return null;
  }

  try {
    const header = JSON.parse(base64UrlDecode(encodedHeader).toString('utf8')) as {
      alg?: string;
      typ?: string;
    };

    if (header.alg !== JWT_ALGORITHM || header.typ !== 'JWT') {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8')) as Partial<JwtPayload>;
    const now = Math.floor(Date.now() / 1000);
    if (!payload.userId || !payload.email || !payload.name || !payload.exp || payload.exp <= now) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
    };
  } catch {
    return null;
  }
}

function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};

  return cookieHeader.split(';').reduce<Record<string, string>>((accumulator, item) => {
    const [rawName, ...rawValue] = item.trim().split('=');
    if (!rawName) return accumulator;
    accumulator[rawName] = decodeURIComponent(rawValue.join('='));
    return accumulator;
  }, {});
}

export function getTokenFromRequest(req: Request): string | null {
  const authorization = req.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  const cookies = parseCookieHeader(req.headers.get('cookie'));
  return cookies[AUTH_COOKIE_NAME] ?? null;
}

export function getSessionFromRequest(req: Request): SessionUser | null {
  const token = getTokenFromRequest(req);
  return token ? verifyJwt(token) : null;
}

export const authCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: DEFAULT_SESSION_TTL_SECONDS,
};
