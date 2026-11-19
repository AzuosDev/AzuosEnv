import { WaMenuKind, WaMessageType } from '../whatsapp-fields';

/** One button or one list row of an interactive message. */
export interface WaInteractiveOption {
  id: string;
  title: string;
  description?: string;
}

/** Buttons or interactive list the bot sends. */
export interface WaInteractive {
  kind: WaMenuKind;
  header?: string;
  body: string;
  footer?: string;
  /** Label that opens the list; required by the Cloud API on a list. */
  buttonLabel?: string;
  options: WaInteractiveOption[];
}

/** Credentials of the connection, already decrypted. */
export interface WaCredentials {
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
}

/** Message handed to the Cloud API. */
export interface WaOutbound {
  /** wa_id of the contact. */
  to: string;
  type: WaMessageType;
  text?: string;
  mediaId?: string;
  /** Public link of the file, when it was never uploaded to Meta. */
  mediaLink?: string;
  mediaMime?: string;
  caption?: string;
  filename?: string;
  /** waMessageId of the quoted message. */
  replyTo?: string | null;
  template?: { name: string; language: string; variables: string[] };
  interactive?: WaInteractive;
}

export interface WaMediaInfo {
  url: string;
  mime: string;
  size: number;
}

export interface WaMediaFile {
  buffer: Buffer;
  mime: string;
}

export interface WaUploadInput {
  filename: string;
  mime: string;
  buffer: Buffer;
}

export interface WaTemplate {
  name: string;
  language: string;
  status: string;
  category: string;
  /** How many {{n}} the body expects. */
  variables: number;
}

export interface WaPhoneInfo {
  displayPhone: string;
  verifiedName: string;
  qualityRating: string;
}

/**
 * Port of the WhatsApp Cloud API. MetaGraphProvider is the implementation in use;
 * the e2e suite overrides this token so nothing leaves the process.
 */
export abstract class WhatsappGraphProvider {
  /** Sends the message and answers the waMessageId Meta assigned to it. */
  abstract send(credentials: WaCredentials, message: WaOutbound): Promise<string>;

  /** Uploads the file to Meta and answers the media id used when sending. */
  abstract upload(credentials: WaCredentials, file: WaUploadInput): Promise<string>;

  abstract mediaInfo(credentials: WaCredentials, mediaId: string): Promise<WaMediaInfo | null>;

  abstract download(credentials: WaCredentials, url: string): Promise<WaMediaFile | null>;

  abstract markRead(credentials: WaCredentials, waMessageId: string): Promise<void>;

  abstract templates(credentials: WaCredentials): Promise<WaTemplate[]>;

  abstract phoneInfo(credentials: WaCredentials): Promise<WaPhoneInfo | null>;
}
