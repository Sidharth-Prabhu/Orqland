import { NextResponse, connection } from 'next/server';
import os from 'os';

export async function GET() {
  await connection();
  try {
    const memoryUsage = process.memoryUsage();
    const cpus = os.cpus();

    const healthStatus = {
      status: 'healthy',
      service: 'orqland-chat-backend',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        cpuCount: cpus.length,
        loadAverage: os.loadavg(),
        freeMemoryMB: Math.round(os.freemem() / (1024 * 1024)),
        totalMemoryMB: Math.round(os.totalmem() / (1024 * 1024)),
      },
      process: {
        rssMB: Math.round(memoryUsage.rss / (1024 * 1024)),
        heapUsedMB: Math.round(memoryUsage.heapUsed / (1024 * 1024)),
        heapTotalMB: Math.round(memoryUsage.heapTotal / (1024 * 1024)),
      },
      requestId: Math.random().toString(36).slice(2, 8),
    };

    return NextResponse.json(healthStatus, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'X-Health-Check': 'Pass',
      },
    });
  } catch (error: unknown) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown health error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
