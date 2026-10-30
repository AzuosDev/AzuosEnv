import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { SaveFileInput, StorageService, StoredFile } from './storage.service';

/** Files on the local disk, under UPLOAD_DIR. */
@Injectable()
export class LocalDiskStorage extends StorageService {
  private readonly root: string;

  constructor(config: ConfigService) {
    super();
    this.root = resolve(config.getOrThrow<string>('UPLOAD_DIR'));
  }

  async save(input: SaveFileInput): Promise<StoredFile> {
    const key = `${input.workspaceId}/${randomUUID()}${extname(input.filename).toLowerCase()}`;
    const target = this.pathOf(key);

    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, input.buffer);

    return { key, size: input.buffer.length };
  }

  read(key: string): Promise<Readable> {
    return Promise.resolve(createReadStream(this.pathOf(key)));
  }

  async remove(key: string): Promise<void> {
    try {
      await unlink(this.pathOf(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /** Absolute path of the key, rejecting anything that escapes the root. */
  private pathOf(key: string): string {
    const target = resolve(join(this.root, key));
    const inside = relative(this.root, target);

    if (inside.startsWith('..') || inside.startsWith(sep) || inside.length === 0) {
      throw new InternalServerErrorException({
        code: 'INVALID_STORAGE_KEY',
        message: 'Chave de arquivo inválida.',
      });
    }

    return target;
  }
}
