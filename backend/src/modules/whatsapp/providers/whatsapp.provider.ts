import { WaInstanceState, WaMenuKind, WaMessageType, WaProvider } from '../whatsapp-fields';

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

/** File of an outbound message, straight from the upload of the attendant. */
export interface WaUploadInput {
  filename: string;
  mime: string;
  buffer: Buffer;
}

/** Credentials of the connection, already decrypted. */
export interface WaCredentials {
  provider: WaProvider;
  /** Cloud API: id of the number inside the WABA. */
  phoneNumberId: string;
  /** Cloud API: WhatsApp Business account. */
  wabaId: string;
  /** Cloud API: permanent token of the Graph API. */
  accessToken: string;
  /** Evolution: origin of the server, with no trailing slash. */
  baseUrl: string;
  /** Evolution: value of the `apikey` header. */
  apiKey: string;
  /** Evolution: name of the instance the number is paired on. */
  instanceName: string;
}

/** Message handed to the provider. */
export interface WaOutbound {
  /** wa_id of the contact: digits only, with the country code. */
  to: string;
  type: WaMessageType;
  text?: string;
  /** Media already uploaded to Meta. */
  mediaId?: string;
  /** Public link of the file, when it was never uploaded. */
  mediaLink?: string;
  /** File sent along with the message; the provider decides how to carry it. */
  file?: WaUploadInput;
  mediaMime?: string;
  caption?: string;
  filename?: string;
  /** waMessageId of the quoted message. */
  replyTo?: string | null;
  template?: { name: string; language: string; variables: string[] };
  interactive?: WaInteractive;
}

export interface WaMediaFile {
  buffer: Buffer;
  mime: string;
}

/** What identifies the file of an inbound message for each provider. */
export interface WaMediaRequest {
  waMessageId: string;
  /** Cloud API: id of the media inside the Graph API. */
  mediaId: string | null;
  /** Evolution: file already inside the delivery of the webhook. */
  base64: string | null;
  mime: string | null;
}

export interface WaTemplate {
  name: string;
  language: string;
  status: string;
  category: string;
  /** How many {{n}} the body expects. */
  variables: number;
}

/** Number behind the connection, as the provider describes it. */
export interface WaPhoneInfo {
  displayPhone: string;
  verifiedName: string;
  qualityRating: string;
}

/** Where the pairing of the connection stands. */
export interface WaInstanceStatus {
  state: WaInstanceState;
  /** QR Code in base64 while the instance is waiting to be read. */
  qrCode: string | null;
  displayPhone: string;
  verifiedName: string;
}

/**
 * Port of the WhatsApp of a workspace. EvolutionProvider is the default and
 * CloudApiProvider is the official Cloud API, kept working but no longer
 * offered; WhatsappProviders picks one by the provider of the connection, and
 * the e2e suite overrides them so nothing leaves the process.
 *
 * **Escopo de uma instância.** O servidor da Evolution é compartilhado com
 * outros sistemas: toda chamada aqui vale só para `credentials.instanceName`.
 * Nenhuma implementação pode listar instâncias para agir sobre elas, excluir
 * instância, nem tocar em configuração global do servidor.
 */
export abstract class WhatsappProvider {
  /** Sends the message and answers the id the provider assigned to it. */
  abstract send(credentials: WaCredentials, message: WaOutbound): Promise<string>;

  /** File of an inbound message, ready for the StorageService. */
  abstract inboundMedia(
    credentials: WaCredentials,
    request: WaMediaRequest,
  ): Promise<WaMediaFile | null>;

  abstract markRead(credentials: WaCredentials, waMessageId: string): Promise<void>;

  /** Approved templates; empty on a provider that has none. */
  abstract templates(credentials: WaCredentials): Promise<WaTemplate[]>;

  abstract phoneInfo(credentials: WaCredentials): Promise<WaPhoneInfo | null>;

  /** Creates what the provider needs before a number can be paired. */
  abstract createInstance(
    credentials: WaCredentials,
    webhookUrl: string,
  ): Promise<WaInstanceStatus>;

  /**
   * Se a instância do `instanceName` já existe no servidor. É só leitura, e é
   * o que impede o módulo de assumir uma instância de outro sistema.
   */
  abstract instanceExists(credentials: WaCredentials): Promise<boolean>;

  /** Keeps the webhook of the instance pointing at this API. */
  abstract setWebhook(credentials: WaCredentials, webhookUrl: string): Promise<void>;

  /** Starts (or resumes) the pairing and answers the QR Code, when there is one. */
  abstract connect(credentials: WaCredentials): Promise<WaInstanceStatus>;

  abstract state(credentials: WaCredentials): Promise<WaInstanceStatus>;

  /** Drops the pairing; the number has to be read again to come back. */
  abstract disconnect(credentials: WaCredentials): Promise<void>;

  abstract restart(credentials: WaCredentials): Promise<WaInstanceStatus>;

  /**
   * Which of the numbers really exist on WhatsApp. A provider that cannot tell
   * answers everything it was given.
   */
  abstract existingNumbers(credentials: WaCredentials, waIds: string[]): Promise<string[]>;
}
