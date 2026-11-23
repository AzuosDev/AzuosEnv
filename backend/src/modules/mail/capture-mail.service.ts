import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailMessage, MailService } from './mail.service';

export const DEFAULT_MAIL_CAPTURE_FILE = './storage/e2e-mailbox.jsonl';

/**
 * Mail service of the front e2e: logs the message and appends it as one JSON
 * line to MAIL_CAPTURE_FILE, so the suite can read the link an e-mail carries
 * (password reset, invite) without a real inbox and without a test-only route
 * in the API. Only selected when MAIL_CAPTURE=true, never in production.
 */
@Injectable()
export class CaptureMailService extends MailService {
  private readonly logger = new Logger(CaptureMailService.name);
  private readonly file: string;

  constructor(config: ConfigService) {
    super();
    this.file = resolve(config.get<string>('MAIL_CAPTURE_FILE') ?? DEFAULT_MAIL_CAPTURE_FILE);

    // Starts empty: a message from an earlier run would be read as this one's.
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(this.file, '');
    } catch (error) {
      this.logger.warn(`Não foi possível preparar ${this.file}: ${String(error)}`);
    }
  }

  send(message: MailMessage): Promise<void> {
    this.logger.log(`[mail] to=${message.to} subject=${message.subject}`);

    try {
      appendFileSync(
        this.file,
        `${JSON.stringify({ ...message, at: new Date().toISOString() })}\n`,
      );
    } catch (error) {
      this.logger.warn(`Não foi possível gravar ${this.file}: ${String(error)}`);
    }

    return Promise.resolve();
  }
}
