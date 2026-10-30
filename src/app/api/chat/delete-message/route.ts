import { NextRequest, NextResponse } from 'next/server';
import { isBusinessUser } from '@/lib/security';
import { serverChatStore } from '@/lib/serverChatStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { conversationId, messageId, userEmail } = body;

    if (!isBusinessUser(userEmail)) {
      return NextResponse.json(
        {
          error:
            'Permission Denied: Only the Business account can delete messages from their view.',
        },
        { status: 403 }
      );
    }

    if (!conversationId || !messageId) {
      return NextResponse.json(
        { error: 'Conversation ID and Message ID are required.' },
        { status: 400 }
      );
    }

    const updated = serverChatStore.deleteMessage({
      conversationId,
      messageId,
      userEmail,
    });

    return NextResponse.json({
      success: true,
      message: 'Message deleted from business view only.',
      conversation: updated,
    });
  } catch (error: unknown) {
    console.error('API /chat/delete-message error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

