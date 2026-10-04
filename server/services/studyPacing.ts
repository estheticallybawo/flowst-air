import {randomUUID} from 'node:crypto'
import {createError} from 'h3'
import type {H3Event} from 'h3'
import type {StudyConversation} from '../../shared/study'
import {pacingAt,type StudyPacingState} from '../../shared/studyPacing'
import {readAirsArtifact,writeAirsArtifact} from './airsContext'
import {assertStudyConversationActive,getStudyConversation} from './studyRepository'
export async function getStudyPacing(owner:string,id:string,event?:H3Event){
 const state=await readAirsArtifact<StudyPacingState>(owner,'PACING#'+id,event)
 return state ? pacingAt(state,Date.now()) : null
}
export async function changeStudyPacing(owner:string,id:string,action:'START'|'BREAK'|'RESUME'|'PAUSE'|'RECORD',revision:string,event?:H3Event,recordingId?:string){
 const study=await getStudyConversation(owner,id,event);assertStudyConversationActive(study)
 const pacing=study.plan.pacing
 if(study.plan.status!=='APPROVED' || !pacing || !study.plan.activeObjectiveId)throw createError({statusCode:409,statusMessage:'An approved timed plan is required.'})
 const current=await getStudyPacing(owner,id,event),now=Date.now()
 if((current?.revision || '')!==revision)throw createError({statusCode:409,statusMessage:'Your practice timer changed. Reload its current state.'})
 let next:StudyPacingState
 if(action==='RECORD'){
  if(current?.phase!=='PRACTICE' || !recordingId)throw createError({statusCode:409,statusMessage:'Start a recording within the current practice block.'})
  next={...current,recordingId,startedAt:now,serverNow:now}
 } else if(action==='BREAK'){
  if(current?.phase==='BREAK')return current
  if(current?.phase!=='BREAK_DUE')throw createError({statusCode:409,statusMessage:'Finish the practice block before starting its break.'})
  next={...current,phase:'BREAK',remainingMs:pacing.breakMinutes*60000,startedAt:now,breakEndsAt:now+pacing.breakMinutes*60000,serverNow:now}
 } else if(action==='PAUSE'){
  if(!current || current.phase==='BREAK' || current.phase==='BREAK_DUE' || current.phase==='PAUSED')return current
  next={...current,phase:'PAUSED',startedAt:now,serverNow:now}
 } else {
  if(current?.phase==='PRACTICE')return current
  if(current?.phase==='BREAK_DUE' || current?.phase==='BREAK' && current.remainingMs>0)throw createError({statusCode:409,statusMessage:'Your break is not finished. Resume when it is ready.'})
  const resume=current?.phase==='PAUSED' && current.objectiveId===study.plan.activeObjectiveId
  next={revision:'',blockId:resume?current.blockId:randomUUID(),objectiveId:study.plan.activeObjectiveId,phase:'PRACTICE',remainingMs:resume?current.remainingMs:pacing.practiceMinutes*60000,startedAt:now,serverNow:now}
 }
 next.revision=randomUUID()
 await writeAirsArtifact(owner,'PACING#'+id,next,event,revision)
 return next
}
/** Breaks gate new work; elapsed time alone never grants assessment completion. */
export async function assertStudyPacingOpen(study:StudyConversation,event?:H3Event,recordingId?:string){
 if(!study.plan.pacing)return
 const state=await getStudyPacing(study.ownerId,study.id,event)
 if(!state || state.phase==='BREAK' || state.phase==='PAUSED' || state.phase==='BREAK_DUE' && (!recordingId || state.recordingId!==recordingId))throw createError({statusCode:409,statusMessage:'Resume your practice block before asking Amina for another turn.'})
 // Only a take reserved before the deadline may finish; new turns are blocked.
 return state
}
