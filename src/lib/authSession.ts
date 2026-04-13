import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import dbConnect from '@/lib/database';
import { getSessionFromRequest, AUTH_COOKIE_NAME, authCookieOptions } from '@/lib/auth';
import { User } from '@/models/user';

function unauthorizedResponse(message = 'Authentication required') {
  return NextResponse.json({ error: message }, { status: 401 });
}

export async function getAuthenticatedUser(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session?.userId) {
    return null;
  }

  await dbConnect();
  return User.findById(session.userId);
}

export async function requireAuthenticatedUser(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return { user: null, response: unauthorizedResponse() };
  }

  return { user, response: null };
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, token, authCookieOptions);
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, '', {
    ...authCookieOptions,
    maxAge: 0,
  });
}
