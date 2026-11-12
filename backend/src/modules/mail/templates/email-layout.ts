import { MAIL_COLORS as C, MAIL_FONT } from './email-theme';

export interface EmailDetail {
  label: string;
  value: string;
}

export interface EmailAction {
  label: string;
  url: string;
  /** Shown under the button so the link still works where buttons are stripped. */
  fallbackNote?: string;
}

export interface EmailContent {
  /** First line shown in the inbox preview, never rendered in the body. */
  preheader: string;
  /** Small label in the header strip, e.g. "Convite". */
  kind: string;
  heading: string;
  paragraphs: string[];
  details?: EmailDetail[];
  action?: EmailAction;
  /** Small print right above the footer, e.g. the expiry. */
  note?: string;
  footer: string[];
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

/** Outlook needs a fixed pixel width on the VML button, so it is estimated from the label. */
function buttonWidth(label: string): number {
  return Math.max(200, label.length * 9 + 56);
}

function renderButton(action: EmailAction): string {
  const url = escapeHtml(action.url);
  const label = escapeHtml(action.label);
  const width = buttonWidth(action.label);

  return `              <table role="presentation" class="btn-wrap" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:48px;v-text-anchor:middle;width:${width}px;" arcsize="25%" stroke="f" fillcolor="${C.signal2}">
                  <w:anchorlock/>
                  <center style="color:${C.onSignal};font-family:${MAIL_FONT};font-size:15px;font-weight:600;">${label}</center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-->
                <a class="btn" href="${url}" style="background-color:${C.signal2};background-image:linear-gradient(100deg,${C.signal} 0%,${C.signal2} 100%);border-radius:12px;color:${C.onSignal};display:inline-block;font-family:${MAIL_FONT};font-size:15px;font-weight:600;height:48px;line-height:48px;mso-hide:all;padding:0 28px;text-align:center;text-decoration:none;box-shadow:0 10px 30px -12px rgba(167,139,250,0.7);">${label}</a>
                <!--<![endif]-->
              </td></tr></table>`;
}

function renderDetails(details: EmailDetail[]): string {
  const rows = details
    .map(
      (detail, index) => `
                  <tr>
                    <td style="padding:${index === 0 ? '0' : '14px'} 0 0 0;font-family:${MAIL_FONT};font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;line-height:1.2;color:${C.muted};">${escapeHtml(detail.label)}</td>
                  </tr>
                  <tr>
                    <td style="padding:5px 0 0 0;font-family:${MAIL_FONT};font-size:14px;font-weight:600;line-height:1.4;color:${C.ink};">${escapeHtml(detail.value)}</td>
                  </tr>`,
    )
    .join('');

  return `              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:${C.surface2};border:1px solid ${C.line};border-radius:12px;">
                <tr><td style="padding:16px 18px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}
                  </table>
                </td></tr>
              </table>`;
}

/** Builds the full mail document. Everything is inlined: mail clients drop style rules at will. */
export function renderEmailHtml(content: EmailContent): string {
  const blocks: string[] = [
    `              <h1 class="h1" style="margin:0;font-family:${MAIL_FONT};font-size:24px;font-weight:600;line-height:1.15;letter-spacing:-0.02em;color:${C.ink};">${escapeHtml(content.heading)}</h1>`,
  ];

  for (const paragraph of content.paragraphs) {
    blocks.push(
      `              <p style="margin:14px 0 0 0;font-family:${MAIL_FONT};font-size:15px;line-height:1.6;color:${C.body};">${escapeHtml(paragraph)}</p>`,
    );
  }

  if (content.details?.length) {
    blocks.push('              <div style="height:24px;line-height:24px;">&nbsp;</div>');
    blocks.push(renderDetails(content.details));
  }

  if (content.action) {
    blocks.push('              <div style="height:28px;line-height:28px;">&nbsp;</div>');
    blocks.push(renderButton(content.action));

    if (content.action.fallbackNote) {
      blocks.push(
        `              <p style="margin:20px 0 0 0;font-family:${MAIL_FONT};font-size:13px;line-height:1.5;color:${C.muted};">${escapeHtml(content.action.fallbackNote)}</p>`,
        `              <p style="margin:6px 0 0 0;font-family:${MAIL_FONT};font-size:13px;line-height:1.5;word-break:break-all;"><a href="${escapeHtml(content.action.url)}" style="color:${C.accent};text-decoration:underline;">${escapeHtml(content.action.url)}</a></p>`,
      );
    }
  }

  if (content.note) {
    blocks.push(
      '              <div style="height:28px;line-height:28px;">&nbsp;</div>',
      `              <div style="border-top:1px solid ${C.line};font-size:0;line-height:0;">&nbsp;</div>`,
      `              <p style="margin:20px 0 0 0;font-family:${MAIL_FONT};font-size:13px;line-height:1.5;color:${C.muted};">${escapeHtml(content.note)}</p>`,
    );
  }

  const footer = content.footer
    .map(
      (line, index) =>
        `              <p style="margin:${index === 0 ? '0' : '6px'} 0 0 0;font-family:${MAIL_FONT};font-size:12px;line-height:1.5;color:${C.muted};">${escapeHtml(line)}</p>`,
    )
    .join('\n');

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="color-scheme" content="dark" />
<meta name="supported-color-schemes" content="dark" />
<title>${escapeHtml(content.heading)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style type="text/css">
:root { color-scheme: dark; supported-color-schemes: dark; }
body { margin:0 !important; padding:0 !important; width:100% !important; -webkit-text-size-adjust:100%; }
table { border-collapse:collapse; }
img { border:0; outline:none; }
::selection { background:${C.scene}; color:${C.ink}; }
@media only screen and (max-width:620px) {
  .card { width:100% !important; }
  .pad { padding-left:20px !important; padding-right:20px !important; }
  .h1 { font-size:21px !important; }
  .btn-wrap { width:100% !important; }
  .btn { display:block !important; width:100% !important; padding:0 !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background-color:${C.paper};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${C.paper};">${escapeHtml(content.preheader)}&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:${C.paper};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" class="card" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:${C.surface};border:1px solid ${C.line};border-radius:16px;">
        <tr>
          <td class="pad" style="padding:20px 28px;background-color:${C.scene};border-bottom:1px solid ${C.sceneLine};border-radius:16px 16px 0 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="left" style="font-family:${MAIL_FONT};font-size:17px;font-weight:600;letter-spacing:-0.02em;line-height:1.2;color:${C.ink};white-space:nowrap;">Azuos<span style="color:${C.accent};"> Env</span><span style="display:inline-block;width:5px;height:5px;background-color:${C.accent};border-radius:999px;vertical-align:middle;margin:0 0 3px 7px;mso-hide:all;font-size:0;line-height:0;">&nbsp;</span></td>
                <td align="right" style="font-family:${MAIL_FONT};font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;line-height:1.2;color:${C.accent};white-space:nowrap;">${escapeHtml(content.kind)}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td class="pad" style="padding:32px 28px;">
${blocks.join('\n')}
          </td>
        </tr>
        <tr>
          <td class="pad" style="padding:20px 28px;background-color:${C.paper2};border-top:1px solid ${C.line};border-radius:0 0 16px 16px;">
${footer}
          </td>
        </tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** Plain-text twin of the same content, for clients that refuse HTML. */
export function renderEmailText(content: EmailContent): string {
  const lines: string[] = [content.heading, '', ...content.paragraphs, ''];

  for (const detail of content.details ?? []) {
    lines.push(`${detail.label}: ${detail.value}`);
  }

  if (content.details?.length) {
    lines.push('');
  }

  if (content.action) {
    lines.push(`${content.action.label}: ${content.action.url}`, '');
  }

  if (content.note) {
    lines.push(content.note, '');
  }

  lines.push(...content.footer);

  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
