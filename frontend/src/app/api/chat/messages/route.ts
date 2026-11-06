import { NextRequest } from 'next/server';
import { proxyToNest } from '@/lib/api/bffProxy';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const conversationId = searchParams.get('conversationId') || '';
  const limit = searchParams.get('limit') || '50';
  const beforeTimestamp = searchParams.get('beforeTimestamp') || '';

  return proxyToNest(request, '/messages', {
    params: {
      conversationId,
      limit,
      ...(beforeTimestamp ? { beforeTimestamp } : {}),
    },
  });
}

export async function POST(request: NextRequest) {
  return proxyToNest(request, '/messages');
}
