import { forwardRef } from 'react';
import { contentAttributes } from '../../i18n';

export const MAX_ARTICLE_CHARS = 5000;

/** Plain-text article: React escapes everything, there is no HTML path. */
export const ArticleBody = forwardRef<
  HTMLElement,
  { title: string; body: string; language?: string }
>(function ArticleBody({ title, body, language }, ref) {
  const paragraphs = body
    .slice(0, MAX_ARTICLE_CHARS)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  return (
    <article
      ref={ref}
      tabIndex={-1}
      className="article-body outline-none"
      aria-labelledby="article-title"
      {...(language ? contentAttributes(language) : {})}
    >
      <h2 id="article-title" className="mb-3 text-3xl">
        {title}
      </h2>
      <div className="space-y-3 text-base leading-relaxed text-ink-2">
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </article>
  );
});
