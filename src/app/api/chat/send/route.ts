import { NextRequest, NextResponse } from 'next/server';
import { detectSensitiveContent } from '@/lib/security';
import { serverChatStore } from '@/lib/serverChatStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      conversationId,
      senderEmail,
      senderName,
      senderAvatar,
      content,
      attachment,
    } = body;

    if (!conversationId || !senderEmail) {
      return NextResponse.json(
        { error: 'Conversation ID and sender email are required.' },
        { status: 400 }
      );
    }

    // Sensitive data scanning: warn and prevent prohibited credential/financial info
    if (content) {
      const sensitiveCheck = detectSensitiveContent(content);
      if (sensitiveCheck.hasSensitiveData && content.toLowerCase().includes('otp')) {
        return NextResponse.json(
          { error: sensitiveCheck.warning || 'Sharing OTPs or sensitive credentials is prohibited.' },
          { status: 400 }
        );
      }
    }

    // Attachment validation if present
    if (attachment) {
      const allowedTypes = ['image', 'pdf', 'location'];
      if (!allowedTypes.includes(attachment.type)) {
        return NextResponse.json(
          {
            error:
              'Unsupported attachment format. Only Images (JPG, JPEG, PNG, WebP), PDF documents, and Location sharing are permitted.',
          },
          { status: 400 }
        );
      }
    }

    const result = serverChatStore.sendMessage({
      conversationId,
      senderEmail,
      senderName: senderName || 'User',
      senderAvatar: senderAvatar || '',
      content: content || '',
      attachment,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    console.error('API /chat/send error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const status = message.includes('ended') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
