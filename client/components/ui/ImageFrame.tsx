import { useState } from 'react';
import type { Language } from '../../../shared/languages';
import type { ImageView } from '../../../shared/types';
import { contentAttributes, useTranslation } from '../../i18n';

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
  const [failed, setFailed] = useState(false);
  const showImage = image !== null && !failed;
  return (
    <figure
      className={`flex items-center justify-center overflow-hidden rounded-lg border border-line bg-surface ${className}`}
    >
      {showImage ? (
        <img
          src={image.url}
          alt={image.alt}
          {...(language ? { lang: language } : {})}
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="max-h-full max-w-full object-contain"
        />
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
