import { Injectable, Logger } from '@nestjs/common';
import { MailMessage, MailService } from './mail.service';

/** Development implementation: writes the message to the log instead of sending it. */
@Injectable()
export class LogMailService extends MailService {
  private readonly logger = new Logger(LogMailService.name);

  send(message: MailMessage): Promise<void> {
    this.logger.log(`[mail] to=${message.to} subject=${message.subject} :: ${message.text}`);

    return Promise.resolve();
  }
}
