import { NextRequest, NextResponse } from 'next/server';
import { serverChatStore } from '@/lib/serverChatStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, avatar } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const user = serverChatStore.syncUserProfile({
      email,
      name,
      avatar,
    });

    return NextResponse.json({ success: true, user });
  } catch (error: unknown) {
    console.error('API /user/sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

