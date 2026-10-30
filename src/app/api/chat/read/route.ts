import { NextRequest, NextResponse } from 'next/server';
import { serverChatStore } from '@/lib/serverChatStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { conversationId, readerEmail } = body;

    if (!conversationId || !readerEmail) {
      return NextResponse.json(
        { error: 'Conversation ID and reader email are required.' },
        { status: 400 }
      );
    }

    serverChatStore.markAsRead(conversationId, readerEmail);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('API /chat/read error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

