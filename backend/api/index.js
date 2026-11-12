'use strict';

// O rastreador de dependencias da Vercel nao enxerga os require() dinamicos do
// Nest; declarar os pacotes aqui garante que eles entrem no bundle da funcao.
require('@nestjs/core');
require('@nestjs/platform-express');
require('@nestjs/websockets');
require('@nestjs/platform-socket.io');

// TEMPORARIO: enquanto o deploy nao estabiliza, qualquer falha de carga ou de
// bootstrap volta como texto na resposta. Sem isso o unico sinal e um
// FUNCTION_INVOCATION_FAILED opaco. Remover assim que a API subir.
function report(response, stage, error) {
  const detail = error && error.stack ? error.stack : String(error);

  response.statusCode = 500;
  response.setHeader('content-type', 'text/plain; charset=utf-8');
  response.end(`BOOTSTRAP_ERROR em ${stage}\n\n${detail}`);
}

module.exports = async function handler(request, response) {
  let createHandler;

  try {
    ({ createHandler } = require('../dist/serverless'));
  } catch (error) {
    return report(response, 'require(../dist/serverless)', error);
  }

  let app;

  try {
    app = await createHandler();
  } catch (error) {
    return report(response, 'bootstrap do Nest', error);
  }

  return app(request, response);
};
