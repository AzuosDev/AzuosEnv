'use strict';

// Funcao da Vercel. O app inteiro vem de um bundle CJS unico: o @nestjs 12 e ESM
// puro e o runtime da Vercel nao implementa require(ESM), entao nada do Nest pode
// ser carregado por require externo. Ver scripts/bundle-serverless.mjs.
const BUILD = 'bundle-1';

function report(response, stage, error) {
  const detail = error && error.stack ? error.stack : String(error);

  response.statusCode = 500;
  response.setHeader('content-type', 'text/plain; charset=utf-8');
  response.end(`BOOTSTRAP_ERROR [${BUILD}] em ${stage}\n\n${detail}`);
}

module.exports = async function handler(request, response) {
  // ?probe=1 responde sem tocar no Nest: separa "a funcao executa" de "o Nest falha".
  if (request.url && request.url.includes('probe=1')) {
    response.statusCode = 200;
    response.setHeader('content-type', 'text/plain; charset=utf-8');
    response.end(`FUNCAO VIVA [${BUILD}] node=${process.version}`);

    return;
  }

  let createHandler;

  try {
    ({ createHandler } = require('../dist-vercel/serverless.cjs'));
  } catch (error) {
    return report(response, 'carga do bundle', error);
  }

  let app;

  try {
    app = await createHandler();
  } catch (error) {
    return report(response, 'bootstrap do Nest', error);
  }

  return app(request, response);
};
