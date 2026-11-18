import { TAGLINE_PATH, WORDMARK_PATH, WORDMARK_WIDTH } from './brand-paths';

/**
 * The Encycla logo (D-111): the mark (an open book under a spark, /brand/encycla-mark.svg) and
 * the wordmark drawn as paths in `currentColor`, so it reads on light and dark backgrounds and
 * needs no web font. Decorative: the control that holds it carries the accessible name.
 */
export function Logo({
  height = 40,
  tagline = true,
  className = '',
}: {
  height?: number;
  tagline?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} dir="ltr" aria-hidden="true">
      <img
        src="/brand/encycla-mark.svg"
        alt=""
        width={height}
        height={height}
        className="shrink-0"
        draggable={false}
      />
      <svg
        viewBox={`0 0 ${WORDMARK_WIDTH} 64`}
        height={height}
        width={(height * WORDMARK_WIDTH) / 64}
        focusable="false"
        data-testid="logo-wordmark"
      >
        <path d={WORDMARK_PATH} fill="currentColor" />
        {tagline ? <path d={TAGLINE_PATH} className="fill-accent" /> : null}
      </svg>
    </span>
  );
}
