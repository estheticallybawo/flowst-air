import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import { z } from 'zod'
import { semanticEvidenceSchema } from '../../shared/studyObjectivePolicy'

// Turn attribution is assigned by the server after grounding, never by the model.
export const misuReviewSchema = semanticEvidenceSchema.omit({ learnerTurnIds: true })
export const misuReviewOutput = {
  name: 'submit_objective_evidence',
  description: 'Submit the evidence review of the saved answer against the approved target.',
  parameters: z.toJSONSchema(misuReviewSchema) as Record<string, unknown>,
}
const labels: Record<string, string> = {
  semanticAcceptance: 'acceptance decision', demonstrated: 'demonstrated meanings',
  unresolved: 'remaining meanings', reason: 'explanation', sourceRefs: 'source references',
  learnerQuotes: 'learner quotations', transcriptionUncertainty: 'transcription ambiguities',
  interactionState: 'interaction status',
}
type ReviewIssue = { field: string; reason: string; minimum?: number; maximum?: number; unit?: string }
export function misuReviewFailure(detail: string, issues: ReviewIssue[], issueCount = issues.length) {
  const reference = randomUUID()
  const data = { code: 'MISU_REVIEW_INVALID', stage: 'EVIDENCE_REVIEW', savedAnswer: true,
    reference, validationIssues: issues.slice(0, 4), validationIssueCount: issueCount }
  // Application-owned codes/fields only; no model output, learner content or source text.
  console.warn('Misu evidence review rejected', data)
  return createError({ statusCode: 502,
    statusMessage: `Misu could not review your saved answer: ${detail}. Retry saved response. Reference: ${reference}`,
    data })
}
export function parseMisuReview(result: string) {
  let proposal: unknown
  try { proposal = JSON.parse(result.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) }
  catch { throw misuReviewFailure('the review was not valid JSON', [{ field: 'review', reason: 'INVALID_JSON' }]) }
  const parsed = misuReviewSchema.safeParse(proposal)
  if (parsed.success) return parsed.data
  const issues = parsed.error.issues.map<ReviewIssue>(issue => {
    const key = String(issue.path[0] ?? '')
    const field = Object.hasOwn(labels, key) ? key : 'review'
    const value = field !== 'review' && proposal && typeof proposal === 'object' ? (proposal as Record<string, unknown>)[field] : proposal
    const reason = issue.code === 'unrecognized_keys' ? 'UNEXPECTED_FIELDS' : value === undefined ? 'MISSING_FIELD'
      : issue.code === 'too_big' || issue.code === 'too_small' ? 'OUTSIDE_LIMIT' : 'INVALID_VALUE'
    return { field, reason, ...(issue.code === 'too_big' ? { maximum: Number(issue.maximum), unit: issue.origin === 'array' ? 'items' : 'characters' }
      : issue.code === 'too_small' ? { minimum: Number(issue.minimum), unit: issue.origin === 'array' ? 'items' : 'characters' } : {}) }
  })
  const first = issues[0]!
  const label = labels[first.field] || 'review'
  const detail = first.reason === 'MISSING_FIELD' ? `the review is missing its ${label}`
    : first.reason === 'UNEXPECTED_FIELDS' ? 'the review contains unexpected fields'
    : first.reason === 'OUTSIDE_LIMIT' ? `the ${label} must contain ${first.maximum !== undefined ? 'at most '+first.maximum : 'at least '+first.minimum} ${(first.maximum ?? first.minimum) === 1 ? first.unit?.slice(0,-1) : first.unit}`
    : `the ${label} has an unsupported value or format`
  throw misuReviewFailure(detail, issues, parsed.error.issues.length)
}
