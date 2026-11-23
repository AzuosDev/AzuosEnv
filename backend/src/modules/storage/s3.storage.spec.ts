import { InternalServerErrorException } from '@nestjs/common';
import { Readable } from 'node:stream';
import type { S3Client } from '@aws-sdk/client-s3';
import { S3Storage } from './s3.storage';

/** ConfigService falso com o mínimo que o driver lê. */
function configOf(values: Record<string, unknown>) {
  return {
    get: (key: string) => values[key],
    getOrThrow: (key: string) => {
      if (values[key] === undefined) {
        throw new Error();
      }

      return values[key];
    },
  } as never;
}

function clientOf(result: unknown): { client: S3Client; sent: Record<string, unknown>[] } {
  const sent: Record<string, unknown>[] = [];
  const client = {
    send: (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      sent.push({ name: command.constructor.name, ...command.input });

      return Promise.resolve(result);
    },
  } as unknown as S3Client;

  return { client, sent };
}

describe('S3Storage', () => {
  const config = configOf({ S3_BUCKET: 'anexos' });

  it('guarda o arquivo na pasta do workspace e devolve a chave e o tamanho', async () => {
    const { client, sent } = clientOf({});
    const storage = new S3Storage(config, client);

    const stored = await storage.save({
      workspaceId: 'ws1',
      filename: 'Planta Final.DWG',
      mimeType: 'application/acad',
      buffer: Buffer.from('abc'),
    });

    expect(stored.size).toBe(3);
    expect(stored.key).toMatch(/^ws1\/[0-9a-f-]{36}\.dwg$/);
    expect(sent[0]).toMatchObject({
      name: 'PutObjectCommand',
      Bucket: 'anexos',
      Key: stored.key,
      ContentType: 'application/acad',
      ContentLength: 3,
    });
  });

  it('lê os bytes como stream', async () => {
    const body = Readable.from(['oi']);
    const { client, sent } = clientOf({ Body: body });
    const storage = new S3Storage(config, client);

    await expect(storage.read('ws1/a.pdf')).resolves.toBe(body);
    expect(sent[0]).toMatchObject({ name: 'GetObjectCommand', Key: 'ws1/a.pdf' });
  });

  it('recusa corpo que não é stream', async () => {
    const { client } = clientOf({ Body: 'texto' });
    const storage = new S3Storage(config, client);

    await expect(storage.read('ws1/a.pdf')).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('remove pela chave', async () => {
    const { client, sent } = clientOf({});
    const storage = new S3Storage(config, client);

    await storage.remove('ws1/a.pdf');

    expect(sent[0]).toMatchObject({ name: 'DeleteObjectCommand', Key: 'ws1/a.pdf' });
  });
});
