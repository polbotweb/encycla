/** One message: a string with `{name}` placeholders, or plural forms picked by `{count}`. */
export type PluralForms = { other: string } & Partial<
  Record<'zero' | 'one' | 'two' | 'few' | 'many', string>
>;
export type Message = string | PluralForms;

export type MessageParams = Record<string, string | number>;
