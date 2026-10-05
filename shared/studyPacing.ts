export interface StudyPacingState {
 recordingId?: string
 revision: string
 blockId: string
 objectiveId: string
 phase: 'PRACTICE' | 'BREAK_DUE' | 'BREAK' | 'PAUSED'
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
