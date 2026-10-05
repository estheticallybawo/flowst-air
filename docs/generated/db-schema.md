# Generated storage access-pattern catalog

Status: static extraction of current code, not deployed table introspection or a complete physical schema. Regenerate with npm run docs:generate; do not hand-edit.

Application table uses pk/sk. Owner listing uses GSI2 where shown in code. Draft retention uses expiresAt; expiry units and application checks must be read in each record implementation. This catalog does not infer TTL policy or cloud provisioning from field names.

Proposed Kai/longitudinal entities are not added here unless implemented in these modules. Extraction parses TypeScript without executing application code, accessing credentials or calling a provider.

| Source location | Partition key | Sort key | Index fields on same object |
| --- | --- | --- | --- |
| [server/services/studyRepository.ts:120](../../server/services/studyRepository.ts#L120) | <code>`STUDY_UPLOAD#${ownerId}`</code> | <code>"ACTIVE"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:340](../../server/services/studyRepository.ts#L340) | <code>`STUDY#${id}`</code> | <code>"LIVE#VOICE"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:365](../../server/services/studyRepository.ts#L365) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:383](../../server/services/studyRepository.ts#L383) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:421](../../server/services/studyRepository.ts#L421) | <code>`STUDY#${id}`</code> | <code>`RECORDED#${recordingId}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:789](../../server/services/studyRepository.ts#L789) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>gsi2pk=`USER#${ownerId}`; gsi2sk=`STUDY#${now}#${id}`</code> |
| [server/services/studyRepository.ts:905](../../server/services/studyRepository.ts#L905) | <code>record.pk</code> | <code>`CHUNK#${String(chunk.position).padStart(4, "0")}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:931](../../server/services/studyRepository.ts#L931) | <code>record.pk</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:986](../../server/services/studyRepository.ts#L986) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1128](../../server/services/studyRepository.ts#L1128) | <code>`STUDY#${id}`</code> | <code>"VOICE#ALLOWANCE"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1142](../../server/services/studyRepository.ts#L1142) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1146](../../server/services/studyRepository.ts#L1146) | <code>`STUDY#${id}`</code> | <code>`USAGE#${item.createdAt}#${item.id}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1149](../../server/services/studyRepository.ts#L1149) | <code>`STUDY#${id}`</code> | <code>"LIVE#VOICE"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1151](../../server/services/studyRepository.ts#L1151) | <code>`STUDY#${id}`</code> | <code>"LIVE#VOICE"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1256](../../server/services/studyRepository.ts#L1256) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1380](../../server/services/studyRepository.ts#L1380) | <code>`STUDY#${id}`</code> | <code>`TURN#${turn.createdAt}#${turn.id}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1414](../../server/services/studyRepository.ts#L1414) | <code>`STUDY#${id}`</code> | <code>`TURN#${turn.createdAt}#${turn.id}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1468](../../server/services/studyRepository.ts#L1468) | <code>`STUDY#${id}`</code> | <code>`TRACE#${trace.id}#${trace.status}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1714](../../server/services/studyRepository.ts#L1714) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1752](../../server/services/studyRepository.ts#L1752) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1788](../../server/services/studyRepository.ts#L1788) | <code>item.pk</code> | <code>item.sk</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1818](../../server/services/studyRepository.ts#L1818) | <code>"STUDY#" + id</code> | <code>"LIVE#VOICE"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1862](../../server/services/studyRepository.ts#L1862) | <code>"STUDY#" + id</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1871](../../server/services/studyRepository.ts#L1871) | <code>"STUDY#" + id</code> | <code>"LIVE#VOICE"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1901](../../server/services/studyRepository.ts#L1901) | <code>"STUDY#" + id</code> | <code>"LIVE#VOICE"</code> | <code>Not present in this object</code> |
| [server/services/sources/store.ts:14](../../server/services/sources/store.ts#L14) | <code>`STUDY_SOURCE#${id}`</code> | <code>'DRAFT'</code> | <code>Not present in this object</code> |
| [server/services/sources/store.ts:56](../../server/services/sources/store.ts#L56) | <code>`STUDY_SOURCE_LIMIT#${id}`</code> | <code>'USAGE'</code> | <code>Not present in this object</code> |
| [server/services/sources/store.ts:59](../../server/services/sources/store.ts#L59) | <code>`STUDY_SOURCE_LIMIT#${id}`</code> | <code>'USAGE'</code> | <code>Not present in this object</code> |
| [server/services/sources/store.ts:108](../../server/services/sources/store.ts#L108) | <code>`STUDY_UPLOAD#${record.ownerId}`</code> | <code>'ACTIVE'</code> | <code>Not present in this object</code> |
| [server/services/studySpeechCache.ts:43](../../server/services/studySpeechCache.ts#L43) | <code>`STUDY#${id}`</code> | <code>`SPEECH#${turnId}`</code> | <code>Not present in this object</code> |
| [server/services/studySpeechCache.ts:74](../../server/services/studySpeechCache.ts#L74) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studySpeechCache.ts:83](../../server/services/studySpeechCache.ts#L83) | <code>`STUDY#${id}`</code> | <code>`SPEECH#${turnId}`</code> | <code>Not present in this object</code> |

## Source fingerprints

- server/services/studyRepository.ts: ae8937005f14603b5ad3172dfd8d9a28fbbf54085c2da44cb639db8ccf3b07b6
- server/services/sources/store.ts: 09c553ad30a77fa09e552d796d479e1d986ca1a47d7492c6c80830c80dbc17f6
- server/services/airsContext.ts: ab93383d2287a0cc4570568acc8a070d754448e46b6f73774a36131217658b3d
- server/services/studySpeechCache.ts: 731d50823ea2f6c4f3b2079a2277949f7c7af3b371afc585d5b55ca101533f4e
