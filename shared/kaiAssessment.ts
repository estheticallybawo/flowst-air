import { z } from 'zod'

export const KAI_ASSESSMENT_VERSION = '0.3' as const
export const KAI_VERBAL_DOMAINS = ['understanding', 'clarity', 'vocabulary', 'reasoning'] as const
export const KAI_VERBAL_LABELS: Record<typeof KAI_VERBAL_DOMAINS[number], string> = {
  understanding: 'Understanding', clarity: 'Clarity', vocabulary: 'Vocabulary and word choice', reasoning: 'Reasoning',
}
export const kaiLearnerQuoteSchema = z.object({ evidenceId: z.string().min(1), text: z.string().min(1).max(1000) }).strict()
export const kaiVerbalDomainSchema = z.object({
  domain: z.enum(KAI_VERBAL_DOMAINS),
  status: z.enum(['observed', 'partial', 'not_assessed']),
  summary: z.string().trim().min(1).max(500),
  kind: z.enum(['observation', 'inference']),
  uncertainty: z.string().trim().min(1).max(300).optional(),
  evidenceIds: z.array(z.string().min(1)).max(5),
  learnerQuotes: z.array(kaiLearnerQuoteSchema).max(5),
}).strict().superRefine((domain, context) => {
  if (domain.status === 'not_assessed') {
    if (domain.evidenceIds.length || domain.learnerQuotes.length || domain.kind !== 'observation')
      context.addIssue({ code: 'custom', message: 'An unassessed domain cannot contain a learning judgement or evidence claim.' })
  } else if (!domain.evidenceIds.length || !domain.learnerQuotes.length) {
    context.addIssue({ code: 'custom', message: 'An assessed domain requires learner quotes and evidence references.' })
  }
  if (domain.kind === 'inference' && !domain.uncertainty)
    context.addIssue({ code: 'custom', message: 'An inference needs its uncertainty.' })
})
export const kaiSessionAssessmentSchema = z.object({
  scope: z.literal('THIS_SESSION'),
  basis: z.literal('SAVED_LEARNER_TEXT'),
  domains: z.array(kaiVerbalDomainSchema).length(4).superRefine((domains, context) => {
    if (new Set(domains.map(domain => domain.domain)).size !== KAI_VERBAL_DOMAINS.length)
      context.addIssue({ code: 'custom', message: 'Each verbal domain must appear once.' })
  }),
}).strict()
export type KaiSessionAssessment = z.infer<typeof kaiSessionAssessmentSchema>
export type KaiLearnerQuote = z.infer<typeof kaiLearnerQuoteSchema>
export interface KaiAssessmentEvidence {
  attempt: string
  reasoningEligible: boolean
  semanticAcceptance?: 'met' | 'partial' | 'not_met'
  demonstrated?: string[]
  transcriptionUncertainty?: string[]
}
export function validateKaiTextObservation(text: string, kind?: 'observation' | 'inference', uncertainty?: string) {
  if (kind === 'inference' && !uncertainty?.trim()) throw new Error('An inference needs its uncertainty.')
  if (/\b(?:your|the learner['’]s) (?:voice|accent|pronunciation|intonation|volume|speaking (?:rate|pace|tempo)) (?:is|was|sounds?|sounded|seems?|seemed|improved|became)\b|\byou (?:spoke|sounded) (?:clearly|fluently|confidently|slowly|quickly|loudly|softly|nervously)\b/i.test(text))
    throw new Error('Text evidence cannot support an audio delivery judgement.')
}

/** A review can cite only exact text from this session's reviewed evidence packet. */
export function validateKaiLearnerQuotes(
  evidenceIds: string[], quotes: KaiLearnerQuote[], evidence: ReadonlyMap<string, KaiAssessmentEvidence>,
) {
  if (evidenceIds.some(id => !evidence.has(id)) || quotes.some(quote =>
    !evidenceIds.includes(quote.evidenceId) || !quote.text.trim() || !evidence.get(quote.evidenceId)?.attempt.includes(quote.text),
  ) || evidenceIds.some(id => !quotes.some(quote => quote.evidenceId === id)))
    throw new Error('Kai referenced an unavailable learner quote.')
}

export function validateKaiSessionAssessment(assessment: KaiSessionAssessment, evidence: ReadonlyMap<string, KaiAssessmentEvidence>) {
  for (const domain of assessment.domains) {
    if (domain.status === 'not_assessed') continue
    validateKaiLearnerQuotes(domain.evidenceIds, domain.learnerQuotes, evidence)
    const cited = domain.evidenceIds.map(id => evidence.get(id)!)
    if (domain.domain === 'reasoning' && !cited.some(item => item.reasoningEligible))
      throw new Error('Reasoning was not elicited by the reviewed activity.')
    if (domain.domain === 'understanding' && cited.some(item => item.semanticAcceptance === undefined) && domain.kind !== 'inference')
      throw new Error('Historical understanding without semantic review must be labelled as an inference.')
    if (domain.domain === 'understanding' && domain.status === 'observed' && cited.every(item => item.semanticAcceptance !== undefined && item.semanticAcceptance !== 'met'))
      throw new Error('An unresolved semantic review cannot establish demonstrated understanding.')
    if (domain.domain === 'understanding' && domain.status === 'partial' && cited.every(item => item.semanticAcceptance !== undefined && !item.demonstrated?.length))
      throw new Error('Partial understanding needs a demonstrated meaning from the saved semantic review.')
    if (cited.some(item => item.transcriptionUncertainty?.length) && domain.kind !== 'inference')
      throw new Error('Material transcription uncertainty cannot support a confident observation.')
    validateKaiTextObservation(domain.summary, domain.kind, domain.uncertainty)
  }
  return assessment
}

export function unassessedKaiSession(reason: string): KaiSessionAssessment {
  return { scope: 'THIS_SESSION', basis: 'SAVED_LEARNER_TEXT', domains: KAI_VERBAL_DOMAINS.map(domain => ({
    domain, status: 'not_assessed', summary: reason, kind: 'observation', evidenceIds: [], learnerQuotes: [],
  })) }
}
