export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Transport-agnostic mail port. SMTP implementation arrives in a later stage. */
export abstract class MailService {
  abstract send(message: MailMessage): Promise<void>;
}
