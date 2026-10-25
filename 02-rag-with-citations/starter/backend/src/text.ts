export function sanitizeText(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function chunkText(input: string, chunkSize: number, overlap: number): string[] {
  // TODO 1: Clean the text with sanitizeText(). Return [] if nothing is left.
  // TODO 2: Walk through the text in windows of chunkSize characters, trimming each slice.
  // TODO 3: Start each new window `overlap` characters before the previous one ended,
  //         so a sentence cut at a boundary still appears whole in one of the chunks.
  // TODO 4: Make sure the start always moves forward, or the loop never ends.
  throw new Error('TODO: chunkText is not implemented yet.');
}
export function cosineSimilarity(left: number[], right: number[]): number {
  // TODO: Return dot(left, right) / (length(left) * length(right)).
  //       Return 0 if the vectors differ in length, or either one is empty or all zeros.
  throw new Error('TODO: cosineSimilarity is not implemented yet.');
}
