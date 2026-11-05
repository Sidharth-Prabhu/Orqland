import { NextRequest, NextResponse } from 'next/server';
import { serverChatStore } from '@/lib/serverChatStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { conversationId, messageId, newContent, userEmail } = body;

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email is required.' },
        { status: 400 }
      );
    }

    if (!conversationId || !messageId) {
      return NextResponse.json(
        { error: 'Conversation ID and Message ID are required.' },
        { status: 400 }
      );
    }

    if (typeof newContent !== 'string') {
      return NextResponse.json(
        { error: 'New content is required.' },
        { status: 400 }
      );
    }

    const updated = serverChatStore.editMessage({
      conversationId,
      messageId,
      newContent,
      userEmail,
    });

    return NextResponse.json({
      success: true,
      message: 'Message edited successfully.',
      conversation: updated,
    });
  } catch (error: unknown) {
    console.error('API /chat/edit-message error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
