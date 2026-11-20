import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BrevoMailService } from './brevo-mail.service';
import { CaptureMailService } from './capture-mail.service';
import { LogMailService } from './log-mail.service';
import { createMailService } from './mail.module';
import { SmtpMailService } from './smtp-mail.service';

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

describe('createMailService', () => {
  it('prefers Brevo when there is a key', () => {
    const service = createMailService(
      configOf({ BREVO_API_KEY: 'chave', SMTP_HOST: 'smtp.gmail.com' }),
    );

    expect(service).toBeInstanceOf(BrevoMailService);
  });

  it('falls back to SMTP when only the host is set', () => {
    expect(createMailService(configOf({ SMTP_HOST: 'smtp.gmail.com' }))).toBeInstanceOf(
      SmtpMailService,
    );
  });

  it('keeps everything in the log without any transport', () => {
    expect(createMailService(configOf({}))).toBeInstanceOf(LogMailService);
  });

  it('captures to a file when the front e2e asks for it', () => {
    const service = createMailService(
      configOf({
        NODE_ENV: 'test',
        MAIL_CAPTURE: 'true',
        MAIL_CAPTURE_FILE: join(tmpdir(), 'azuos-env-mailbox.jsonl'),
      }),
    );

    expect(service).toBeInstanceOf(CaptureMailService);
  });

  it('never leaves the log under NODE_ENV=test, even fully configured', () => {
    const service = createMailService(
      configOf({ NODE_ENV: 'test', BREVO_API_KEY: 'chave', SMTP_HOST: 'smtp.gmail.com' }),
    );

    expect(service).toBeInstanceOf(LogMailService);
  });
});
