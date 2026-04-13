import { NextResponse } from 'next/server';
import dbConnect from '@/lib/database';
import { createJwt, verifyPassword } from '@/lib/auth';
import { setAuthCookie } from '@/lib/authSession';
import { devLogger } from '@/lib/devLogger';
import { User } from '@/models/user';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<{ email: string; password: string }>;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    devLogger.log('auth.login', 'Incoming login request', {
      email,
      passwordLength: password.length,
    });

    await dbConnect();
    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      devLogger.warn('auth.login', 'Password verification failed', { email });
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = createJwt({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
    });

    await setAuthCookie(token);

    devLogger.log('auth.login', 'Login successful', {
      userId: user._id.toString(),
      email: user.email,
      profileKeys: Object.keys(Object.fromEntries(user.data ?? new Map())),
    });

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        data: Object.fromEntries(user.data ?? new Map()),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to log in';
    devLogger.error('auth.login', 'Login failed', { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
