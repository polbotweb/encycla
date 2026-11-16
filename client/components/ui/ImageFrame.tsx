import { useState } from 'react';
import type { ImageView } from '../../../shared/types';

export function ImageFrame({ image, className = '' }: { image: ImageView | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = image !== null && !failed;
  return (
    <figure className={`flex items-center justify-center overflow-hidden rounded-lg border border-line bg-surface ${className}`}>
      {showImage ? (
        <img
          src={image.url}
          alt={image.alt}
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="max-h-full max-w-full object-contain"
        />
      ) : (
        <div role="img" aria-label="Image unavailable" className="p-8 text-center text-ink-2">
          Image unavailable
        </div>
      )}
    </figure>
  );
}

export function ImageCredit({ image }: { image: ImageView | null }) {
  if (!image || (!image.credit && !image.license)) return null;
  const text = [image.credit, image.license].filter(Boolean).join(' · ');
  const safeUrl = image.sourceUrl?.startsWith('https://') ? image.sourceUrl : null;
  return (
    <p className="text-sm text-ink-2">
      Credit:{' '}
      {safeUrl ? (
        <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="underline">
          {text}
        </a>
      ) : (
        text
      )}
    </p>
  );
}
