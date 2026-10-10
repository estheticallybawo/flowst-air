import { isAirGrowthPreview } from "../utils/airGrowthPreview"
import { guestMode, guestStudyPath, getGuestSession } from '../utils/airsGuest'
export default defineEventHandler(event=>{
  if(isAirGrowthPreview(event) || !guestMode(event)) return
  setHeader(event,'Cache-Control','private, no-store')
  const url=getRequestURL(event)
  if(!url.pathname.startsWith('/api/') && getHeader(event,'accept')?.includes('text/html')) { const session=getGuestSession(event,true); if(session) event.node.req.headers.cookie=(event.node.req.headers.cookie || '').split(';').filter(part=>!part.trim().startsWith('airs_guest=')).join(';')+'; airs_guest='+session.token }
  if(!['GET','HEAD','OPTIONS'].includes(event.method) && (guestStudyPath(url.pathname)||url.pathname==='/api/auth/session')){
    const origin=getHeader(event,'origin')
    if(origin && origin!==url.origin) throw createError({statusCode:403,statusMessage:'Open this action from your Airs session.'})
  }
})
