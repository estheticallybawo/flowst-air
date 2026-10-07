import { describe, expect, it } from 'vitest'
import { kaiReviewSchema, kaiReviewV03Schema } from '../shared/airsOrchestration'
import { kaiSessionAssessmentSchema, unassessedKaiSession, validateKaiLearnerQuotes, validateKaiSessionAssessment, validateKaiTextObservation, type KaiAssessmentEvidence } from '../shared/kaiAssessment'

const text='One shared reference avoids conflicting instructions because each team uses the same design.'
const evidence=new Map<string,KaiAssessmentEvidence>([['saved',{attempt:text,reasoningEligible:true,semanticAcceptance:'met',transcriptionUncertainty:[]}]])
function assessed(domain:'understanding'|'clarity'|'vocabulary'|'reasoning'='understanding') {
  const assessment=unassessedKaiSession('This activity did not establish this domain.')
  Object.assign(assessment.domains.find(item=>item.domain===domain)!,{status:'observed',summary:'The saved explanation describes the shared reference.',evidenceIds:['saved'],learnerQuotes:[{evidenceId:'saved',text}]})
  return assessment
}
describe('Kai verbal feedback evidence boundaries',()=>{
  it('keeps legacy feedback readable and requires the richer contract for new proposals',()=>{
    const legacy={observations:[{text:'A saved explanation.',criterionId:'ACCURACY',evidenceIds:['saved']}],notAssessed:[],nextPractice:{goal:'Explain the source',exercise:'Use a new example later.',evidenceIds:['saved']}}
    expect(kaiReviewSchema.safeParse(legacy).success).toBe(true)
    expect(kaiReviewV03Schema.safeParse(legacy).success).toBe(false)
    const rich={...legacy,observations:[],sessionAssessment:unassessedKaiSession('No task established these domains.')}
    expect(kaiReviewV03Schema.safeParse(rich).success).toBe(true)
    expect(kaiReviewV03Schema.safeParse({...rich,score:90}).success).toBe(false)
  })
  it('requires exactly four distinct domains and evidence for every assessed domain',()=>{
    expect(kaiSessionAssessmentSchema.safeParse(assessed()).success).toBe(true)
    const duplicate=assessed();duplicate.domains[3]=duplicate.domains[0]!
    expect(kaiSessionAssessmentSchema.safeParse(duplicate).success).toBe(false)
    const missing=assessed();missing.domains[0]!.learnerQuotes=[]
    expect(kaiSessionAssessmentSchema.safeParse(missing).success).toBe(false)
    const invented=unassessedKaiSession('Not assessed.');invented.domains[0]!.evidenceIds=['saved']
    expect(kaiSessionAssessmentSchema.safeParse(invented).success).toBe(false)
  })
  it('grounds quotes in exact saved learner text and their corresponding evidence IDs',()=>{
    expect(()=>validateKaiSessionAssessment(assessed(),evidence)).not.toThrow()
    expect(()=>validateKaiLearnerQuotes(['saved'],[{evidenceId:'saved',text:'A source sentence the learner did not say.'}],evidence)).toThrow()
    expect(()=>validateKaiLearnerQuotes(['saved'],[{evidenceId:'source-id',text}],evidence)).toThrow()
    expect(()=>validateKaiLearnerQuotes(['saved'],[{evidenceId:'saved',text:'   '}],evidence)).toThrow()
    expect(()=>validateKaiLearnerQuotes(['saved','other'],[{evidenceId:'saved',text}],evidence)).toThrow()
  })
  it('allows reasoning only when the cited approved activity elicited it',()=>{
    expect(()=>validateKaiSessionAssessment(assessed('reasoning'),evidence)).not.toThrow()
    const comprehension=new Map(evidence);comprehension.set('saved',{...evidence.get('saved')!,reasoningEligible:false})
    expect(()=>validateKaiSessionAssessment(assessed('reasoning'),comprehension)).toThrow(/not elicited/)
    expect(()=>validateKaiSessionAssessment(unassessedKaiSession('Reasoning was not elicited.'),comprehension)).not.toThrow()
  })
  it('labels historical interpretation as inference and preserves material transcription uncertainty',()=>{
    const historical=new Map(evidence);historical.set('saved',{attempt:text,reasoningEligible:true})
    const review=assessed()
    expect(()=>validateKaiSessionAssessment(review,historical)).toThrow(/Historical/)
    Object.assign(review.domains[0]!,{kind:'inference',uncertainty:'The historical semantic assessment is unavailable.'})
    expect(()=>validateKaiSessionAssessment(review,historical)).not.toThrow()
    const noisy=new Map(evidence);noisy.set('saved',{...evidence.get('saved')!,transcriptionUncertainty:['The key term is uncertain.']})
    expect(()=>validateKaiSessionAssessment(assessed('clarity'),noisy)).toThrow(/uncertainty/)
    expect(()=>validateKaiSessionAssessment(review,noisy)).not.toThrow()
  })
  it('does not present an unresolved semantic review as demonstrated understanding',()=>{
    const unresolved=new Map(evidence);unresolved.set('saved',{...evidence.get('saved')!,semanticAcceptance:'not_met'})
    expect(()=>validateKaiSessionAssessment(assessed(),unresolved)).toThrow(/unresolved/)
    const partial=assessed();partial.domains[0]!.status='partial'
    expect(()=>validateKaiSessionAssessment(partial,unresolved)).toThrow(/demonstrated meaning/)
    unresolved.set('saved',{...unresolved.get('saved')!,demonstrated:['A shared reference supports consistency.']})
    expect(()=>validateKaiSessionAssessment(partial,unresolved)).not.toThrow()
  })
  it('rejects direct audio delivery judgements while allowing discussion of a source topic',()=>{
    expect(()=>validateKaiTextObservation('Your pronunciation was clear.')).toThrow(/audio/)
    expect(()=>validateKaiTextObservation('You spoke fluently.')).toThrow(/audio/)
    expect(()=>validateKaiTextObservation('You spoke about the shared reference.')).not.toThrow()
    expect(()=>validateKaiTextObservation('A possible reading.','inference')).toThrow(/uncertainty/)
  })
  it('represents zero evidence as four unassessed domains without quotes or learning claims',()=>{
    const closure=unassessedKaiSession('No reviewed learning evidence is available from this session.')
    expect(closure.domains.map(item=>item.status)).toEqual(Array(4).fill('not_assessed'))
    expect(closure.domains.every(item=>!item.evidenceIds.length && !item.learnerQuotes.length)).toBe(true)
    expect(()=>validateKaiSessionAssessment(kaiSessionAssessmentSchema.parse(closure),new Map())).not.toThrow()
  })
})
