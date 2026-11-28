import type { GuidedStep } from '../schemas/workout';

const QUANTITY_UNIT = String.raw`(?:m|km|cal|kcal|reps?|rep|seg|s|min|"|')`;
const NUMBER = String.raw`\d+(?:[.,]\d+)?`;
/** "21 Thrusters", "400 m Run", "15 cal Row", "21x Thrusters". */
const LEADING_QUANTITY = new RegExp(
  String.raw`^(${NUMBER}(?:\s*${QUANTITY_UNIT}\b)?)\s*x?\s+(.+)$`,
  'i',
);
/** "Run 400 m", "Row 500m". */
const TRAILING_QUANTITY = new RegExp(String.raw`^(.+?)\s+(${NUMBER}\s*(?:m|km|cal|kcal))$`, 'i');
/** "21-15-9" on its own line: the following bare movements repeat with each count. */
const REP_SCHEME = /^\d+(?:\s*-\s*\d+)+(?:\s*reps?)?:?$/i;
/** Headers the coach writes around the movements, never steps themselves. */
const HEADER =
  /^(?:for time|amrap|emom|e\dmom|tabata|time cap|cap|rx|escalado|scaled|rondas?|rounds?|\d+\s*(?:rondas?|rounds?))\b/i;

/** "21-15-9 Thrusters, Pull-ups" on one line. */
const INLINE_SCHEME = /^(\d+(?:\s*-\s*\d+)+)\s+(?:reps?\s+)?(?:de\s+)?(.+)$/i;
const NAME_SEPARATOR = /\s*(?:,|\s\+\s|\sy\s|\sand\s)\s*/i;

const BULLET = /^[-*•·]\s*/;
/** "Cierre: 400 m run" → "400 m run". */
const LABEL_PREFIX = /^[^:\d]{1,20}:\s*(?=\S)/;

function cleanLine(line: string): string {
  return line.replace(BULLET, '').replace(/\s+/g, ' ').trim();
}

function quantityStep(line: string): GuidedStep | null {
  const leading = LEADING_QUANTITY.exec(line);
  if (leading?.[1] && leading[2]) return { quantity: leading[1].trim(), name: leading[2].trim() };
  const trailing = TRAILING_QUANTITY.exec(line);
  if (trailing?.[1] && trailing[2])
    return { quantity: trailing[2].trim(), name: trailing[1].trim() };
  return null;
}

function expandScheme(counts: string[], names: string[]): GuidedStep[] {
  return counts.flatMap((quantity) => names.map((name) => ({ quantity, name })));
}

/**
 * Reads the steps out of what the coach typed, one movement per line, so WODs
 * loaded before the guided mode existed can be guided too. Returns an empty
 * list when nothing looks like a movement.
 */
export function parseGuidedSteps(description: string): GuidedStep[] {
  const steps: GuidedStep[] = [];
  let scheme: string[] | null = null;
  let schemeNames: string[] = [];
  const closeScheme = () => {
    if (scheme && schemeNames.length > 0) steps.push(...expandScheme(scheme, schemeNames));
    scheme = null;
    schemeNames = [];
  };

  for (const raw of description.split(/\r?\n/)) {
    let line = cleanLine(raw);
    // A blank line ends a rep scheme: what follows is a new block.
    if (line === '') {
      closeScheme();
      continue;
    }
    if (line.endsWith(':') && !REP_SCHEME.test(line)) continue;
    if (REP_SCHEME.test(line)) {
      closeScheme();
      scheme = line
        .replace(/reps?|:/gi, '')
        .split('-')
        .map((count) => count.trim());
      continue;
    }
    if (HEADER.test(line)) continue;
    line = line.replace(LABEL_PREFIX, '');
    const inline = INLINE_SCHEME.exec(line);
    if (inline?.[1] && inline[2]) {
      closeScheme();
      const counts = inline[1].split('-').map((count) => count.trim());
      const names = inline[2].split(NAME_SEPARATOR).filter((name) => name !== '');
      steps.push(...expandScheme(counts, names));
      continue;
    }
    const step = quantityStep(line);
    if (scheme && !step) {
      schemeNames.push(line);
      continue;
    }
    closeScheme();
    if (step) steps.push(step);
  }
  closeScheme();
  return steps.slice(0, 40);
}

export interface GuidedSource {
  description: string;
  guidedSteps: GuidedStep[] | null;
}

/** The coach's steps when loaded, otherwise the ones read from the description. */
export function guidedStepsFor(source: GuidedSource): GuidedStep[] {
  return source.guidedSteps && source.guidedSteps.length > 0
    ? source.guidedSteps
    : parseGuidedSteps(source.description);
}
