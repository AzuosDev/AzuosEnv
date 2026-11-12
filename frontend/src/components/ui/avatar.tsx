import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn, initials } from '@/lib/utils';

export interface AvatarProps {
  name: string;
  src?: string | null;
  className?: string;
}

/** Avatar com iniciais quando não há imagem. */
export function Avatar({ name, src, className }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        'inline-flex h-9 w-9 select-none items-center justify-center overflow-hidden rounded-full border border-scene-line bg-scene',
        className,
      )}
    >
      {src ? (
        <AvatarPrimitive.Image src={src} alt={name} className="h-full w-full object-cover" />
      ) : null}
      <AvatarPrimitive.Fallback
        delayMs={src ? 300 : 0}
        aria-label={name}
        className="text-[12px] font-bold text-ink"
      >
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
