import { NextRequest, NextResponse } from 'next/server';
import { serverChatStore } from '@/lib/serverChatStore';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ conversations: [] });
    }

    const conversations = serverChatStore.getConversations(email);
    return NextResponse.json({ conversations });
  } catch (error: unknown) {
    console.error('API /chat/list error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

