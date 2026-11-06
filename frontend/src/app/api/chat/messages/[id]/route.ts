import { NextRequest } from 'next/server';
import { proxyToNest } from '@/lib/api/bffProxy';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyToNest(request, `/messages/${id}`, { method: 'PATCH' });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyToNest(request, `/messages/${id}`, { method: 'DELETE' });
}
