import { NextRequest, NextResponse } from 'next/server';
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
      viewerEmail,
    } = body;

    if (!clientEmail || typeof clientEmail !== 'string' || !clientEmail.includes('@')) {
      return NextResponse.json(
        { error: 'A valid client email address is required.' },
        { status: 400 }
      );
    }

    if (!businessEmail || typeof businessEmail !== 'string' || !businessEmail.includes('@')) {
      return NextResponse.json(
        { error: 'A valid business email address is required.' },
        { status: 400 }
      );
    }

    if (clientEmail.trim().toLowerCase() === businessEmail.trim().toLowerCase()) {
      return NextResponse.json(
        { error: 'You cannot initiate a conversation with yourself.' },
        { status: 400 }
      );
    }

    const conversation = serverChatStore.initiateChat({
      clientEmail: clientEmail.trim().toLowerCase(),
      clientName: clientName || clientEmail.split('@')[0],
      clientAvatar,
      businessEmail: businessEmail.trim().toLowerCase(),
      businessName: businessName || 'Business Workspace',
      businessAvatar: businessAvatar || '',
      workspaceName: workspaceName || 'General Consultation',
      initialMessage,
      viewerEmail: viewerEmail || clientEmail.trim().toLowerCase(),
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
