/**
 * Helper function to strip markdown code block boundaries from JSON strings.
 * E.g., strips leading "```json" and trailing "```".
 */
export function cleanJsonMarkdown(raw: string): string {
  let cleaned = raw.trim();
  
  // Strip opening backticks block
  if (cleaned.startsWith('```')) {
    const newlineIndex = cleaned.indexOf('\n');
    if (newlineIndex !== -1) {
      cleaned = cleaned.substring(newlineIndex + 1);
    } else {
      // Just strip backticks and any optional language identifier if no newline
      cleaned = cleaned.replace(/^```(json)?/i, '');
    }
  }
  
  // Strip trailing backticks block
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  
  return cleaned.trim();
}
