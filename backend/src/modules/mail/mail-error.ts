interface SmtpError {
  code?: string;
  command?: string;
  responseCode?: number;
  response?: string;
  message?: string;
}

/** O erro do nodemailer só é útil com code/command/responseCode/response juntos. */
export function describeMailError(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return String(error);
  }

  const smtp = error as SmtpError;
  const parts = [
    smtp.code !== undefined && `code=${smtp.code}`,
    smtp.command !== undefined && `command=${smtp.command}`,
    smtp.responseCode !== undefined && `responseCode=${smtp.responseCode}`,
    smtp.response !== undefined && `response=${smtp.response}`,
    smtp.message !== undefined && `message=${smtp.message}`,
  ].filter((part): part is string => typeof part === 'string');

  return parts.length > 0 ? parts.join(' ') : String(error);
}
