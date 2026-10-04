import { afterAll, expect, test, vi } from 'vitest';
import { createStudyConversation, deleteStudyConversation, getStudyConversation, acquireStudyLiveLease, releaseStudyLiveLease, appendStudyVoiceUsage, studyLiveLease } from '../server/services/studyRepository';
vi.stubGlobal('useRuntimeConfig', () => ({ flowstAuthMode: 'mock', awsRegion: 'us-east-1', public: { appSurface: 'flowst' } }));
afterAll(() => vi.unstubAllGlobals());
test('only one live call acquires a document; legacy voice is excluded and unknown Sonic cost stays unknown', async () => {
 const doc = await createStudyConversation('lease-owner', 'voice.pdf', 'application/pdf', Buffer.from('source'), { kind: 'PDF', excerpt: 'Plants', sections: [{ id: 'p1', label: 'Page 1', text: 'Plants use sunlight.' }] });
 const attempts = await Promise.allSettled([acquireStudyLiveLease('lease-owner', doc.id), acquireStudyLiveLease('lease-owner', doc.id)]);
 expect(attempts.filter(item => item.status === 'fulfilled')).toHaveLength(1);
 const lease = await studyLiveLease(doc.id); expect(lease).toBeDefined();
 await expect(acquireStudyLiveLease('another-owner', doc.id)).rejects.toMatchObject({ statusCode: 404 });
 await expect(appendStudyVoiceUsage('lease-owner', doc.id, { kind: 'TRANSCRIBE', units: 1, estimatedUsd: .0005 })).rejects.toMatchObject({ statusCode: 409 });
 await appendStudyVoiceUsage('lease-owner', doc.id, { kind: 'SONIC_INPUT', units: 2 });
 await appendStudyVoiceUsage('lease-owner', doc.id, { kind: 'SONIC_OUTPUT', units: 27 });
 expect((await getStudyConversation('lease-owner', doc.id)).voiceUsage).toEqual({ transcribeSeconds: 2, pollyCharacters: 27, estimatedUsd: undefined });
 await releaseStudyLiveLease(doc.id, 'wrong-lease'); expect(await studyLiveLease(doc.id)).toBeDefined();
 await releaseStudyLiveLease(doc.id, lease!.leaseId); expect(await studyLiveLease(doc.id)).toBeUndefined();
 await appendStudyVoiceUsage('lease-owner', doc.id, { kind: 'TRANSCRIBE', units: 1, estimatedUsd: .0005 });
 await deleteStudyConversation('lease-owner', doc.id);
});
