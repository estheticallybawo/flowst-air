import { createError } from 'h3'
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto'
import { getCookie, setCookie } from 'h3'
import type { H3Event } from 'h3'
const developmentSecret=randomBytes(32).toString('hex')
export function guestMode(event?:H3Event) {
  const c=useRuntimeConfig(event)
  return c.public.appSurface==='air' && c.public.airsGuestEnabled===true
}
function secret(event?:H3Event) {
  const configured=String(useRuntimeConfig(event).airsGuestSecret || '')
  if(configured.length>=32) return configured
  if(process.env.NODE_ENV!=='production') return developmentSecret
  throw createError({statusCode:503,statusMessage:'The private guest-session key is not configured.'})
}
export function verifyGuestToken(token:string,event?:H3Event) {
  if(!guestMode(event)) return null
  const [id,expiry,signature,...extra]=token.split('.')
  if(extra.length || !/^guest-[a-f0-9]{48}$/.test(id||'') || !/^\d+$/.test(expiry||'') || Number(expiry)<Date.now()/1000 || Number(expiry)>Date.now()/1000+86410 || !/^[a-f0-9]{64}$/.test(signature||'')) return null
  const expected=createHmac('sha256',secret(event)).update(id+'.'+expiry).digest()
  if(!timingSafeEqual(expected,Buffer.from(signature!,'hex'))) return null
  return {userId:id!,email:''}
}
export function getGuestSession(event:H3Event,create=false) {
  if(!guestMode(event)) return null
  let token=getCookie(event,'airs_guest') || ''
  let identity=verifyGuestToken(token,event)
  if(!identity && create){
    const id='guest-'+randomBytes(24).toString('hex'),expiry=String(Math.floor(Date.now()/1000)+86400)
    token=id+'.'+expiry+'.'+createHmac('sha256',secret(event)).update(id+'.'+expiry).digest('hex')
    setCookie(event,'airs_guest',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:86400})
    identity={userId:id,email:''}
  }
  return identity ? {identity,token} : null
}
export function guestStudyPath(path:string){return path.startsWith('/api/study/') || ['/api/air/access','/api/airs/access','/api/amira/access'].includes(path)}
