import { airActionForRequest } from '../../shared/airAccess'
import { studyLiveLease } from '../services/studyRepository'
import { requireIdentity } from '../utils/auth'
export default defineEventHandler(async event => {
 const path = getRequestURL(event).pathname;
 const match = /^\/api\/study\/conversations\/([^/]+)\//.exec(path);
 if (!match || event.method !== 'POST' || (!airActionForRequest(event.method, path) && !/\/(mode|plan\/(approve|confirm))$/.test(path))) return;
 const identity = await requireIdentity(event);
 const lease = await studyLiveLease(match[1]!, event);
 if (lease?.ownerId === identity.userId) throw createError({ statusCode: 409, statusMessage: 'End your live call before changing the plan or using recorded voice.' });
});
