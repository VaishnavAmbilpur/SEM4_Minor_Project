import { NextResponse } from 'next/server';
import dbConnect from '@/lib/database';
import { User } from '@/models/user';

export async function GET() {
  try {
    await dbConnect();
    
    // Clear existing to avoid duplicates in testing
    await User.deleteMany({});
    
    const sampleUser = new User({
      data: {
        name: "John Doe",
        dob: "12-03-2002",
        address: "221B Baker Street",
        email: "john@example.com",
        phone: "9876543210"
      }
    });

    await sampleUser.save();

    return NextResponse.json({ message: "Database seeded successfully!", user: sampleUser });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
