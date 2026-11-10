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

    // In dev mode, also check searchParams for email if no auth/email header is present
    if (!headers['x-user-email'] && !headers['authorization']) {
      const emailQuery = request.nextUrl.searchParams.get('email') || request.nextUrl.searchParams.get('senderEmail');
      if (emailQuery) {
        headers['x-user-email'] = emailQuery;
      }
    }

    const method = options?.method || request.method;
    let bodyText: string | undefined = undefined;

    if (options?.body !== undefined) {
      bodyText = JSON.stringify(options.body);
    } else if (method !== 'GET' && method !== 'HEAD') {
      bodyText = await request.text().catch(() => undefined);
    }

    // If in dev and no auth header, try to extract email from body to provide dev identity fallback
    if (!headers['authorization'] && !headers['x-user-email'] && bodyText) {
      try {
        const parsed = JSON.parse(bodyText);
        const devEmail =
          parsed.userEmail ||
          parsed.clientEmail ||
          parsed.senderEmail ||
          parsed.email;
        if (devEmail) {
          headers['x-user-email'] = devEmail;
        }
      } catch {
        // ignore invalid JSON
      }
    }

    const res = await fetch(url.toString(), {
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
