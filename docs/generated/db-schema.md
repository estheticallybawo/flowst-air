# Generated storage access-pattern catalog

Status: static extraction of current code, not deployed table introspection or a complete physical schema. Regenerate with npm run docs:generate; do not hand-edit.

Application table uses pk/sk. Owner listing uses GSI2 where shown in code. Draft retention uses expiresAt; expiry units and application checks must be read in each record implementation. This catalog does not infer TTL policy or cloud provisioning from field names.

Proposed Kai/longitudinal entities are not added here unless implemented in these modules. Extraction parses TypeScript without executing application code, accessing credentials or calling a provider.

| Source location | Partition key | Sort key | Index fields on same object |
| --- | --- | --- | --- |
| [server/services/studyRepository.ts:131](../../server/services/studyRepository.ts#L131) | <code>`STUDY_UPLOAD#${ownerId}`</code> | <code>"ACTIVE"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:351](../../server/services/studyRepository.ts#L351) | <code>`STUDY#${id}`</code> | <code>"LIVE#VOICE"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:376](../../server/services/studyRepository.ts#L376) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:394](../../server/services/studyRepository.ts#L394) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:432](../../server/services/studyRepository.ts#L432) | <code>`STUDY#${id}`</code> | <code>`RECORDED#${recordingId}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:803](../../server/services/studyRepository.ts#L803) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>gsi2pk=`USER#${ownerId}`; gsi2sk=`STUDY#${now}#${id}`</code> |
| [server/services/studyRepository.ts:918](../../server/services/studyRepository.ts#L918) | <code>record.pk</code> | <code>`CHUNK#${String(chunk.position).padStart(4, "0")}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:944](../../server/services/studyRepository.ts#L944) | <code>record.pk</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1012](../../server/services/studyRepository.ts#L1012) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1081](../../server/services/studyRepository.ts#L1081) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1099](../../server/services/studyRepository.ts#L1099) | <code>record.pk</code> | <code>`CHUNK#${String(chunk.position).padStart(4, "0")}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1111](../../server/services/studyRepository.ts#L1111) | <code>record.pk</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1256](../../server/services/studyRepository.ts#L1256) | <code>`STUDY#${id}`</code> | <code>"VOICE#ALLOWANCE"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1286](../../server/services/studyRepository.ts#L1286) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1320](../../server/services/studyRepository.ts#L1320) | <code>`STUDY#${id}`</code> | <code>`USAGE#${item.createdAt}#${item.id}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1333](../../server/services/studyRepository.ts#L1333) | <code>`STUDY#${id}`</code> | <code>"LIVE#VOICE"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1342](../../server/services/studyRepository.ts#L1342) | <code>`STUDY#${id}`</code> | <code>"LIVE#VOICE"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1481](../../server/services/studyRepository.ts#L1481) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1606](../../server/services/studyRepository.ts#L1606) | <code>`STUDY#${id}`</code> | <code>`TURN#${turn.createdAt}#${turn.id}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1640](../../server/services/studyRepository.ts#L1640) | <code>`STUDY#${id}`</code> | <code>`TURN#${turn.createdAt}#${turn.id}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1694](../../server/services/studyRepository.ts#L1694) | <code>`STUDY#${id}`</code> | <code>`TRACE#${trace.id}#${trace.status}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1754](../../server/services/studyRepository.ts#L1754) | <code>'STUDY#' + id</code> | <code>'FLOW#' + operationId</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1815](../../server/services/studyRepository.ts#L1815) | <code>'AIRS_CONTEXT#' + ownerId</code> | <code>'PACING#' + id</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:2016](../../server/services/studyRepository.ts#L2016) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:2054](../../server/services/studyRepository.ts#L2054) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:2095](../../server/services/studyRepository.ts#L2095) | <code>item.pk</code> | <code>item.sk</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:2106](../../server/services/studyRepository.ts#L2106) | <code>record.pk</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:2132](../../server/services/studyRepository.ts#L2132) | <code>"STUDY#" + id</code> | <code>"LIVE#VOICE"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:2176](../../server/services/studyRepository.ts#L2176) | <code>"STUDY#" + id</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:2185](../../server/services/studyRepository.ts#L2185) | <code>"STUDY#" + id</code> | <code>"LIVE#VOICE"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:2215](../../server/services/studyRepository.ts#L2215) | <code>"STUDY#" + id</code> | <code>"LIVE#VOICE"</code> | <code>Not present in this object</code> |
| [server/services/sources/store.ts:14](../../server/services/sources/store.ts#L14) | <code>`STUDY_SOURCE#${id}`</code> | <code>'DRAFT'</code> | <code>Not present in this object</code> |
| [server/services/sources/store.ts:56](../../server/services/sources/store.ts#L56) | <code>`STUDY_SOURCE_LIMIT#${id}`</code> | <code>'USAGE'</code> | <code>Not present in this object</code> |
| [server/services/sources/store.ts:59](../../server/services/sources/store.ts#L59) | <code>`STUDY_SOURCE_LIMIT#${id}`</code> | <code>'USAGE'</code> | <code>Not present in this object</code> |
| [server/services/sources/store.ts:108](../../server/services/sources/store.ts#L108) | <code>`STUDY_UPLOAD#${record.ownerId}`</code> | <code>'ACTIVE'</code> | <code>Not present in this object</code> |
| [server/services/studySpeechCache.ts:46](../../server/services/studySpeechCache.ts#L46) | <code>`STUDY#${id}`</code> | <code>`SPEECH#${turnId}`</code> | <code>Not present in this object</code> |
| [server/services/studySpeechCache.ts:77](../../server/services/studySpeechCache.ts#L77) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studySpeechCache.ts:86](../../server/services/studySpeechCache.ts#L86) | <code>`STUDY#${id}`</code> | <code>`SPEECH#${turnId}`</code> | <code>Not present in this object</code> |

## Source fingerprints

- server/services/studyRepository.ts: d45a583a13b92b30092cbec30011c8bef127e8018869603fe78444d839388d8a
- server/services/sources/store.ts: 09c553ad30a77fa09e552d796d479e1d986ca1a47d7492c6c80830c80dbc17f6
- server/services/airsContext.ts: a6b138269851bf07c38633d6bc98e5fe39118db250793d677bad34c669ddbbb4
- server/services/studySpeechCache.ts: 8e25ba02ced4e14df94f16191743fc8c28c639448fc34b7173b8bb780c0d5850
