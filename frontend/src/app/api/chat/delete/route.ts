import { NextRequest, NextResponse } from 'next/server';
import { proxyToNest } from '@/lib/api/bffProxy';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.conversationId) {
    return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
  }
  return proxyToNest(req, `/conversations/${body.conversationId}`, {
    method: 'DELETE',
    body,
  });
}
