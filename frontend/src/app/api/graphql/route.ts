import { NextRequest, NextResponse } from 'next/server';
import { fetchUpstreamWithRetry } from '@/lib/api/bffProxy';

const NEST_BASE_URL =
  process.env.NEST_BASE_URL ||
  (process.env.NEST_API_URL ? process.env.NEST_API_URL.replace(/\/api(\/v1)?\/?$/, '') : 'http://localhost:3002');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.query) {
      return NextResponse.json({ errors: [{ message: 'Missing GraphQL query in request body' }] }, { status: 400 });
    }

    const authHeader = req.headers.get('authorization') || req.headers.get('x-user-token');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (authHeader) {
      headers['authorization'] = authHeader;
    }

    const upstream = await fetchUpstreamWithRetry(`${NEST_BASE_URL}/graphql`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const data = await upstream.json().catch(() => ({ errors: [{ message: 'Invalid response from upstream GraphQL server' }] }));
    return NextResponse.json(data, { status: upstream.status });
  } catch (error: any) {
    const detail = error?.cause?.code ? `${error.message} (${error.cause.code})` : error?.message;
    return NextResponse.json(
      { errors: [{ message: detail || 'Internal GraphQL BFF proxy failure' }] },
      { status: 502 }
    );
  }
}
