import { Download, FileText, MapPin, Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { WaMessage } from '@/api/types';
import { Spinner } from '@/components/ui/spinner';
import { downloadWaMedia } from '../api';

/**
 * Bytes do arquivo da mensagem como URL local. O arquivo vem pela API porque o
 * link da Meta expira e o access token vive só em memória.
 */
function useWaBlobUrl(
  wsId: string,
  conversationId: string,
  messageId: string,
  enabled: boolean,
): { url: string | null; failed: boolean } {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    setFailed(false);

    void downloadWaMedia(wsId, conversationId, messageId)
      .then((blob) => {
        if (cancelled) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }

      setUrl(null);
    };
  }, [wsId, conversationId, messageId, enabled]);

  return { url, failed };
}

export interface WaMediaProps {
  wsId: string;
  conversationId: string;
  message: WaMessage;
}

function sizeLabel(bytes: number): string {
  if (bytes <= 0) {
    return '';
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('pt-BR')} kB`;
  }

  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}

function clockLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }

  const whole = Math.floor(seconds);

  return `${String(Math.floor(whole / 60))}:${String(whole % 60).padStart(2, '0')}`;
}

/** Imagem e figurinha: prévia clicável que abre o arquivo em outra aba. */
function WaImageBubble({ wsId, conversationId, message }: WaMediaProps) {
  const { url, failed } = useWaBlobUrl(wsId, conversationId, message.id, true);
  const label = message.media?.caption || 'Imagem da conversa';

  if (failed) {
    return <p className="text-[13px] text-wa-muted">Não foi possível carregar a imagem.</p>;
  }

  if (!url) {
    return (
      <div className="flex h-40 w-full items-center justify-center rounded-lg bg-wa-header">
        <Spinner label="Carregando a imagem" />
      </div>
    );
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img
        src={url}
        alt={label}
        className="max-h-72 w-full rounded-lg object-cover"
        loading="lazy"
      />
    </a>
  );
}

function WaVideoBubble({ wsId, conversationId, message }: WaMediaProps) {
  const { url, failed } = useWaBlobUrl(wsId, conversationId, message.id, true);

  if (failed) {
    return <p className="text-[13px] text-wa-muted">Não foi possível carregar o vídeo.</p>;
  }

  if (!url) {
    return (
      <div className="flex h-40 w-full items-center justify-center rounded-lg bg-wa-header">
        <Spinner label="Carregando o vídeo" />
      </div>
    );
  }

  return (
    <video src={url} controls preload="metadata" className="max-h-72 w-full rounded-lg">
      <track kind="captions" />
    </video>
  );
}

/** Player do áudio: tocar/pausar, posição e duração, sem depender do nativo. */
function WaAudioBubble({ wsId, conversationId, message }: WaMediaProps) {
  const { url, failed } = useWaBlobUrl(wsId, conversationId, message.id, true);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  if (failed) {
    return <p className="text-[13px] text-wa-muted">Não foi possível carregar o áudio.</p>;
  }

  if (!url) {
    return (
      <div className="flex h-11 items-center">
        <Spinner label="Carregando o áudio" />
      </div>
    );
  }

  const toggle = (): void => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  };

  return (
    <div className="flex min-w-[200px] items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pausar o áudio' : 'Tocar o áudio'}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-wa-accent text-wa-panel"
      >
        {playing ? (
          <Pause className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Play className="h-4 w-4" aria-hidden="true" />
        )}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.floor(duration))}
          value={Math.floor(position)}
          aria-label="Posição do áudio"
          onChange={(event) => {
            const audio = audioRef.current;
            const next = Number(event.target.value);

            setPosition(next);

            if (audio) {
              audio.currentTime = next;
            }
          }}
          className="h-1.5 w-full accent-[var(--wa-accent)]"
        />
        <span className="text-[11px] text-wa-muted">
          {clockLabel(position)} / {clockLabel(duration)}
        </span>
      </div>

      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => {
          setPlaying(true);
        }}
        onPause={() => {
          setPlaying(false);
        }}
        onTimeUpdate={(event) => {
          setPosition(event.currentTarget.currentTime);
        }}
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration);
        }}
        onEnded={() => {
          setPlaying(false);
          setPosition(0);
        }}
      >
        <track kind="captions" />
      </audio>
    </div>
  );
}

/** Documento: nome, tamanho e o botão que salva o arquivo. */
function WaDocumentBubble({ wsId, conversationId, message }: WaMediaProps) {
  const [downloading, setDownloading] = useState(false);
  const name = message.media?.filename || 'Documento';
  const size = sizeLabel(message.media?.size ?? 0);

  const save = (): void => {
    setDownloading(true);

    void downloadWaMedia(wsId, conversationId, message.id)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = name;
        link.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => {
        // O aviso de erro fica no próprio botão, que volta a ficar disponível.
      })
      .finally(() => {
        setDownloading(false);
      });
  };

  return (
    <div className="flex items-center gap-2 rounded-lg bg-wa-header/60 p-2">
      <FileText className="h-5 w-5 shrink-0 text-wa-muted" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-[13px]">
        {name}
        {size === '' ? '' : ` · ${size}`}
      </span>
      <button
        type="button"
        onClick={save}
        disabled={downloading}
        aria-label={`Baixar ${name}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-wa-muted hover:text-wa-text md:h-9 md:w-9"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

interface WaLocationPayload {
  latitude?: number;
  longitude?: number;
  name?: string;
  address?: string;
}

/** Localização: endereço e link para o mapa, sem embutir mapa de terceiro. */
function WaLocationBubble({ message }: { message: WaMessage }) {
  const payload = (message.payload ?? {}) as WaLocationPayload;
  const latitude = payload.latitude;
  const longitude = payload.longitude;
  const title = payload.name ?? 'Localização';

  return (
    <div className="flex items-start gap-2">
      <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-wa-accent" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold">{title}</p>
        {payload.address ? <p className="text-[13px]">{payload.address}</p> : null}
        {typeof latitude === 'number' && typeof longitude === 'number' ? (
          <a
            href={`https://www.openstreetmap.org/?mlat=${String(latitude)}&mlon=${String(longitude)}`}
            target="_blank"
            rel="noreferrer"
            className="text-[13px] text-wa-accent underline"
          >
            Abrir no mapa
          </a>
        ) : null}
      </div>
    </div>
  );
}

/** Conteúdo da bolha que não é texto puro. */
export function WaMediaContent({ wsId, conversationId, message }: WaMediaProps) {
  if (message.type === 'image' || message.type === 'sticker') {
    return <WaImageBubble wsId={wsId} conversationId={conversationId} message={message} />;
  }

  if (message.type === 'video') {
    return <WaVideoBubble wsId={wsId} conversationId={conversationId} message={message} />;
  }

  if (message.type === 'audio') {
    return <WaAudioBubble wsId={wsId} conversationId={conversationId} message={message} />;
  }

  if (message.type === 'document') {
    return <WaDocumentBubble wsId={wsId} conversationId={conversationId} message={message} />;
  }

  if (message.type === 'location') {
    return <WaLocationBubble message={message} />;
  }

  return null;
}
