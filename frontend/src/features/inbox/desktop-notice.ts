export interface DesktopNoticeInput {
  permission: NotificationPermission;
  /** Este navegador está inscrito no Web Push: o aviso vem do Service Worker. */
  pushSubscribed: boolean;
  /** A aba está em foco: o toast na tela já conta a novidade. */
  focused: boolean;
}

/**
 * Decide se a própria aba desenha o aviso do sistema. Ela só entra quando o
 * Web Push não cobre este navegador (sem inscrição, por falta de suporte ou
 * porque o registro falhou) e a pessoa está em outra janela.
 */
export function shouldShowDesktopNotice(input: DesktopNoticeInput): boolean {
  return input.permission === 'granted' && !input.pushSubscribed && !input.focused;
}

export interface DesktopNotice {
  title: string;
  body: string;
  /** Mesma etiqueta do push do servidor: o aviso repetido substitui o anterior. */
  tag: string;
}
