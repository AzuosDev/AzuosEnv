import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transporter, createTransport } from 'nodemailer';
import { describeMailError } from './mail-error';
import { MailMessage, MailService } from './mail.service';
import { renderNoticeHtml } from './templates/notice-email';

/**
 * Em serverless a funcao morre junto com a requisicao: sem limite proprio o
 * nodemailer esperaria 2 min por uma porta bloqueada e a funcao seria cortada
 * antes de registrar qualquer coisa.
 */
const CONNECTION_TIMEOUT_MS = 10_000;
const GREETING_TIMEOUT_MS = 10_000;
const SOCKET_TIMEOUT_MS = 20_000;

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
      // A senha de app do Google e exibida em grupos de 4; o espaco colado quebra o login.
      auth: user ? { user, pass: pass?.replace(/\s+/g, '') } : undefined,
      connectionTimeout: CONNECTION_TIMEOUT_MS,
      greetingTimeout: GREETING_TIMEOUT_MS,
      socketTimeout: SOCKET_TIMEOUT_MS,
    });
    this.from = config.get<string>('SMTP_FROM') ?? 'Azuos Env <no-reply@azuos.dev>';
  }

  async send(message: MailMessage): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html ?? renderNoticeHtml(message.subject, message.text),
      });
    } catch (error) {
      this.logger.error(`[mail] falhou para ${message.to}: ${describeMailError(error)}`);

      throw error;
    }

    this.logger.log(`[mail] enviado para ${message.to}: ${message.subject}`);
  }

  onApplicationShutdown(): void {
    this.transporter.close();
  }
}
