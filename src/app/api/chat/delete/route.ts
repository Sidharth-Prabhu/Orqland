import { NextRequest, NextResponse } from 'next/server';
import { isBusinessUser } from '@/lib/security';
import { serverChatStore } from '@/lib/serverChatStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { conversationId, userEmail } = body;

    // Backend-enforced check: Delete Chat is available only to the Business
    if (!isBusinessUser(userEmail)) {
      return NextResponse.json(
        {
          error:
            'Permission Denied: Only the Business account can delete conversation history from their view.',
        },
        { status: 403 }
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
        'Conversation deleted from business view only. Communication connection and client history remain active.',
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
