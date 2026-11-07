import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
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
        process.env.FRONTEND_URL || 'http://localhost:3000',
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-User-Email'],
    },
  });

  // Support up to 50mb payloads for base64 / inline images and documents
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  // REST API prefix
  app.setGlobalPrefix('api/v1');

  // Global filters, interceptors, and pipes
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    })
  );

  // Redis Socket.IO adapter
  const redisService = app.get(RedisService);
  const redisIoAdapter = new RedisIoAdapter(app, redisService);
  app.useWebSocketAdapter(redisIoAdapter);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`🚀 ORQLAND Chat Backend running on http://localhost:${port}/api/v1`);
  logger.log(`⚡ WebSocket Gateway active on ws://localhost:${port}`);
}

bootstrap();
