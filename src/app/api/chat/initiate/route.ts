import { NextRequest, NextResponse } from 'next/server';
import { isBusinessUser } from '@/lib/security';
import { serverChatStore } from '@/lib/serverChatStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      businessEmail,
      businessName,
      businessAvatar,
      clientEmail,
      clientName,
      clientAvatar,
      workspaceName,
      initialMessage,
    } = body;

    // Strict Backend Permission Enforcement:
    // Only the business user (mailtosidharth.me@gmail.com) can initiate a chat with a client.
    if (!isBusinessUser(businessEmail)) {
      return NextResponse.json(
        {
          error:
            'Permission Denied: Only the Business account can initiate conversations with clients. Clients cannot initiate conversations or send the first message.',
        },
        { status: 403 }
      );
    }

    if (!clientEmail || typeof clientEmail !== 'string' || !clientEmail.includes('@')) {
      return NextResponse.json(
        { error: 'A valid client email address is required.' },
        { status: 400 }
      );
    }

    const conversation = serverChatStore.initiateChat({
      businessEmail,
      businessName: businessName || 'Business Workspace',
      businessAvatar: businessAvatar || '',
      clientEmail,
      clientName: clientName || clientEmail.split('@')[0],
      clientAvatar,
      workspaceName,
      initialMessage,
    });

    return NextResponse.json({ success: true, conversation });
  } catch (error: unknown) {
    console.error('API /chat/initiate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
