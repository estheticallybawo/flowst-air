import { createError } from 'h3'
import { z } from 'zod'
import { DEFAULT_STUDY_PREFERENCES, type StudyPreferences } from '../../shared/study'

const preferencesSchema = z.object({
  purpose: z.enum(['UNDERSTAND', 'EXAM', 'INTERVIEW', 'CONTENT_CREATION', 'OTHER']).default('UNDERSTAND'),
  scope: z.enum(['FOCUSED', 'BROAD']).default('FOCUSED'),
  timeBudgetMinutes: z.number().int().min(5).max(120).default(15),
  pacing: z.object({ mode: z.literal('TOPIC_BLOCKS'), practiceMinutes: z.number().int().min(5).max(15), breakMinutes: z.union([z.literal(3),z.literal(5)]) }).strict().optional(),
  context: z.string().trim().max(600).default(''),
}).strict().superRefine((value, context) => {
  if (value.purpose === 'OTHER' && !value.context) context.addIssue({ code: 'custom', path: ['context'], message: 'Tell Amina what you want from this session.' })
})

export function validateStudyPreferences(value: unknown): StudyPreferences {
  const parsed = preferencesSchema.safeParse(value === undefined ? { ...DEFAULT_STUDY_PREFERENCES } : value)
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0]
    const statusMessage = field === 'pacing' ? 'Choose 5–15 minutes per topic and a 3- or 5-minute break.' : field === 'timeBudgetMinutes' ? 'Choose a whole number of minutes between 5 and 120.'
      : field === 'context' ? 'Add a brief session goal, using no more than 600 characters.'
        : 'Choose a supported session purpose and focused or broad coverage.'
    throw createError({ statusCode: 400, statusMessage })
  }
  return parsed.data
}

export function readStudyPreferencesField(value?: Buffer): StudyPreferences {
  if (value === undefined) return validateStudyPreferences(undefined)
  if (value.length > 4000) throw createError({ statusCode: 400, statusMessage: 'Keep the session context brief.' })
  let preferences: unknown
  try { preferences = JSON.parse(value.toString('utf8')) }
  catch { throw createError({ statusCode: 400, statusMessage: 'Your session choices could not be read. Please try again.' }) }
  return validateStudyPreferences(preferences)
}
