import { NextRequest, NextResponse } from 'next/server';
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

    const updated = serverChatStore.endChat(conversationId, userEmail);

    return NextResponse.json({
      success: true,
      message: 'Chat session has been permanently ended.',
      conversation: updated,
    });
  } catch (error: unknown) {
    console.error('API /chat/end error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: error instanceof Error && error.message.includes('Permission Denied') ? 403 : 500 }
    );
  }
}
