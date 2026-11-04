import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  MONGODB_URI: Joi.string()
    .pattern(/^mongodb(\+srv)?:\/\//)
    .required(),
  CORS_ORIGINS: Joi.string().default('http://localhost:5173'),
  // Origins allowed on the public form routes (site of Azuos Dev).
  PUBLIC_FORM_ORIGINS: Joi.string().allow('').default(''),
  APP_URL: Joi.string().uri().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL: Joi.string().default('30d'),
  COOKIE_SECURE: Joi.boolean().default(false),
  COOKIE_DOMAIN: Joi.string().allow('').default(''),
  UPLOAD_DIR: Joi.string().default('./storage/uploads'),
  // Without SMTP_HOST the MailService only logs the message.
  SMTP_HOST: Joi.string().allow('').default(''),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().allow('').default(''),
  SMTP_PASSWORD: Joi.string().allow('').default(''),
  SMTP_FROM: Joi.string().allow('').default('Azuos Env <no-reply@azuos.dev>'),
})
  .unknown(true)
  .options({ abortEarly: false });
