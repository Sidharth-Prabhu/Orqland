import { NextRequest } from 'next/server';
import { proxyToNest } from '@/lib/api/bffProxy';

export async function POST(req: NextRequest) {
  return proxyToNest(req, '/presence/heartbeat', { method: 'POST' });
}
