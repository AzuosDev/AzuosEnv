import { z } from 'zod';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Mesma regra do backend: 8+ caracteres, com letra e número. */
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
export const PASSWORD_MESSAGE =
  'A senha deve ter no mínimo 8 caracteres, com ao menos uma letra e um número.';

export const emailField = z
  .string()
  .trim()
  .min(1, 'Informe o e-mail.')
  .max(254, 'E-mail muito longo.')
  .regex(EMAIL_PATTERN, 'E-mail inválido.');

export const nameField = z
  .string()
  .trim()
  .min(2, 'Informe o nome completo.')
  .max(120, 'Nome muito longo.');

export const newPasswordField = z
  .string()
  .min(1, 'Informe a senha.')
  .max(128, 'Senha muito longa.')
  .regex(PASSWORD_PATTERN, PASSWORD_MESSAGE);

export const currentPasswordField = z.string().min(1, 'Informe a senha.');

/** Prefixo das tarefas: 2 a 6 letras ou números, como no backend. */
export const taskPrefixField = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9]{1,5}$/, 'O prefixo deve ter de 2 a 6 letras ou números (ex.: AZD).');

export const colorField = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida.');
