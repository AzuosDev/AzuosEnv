import request from 'supertest';
import { MailMessage, MailService } from '../src/modules/mail/mail.service';
import { createTestApp, TestApp } from './utils/e2e-app';
import {
  DEFAULT_PASSWORD,
  Credentials,
  createSession,
  login,
  nextIp,
  registerUser,
  uniqueEmail,
} from './utils/auth-client';

const NEW_PASSWORD = 'Azuos2027';

/** Guarda o que seria enviado, para o teste ler o link do e-mail. */
class CollectingMailService extends MailService {
  readonly sent: MailMessage[] = [];

  send(message: MailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }
}

const mail = new CollectingMailService();

function tokenOf(message: MailMessage): string {
  const match = /redefinir-senha\/([A-Za-z0-9_-]+)/.exec(message.text);

  if (!match) {
    throw new Error('Link de redefinição ausente no e-mail.');
  }

  return match[1];
}

describe('Recuperação de senha', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp({ overrides: [{ token: MailService, value: mail }] });
  });

  afterEach(async () => {
    await ctx.clearDatabase();
    mail.sent.length = 0;
  });

  afterAll(async () => {
    await ctx.close();
  });

  function forgot(email: string, ip: string): request.Test {
    return request(ctx.httpServer as never)
      .post('/api/v1/auth/forgot-password')
      .set('X-Forwarded-For', ip)
      .send({ email });
  }

  function reset(token: string, password: string, ip: string): request.Test {
    return request(ctx.httpServer as never)
      .post('/api/v1/auth/reset-password')
      .set('X-Forwarded-For', ip)
      .send({ token, password });
  }

  function validity(token: string, ip: string): request.Test {
    return request(ctx.httpServer as never)
      .get(`/api/v1/auth/reset-password/${token}/valid`)
      .set('X-Forwarded-For', ip);
  }

  /** Cada pedido sai de um IP novo: o limite por IP tem teste próprio. */
  async function requestReset(credentials: Credentials): Promise<string> {
    const before = mail.sent.length;

    await forgot(credentials.email, nextIp()).expect(200);
    expect(mail.sent).toHaveLength(before + 1);

    return tokenOf(mail.sent[before]);
  }

  it('responde igual e não envia e-mail para conta que não existe', async () => {
    const ip = nextIp();
    const known = await registerUser(ctx, { ip });

    const unknown = await forgot(uniqueEmail(), nextIp()).expect(200);
    const existing = await forgot(known.email, nextIp()).expect(200);

    expect(unknown.body.message).toBe(existing.body.message);
    expect(mail.sent.map((message) => message.to)).toEqual([known.email]);
  });

  it('envia o link, valida o token e redefine a senha', async () => {
    const credentials = await registerUser(ctx);
    const token = await requestReset(credentials);

    expect(mail.sent[0].to).toBe(credentials.email);
    expect(mail.sent[0].text).toContain('http://localhost:5173/redefinir-senha/');
    await validity(token, credentials.ip).expect(200).expect({ valid: true });

    await reset(token, NEW_PASSWORD, credentials.ip).expect(200).expect({ success: true });

    await login(ctx, { ...credentials, password: NEW_PASSWORD }).expect(200);
    await login(ctx, credentials).expect(401);
  });

  it('recusa token já usado e token inexistente', async () => {
    const credentials = await registerUser(ctx);
    const token = await requestReset(credentials);

    await reset(token, NEW_PASSWORD, credentials.ip).expect(200);

    const reused = await reset(token, 'Azuos2028', credentials.ip).expect(400);

    expect(reused.body.code).toBe('INVALID_RESET_TOKEN');
    await validity(token, credentials.ip).expect(200).expect({ valid: false });
    await reset('nao-existe-esse-token', NEW_PASSWORD, credentials.ip).expect(400);
  });

  it('recusa token expirado', async () => {
    const credentials = await registerUser(ctx);
    const token = await requestReset(credentials);

    await ctx.connection
      .collection('password_resets')
      .updateOne({}, { $set: { expiresAt: new Date(Date.now() - 1_000) } });

    await validity(token, credentials.ip).expect(200).expect({ valid: false });
    await reset(token, NEW_PASSWORD, credentials.ip).expect(400);
  });

  it('invalida o token anterior quando um pedido novo chega', async () => {
    const credentials = await registerUser(ctx);
    const replaced = await requestReset(credentials);
    const current = await requestReset(credentials);

    await reset(replaced, NEW_PASSWORD, credentials.ip).expect(400);
    await reset(current, NEW_PASSWORD, credentials.ip).expect(200);
  });

  it('recusa senha fora da regra do cadastro', async () => {
    const credentials = await registerUser(ctx);
    const token = await requestReset(credentials);

    const response = await reset(token, 'curta1', credentials.ip).expect(400);

    expect(response.body.code).toBe('VALIDATION_ERROR');
    await validity(token, credentials.ip).expect(200).expect({ valid: true });
  });

  it('encerra todas as sessões do usuário ao redefinir', async () => {
    const session = await createSession(ctx);
    const token = await requestReset(session.credentials);

    await reset(token, NEW_PASSWORD, session.credentials.ip).expect(200);

    await request(ctx.httpServer as never)
      .post('/api/v1/auth/refresh')
      .set('X-Forwarded-For', session.credentials.ip)
      .set('Cookie', session.cookie)
      .expect(401);
  });

  it('dá senha a uma conta criada só com o Google', async () => {
    const email = uniqueEmail();
    const ip = nextIp();

    await ctx.connection.collection('users').insertOne({
      name: 'Conta Google',
      email,
      googleId: `google-${email}`,
      authProviders: ['google'],
      timezone: 'America/Fortaleza',
      locale: 'pt-BR',
      theme: 'dark',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const token = await requestReset({ email, password: DEFAULT_PASSWORD, ip });

    await reset(token, NEW_PASSWORD, ip).expect(200);

    const response = await login(ctx, { email, password: NEW_PASSWORD, ip }).expect(200);

    expect(response.body.user.authProviders).toEqual(['google', 'password']);
  });

  it('limita os pedidos por IP e por e-mail', async () => {
    const credentials = await registerUser(ctx);
    const ip = nextIp();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await forgot(credentials.email, ip).expect(200);
    }

    await forgot(credentials.email, ip).expect(429);
    expect(mail.sent).toHaveLength(3);

    // Outro IP passa pelo throttler, mas o limite por e-mail já estourou:
    // a resposta segue 200 e nenhum e-mail novo sai.
    const response = await forgot(credentials.email, nextIp()).expect(200);

    expect(response.body.message).toContain('Azuos Env');
    expect(mail.sent).toHaveLength(3);
  });
});
