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
| [server/services/studyRepository.ts:799](../../server/services/studyRepository.ts#L799) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>gsi2pk=`USER#${ownerId}`; gsi2sk=`STUDY#${now}#${id}`</code> |
| [server/services/studyRepository.ts:913](../../server/services/studyRepository.ts#L913) | <code>record.pk</code> | <code>`CHUNK#${String(chunk.position).padStart(4, "0")}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:939](../../server/services/studyRepository.ts#L939) | <code>record.pk</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:994](../../server/services/studyRepository.ts#L994) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1063](../../server/services/studyRepository.ts#L1063) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1081](../../server/services/studyRepository.ts#L1081) | <code>record.pk</code> | <code>`CHUNK#${String(chunk.position).padStart(4, "0")}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1093](../../server/services/studyRepository.ts#L1093) | <code>record.pk</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1238](../../server/services/studyRepository.ts#L1238) | <code>`STUDY#${id}`</code> | <code>"VOICE#ALLOWANCE"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1268](../../server/services/studyRepository.ts#L1268) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1302](../../server/services/studyRepository.ts#L1302) | <code>`STUDY#${id}`</code> | <code>`USAGE#${item.createdAt}#${item.id}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1315](../../server/services/studyRepository.ts#L1315) | <code>`STUDY#${id}`</code> | <code>"LIVE#VOICE"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1324](../../server/services/studyRepository.ts#L1324) | <code>`STUDY#${id}`</code> | <code>"LIVE#VOICE"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1463](../../server/services/studyRepository.ts#L1463) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1588](../../server/services/studyRepository.ts#L1588) | <code>`STUDY#${id}`</code> | <code>`TURN#${turn.createdAt}#${turn.id}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1622](../../server/services/studyRepository.ts#L1622) | <code>`STUDY#${id}`</code> | <code>`TURN#${turn.createdAt}#${turn.id}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1676](../../server/services/studyRepository.ts#L1676) | <code>`STUDY#${id}`</code> | <code>`TRACE#${trace.id}#${trace.status}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1736](../../server/services/studyRepository.ts#L1736) | <code>'STUDY#' + id</code> | <code>'FLOW#' + operationId</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1797](../../server/services/studyRepository.ts#L1797) | <code>'AIRS_CONTEXT#' + ownerId</code> | <code>'PACING#' + id</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:1998](../../server/services/studyRepository.ts#L1998) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:2036](../../server/services/studyRepository.ts#L2036) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:2077](../../server/services/studyRepository.ts#L2077) | <code>item.pk</code> | <code>item.sk</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:2088](../../server/services/studyRepository.ts#L2088) | <code>record.pk</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:2114](../../server/services/studyRepository.ts#L2114) | <code>"STUDY#" + id</code> | <code>"LIVE#VOICE"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:2158](../../server/services/studyRepository.ts#L2158) | <code>"STUDY#" + id</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:2167](../../server/services/studyRepository.ts#L2167) | <code>"STUDY#" + id</code> | <code>"LIVE#VOICE"</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:2197](../../server/services/studyRepository.ts#L2197) | <code>"STUDY#" + id</code> | <code>"LIVE#VOICE"</code> | <code>Not present in this object</code> |
| [server/services/sources/store.ts:14](../../server/services/sources/store.ts#L14) | <code>`STUDY_SOURCE#${id}`</code> | <code>'DRAFT'</code> | <code>Not present in this object</code> |
| [server/services/sources/store.ts:56](../../server/services/sources/store.ts#L56) | <code>`STUDY_SOURCE_LIMIT#${id}`</code> | <code>'USAGE'</code> | <code>Not present in this object</code> |
| [server/services/sources/store.ts:59](../../server/services/sources/store.ts#L59) | <code>`STUDY_SOURCE_LIMIT#${id}`</code> | <code>'USAGE'</code> | <code>Not present in this object</code> |
| [server/services/sources/store.ts:108](../../server/services/sources/store.ts#L108) | <code>`STUDY_UPLOAD#${record.ownerId}`</code> | <code>'ACTIVE'</code> | <code>Not present in this object</code> |
| [server/services/studySpeechCache.ts:44](../../server/services/studySpeechCache.ts#L44) | <code>`STUDY#${id}`</code> | <code>`SPEECH#${turnId}`</code> | <code>Not present in this object</code> |
| [server/services/studySpeechCache.ts:75](../../server/services/studySpeechCache.ts#L75) | <code>`STUDY#${id}`</code> | <code>"META"</code> | <code>Not present in this object</code> |
| [server/services/studySpeechCache.ts:84](../../server/services/studySpeechCache.ts#L84) | <code>`STUDY#${id}`</code> | <code>`SPEECH#${turnId}`</code> | <code>Not present in this object</code> |

## Source fingerprints

- server/services/studyRepository.ts: 32d515c19f4537c0fd4c52edbcb60c990a3d6abbc3ac13fba7b5eb9f2255b45a
- server/services/sources/store.ts: 09c553ad30a77fa09e552d796d479e1d986ca1a47d7492c6c80830c80dbc17f6
- server/services/airsContext.ts: a6b138269851bf07c38633d6bc98e5fe39118db250793d677bad34c669ddbbb4
- server/services/studySpeechCache.ts: d60810807f482c94539aac91427b662d881b88b21d1e51776b4bc32ec84a53b1
