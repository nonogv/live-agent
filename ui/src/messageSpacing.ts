import type { ChatMessage } from './types.js';

/**
 * Top margin class for a message based on spacing from the previous one.
 * User ↔ agent pairs get extra separation between turns.
 */
export function messageTopMargin(index: number, messages: ChatMessage[]): string {
  if (index === 0) return '';
  const prev = messages[index - 1];
  const cur = messages[index];
  const isDialoguePair =
    (prev.role === 'user' && cur.role === 'agent') ||
    (prev.role === 'agent' && cur.role === 'user');
  return isDialoguePair ? 'mt-5' : 'mt-3';
}
