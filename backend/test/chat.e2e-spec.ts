import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from '../src/app.module';

describe('Chat Platform (E2E Integration)', () => {
  let app: INestApplication;
  let activeConversationId: string;
  let alphaSpaceId: string;
  let betaSpaceId: string;

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

    // Discover or initiate active test conversation via real GraphQL
    const dirRes = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', 'Bearer mock-token-client1@orqland.test')
      .send({
        query: `query { chatDirectory { id orqspaceCode name ownerId email } }`,
      });
    const spaces = dirRes.body?.data?.chatDirectory || [];
    alphaSpaceId = spaces.find((s: any) => s.orqspaceCode === 'WS#ALPHA#01')?.id || spaces[0]?.id;
    betaSpaceId = spaces.find((s: any) => s.orqspaceCode === 'WS#BETA#02')?.id || spaces[1]?.id;

    const initRes = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', 'Bearer mock-token-client1@orqland.test')
      .send({
        query: `
          mutation InitConv($input: InitiateConversationInputGql!) {
            initiateConversation(input: $input) {
              id
              orqspaceId
              businessId
              businessEmail
            }
          }
        `,
        variables: {
          input: {
            businessId: alphaSpaceId || 'WS#ALPHA#01',
            category: 'Workspace',
          },
        },
      });
    activeConversationId = initRes.body?.data?.initiateConversation?.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication & Security Boundary', () => {
    it('should reject unauthenticated REST requests with 401 fail-closed', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/conversations');
      expect(res.status).toBe(401);
    });

    it('should reject x-user-email header spoofing without a verified Bearer token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/conversations')
        .set('x-user-email', 'client1@orqland.test');
      expect(res.status).toBe(401);
    });

    it('should protect POST /api/v1/auth/sync with FirebaseAuthGuard', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/sync')
        .send({ email: 'attacker@orqland.test', name: 'Attacker' });
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

  describe('Real GraphQL API & Cursor Pagination', () => {
    it('should return workspace directory and enforce orqspaceId filter in myChatConversations', async () => {
      const dirRes = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', 'Bearer mock-token-client1@orqland.test')
        .send({
          query: `query { chatDirectory { id orqspaceCode name ownerId email } }`,
        });

      expect(dirRes.status).toBe(200);
      expect(dirRes.body.errors).toBeUndefined();
      expect(Array.isArray(dirRes.body.data.chatDirectory)).toBe(true);
      expect(dirRes.body.data.chatDirectory.length).toBeGreaterThanOrEqual(1);

      const alphaRes = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', 'Bearer mock-token-client1@orqland.test')
        .send({
          query: `query MyConvs($orqspaceId: ID) { myChatConversations(orqspaceId: $orqspaceId) { id orqspaceId businessId businessEmail } }`,
          variables: { orqspaceId: alphaSpaceId },
        });

      expect(alphaRes.status).toBe(200);
      expect(alphaRes.body.errors).toBeUndefined();
      const convs = alphaRes.body.data.myChatConversations;
      expect(convs.length).toBeGreaterThanOrEqual(1);
      for (const c of convs) {
        expect(c.orqspaceId).toBe(alphaSpaceId);
        // businessId targets ownerId, distinct from workspace orqspaceId
        expect(c.businessId).not.toBe(alphaSpaceId);
      }

      if (betaSpaceId && betaSpaceId !== alphaSpaceId) {
        const betaRes = await request(app.getHttpServer())
          .post('/graphql')
          .set('Authorization', 'Bearer mock-token-client1@orqland.test')
          .send({
            query: `query MyConvs($orqspaceId: ID) { myChatConversations(orqspaceId: $orqspaceId) { id orqspaceId } }`,
            variables: { orqspaceId: betaSpaceId },
          });
        expect(betaRes.status).toBe(200);
        for (const c of betaRes.body.data.myChatConversations) {
          expect(c.orqspaceId).toBe(betaSpaceId);
        }
      }
    });

    it('should support GraphQL sendMessage and cursor pagination in chatMessages', async () => {
      const labels = ['alpha', 'beta', 'gamma'];
      for (const label of labels) {
        const sendRes = await request(app.getHttpServer())
          .post('/graphql')
          .set('Authorization', 'Bearer mock-token-client1@orqland.test')
          .send({
            query: `
              mutation SendMsg($input: SendMessageInputGql!) {
                sendMessage(input: $input) { id content }
              }
            `,
            variables: {
              input: {
                conversationId: activeConversationId,
                content: `GraphQL cursor pagination check ${label}`,
              },
            },
          });
        expect(sendRes.status).toBe(200);
        expect(sendRes.body.errors).toBeUndefined();
      }

      const page1 = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', 'Bearer mock-token-client1@orqland.test')
        .send({
          query: `
            query Msgs($conversationId: ID!, $limit: Int, $cursor: String) {
              chatMessages(conversationId: $conversationId, limit: $limit, cursor: $cursor) {
                hasMore
                nextCursor
                messages { id content }
              }
            }
          `,
          variables: { conversationId: activeConversationId, limit: 2 },
        });

      expect(page1.status).toBe(200);
      expect(page1.body.errors).toBeUndefined();
      const data1 = page1.body.data.chatMessages;
      expect(data1.messages).toHaveLength(2);
      expect(data1.hasMore).toBe(true);
      expect(data1.nextCursor).toBeDefined();

      const page2 = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', 'Bearer mock-token-client1@orqland.test')
        .send({
          query: `
            query Msgs($conversationId: ID!, $limit: Int, $cursor: String) {
              chatMessages(conversationId: $conversationId, limit: $limit, cursor: $cursor) {
                hasMore
                nextCursor
                messages { id content }
              }
            }
          `,
          variables: {
            conversationId: activeConversationId,
            limit: 2,
            cursor: data1.nextCursor,
          },
        });

      expect(page2.status).toBe(200);
      expect(page2.body.errors).toBeUndefined();
      const page1Ids = new Set(data1.messages.map((m: any) => m.id));
      for (const m of page2.body.data.chatMessages.messages) {
        expect(page1Ids.has(m.id)).toBe(false);
      }
    });
  });

  describe('DLP & Content Moderation Engine', () => {
    it('should block messages containing sensitive credit card patterns', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/messages')
        .set('Authorization', 'Bearer mock-token-client1@orqland.test')
        .send({
          conversationId: activeConversationId,
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
          conversationId: activeConversationId,
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
          conversationId: activeConversationId,
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
          conversationId: activeConversationId,
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
          conversationId: activeConversationId,
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
          conversationId: activeConversationId,
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
          conversationId: activeConversationId,
          content: 'Idempotency guaranteed test',
          idempotencyKey,
        });

      const res2 = await request(app.getHttpServer())
        .post('/api/v1/messages')
        .set('Authorization', 'Bearer mock-token-client1@orqland.test')
        .send({
          conversationId: activeConversationId,
          content: 'Idempotency guaranteed test',
          idempotencyKey,
        });

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      expect(res1.body.data.id).toBe(res2.body.data.id);
    });
  });
});
