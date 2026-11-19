/**
 * Marca do WhatsApp em traço, só para identificar a integração. Desenho
 * próprio: o balão com o fone, sem o círculo verde nem o logotipo da Meta.
 */
export function WhatsappGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L4 20l1.2-4.2A8.5 8.5 0 1 1 21 11.5z" />
      <path d="M9.2 9c-.3 0-.6.2-.8.5-.3.5-.3 1.2 0 1.9.5 1.3 1.9 2.9 3.6 3.6.8.3 1.5.3 2-.1.3-.2.4-.6.4-.9l-1.4-.7-.7.7c-.9-.4-1.7-1.2-2.1-2.1l.7-.7-.7-1.4a1 1 0 0 0-.4-.8z" />
    </svg>
  );
}
