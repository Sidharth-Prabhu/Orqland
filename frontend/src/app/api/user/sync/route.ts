import { NextRequest } from 'next/server';
import { proxyToNest } from '@/lib/api/bffProxy';

export async function POST(req: NextRequest) {
  return proxyToNest(req, '/auth/sync', { method: 'POST' });
}
