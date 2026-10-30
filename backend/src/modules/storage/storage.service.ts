import { Readable } from 'node:stream';

export interface SaveFileInput {
  /** Files are grouped by workspace so a backend swap keeps the same layout. */
  workspaceId: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

export interface StoredFile {
  /** Opaque key of the backend; the only thing persisted on the attachment. */
  key: string;
  size: number;
}

/**
 * Storage port of the uploads. LocalDiskStorage is the implementation in use;
 * swapping it for S3/R2 only means another provider in StorageModule.
 */
export abstract class StorageService {
  abstract save(input: SaveFileInput): Promise<StoredFile>;

  abstract read(key: string): Promise<Readable>;

  abstract remove(key: string): Promise<void>;
}
