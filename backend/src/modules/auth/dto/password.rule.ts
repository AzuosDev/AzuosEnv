/** Senha com no mínimo 8 caracteres, contendo ao menos uma letra e um número. */
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export const PASSWORD_RULE_MESSAGE =
  'A senha deve ter no mínimo 8 caracteres, com ao menos uma letra e um número.';
