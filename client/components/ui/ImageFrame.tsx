import { useState } from 'react';
import type { Language } from '../../../shared/languages';
import type { ImageView } from '../../../shared/types';
import { contentAttributes, useTranslation } from '../../i18n';
import { IMAGE_SIZES, commonsSources } from '../../lib/images';

type LoadState = 'loading' | 'loaded' | 'retry' | 'failed';

function FramedImage({ image, language }: { image: ImageView; language?: Language }) {
  const { t } = useTranslation();
  const [state, setState] = useState<LoadState>('loading');
  const { src, srcSet } = commonsSources(image.url);

  if (state === 'failed') {
    return (
      <div
        role="img"
        aria-label={t('image.unavailable')}
        className="anim-fade p-8 text-center text-ink-2"
      >
        {t('image.unavailable')}
      </div>
    );
  }
  // A failed responsive candidate is retried once with the stored URL before giving up.
  const responsive = srcSet !== null && state !== 'retry';
  return (
    <>
      {state === 'loading' ? (
        <div
          aria-hidden="true"
          className="anim-pulse absolute inset-0 bg-raised"
          data-testid="image-skeleton"
        />
      ) : null}
      <img
        key={responsive ? 'responsive' : 'plain'}
        src={src}
        {...(responsive ? { srcSet, sizes: IMAGE_SIZES } : {})}
        alt={image.alt}
        {...(language ? { lang: language } : {})}
        loading="eager"
        decoding="async"
        fetchPriority="high"
        referrerPolicy="no-referrer"
        onLoad={() => setState('loaded')}
        onError={() => setState(responsive ? 'retry' : 'failed')}
        className={`relative max-h-full max-w-full object-contain transition-opacity duration-200 motion-reduce:transition-none ${
          state === 'loaded' ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </>
  );
}

export function ImageFrame({
  image,
  className = '',
  language,
}: {
  image: ImageView | null;
  className?: string;
  /** Language of the alternative text (the language of the questions). */
  language?: Language;
}) {
  const { t } = useTranslation();
  return (
    <figure
      className={`relative flex items-center justify-center overflow-hidden rounded-lg border border-line bg-surface ${className}`}
    >
      {image ? (
        // Keyed by URL: a new question starts again from the loading state.
        <FramedImage key={image.url} image={image} {...(language ? { language } : {})} />
      ) : (
        <div role="img" aria-label={t('image.unavailable')} className="p-8 text-center text-ink-2">
          {t('image.unavailable')}
        </div>
      )}
    </figure>
  );
}

export function ImageCredit({ image, language }: { image: ImageView | null; language?: Language }) {
  const { t } = useTranslation();
  if (!image || (!image.credit && !image.license)) return null;
  const text = [image.credit, image.license].filter(Boolean).join(' · ');
  const safeUrl = image.sourceUrl?.startsWith('https://') ? image.sourceUrl : null;
  return (
    <p className="text-sm text-ink-2">
      {t('image.credit')}{' '}
      <span {...(language ? { lang: language, dir: contentAttributes(language).dir } : {})}>
        {safeUrl ? (
          <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="underline">
            {text}
          </a>
        ) : (
          text
        )}
      </span>
    </p>
  );
}
