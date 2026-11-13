import { WaMessageType } from '../whatsapp-fields';

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
  caption?: string;
  filename?: string;
  /** waMessageId of the quoted message. */
  replyTo?: string | null;
  template?: { name: string; language: string; variables: string[] };
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
