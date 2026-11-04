import { NextRequest, NextResponse } from 'next/server';
import { detectSensitiveContent } from '@/lib/security';
import { serverChatStore } from '@/lib/serverChatStore';
import { checkMessageRateLimit, inspectAttachmentSecurity } from '@/lib/rateLimiter';

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
      attachments,
    } = body;

    if (!conversationId || !senderEmail) {
      return NextResponse.json(
        { error: 'Conversation ID and sender email are required.' },
        { status: 400 }
      );
    }

    // 1. Abuse Protection: Rate Limiting
    const rateCheck = checkMessageRateLimit(senderEmail);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: rateCheck.reason || 'Rate limit exceeded. Please wait a moment.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateCheck.retryAfterSeconds || 5) },
        }
      );
    }

    // 2. Sensitive Data Policy Enforcement:
    // Block confidential credentials, OTPs, card numbers, passwords, bank accounts, and identity documents
    if (content) {
      const sensitiveCheck = detectSensitiveContent(content);
      if (sensitiveCheck.isBlocked) {
        return NextResponse.json(
          {
            error:
              sensitiveCheck.error ||
              'Security Policy Violation: Sharing credit/debit card numbers, OTPs, passwords, PINs, or bank account details is prohibited.',
          },
          { status: 400 }
        );
      }
    }

    // 3. Attachment validation & malicious signature inspection
    if (attachment) {
      const attachmentCheck = inspectAttachmentSecurity(attachment);
      if (!attachmentCheck.valid) {
        return NextResponse.json(
          { error: attachmentCheck.error || 'Invalid or prohibited attachment.' },
          { status: 400 }
        );
      }
    }

    if (attachments && Array.isArray(attachments)) {
      if (attachments.length > 6) {
        return NextResponse.json(
          { error: 'Maximum 6 pictures allowed at once.' },
          { status: 400 }
        );
      }
      for (const att of attachments) {
        const attCheck = inspectAttachmentSecurity(att);
        if (!attCheck.valid) {
          return NextResponse.json(
            { error: attCheck.error || 'Invalid or prohibited attachment in batch.' },
            { status: 400 }
          );
        }
      }
    }

    // 4. Send message with conversation membership and lifecycle authorization
    const result = serverChatStore.sendMessage({
      conversationId,
      senderEmail,
      senderName: senderName || 'User',
      senderAvatar: senderAvatar || '',
      content: content || '',
      attachment,
      attachments,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    console.error('API /chat/send error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const status = message.includes('ended') || message.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
