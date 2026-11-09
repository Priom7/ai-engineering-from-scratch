import { Ajv } from 'ajv';

const ajv = new Ajv({ allErrors: true });

/** The first {...} block in the text: small models often wrap JSON in a sentence. */
function extractObject(raw: string): string | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  return start !== -1 && end > start ? raw.slice(start, end + 1) : null;
}

/** Parses a model reply as JSON and checks it against a schema. The error is one readable line for a retry prompt. */
export function parseAndValidate(raw: string, schema: object): { ok: true; value: unknown } | { ok: false; error: string } {
  const candidate = extractObject(raw);
  let value: unknown;
  try {
    if (candidate === null) throw new Error('no object');
    value = JSON.parse(candidate);
  } catch {
    return { ok: false, error: 'The reply was not JSON.' };
  }
  const validate = ajv.compile(schema);
  if (validate(value)) return { ok: true, value };
  const errors = (validate.errors ?? []).map((e) => `${e.instancePath || 'reply'} ${e.message}${e.params && 'allowedValues' in e.params ? ` (${(e.params.allowedValues as string[]).join(', ')})` : ''}`);
  return { ok: false, error: errors.join('; ') };
}

/** What the model is told when its JSON was invalid: the exact error, and to try again. */
export function retryPrompt(previous: string, error: string): string {
  return `Your previous reply was invalid: ${error}\n\nPrevious reply:\n${previous}\n\nReply again with only JSON matching the schema.`;
}
