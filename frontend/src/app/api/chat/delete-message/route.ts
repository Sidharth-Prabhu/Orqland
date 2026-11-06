import { NextRequest, NextResponse } from 'next/server';
import { proxyToNest } from '@/lib/api/bffProxy';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.messageId) {
    return NextResponse.json({ error: 'messageId required' }, { status: 400 });
  }
  return proxyToNest(req, `/messages/${body.messageId}`, {
    method: 'DELETE',
    body,
  });
}
