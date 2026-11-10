import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import request from 'supertest';
import { In, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AiService } from '../src/ai/ai.service';
import { ChatLog } from '../src/chat/chat-log.entity';
import { GuestSession } from '../src/guest-sessions/guest-session.entity';
import { GUEST_SESSION_COOKIE } from '../src/guest-sessions/guest-session.constants';
import { EmailService } from '../src/email/email.service';
import { IngestionService } from '../src/ingestion/ingestion.service';
import { GlobalExceptionHandler } from '../src/exceptions/global-exception-handler';

describe('Guest chat e2e', () => {
  let app: INestApplication;
  let httpServer: unknown;
  let guestSessions: Repository<GuestSession> | undefined;
  let chatLogs: Repository<ChatLog> | undefined;

  const createdGuestSessionIds: string[] = [];

  // The greeting path in ChatService is deterministic and does not call the LLM.
  // Fail the test if a future code change unexpectedly attempts an AI request.
  const aiService = {
    generateResponse: jest.fn().mockRejectedValue(
      new Error('Unexpected AI provider call in guest chat e2e test'),
    ),
  };
  const emailService = {
    sendConfirmationEmail: jest.fn().mockResolvedValue(undefined),
  };
  const ingestionService = {
    ingest: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    process.env.CSRF_ALLOW_NO_ORIGIN = 'true';

    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AiService)
      .useValue(aiService)
      .overrideProvider(EmailService)
      .useValue(emailService)
      .overrideProvider(IngestionService)
      .useValue(ingestionService)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionHandler());
    await app.init();

    httpServer = app.getHttpServer();
    guestSessions = module.get(getRepositoryToken(GuestSession));
    chatLogs = module.get(getRepositoryToken(ChatLog));
  });

  afterAll(async () => {
    if (chatLogs && createdGuestSessionIds.length > 0) {
      await chatLogs.delete({
        guestSessionId: In(createdGuestSessionIds),
      });
    }

    if (guestSessions && createdGuestSessionIds.length > 0) {
      await guestSessions.delete({ id: In(createdGuestSessionIds) });
    }

    if (app) {
      await app.close();
    }
  });

  it('creates isolated guest sessions, persists private chat history and revokes access', async () => {
    const guestA = request.agent(httpServer);
    const guestB = request.agent(httpServer);

    const sessionA = await createGuestSession(guestA);
    const sessionB = await createGuestSession(guestB);

    expect(sessionA.sessionId).not.toBe(sessionB.sessionId);

    const answerA = await guestA
      .post('/chat')
      .send({ message: 'Привет' })
      .expect(200);
    expect(answerA.text).toContain('Здравствуйте!');

    const answerB = await guestB
      .post('/chat')
      .send({ message: 'Здравствуйте' })
      .expect(200);
    expect(answerB.text).toContain('Здравствуйте!');

    const historyA = await guestA.get('/chat/history').expect(200);
    const historyB = await guestB.get('/chat/history').expect(200);

    expect(historyA.body).toHaveLength(1);
    expect(historyA.body[0]).toMatchObject({ question: 'Привет' });
    expect(historyB.body).toHaveLength(1);
    expect(historyB.body[0]).toMatchObject({ question: 'Здравствуйте' });

    const logsA = await chatLogs!.findBy({ guestSessionId: sessionA.sessionId });
    const logsB = await chatLogs!.findBy({ guestSessionId: sessionB.sessionId });

    expect(logsA).toHaveLength(1);
    expect(logsA[0]).toMatchObject({
      userId: null,
      guestSessionId: sessionA.sessionId,
      question: 'Привет',
    });
    expect(logsB).toHaveLength(1);
    expect(logsB[0]).toMatchObject({
      userId: null,
      guestSessionId: sessionB.sessionId,
      question: 'Здравствуйте',
    });

    // A guest must not be able to use registered-user order endpoints.
    await guestA.get('/orders').expect(401);

    // A valid guest cookie must not override an invalid access JWT.
    await request(httpServer)
      .get('/chat/history')
      .set('Cookie', `${sessionB.cookie}; access-token=invalid-token`)
      .expect(401);

    // Clearing one guest's stored history must not affect another guest.
    await guestA.delete('/chat/history').expect(204);
    await guestA.get('/chat/history').expect(200, []);
    const historyBAfterClear = await guestB.get('/chat/history').expect(200);
    expect(historyBAfterClear.body).toHaveLength(1);
    expect(historyBAfterClear.body[0]).toMatchObject({
      question: 'Здравствуйте',
    });

    // Keep the original cookie to verify server-side revocation, not just cookie clearing.
    await guestA.post('/guest-sessions/revoke').expect(204);
    await request(httpServer)
      .get('/chat/history')
      .set('Cookie', sessionA.cookie)
      .expect(401);

    // Revoking A must not invalidate B.
    await guestB.get('/chat/history').expect(200);
  });

  it('rejects chat requests without a registered-user or guest-session cookie', async () => {
    await request(httpServer)
      .post('/chat')
      .send({ message: 'Привет' })
      .expect(401);

    await request(httpServer).get('/chat/history').expect(401);
  });

  async function createGuestSession(
    agent: request.SuperAgentTest,
  ): Promise<{ sessionId: string; cookie: string }> {
    const response = await agent.post('/guest-sessions').expect(201);

    expect(response.body).toEqual({ expiresAt: expect.any(String) });

    const setCookieHeader = response.headers['set-cookie'];
    const setCookieHeaders: string[] = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : setCookieHeader
        ? [setCookieHeader]
        : [];
    const guestCookieHeader = setCookieHeaders.find((cookie) =>
      cookie.startsWith(`${GUEST_SESSION_COOKIE}=`),
    );

    if (!guestCookieHeader) {
      throw new Error('Guest session cookie was not set');
    }
    expect(guestCookieHeader).toContain('HttpOnly');

    const cookie = guestCookieHeader.split(';', 1)[0];
    if (!cookie) {
      throw new Error('Guest session cookie is empty');
    }
    const token = decodeURIComponent(
      cookie.slice(`${GUEST_SESSION_COOKIE}=`.length),
    );
    const tokenHash = createHash('sha256').update(token).digest('hex');

    if (!guestSessions) {
      throw new Error('GuestSessions repository is not initialized');
    }

    const session = await guestSessions.findOneByOrFail({ tokenHash });

    createdGuestSessionIds.push(session.id);

    expect(session.tokenHash).toHaveLength(64);
    expect(session.tokenHash).not.toBe(token);

    return { sessionId: session.id, cookie };
  }
});
