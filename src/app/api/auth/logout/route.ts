import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/authSession';

export async function POST() {
  await clearAuthCookie();
  return NextResponse.json({ success: true });
}
