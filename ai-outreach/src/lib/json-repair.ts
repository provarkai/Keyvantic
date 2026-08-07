/**
 * Tolerant JSON extraction.
 *
 * Models wrap JSON in code fences, prepend "Here is the analysis:", or emit a
 * trailing comma. `JSON.parse` rejects all of that, so this walks the string,
 * finds the first balanced top-level object, and retries once with trailing
 * commas stripped before giving up.
 */
export function extractJsonObject(raw: string): unknown | undefined {
  const text = stripCodeFences(raw).trim();
  if (!text) return undefined;

  const direct = tryParse(text);
  if (direct !== undefined) return direct;

  const slice = findBalancedObject(text);
  if (slice === undefined) return undefined;

  return tryParse(slice);
}

function tryParse(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    // one more go without trailing commas, the single most common defect
    try {
      return JSON.parse(text.replace(/,(\s*[}\]])/g, '$1'));
    } catch {
      return undefined;
    }
  }
}

function stripCodeFences(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced?.[1] ?? raw;
}

/**
 * Returns the first top-level `{...}` span, respecting braces that appear
 * inside string literals and escape sequences.
 */
function findBalancedObject(text: string): string | undefined {
  const start = text.indexOf('{');
  if (start === -1) return undefined;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      if (inString) escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return undefined;
}
