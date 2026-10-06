import { requireIdentity } from '../../../../../utils/auth'
import { claimRecordedStudyTurn, failRecordedStudyTurn, getStudyConversation, getStudyObjectiveOperation } from '../../../../../services/studyRepository'
import { failAminaTurn, finishAminaTurn, prepareAminaTurn, streamAminaText } from '../../../../../services/studyAmina'
export default defineEventHandler(async event => {
  const identity = await requireIdentity(event), id = getRouterParam(event,'id') || ''
  const study = await getStudyConversation(identity.userId,id,event)
  const operationId = study.objectiveFlow?.interruptOperationId || study.objectiveFlow?.pendingOperationId
  if (!operationId) throw createError({statusCode:409,statusMessage:'There is no saved answer awaiting a response.'})
  const operation = await getStudyObjectiveOperation(identity.userId,id,operationId,event)
  if (!operation || operation.status === 'CANCELLED') throw createError({statusCode:409,statusMessage:'This answer is no longer pending.'})
  let claim
  if (operation.recordingHash) {
    const result = await claimRecordedStudyTurn(identity.userId,id,operation.id,operation.recordingHash,event)
    if (result.status === 'PROCESSING') throw createError({statusCode:409,statusMessage:'The original response is still processing. Wait before retrying.'})
    if (result.status === 'COMPLETE') return {userTurn:result.userTurn,agentTurn:result.agentTurn}
    claim = result.claim
  }
  let prepared: Awaited<ReturnType<typeof prepareAminaTurn>> | undefined
  try {
    prepared = await prepareAminaTurn(identity.userId,id,operation.userTurn.text,event,false,operation.id,claim,operation.control)
    let reply = ''
    for await (const chunk of streamAminaText(prepared.system,prepared.conversation.turns,operation.userTurn.text,event,prepared.sourceContext,prepared.objectiveOperation)) reply += chunk
    const agentTurn = await finishAminaTurn(identity.userId,id,prepared,reply,event,claim)
    setHeader(event,'Cache-Control','private, no-store')
    return {userTurn:prepared.userTurn,agentTurn}
  } catch (error) {
    if (prepared) await failAminaTurn(identity.userId,id,prepared,error,event)
    if (claim) await failRecordedStudyTurn(identity.userId,id,claim,event)
    throw error
  }
})
