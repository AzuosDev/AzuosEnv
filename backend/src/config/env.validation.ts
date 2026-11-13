import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  MONGODB_URI: Joi.string()
    .pattern(/^mongodb(\+srv)?:\/\//)
    .required(),
  CORS_ORIGINS: Joi.string().default('http://localhost:5173'),
  // Janela e teto do rate limit global, por IP. A API de e2e do front sobe o teto:
  // a suíte inteira sai de um único IP.
  THROTTLE_TTL: Joi.number().integer().min(1000).default(60_000),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(120),
  // Level of the structured log (nestjs-pino); silent in the test environment.
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
  // Origins allowed on the public form routes (site of Azuos Dev).
  PUBLIC_FORM_ORIGINS: Joi.string().allow('').default(''),
  APP_URL: Joi.string().uri().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL: Joi.string().default('30d'),
  COOKIE_SECURE: Joi.boolean().default(false),
  // `none` é necessário quando o front está em outro domínio; exige COOKIE_SECURE.
  COOKIE_SAME_SITE: Joi.string()
    .valid('lax', 'strict', 'none')
    .default('lax')
    .when('COOKIE_SECURE', { is: false, then: Joi.valid('lax', 'strict') }),
  COOKIE_DOMAIN: Joi.string().allow('').default(''),
  UPLOAD_DIR: Joi.string().default('./storage/uploads'),
  // Com BREVO_API_KEY o envio vai pela API HTTP da Brevo; sem ela cai no SMTP.
  BREVO_API_KEY: Joi.string().allow('').default(''),
  // Remetente usado pela Brevo; na falta dele vale o SMTP_FROM.
  MAIL_FROM: Joi.string().allow('').default(''),
  // Without SMTP_HOST the MailService only logs the message.
  SMTP_HOST: Joi.string().allow('').default(''),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().allow('').default(''),
  SMTP_PASSWORD: Joi.string().allow('').default(''),
  SMTP_FROM: Joi.string().allow('').default('Azuos Env <no-reply@azuos.dev>'),
  // Without XAI_API_KEY the AiProvider is the stub and no request leaves the process.
  XAI_API_KEY: Joi.string().allow('').default(''),
  XAI_BASE_URL: Joi.string().uri().default('https://api.x.ai/v1'),
  // No model is hardcoded: with a key configured the model has to be named here.
  GROK_MODEL: Joi.string()
    .allow('')
    .default('')
    .when('XAI_API_KEY', { is: Joi.string().min(1), then: Joi.string().min(1).required() }),
  // Tokens (in + out) one workspace may spend per calendar month; 0 = no ceiling.
  AI_MONTHLY_TOKEN_BUDGET: Joi.number().integer().min(0).default(1_000_000),
  // Passphrase of the secrets at rest (OAuth tokens, webhook secrets). Empty falls
  // back to JWT_ACCESS_SECRET, which keeps development and the tests working.
  ENCRYPTION_KEY: Joi.string().allow('').default(''),
  // Version of the Graph API used by the WhatsApp Cloud API.
  META_GRAPH_VERSION: Joi.string().default('v21.0'),
  // Without GOOGLE_CLIENT_ID the CalendarProvider stays the stub.
  GOOGLE_CLIENT_ID: Joi.string().allow('').default(''),
  GOOGLE_CLIENT_SECRET: Joi.string()
    .allow('')
    .default('')
    .when('GOOGLE_CLIENT_ID', { is: Joi.string().min(1), then: Joi.string().min(1).required() }),
  GOOGLE_REDIRECT_URI: Joi.string()
    .uri()
    .default('http://localhost:3000/api/v1/integrations/google/callback'),
  // Calendar of the connected account; `primary` is the main one of the user.
  GOOGLE_CALENDAR_ID: Joi.string().default('primary'),
  // Login with Google (reuses GOOGLE_CLIENT_ID/SECRET of the calendar integration).
  GOOGLE_LOGIN_REDIRECT_URI: Joi.string()
    .uri()
    .default('http://localhost:3000/api/v1/auth/google/callback'),
  // Where the callback sends the browser back to; also the error redirect.
  FRONTEND_URL: Joi.string().uri().default('http://localhost:5173'),
  // Fake Google for development and for the e2e; ignored in production.
  GOOGLE_MOCK: Joi.boolean()
    .default(false)
    .when('NODE_ENV', { is: 'production', then: Joi.valid(false) }),
})
  .unknown(true)
  .options({ abortEarly: false });
