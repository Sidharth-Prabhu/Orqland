import { NextRequest, NextResponse } from 'next/server';

const NEST_API_BASE =
  process.env.NEST_API_URL ||
  process.env.INTERNAL_API_URL ||
  'http://localhost:3002/api/v1';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await context.params;
    const encodedKey = encodeURIComponent(key);
    const targetUrl = `${NEST_API_BASE}/chat/attachments/simulate-upload/${encodedKey}`;

    const body = await request.arrayBuffer();
    const headers: Record<string, string> = {};
    const contentType = request.headers.get('content-type');
    if (contentType) {
      headers['content-type'] = contentType;
    }
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers['authorization'] = authHeader;
    }

    const upstream = await fetch(targetUrl, {
      method: 'PUT',
      headers,
      body,
      cache: 'no-store',
    });

    const data = await upstream.json().catch(() => ({ success: upstream.ok }));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'Simulated attachment upload proxy failed',
        message: err?.message,
      },
      { status: 502 }
    );
  }
}
