import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from '../src/app.module';

describe('Chat Platform (E2E Integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['graphql'] });
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication & Security Boundary', () => {
    it('should reject unauthenticated REST requests with 401 fail-closed', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/conversations');
      expect(res.status).toBe(401);
    });

    it('should accept valid mock/dev tokens in non-production environment', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/conversations')
        .set('Authorization', 'Bearer mock-token-client1@orqland.test');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('DLP & Content Moderation Engine', () => {
    it('should block messages containing sensitive credit card patterns', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/messages')
        .set('Authorization', 'Bearer mock-token-client1@orqland.test')
        .send({
          conversationId: 'c0000000-0000-0000-0000-000000000001',
          content: 'Here is my card 4532-1234-5678-9010 please charge it',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Data Loss Prevention \(DLP\)/i);
    });

    it('should block messages containing SSN patterns', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/messages')
        .set('Authorization', 'Bearer mock-token-client1@orqland.test')
        .send({
          conversationId: 'c0000000-0000-0000-0000-000000000001',
          content: 'My SSN is 000-12-3456',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Data Loss Prevention \(DLP\)/i);
    });
  });

  describe('Attachment Gateway & Storage Security', () => {
    it('should reject attachment requests exceeding 5MB max size', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/attachments/request-upload')
        .set('Authorization', 'Bearer mock-token-client1@orqland.test')
        .send({
          conversationId: 'c0000000-0000-0000-0000-000000000001',
          fileName: 'oversized_document.pdf',
          mimeType: 'application/pdf',
          size: 6 * 1024 * 1024, // 6MB > 5MB limit
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/exceeds the 5MB attachment limit/i);
    });

    it('should reject dangerous executable file extensions (.exe)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/attachments/request-upload')
        .set('Authorization', 'Bearer mock-token-client1@orqland.test')
        .send({
          conversationId: 'c0000000-0000-0000-0000-000000000001',
          fileName: 'malicious_payload.exe',
          mimeType: 'application/octet-stream',
          size: 1024,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Security Policy Violation/i);
    });

    it('should generate simulated storage signed URLs for legitimate file attachments', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/attachments/request-upload')
        .set('Authorization', 'Bearer mock-token-client1@orqland.test')
        .send({
          conversationId: 'c0000000-0000-0000-0000-000000000001',
          fileName: 'architecture_diagram.png',
          mimeType: 'image/png',
          size: 1024 * 200,
        });

      expect(res.status).toBe(201);
      expect(res.body.uploadUrl).toBeDefined();
      expect(res.body.objectKey).toBeDefined();
    });
  });

  describe('Message Operations & Window Policy', () => {
    it('should deliver clean messages and return delivered status', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/messages')
        .set('Authorization', 'Bearer mock-token-client1@orqland.test')
        .send({
          conversationId: 'c0000000-0000-0000-0000-000000000001',
          content: 'E2E verified delivery test message',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toBe('E2E verified delivery test message');
      expect(res.body.data.status).toBe('delivered');
    });

    it('should enforce idempotency by deduplicating repeated messages with same idempotencyKey', async () => {
      const idempotencyKey = `e2e-idempotent-${Date.now()}`;

      const res1 = await request(app.getHttpServer())
        .post('/api/v1/messages')
        .set('Authorization', 'Bearer mock-token-client1@orqland.test')
        .send({
          conversationId: 'c0000000-0000-0000-0000-000000000001',
          content: 'Idempotency guaranteed test',
          idempotencyKey,
        });

      const res2 = await request(app.getHttpServer())
        .post('/api/v1/messages')
        .set('Authorization', 'Bearer mock-token-client1@orqland.test')
        .send({
          conversationId: 'c0000000-0000-0000-0000-000000000001',
          content: 'Idempotency guaranteed test',
          idempotencyKey,
        });

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      expect(res1.body.data.id).toBe(res2.body.data.id);
    });
  });
});
