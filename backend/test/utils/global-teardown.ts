export default async function globalTeardown(): Promise<void> {
  await globalThis.__MONGOD__?.stop();
  globalThis.__MONGOD__ = undefined;
}
