export interface SpeechAlignment { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] }
export interface TimedStudySpeech { audioBase64: string; mimeType: 'audio/mpeg'; spokenText: string; alignment: SpeechAlignment | null }
export function validSpeechAlignment(value:unknown):SpeechAlignment|null {
 const a=value as SpeechAlignment | undefined
 if(!a || !Array.isArray(a.characters) || !a.characters.length || a.characters.length>10000 || !Array.isArray(a.character_start_times_seconds) || !Array.isArray(a.character_end_times_seconds) || a.characters.length!==a.character_start_times_seconds.length || a.characters.length!==a.character_end_times_seconds.length)return null
 for(let i=0;i<a.characters.length;i++)if(typeof a.characters[i]!=='string' || a.characters[i]!.length>8 || !Number.isFinite(a.character_start_times_seconds[i]) || !Number.isFinite(a.character_end_times_seconds[i]) || a.character_start_times_seconds[i]!<0 || a.character_end_times_seconds[i]!<a.character_start_times_seconds[i]! || a.character_end_times_seconds[i]!>600 || i>0 && a.character_start_times_seconds[i]!<a.character_start_times_seconds[i-1]!)return null
 return a
}
export function spokenCaption(alignment:SpeechAlignment|null,text:string,currentTime:number){
 if(!alignment)return text
 let end=0
 while(end<alignment.characters.length && alignment.character_start_times_seconds[end]!<=currentTime)end++
 return alignment.characters.slice(0,end).join('')
}
