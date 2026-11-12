import { Logger } from '@nestjs/common';
import { BrevoMailService, parseSender } from './brevo-mail.service';

const configOf = (values: Record<string, string>) =>
  ({
    get: (key: string) => values[key],
    getOrThrow: (key: string) => {
      if (!values[key]) {
        throw new Error(`faltou ${key}`);
      }

      return values[key];
    },
  }) as never;

describe('parseSender', () => {
  it('splits name and address', () => {
    expect(parseSender('Azuos Env <no-reply@azuos.dev>')).toEqual({
      name: 'Azuos Env',
      email: 'no-reply@azuos.dev',
    });
  });

  it('accepts a bare address', () => {
    expect(parseSender('no-reply@azuos.dev')).toEqual({ email: 'no-reply@azuos.dev' });
  });

  it('drops the quotes around the name', () => {
    expect(parseSender('"Azuos Env" <no-reply@azuos.dev>')).toEqual({
      name: 'Azuos Env',
      email: 'no-reply@azuos.dev',
    });
  });
});

describe('BrevoMailService', () => {
  const config = configOf({
    BREVO_API_KEY: 'chave',
    MAIL_FROM: 'Azuos Env <azuos@example.com>',
  });
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('posts the message with the validated sender', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201 });

    await new BrevoMailService(config).send({
      to: 'colega@azuos.dev',
      subject: 'Convite',
      text: 'Entre no workspace',
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((init.headers as Record<string, string>)['api-key']).toBe('chave');

    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.sender).toEqual({ name: 'Azuos Env', email: 'azuos@example.com' });
    expect(body.to).toEqual([{ email: 'colega@azuos.dev' }]);
    // Sem html explícito o invólucro padrão entra no lugar.
    expect(String(body.htmlContent)).toContain('Entre no workspace');
  });

  it('raises the body of the failed response so the log names the cause', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('{"code":"unauthorized","message":"Key not found"}'),
    });

    await expect(
      new BrevoMailService(config).send({ to: 'a@b.c', subject: 'x', text: 'y' }),
    ).rejects.toThrow('Brevo respondeu 401: {"code":"unauthorized","message":"Key not found"}');
  });
});
