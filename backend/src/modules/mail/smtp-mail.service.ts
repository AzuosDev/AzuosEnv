import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transporter, createTransport } from 'nodemailer';
import { MailMessage, MailService } from './mail.service';
import { renderNoticeHtml } from './templates/notice-email';

/** Sends through the SMTP server configured in SMTP_*. */
@Injectable()
export class SmtpMailService extends MailService implements OnApplicationShutdown {
  private readonly logger = new Logger(SmtpMailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    super();

    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASSWORD');

    this.transporter = createTransport({
      host: config.getOrThrow<string>('SMTP_HOST'),
      port: config.get<number>('SMTP_PORT') ?? 587,
      secure: config.get<boolean>('SMTP_SECURE') ?? false,
      auth: user ? { user, pass } : undefined,
    });
    this.from = config.get<string>('SMTP_FROM') ?? 'Azuos Env <no-reply@azuos.dev>';
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html ?? renderNoticeHtml(message.subject, message.text),
    });

    this.logger.log(`[mail] enviado para ${message.to}: ${message.subject}`);
  }

  onApplicationShutdown(): void {
    this.transporter.close();
  }
}
