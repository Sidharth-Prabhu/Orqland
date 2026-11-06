import { NextRequest } from 'next/server';
import { proxyToNest } from '@/lib/api/bffProxy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyToNest(request, `/conversations/${id}`);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyToNest(request, `/conversations/${id}`, { method: 'DELETE' });
}
