import { NextRequest, NextResponse } from 'next/server';
import { serverChatStore } from '@/lib/serverChatStore';
import { checkGeneralRateLimit } from '@/lib/rateLimiter';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ conversations: [] });
    }

    // Rate limiting to protect against excessive polling / scraping
    const rateCheck = checkGeneralRateLimit(email);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: rateCheck.reason || 'Too many requests' },
        { status: 429 }
      );
    }

    const conversations = serverChatStore.getConversations(email);
    return NextResponse.json({ conversations });
  } catch (error: unknown) {
    console.error('API /chat/list error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

