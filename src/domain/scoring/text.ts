import type { AcceptedAnswer, Concept } from '../exercises/types';

export function normalizeBlank(value: string): string {
  return value.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е').replace(/\s+/gu, ' ').replace(/[.!?,;:…]+$/u, '').trim();
}
export function acceptsBlank(value: string, accepted: AcceptedAnswer): boolean {
  const input = normalizeBlank(value);
  const expected = normalizeBlank(accepted.text);
  if (input === expected) return true;
  if (!accepted.allowTypo || !/^\p{L}{7,}$/u.test(expected) || !/^\p{L}+$/u.test(input) || input.length !== expected.length) return false;
  return [...input].filter((letter, index) => letter !== expected[index]).length === 1;
}
function tokens(value: string): string[] {
  return value.toLocaleLowerCase('ru').replaceAll('ё', 'е').match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu) ?? [];
}
export function wordCount(value: string): number {
  const words = tokens(value).filter(word => /\p{L}/u.test(word));
  return words.filter((word, index) => word !== words[index - 1]).length;
}
function sequenceFound(words: string[], concept: Concept): boolean {
  const expected = tokens(concept.text);
  return expected.length > 0 && words.some((_, start) => expected.every((word, offset) => {
    const actual = words[start + offset];
    return concept.stem && expected.length === 1 ? actual?.startsWith(word) : actual === word;
  }));
}
/** Preserve sentence boundaries before turning punctuation into separators. */
export function matchingSentence(value: string, concept: Concept, suppressNegation = true): string | undefined {
  return value.split(/[.!?\r\n]+/u).find(sentence => {
    const words = tokens(sentence);
    if (!sequenceFound(words, concept)) return false;
    return !suppressNegation || !(concept.negative ?? []).some(text => sequenceFound(words, { text }));
  })?.trim();
}
export function matchesConcept(value: string, concept: Concept): boolean {
  return matchingSentence(value, concept) !== undefined;
}
