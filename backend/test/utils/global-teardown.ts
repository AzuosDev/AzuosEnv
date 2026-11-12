import { rm } from 'node:fs/promises';
import { TEST_UPLOAD_DIR } from './test-env';

export default async function globalTeardown(): Promise<void> {
  await globalThis.__MONGOD__?.stop();
  globalThis.__MONGOD__ = undefined;
  await rm(TEST_UPLOAD_DIR, { recursive: true, force: true });
}
