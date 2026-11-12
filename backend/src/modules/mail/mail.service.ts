export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  /** Rendered HTML body. Falls back to the shared notice shell when absent. */
  html?: string;
}

/** Transport-agnostic mail port. SMTP implementation arrives in a later stage. */
export abstract class MailService {
  abstract send(message: MailMessage): Promise<void>;
}
