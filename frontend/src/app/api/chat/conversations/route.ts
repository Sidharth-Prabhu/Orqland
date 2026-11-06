import { NextRequest } from 'next/server';
import { proxyToNest } from '@/lib/api/bffProxy';

export async function GET(request: NextRequest) {
  return proxyToNest(request, '/conversations');
}

export async function POST(request: NextRequest) {
  return proxyToNest(request, '/conversations');
}
