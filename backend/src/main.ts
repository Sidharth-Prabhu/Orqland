import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { RedisIoAdapter } from './infrastructure/redis/redis-io.adapter';
import { RedisService } from './infrastructure/redis/redis.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        process.env.FRONTEND_URL || 'http://localhost:3001',
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    },
  });

  // Standard JSON payload limit for metadata and messaging payloads (2MB)
  // Raw base64 attachments must not travel inside JSON messages
  app.use(bodyParser.json({ limit: '2mb' }));
  app.use(bodyParser.urlencoded({ limit: '2mb', extended: true }));
  app.use(bodyParser.raw({ type: ['image/*', 'application/pdf', 'application/octet-stream'], limit: '10mb' }));

  // Versioning & Prefix Convention (matching orqland-engine)
  app.setGlobalPrefix('api', {
    exclude: ['graphql'], // GraphQL stays at /graphql; REST controllers use @Controller({ path: '...', version: '1' }) -> /api/v1/...
  });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global filters, interceptors, and strict pipes
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );

  // Connect Redis before attaching Socket.IO Redis adapter
  const redisService = app.get(RedisService);
  await redisService.onModuleInit();
  const redisIoAdapter = new RedisIoAdapter(app, redisService);
  app.useWebSocketAdapter(redisIoAdapter);

  const port = process.env.PORT || 3002;
  await app.listen(port);
  logger.log(`🚀 ORQLAND Chat Backend running on http://localhost:${port}/api/v1`);
  logger.log(`⚡ WebSocket Gateway active on ws://localhost:${port}`);
}

bootstrap();
