# Generated storage access-pattern catalog

Status: static extraction of current code, not deployed table introspection or a complete physical schema. Regenerate with npm run docs:generate; do not hand-edit.

Application table uses pk/sk. Owner listing uses GSI2 where shown in code. Draft retention uses expiresAt; expiry units and application checks must be read in each record implementation. This catalog does not infer TTL policy or cloud provisioning from field names.

Proposed Kai/longitudinal entities are not added here unless implemented in these modules. Extraction parses TypeScript without executing application code, accessing credentials or calling a provider.

| Source location | Partition key | Sort key | Index fields on same object |
| --- | --- | --- | --- |
| [server/services/studyRepository.ts:129](../../server/services/studyRepository.ts#L129) | <code>`STUDY_UPLOAD#${ownerId}`</code> | <code>"ACTIVE"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:349](../../server/services/studyRepository.ts#L349) | <code>`STUDY#${id}`</code> | <code>"LIVE#VOICE"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:374](../../server/services/studyRepository.ts#L374) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:392](../../server/services/studyRepository.ts#L392) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:430](../../server/services/studyRepository.ts#L430) | <code>`STUDY#${id}`</code> | <code>`RECORDED#${recordingId}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:798](../../server/services/studyRepository.ts#L798) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>gsi2pk=`USER#${ownerId}`; gsi2sk=`STUDY#${now}#${id}`</code> |
| [server/services/studyRepository.ts:912](../../server/services/studyRepository.ts#L912) | <code>record.pk</code> | <code>`CHUNK#${String(chunk.position).padStart(4, "0")}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:938](../../server/services/studyRepository.ts#L938) | <code>record.pk</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:993](../../server/services/studyRepository.ts#L993) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1181](../../server/services/studyRepository.ts#L1181) | <code>`STUDY#${id}`</code> | <code>"VOICE#ALLOWANCE"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1211](../../server/services/studyRepository.ts#L1211) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1245](../../server/services/studyRepository.ts#L1245) | <code>`STUDY#${id}`</code> | <code>`USAGE#${item.createdAt}#${item.id}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1258](../../server/services/studyRepository.ts#L1258) | <code>`STUDY#${id}`</code> | <code>"LIVE#VOICE"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1267](../../server/services/studyRepository.ts#L1267) | <code>`STUDY#${id}`</code> | <code>"LIVE#VOICE"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1406](../../server/services/studyRepository.ts#L1406) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1530](../../server/services/studyRepository.ts#L1530) | <code>`STUDY#${id}`</code> | <code>`TURN#${turn.createdAt}#${turn.id}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1564](../../server/services/studyRepository.ts#L1564) | <code>`STUDY#${id}`</code> | <code>`TURN#${turn.createdAt}#${turn.id}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1618](../../server/services/studyRepository.ts#L1618) | <code>`STUDY#${id}`</code> | <code>`TRACE#${trace.id}#${trace.status}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1678](../../server/services/studyRepository.ts#L1678) | <code>'STUDY#' + id</code> | <code>'FLOW#' + operationId</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1739](../../server/services/studyRepository.ts#L1739) | <code>'AIRS_CONTEXT#' + ownerId</code> | <code>'PACING#' + id</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1940](../../server/services/studyRepository.ts#L1940) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1978](../../server/services/studyRepository.ts#L1978) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:2019](../../server/services/studyRepository.ts#L2019) | <code>item.pk</code> | <code>item.sk</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:2030](../../server/services/studyRepository.ts#L2030) | <code>record.pk</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:2056](../../server/services/studyRepository.ts#L2056) | <code>"STUDY#" + id</code> | <code>"LIVE#VOICE"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:2100](../../server/services/studyRepository.ts#L2100) | <code>"STUDY#" + id</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:2109](../../server/services/studyRepository.ts#L2109) | <code>"STUDY#" + id</code> | <code>"LIVE#VOICE"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:2139](../../server/services/studyRepository.ts#L2139) | <code>"STUDY#" + id</code> | <code>"LIVE#VOICE"</code> | <code>Not present in this object</code> |
| [server/services/sources/store.ts:14](../../server/services/sources/store.ts#L14) | <code>`STUDY_SOURCE#${id}`</code> | <code>'DRAFT'</code> | <code>Not present in this object</code> |
| [server/services/sources/store.ts:56](../../server/services/sources/store.ts#L56) | <code>`STUDY_SOURCE_LIMIT#${id}`</code> | <code>'USAGE'</code> | <code>Not present in this object</code> |
| [server/services/sources/store.ts:59](../../server/services/sources/store.ts#L59) | <code>`STUDY_SOURCE_LIMIT#${id}`</code> | <code>'USAGE'</code> | <code>Not present in this object</code> |
| [server/services/sources/store.ts:108](../../server/services/sources/store.ts#L108) | <code>`STUDY_UPLOAD#${record.ownerId}`</code> | <code>'ACTIVE'</code> | <code>Not present in this object</code> |
| [server/services/studySpeechCache.ts:44](../../server/services/studySpeechCache.ts#L44) | <code>`STUDY#${id}`</code> | <code>`SPEECH#${turnId}`</code> | <code>Not present in this object</code> |
| [server/services/studySpeechCache.ts:75](../../server/services/studySpeechCache.ts#L75) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studySpeechCache.ts:84](../../server/services/studySpeechCache.ts#L84) | <code>`STUDY#${id}`</code> | <code>`SPEECH#${turnId}`</code> | <code>Not present in this object</code> |

## Source fingerprints

- server/services/studyRepository.ts: 6f05d6d12b8f9e60a1dbd23059ffbb6f9b6afd89c507015c08e8a558acc5d590
- server/services/sources/store.ts: 09c553ad30a77fa09e552d796d479e1d986ca1a47d7492c6c80830c80dbc17f6
- server/services/airsContext.ts: a6b138269851bf07c38633d6bc98e5fe39118db250793d677bad34c669ddbbb4
- server/services/studySpeechCache.ts: d60810807f482c94539aac91427b662d881b88b21d1e51776b4bc32ec84a53b1
