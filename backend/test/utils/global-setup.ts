import { MongoMemoryServer } from 'mongodb-memory-server';
import { TEST_DB_NAME, TEST_ENV } from './test-env';

declare global {
  var __MONGOD__: MongoMemoryServer | undefined;
}

export default async function globalSetup(): Promise<void> {
  const mongod = await MongoMemoryServer.create();
  globalThis.__MONGOD__ = mongod;

  Object.assign(process.env, TEST_ENV);
  process.env.MONGODB_URI = mongod.getUri(TEST_DB_NAME);
}
