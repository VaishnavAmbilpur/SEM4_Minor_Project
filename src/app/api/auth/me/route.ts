import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/authSession';
import { devLogger } from '@/lib/devLogger';

function serializeUser(user: {
  _id: { toString(): string };
  name: string;
  email: string;
  data?: Map<string, string>;
}) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    data: Object.fromEntries(user.data ?? new Map()),
  };
}

export async function GET(req: Request) {
  const { user, response } = await requireAuthenticatedUser(req);
  if (!user) {
    return response;
  }

  devLogger.log('auth.me', 'Returning current user profile', {
    userId: user._id.toString(),
    email: user.email,
    profileKeys: Object.keys(Object.fromEntries(user.data ?? new Map())),
  });

  return NextResponse.json({ user: serializeUser(user) });
}

export async function PUT(req: Request) {
  const { user, response } = await requireAuthenticatedUser(req);
  if (!user) {
    return response;
  }

  try {
    const body = (await req.json()) as Partial<{
      name: string;
      data: Record<string, string>;
    }>;

    const nextName = typeof body.name === 'string' ? body.name.trim() : user.name;
    const rawData = body.data && typeof body.data === 'object' ? body.data : {};
    const normalizedData: Record<string, string> = {};

    for (const [key, value] of Object.entries(rawData)) {
      if (typeof value === 'string' && value.trim()) {
        normalizedData[key] = value.trim();
      }
    }

    devLogger.log('auth.me', 'Updating profile', {
      userId: user._id.toString(),
      nextName,
      incomingKeys: Object.keys(rawData),
      normalizedKeys: Object.keys(normalizedData),
      normalizedData,
    });

    user.name = nextName || user.name;
    user.data = new Map<string, string>([
      ...Object.entries(normalizedData),
      ['name', user.name],
      ['email', user.email],
    ]);
    await user.save();

    devLogger.log('auth.me', 'Profile updated', {
      userId: user._id.toString(),
      profileKeys: Object.keys(Object.fromEntries(user.data ?? new Map())),
    });

    return NextResponse.json({ user: serializeUser(user) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update profile';
    devLogger.error('auth.me', 'Profile update failed', { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
