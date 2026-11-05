import { NextRequest, NextResponse } from 'next/server';
import { isBusinessUser } from '@/lib/security';
import { serverChatStore } from '@/lib/serverChatStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { conversationId, messageId, userEmail } = body;

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

    const updated = serverChatStore.deleteMessage({
      conversationId,
      messageId,
      userEmail,
    });

    return NextResponse.json({
      success: true,
      message: 'Message deleted from your view.',
      conversation: updated,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.warn('API /chat/delete-message notice:', message);
    const status = message.includes('expired') || message.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}

