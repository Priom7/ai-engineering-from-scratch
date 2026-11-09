// The check step: before a reply goes out, a second model reads it next to the
// retrieved sources and lists any claim the sources don't back up.

/** The reason comes first, so the judge reasons before it decides. */
export const CHECK_FORMAT = {
  type: 'object',
  properties: {
    reason: { type: 'string' },
    verdict: { type: 'string', enum: ['supported', 'unsupported'] },
    unsupportedClaims: { type: 'array', items: { type: 'string' } },
  },
  required: ['reason', 'verdict', 'unsupportedClaims'],
};

const CHECK_SYSTEM =
  'You check customer support replies before they are sent. ' +
  'A reply is supported only if every factual claim in it (prices, time limits, yes/no answers, policies, features) is stated in the sources. ' +
  'Saying the sources do not cover something is fine. Ignore greetings and sign-offs. ' +
  'Reply with JSON: {"reason": "one or two sentences", "verdict": "supported" or "unsupported", "unsupportedClaims": ["each claim the sources do not back up"]}.';

export function checkMessages(answer: string, context: string): { system: string; user: string } {
  return { system: CHECK_SYSTEM, user: `Sources:\n${context}\n\nReply to check:\n${answer}` };
}

/** Anything other than valid JSON with the verdict "supported" counts as unsupported, so it goes to a person. */
export function parseCheck(text: string): { supported: boolean; reason: string; unsupportedClaims: string[] } {
  // TODO: Parse the check's JSON reply. Only the verdict "supported" counts as supported.
  // Anything else, including a reply that isn't JSON, is unsupported, so a person sees the email.
  // Keep reason (a string, '' when missing) and unsupportedClaims (only the strings in it).
  throw new Error('TODO: parseCheck');
}
