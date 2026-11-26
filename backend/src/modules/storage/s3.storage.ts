import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { Readable } from 'node:stream';
import { SaveFileInput, StorageService, StoredFile } from './storage.service';

/**
 * Files on an S3 compatible bucket (Cloudflare R2, AWS S3, MinIO). It is the
 * production driver: a serverless host has no durable disk, so LocalDiskStorage
 * loses every upload on the next cold start.
 */
@Injectable()
export class S3Storage extends StorageService {
  private readonly bucket: string;
  private client?: S3Client;

  /** The client is a parameter so the test can drive it without network. */
  constructor(
    private readonly config: ConfigService,
    client?: S3Client,
  ) {
    super();
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    this.client = client;
  }

  /**
   * O SDK da AWS é carregado no primeiro arquivo, não no boot: são centenas de
   * KB de código que a maioria das requisições nunca toca.
   */
  private async aws(): Promise<typeof import('@aws-sdk/client-s3')> {
    return import('@aws-sdk/client-s3');
  }

  private async s3(): Promise<S3Client> {
    if (this.client) {
      return this.client;
    }

    const { S3Client } = await this.aws();
    const config = this.config;

    this.client = new S3Client({
      region: config.get<string>('S3_REGION') || 'auto',
      forcePathStyle: config.get<boolean>('S3_FORCE_PATH_STYLE') ?? true,
      ...(config.get<string>('S3_ENDPOINT')
        ? { endpoint: config.getOrThrow<string>('S3_ENDPOINT') }
        : {}),
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_ACCESS_KEY'),
      },
    });

    return this.client;
  }

  async save(input: SaveFileInput): Promise<StoredFile> {
    // Same layout as the local disk: swapping the driver keeps old keys readable.
    const key = `${input.workspaceId}/${randomUUID()}${extname(input.filename).toLowerCase()}`;

    const { PutObjectCommand } = await this.aws();

    await (
      await this.s3()
    ).send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: input.buffer,
        ContentType: input.mimeType,
        ContentLength: input.buffer.length,
      }),
    );

    return { key, size: input.buffer.length };
  }

  async read(key: string): Promise<Readable> {
    const { GetObjectCommand } = await this.aws();
    const object = await (
      await this.s3()
    ).send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));

    if (!(object.Body instanceof Readable)) {
      throw new InternalServerErrorException({
        code: 'STORAGE_READ_FAILED',
        message: 'Não foi possível ler o arquivo.',
      });
    }

    return object.Body;
  }

  async remove(key: string): Promise<void> {
    const { DeleteObjectCommand } = await this.aws();

    await (await this.s3()).send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
