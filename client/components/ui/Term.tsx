import type { LabelForm } from '../../../shared/types';
import { directionOf } from '../../i18n';

/**
 * A name that is not in the room language (D-108): isolated with `<bdi>` so it never reorders
 * the surrounding right-to-left or left-to-right text, tagged with its language, and in italics,
 * left-to-right, when it is a scientific (Latin) name.
 */
export function Term({ text, form }: { text: string; form?: LabelForm | null | undefined }) {
  if (!form) return <>{text}</>;
  return (
    <bdi
      lang={form.lang}
      dir={form.scientific ? 'ltr' : directionOf(form.lang)}
      className={form.scientific ? 'italic' : undefined}
      data-label-form={form.scientific ? 'scientific' : 'original'}
    >
      {text}
    </bdi>
  );
}

/** `text` with the first occurrence of `term` rendered as a `Term` (the answer in a sentence). */
export function TextWithTerm({
  text,
  term,
  form,
}: {
  text: string;
  term: string;
  form?: LabelForm | null | undefined;
}) {
  const at = form && term ? text.indexOf(term) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <Term text={term} form={form} />
      {text.slice(at + term.length)}
    </>
  );
}
