import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/authSession';

export async function POST(req: Request) {
  try {
    const { user, response } = await requireAuthenticatedUser(req);
    if (!user) {
      return response;
    }

    user.name = user.name || 'John Doe';
    user.data = new Map<string, string>([
      ['name', user.name],
      ['dob', '12-03-2002'],
      ['address', '221B Baker Street'],
      ['email', user.email],
      ['phone', '9876543210'],
    ]);

    await user.save();

    return NextResponse.json({
      message: 'Demo profile seeded successfully',
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        data: Object.fromEntries(user.data),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to seed profile';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
