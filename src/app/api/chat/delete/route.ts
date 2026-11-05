import { NextRequest, NextResponse } from 'next/server';
import { isBusinessUser } from '@/lib/security';
import { serverChatStore } from '@/lib/serverChatStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { conversationId, userEmail } = body;

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email is required.' },
        { status: 400 }
      );
    }

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required.' },
        { status: 400 }
      );
    }

    const updated = serverChatStore.deleteChat(conversationId, userEmail);

    return NextResponse.json({
      success: true,
      message:
        'Conversation cleared from your view only. Communication connection and recipient history remain active.',
      conversation: updated,
    });
  } catch (error: unknown) {
    console.error('API /chat/delete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
