import { NextResponse } from 'next/server';
import dbConnect from '@/lib/database';
import { createJwt, hashPassword } from '@/lib/auth';
import { setAuthCookie } from '@/lib/authSession';
import { devLogger } from '@/lib/devLogger';
import { User } from '@/models/user';

function normalizeEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<{ name: string; email: string; password: string }>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = normalizeEmail(body.email);
    const password = typeof body.password === 'string' ? body.password : '';

    if (name.length < 2) {
      return NextResponse.json({ error: 'Name must be at least 2 characters long' }, { status: 400 });
    }

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
    }

    devLogger.log('auth.register', 'Incoming register request', {
      name,
      email,
      passwordLength: password.length,
    });

    await dbConnect();
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({
      name,
      email,
      passwordHash,
      data: {
        name,
        email,
      },
    });

    const token = createJwt({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
    });

    await setAuthCookie(token);

    devLogger.log('auth.register', 'Registration successful', {
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
    const message = error instanceof Error ? error.message : 'Failed to register user';
    devLogger.error('auth.register', 'Registration failed', { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
