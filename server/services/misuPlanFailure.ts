type ValidationReason = 'MISSING_FIELD' | 'UNSUPPORTED_VALUE' | 'INVALID_FIELD' | 'UNEXPECTED_FIELDS' | 'CRITERIA_TARGET_MISMATCH' | 'DUPLICATE_TARGET_IDS' | 'REPEATED_CRITERIA' | 'EXACT_WORDING_NOT_ALLOWED' | 'OUTSIDE_LIMIT'
interface SafeValidationIssue { path: string; reason: ValidationReason }
const fields: Record<string, string> = {
  title: 'title', objectives: 'study objectives', outcome: 'learning outcome', sourceIds: 'source references',
  estimatedMinutes: 'practice time', planningNote: 'planning explanation', policy: 'success criteria', version: 'success-criteria version',
  evaluationMode: 'practice activity', successCriteria: 'success criteria', requiredMeaning: 'required meanings',
  lexicalMatchRequired: 'exact-wording requirement', minimumEvidence: 'evidence requirement', evidenceTargets: 'evidence targets',
  id: 'identifier', question: 'practice question', maxAttemptsForSameTarget: 'attempt limit', allowedAdaptations: 'support options',
  rationale: 'plan explanation', conversationStrategy: 'practice strategy', evaluationCriteria: 'review criteria', description: 'description',
}
function fieldValue(proposal: unknown, path: PropertyKey[]) {
  let current: any = proposal
  for (const key of path) {
    if (!current || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, key)) return undefined
    current = current[key]
  }
  return current
}

/** Describe application-owned validation rules, never model values, arbitrary keys or raw error prose. */
export function misuPlanValidationFailure(error: unknown, proposal: unknown) {
  const issues = (error as { issues?: Array<{ code?: string; path?: PropertyKey[]; message?: string }> })?.issues || []
  let explanation = 'the returned plan did not meet the required structure'
  const validationIssues: SafeValidationIssue[] = issues.slice(0, 6).map((issue, index) => {
    const rawPath = Array.isArray(issue.path) ? issue.path : []
    const safePath = rawPath.every(key => typeof key === 'string' ? Object.hasOwn(fields, key) : typeof key === 'number' && Number.isInteger(key) && key >= 0 && key < 100)
      ? rawPath : []
    const field = [...safePath].reverse().find(key => typeof key === 'string') as string | undefined
    const label = field ? fields[field]! : 'plan structure'
    const subject = safePath[0] === 'objectives' && typeof safePath[1] === 'number' ? `objective ${safePath[1] + 1}` : 'the plan'
    let reason: ValidationReason = 'INVALID_FIELD'
    let detail = `${subject} has invalid ${label}`
    if (issue.code === 'custom' && issue.message === 'Every required meaning must belong to exactly one stable evidence target.') {
      reason = 'CRITERIA_TARGET_MISMATCH'
      detail = `${subject}'s success criteria do not match its evidence targets`
      const policy = fieldValue(proposal, safePath)
      if (Array.isArray(policy?.evidenceTargets)) {
        const ids = policy.evidenceTargets.map((target: any) => target.id)
        const meanings = policy.evidenceTargets.flatMap((target: any) => target.requiredMeaning)
        if (new Set(ids).size !== ids.length) {
          reason = 'DUPLICATE_TARGET_IDS'
          detail = `${subject} repeats a practice-check identifier`
        } else if (new Set(meanings).size !== meanings.length) {
          reason = 'REPEATED_CRITERIA'
          detail = `${subject} repeats a success criterion in its practice checks`
        }
      }
    } else if (issue.code === 'custom' && issue.message === 'Exact wording is only permitted for source fidelity.') {
      reason = 'EXACT_WORDING_NOT_ALLOWED'
      detail = `${subject} requires exact wording for an activity that does not allow it`
    } else if (issue.code === 'custom' && field === 'question') {
      detail = `${subject}'s evidence target asks more than one learning question`
    } else if (issue.code === 'unrecognized_keys') {
      reason = 'UNEXPECTED_FIELDS'
      detail = `${subject} contains unexpected fields`
    } else if (safePath.length && fieldValue(proposal, safePath) === undefined) {
      reason = 'MISSING_FIELD'
      detail = `${subject} is missing its ${label}`
    } else if (issue.code === 'invalid_value') {
      reason = 'UNSUPPORTED_VALUE'
      detail = `${subject} has an unsupported value for its ${label}`
    } else if (issue.code === 'too_big' || issue.code === 'too_small') {
      reason = 'OUTSIDE_LIMIT'
      detail = `${subject}'s ${label} is outside the permitted length or count`
    }
    if (index === 0) explanation = detail
    return { path: safePath.join('.') || 'plan', reason }
  })
  const remaining = issues.length - 1
  const otherChecks = remaining > 0 ? ` ${remaining} other ${remaining === 1 ? 'check also failed' : 'checks also failed'}.` : ''
  return { statusMessage: `Misu's plan was rejected: ${explanation}.${otherChecks} Retry the plan.`, validationIssues, validationIssueCount: issues.length }
}
