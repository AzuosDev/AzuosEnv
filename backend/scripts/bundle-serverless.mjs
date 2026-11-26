/**
 * Empacota dist/serverless.js num arquivo unico para a funcao da Vercel.
 *
 * Motivo: o @nestjs 12 e ESM puro e o runtime da Vercel (/opt/rust/nodejs.js)
 * nao implementa require(ESM). Inlinando tudo num bundle CJS nao sobra require
 * externo de pacote ESM para o carregador deles engasgar.
 */
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

/**
 * Pacotes CJS cujos metodos dependem do `this` do proprio modulo.
 *
 * Um pacote ESM que os consome com `import * as x` vira `__toESM(require(...))`
 * no bundle: uma copia do namespace com propriedades so-leitura. Chamar
 * `x.metodo()` passa essa copia como `this`, e qualquer escrita interna falha
 * (no mongoose, `this.nextConnectionId++`). Import default devolve o objeto
 * real do CommonJS.
 */
const CJS_SINGLETONS = ['mongoose'];

const bindCjsSingletons = {
  name: 'bind-cjs-singletons',
  setup(build) {
    // O filter do esbuild e regex do Go, nao do JS: classes com escape de barra
    // nao casam de forma confiavel aqui. Filtra largo e decide no JS.
    build.onLoad({ filter: /\.js$/ }, async (args) => {
      if (!args.path.includes('@nestjs')) {
        return null;
      }

      const source = await readFile(args.path, 'utf8');
      let contents = source;

      for (const pkg of CJS_SINGLETONS) {
        contents = contents.replace(
          new RegExp(String.raw`import \* as (\w+) from ['"]${pkg}['"];`, 'g'),
          `import $1 from '${pkg}';`,
        );
      }

      return contents === source ? null : { contents, loader: 'js' };
    });
  },
};

/**
 * O @nestjs/mapped-types (PartialType, OmitType, IntersectionType) carrega o
 * class-validator e o class-transformer por createRequire(import.meta.url). No
 * bundle isso resolve a partir de dist-vercel/, onde a funcao da Vercel nao tem
 * node_modules: o require falha, a heranca de metadados e pulada em silencio e
 * todo DTO derivado fica sem propriedade conhecida, entao o ValidationPipe
 * (forbidNonWhitelisted) responde 400 "property X should not exist".
 *
 * Aqui o require vira um mapa para as copias que ja estao no bundle - as mesmas
 * que os decorators usam, entao o metadata storage continua unico.
 */
const MAPPED_TYPES_SHIM = [
  "import * as __classValidator from 'class-validator';",
  "import * as __classTransformer from 'class-transformer';",
  "import * as __classTransformerStorage from 'class-transformer/cjs/storage.js';",
  'const __bundledModules = {',
  "  'class-validator': __classValidator,",
  "  'class-transformer': __classTransformer,",
  "  'class-transformer/storage': __classTransformerStorage,",
  "  'class-transformer/cjs/storage': __classTransformerStorage,",
  '};',
  'const require = (id) => {',
  '  const mod = __bundledModules[id];',
  '  if (!mod) {',
  '    throw new Error(`modulo fora do bundle: ${id}`);',
  '  }',
  '  return mod;',
  '};',
].join('\n');

const inlineMappedTypesRequire = {
  name: 'inline-mapped-types-require',
  setup(build) {
    build.onLoad({ filter: /\.js$/ }, async (args) => {
      if (!args.path.split('\\').join('/').includes('@nestjs/mapped-types')) {
        return null;
      }

      const source = await readFile(args.path, 'utf8');

      if (!source.includes('createRequire(import.meta.url)')) {
        return null;
      }

      const contents = source
        .replace("import { createRequire } from 'node:module';\n", '')
        .replace('const require = createRequire(import.meta.url);', MAPPED_TYPES_SHIM);

      return { contents, loader: 'js' };
    });
  },
};

// Dependencias nativas ou opcionais: ficam fora do bundle e sao carregadas (ou
// nao) em runtime. Todas sao CJS, entao require() nelas funciona normalmente.
const external = [
  'argon2',
  'mongoose',
  '@mongodb-js/zstd',
  'kerberos',
  'mongodb-client-encryption',
  'snappy',
  'socks',
  'aws4',
  '@aws-sdk/credential-providers',
  'bson-ext',
  '@nestjs/microservices',
  '@nestjs/platform-fastify',
  '@fastify/static',
  '@fastify/view',
  'fastify',
  'pino-pretty',
  'thread-stream',
  'pino-worker',
  'pino-file',
];

const result = await build({
  entryPoints: ['dist/serverless.js'],
  outfile: 'dist-vercel/serverless.cjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  external,
  plugins: [bindCjsSingletons, inlineMappedTypesRequire],
  // Pacotes ESM (o @nestjs/swagger, entre outros) usam createRequire(import.meta.url),
  // que num bundle CJS viraria undefined.
  define: { 'import.meta.url': '__bundleFileUrl' },
  banner: {
    js: "const __bundleFileUrl = require('node:url').pathToFileURL(__filename).href;",
  },
  // O Nest identifica provider por constructor.name; sem isto o bundle quebra a DI.
  keepNames: true,
  // Menos bytes para ler e parsear no cold start (o minify nao renomeia
  // propriedade nem membro de classe, so o que e local ao modulo).
  minify: true,
  logLevel: 'warning',
  metafile: true,
});

const bytes = Object.values(result.metafile.outputs)[0].bytes;
console.log(`bundle: ${(bytes / 1024 / 1024).toFixed(1)} MB`);
