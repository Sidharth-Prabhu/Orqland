import { NextRequest, NextResponse, connection } from 'next/server';

const NEST_API_BASE =
  process.env.NEST_API_URL ||
  process.env.INTERNAL_API_URL ||
  'http://localhost:3002/api/v1';

/**
 * Fetch an upstream NestJS endpoint, retrying briefly on transient socket/startup failures.
 */
export async function fetchUpstreamWithRetry(
  url: string,
  init: RequestInit,
  maxAttempts = 3
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fetch(url, init);
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 250));
      }
    }
  }
  throw lastError;
}

export async function proxyToNest(
  request: NextRequest,
  nestPath: string,
  options?: {
    method?: string;
    body?: any;
    params?: Record<string, string>;
  }
) {
  await connection();
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

    // Forward verified Bearer auth header only (never fabricate x-user-email)
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers['authorization'] = authHeader;
    }

    const method = options?.method || request.method;
    let bodyText: string | undefined = undefined;

    if (options?.body !== undefined) {
      bodyText = JSON.stringify(options.body);
    } else if (method !== 'GET' && method !== 'HEAD') {
      bodyText = await request.text().catch(() => undefined);
    }

    const res = await fetchUpstreamWithRetry(url.toString(), {
      method,
      headers,
      body: bodyText && bodyText.length > 0 ? bodyText : undefined,
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
