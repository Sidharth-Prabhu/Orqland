import { NextRequest } from 'next/server';
import { proxyToNest } from '@/lib/api/bffProxy';

export async function GET(req: NextRequest) {
  return proxyToNest(req, '/conversations');
}
