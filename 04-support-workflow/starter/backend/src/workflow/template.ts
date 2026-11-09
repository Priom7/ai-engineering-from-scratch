/** Looks up a dotted key ("understand.question") in the run context. */
export function lookup(context: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>((value, part) => (value && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined), context);
}

/** Fills {{key}} placeholders. Missing keys become ''; objects and arrays become JSON. */
export function render(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const value = lookup(context, key);
    if (value === undefined || value === null) return '';
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  });
}
