import { NextRequest } from 'next/server';
import { proxyToNest } from '@/lib/api/bffProxy';

export async function POST(req: NextRequest) {
  return proxyToNest(req, '/notifications/register-token', { method: 'POST' });
}

export async function DELETE(req: NextRequest) {
  return proxyToNest(req, '/notifications/unregister-token', { method: 'DELETE' });
}
