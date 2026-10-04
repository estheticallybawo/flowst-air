import { requireIdentity } from '../../../utils/auth'
import { extractStudyDocument } from '../../../services/studyExtraction'
import { assertStudyUploadAvailable } from '../../../services/studyRepository'
export default defineEventHandler(async event=>{
 const identity=await requireIdentity(event),standalone=['air','amira'].includes(useRuntimeConfig(event).public.appSurface)
 if(standalone)await assertStudyUploadAvailable(identity.userId,event)
 const max=standalone?4000000:20*1024*1024
 if(Number(getHeader(event,'content-length') || 0)>max+100000)throw createError({statusCode:413,statusMessage:'This document exceeds the upload limit.'})
 const parts=await readMultipartFormData(event)
 if((parts || []).reduce((total,part)=>total+part.data.length,0)>max+10000 || parts?.filter(part=>part.name==='file' && part.filename).length!==1)throw createError({statusCode:413,statusMessage:'Send one document within the upload limit.'})
 const file=parts?.find(part=>part.name==='file' && part.filename)
 if(!file?.filename || file.data.length>max)throw createError({statusCode:400,statusMessage:'Choose a supported document within the upload limit.'})
 const extraction=await extractStudyDocument(file.filename,file.data)
 return {name:file.filename,kind:extraction.kind,excerpt:extraction.excerpt,sectionCount:extraction.sections.length,sections:extraction.sections.slice(0,12).map(section=>({label:section.label,text:section.text.slice(0,1500)})),omissions:extraction.provenance?.omissions || []}
})
