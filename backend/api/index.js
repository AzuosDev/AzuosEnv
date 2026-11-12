'use strict';

// O rastreador de dependencias da Vercel nao enxerga os require() dinamicos do
// Nest; declarar os pacotes aqui garante que eles entrem no bundle da funcao.
require('@nestjs/core');
require('@nestjs/platform-express');
require('@nestjs/websockets');
require('@nestjs/platform-socket.io');

const { createHandler } = require('../dist/serverless');

module.exports = async function handler(request, response) {
  const app = await createHandler();

  return app(request, response);
};
