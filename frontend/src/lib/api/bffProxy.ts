import { NextRequest, NextResponse } from 'next/server';

const NEST_API_BASE =
  process.env.NEST_API_URL ||
  process.env.INTERNAL_API_URL ||
  'http://localhost:3001/api/v1';

export async function proxyToNest(
  request: NextRequest,
  nestPath: string,
  options?: {
    method?: string;
    body?: any;
    params?: Record<string, string>;
  }
) {
  try {
    const url = new URL(`${NEST_API_BASE}${nestPath}`);
    if (options?.params) {
      Object.entries(options.params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          url.searchParams.set(k, String(v));
        }
      });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    // Forward auth headers
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers['authorization'] = authHeader;
    }
    const emailHeader = request.headers.get('x-user-email');
    if (emailHeader) {
      headers['x-user-email'] = emailHeader;
    }

    const method = options?.method || request.method;
    const body =
      options?.body !== undefined
        ? JSON.stringify(options.body)
        : method !== 'GET' && method !== 'HEAD'
        ? await request.text().catch(() => undefined)
        : undefined;

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body && body.length > 0 ? body : undefined,
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error(`BFF Proxy failed for ${nestPath}:`, err?.message);
    return NextResponse.json(
      {
        success: false,
        error: 'Proxy to chat API gateway failed',
        message: err?.message,
      },
      { status: 502 }
    );
  }
}
