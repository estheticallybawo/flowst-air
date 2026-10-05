/** Social turns stay in the transcript but are not evidence of learning. */
export function isStudySocialInput(input: string): boolean {
  const text = input
    .trim()
    .replace(/[.!?,]+$/u, "")
    .trim();
  if (!text) return true;
  if (
    /^(?:(?:hi|hello|hey|good morning|good afternoon|good evening)(?:,?\s+(?:amina|amira|misu|kai))?|thanks|thank you|okay|ok|ready|i(?:'|’)m ready|i am ready|let(?:'|’)s (?:begin|start)|yes|no)$/iu.test(
      text,
    )
  )
    return true;
  // Full-match only: a greeting or a stated name must never swallow an explanation.
  return /^(?:(?:[Hh]i|[Hh]ello|[Hh]ey)[,.]?\s+)?(?:[Mm]y name is|[Ii](?:'|’)m|[Ii] am)\s+[A-Z][a-z]+(?:[ -][A-Z][a-z]+){0,2}$/u.test(
    text,
  );
}
