export interface StudyPacingState {
 recordingId?: string
 revision: string
 blockId: string
 objectiveId: string
 phase: 'PRACTICE' | 'BREAK_DUE' | 'BREAK' | 'PAUSED'
 pausedPhase?: 'PRACTICE' | 'BREAK_DUE' | 'BREAK'
 remainingMs: number
 startedAt: number
 breakEndsAt?: number
 breakSkippedAt?: number
 serverNow: number
}
export function pacingAt(state: StudyPacingState, now: number): StudyPacingState {
 const remainingMs=state.phase==='PRACTICE' ? Math.max(0,state.remainingMs-Math.max(0,now-state.startedAt)) : state.phase==='BREAK' ? Math.max(0,(state.breakEndsAt || now)-now) : state.remainingMs
 return {...state,remainingMs,startedAt:state.phase==='PRACTICE' ? now : state.startedAt,phase:state.phase==='PRACTICE' && remainingMs===0 ? 'BREAK_DUE' : state.phase,serverNow:now}
}
export function pacingResumePhase(state: StudyPacingState): Exclude<StudyPacingState['phase'],'PAUSED'> {
 return state.phase === 'PAUSED' ? state.pausedPhase || (state.breakEndsAt !== undefined ? 'BREAK' : state.remainingMs <= 0 ? 'BREAK_DUE' : 'PRACTICE') : state.phase
}
export function pausePacingState(state: StudyPacingState, now: number): StudyPacingState {
 const clock=pacingAt(state,now)
 return {...clock,phase:'PAUSED',pausedPhase:pacingResumePhase(clock),startedAt:now,serverNow:now}
}
export function resumePacingState(state: StudyPacingState, settings: {practiceMinutes:number;breakMinutes:number}, objectiveId: string, now: number, newBlockId: string): StudyPacingState {
 const clock=pacingAt(state,now),phase=pacingResumePhase(clock)
 if (phase === 'BREAK_DUE' || phase === 'BREAK' && clock.remainingMs > 0) {
  const remainingMs=phase === 'BREAK_DUE' ? settings.breakMinutes*60000 : clock.remainingMs
  const next:StudyPacingState={...clock,phase:'BREAK',remainingMs,startedAt:now,serverNow:now,breakEndsAt:clock.phase === 'BREAK' ? clock.breakEndsAt : now+remainingMs}
  delete next.pausedPhase
  return next
 }
 const resume=phase === 'PRACTICE' && clock.objectiveId === objectiveId
 return {revision:clock.revision,blockId:resume ? clock.blockId : newBlockId,objectiveId,phase:'PRACTICE',remainingMs:resume ? clock.remainingMs : settings.practiceMinutes*60000,startedAt:now,serverNow:now,...(resume && clock.recordingId ? {recordingId:clock.recordingId} : {})}
}
