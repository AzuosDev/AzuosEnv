'use strict';

// Nada e carregado no escopo do modulo: um require() que falhe aqui derruba a
// funcao antes de qualquer handler rodar, e a Vercel so devolve
// FUNCTION_INVOCATION_FAILED sem mensagem. Tudo acontece dentro do try.
const BUILD = 'probe-5';

function report(response, stage, error) {
  const detail = error && error.stack ? error.stack : String(error);

  response.statusCode = 500;
  response.setHeader('content-type', 'text/plain; charset=utf-8');
  response.end(`BOOTSTRAP_ERROR [${BUILD}] em ${stage}\n\n${detail}`);
}

module.exports = async function handler(request, response) {
  // ?probe=1 responde sem tocar no Nest: prova que a funcao em si executa.
  if (request.url && request.url.includes('probe=1')) {
    response.statusCode = 200;
    response.setHeader('content-type', 'text/plain; charset=utf-8');
    response.end(`FUNCAO VIVA [${BUILD}] node=${process.version} cwd=${process.cwd()}`);

    return;
  }

  // Os pacotes que o rastreador da Vercel nao enxerga sozinho, agora protegidos.
  for (const name of [
    '@nestjs/core',
    '@nestjs/platform-express',
    '@nestjs/websockets',
    '@nestjs/platform-socket.io',
  ]) {
    try {
      require(name);
    } catch (error) {
      return report(response, `require('${name}')`, error);
    }
  }

  let createHandler;

  try {
    ({ createHandler } = require('../dist/serverless'));
  } catch (error) {
    return report(response, "require('../dist/serverless')", error);
  }

  let app;

  try {
    app = await createHandler();
  } catch (error) {
    return report(response, 'bootstrap do Nest', error);
  }

  return app(request, response);
};
