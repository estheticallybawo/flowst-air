# Generated storage access-pattern catalog

Status: static extraction of current code, not deployed table introspection or a complete physical schema. Regenerate with npm run docs:generate; do not hand-edit.

Application table uses pk/sk. Owner listing uses GSI2 where shown in code. Draft retention uses expiresAt; expiry units and application checks must be read in each record implementation. This catalog does not infer TTL policy or cloud provisioning from field names.

Proposed Kai/longitudinal entities are not added here unless implemented in these modules. Extraction parses TypeScript without executing application code, accessing credentials or calling a provider.

| Source location | Partition key | Sort key | Index fields on same object |
| --- | --- | --- | --- |
| [server/services/studyRepository.ts:72](../../server/services/studyRepository.ts#L72) | <code>`STUDY_UPLOAD#${ownerId}`</code> | <code>'ACTIVE'</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:154](../../server/services/studyRepository.ts#L154) | <code>`STUDY#${id}`</code> | <code>'LIVE#VOICE'</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:158](../../server/services/studyRepository.ts#L158) | <code>`STUDY#${id}`</code> | <code>'META'</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:162](../../server/services/studyRepository.ts#L162) | <code>`STUDY#${id}`</code> | <code>'META'</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:177](../../server/services/studyRepository.ts#L177) | <code>`STUDY#${id}`</code> | <code>`RECORDED#${recordingId}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:320](../../server/services/studyRepository.ts#L320) | <code>`STUDY#${id}`</code> | <code>'META'</code> | <code>gsi2pk=`USER#${ownerId}`; gsi2sk=`STUDY#${now}#${id}`</code> |
| [server/services/studyRepository.ts:358](../../server/services/studyRepository.ts#L358) | <code>record.pk</code> | <code>`CHUNK#${String(chunk.position).padStart(4, '0')}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:368](../../server/services/studyRepository.ts#L368) | <code>record.pk</code> | <code>'META'</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:390](../../server/services/studyRepository.ts#L390) | <code>`STUDY#${id}`</code> | <code>'META'</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:417](../../server/services/studyRepository.ts#L417) | <code>`STUDY#${id}`</code> | <code>'LIVE#VOICE'</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:417](../../server/services/studyRepository.ts#L417) | <code>`STUDY#${id}`</code> | <code>`USAGE#${item.createdAt}#${item.id}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:418](../../server/services/studyRepository.ts#L418) | <code>`STUDY#${id}`</code> | <code>`USAGE#${item.createdAt}#${item.id}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:445](../../server/services/studyRepository.ts#L445) | <code>`STUDY#${id}`</code> | <code>'META'</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:486](../../server/services/studyRepository.ts#L486) | <code>`STUDY#${id}`</code> | <code>`TURN#${turn.createdAt}#${turn.id}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:501](../../server/services/studyRepository.ts#L501) | <code>`STUDY#${id}`</code> | <code>`TURN#${turn.createdAt}#${turn.id}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:518](../../server/services/studyRepository.ts#L518) | <code>`STUDY#${id}`</code> | <code>`TRACE#${trace.id}#${trace.status}`</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:624](../../server/services/studyRepository.ts#L624) | <code>`STUDY#${id}`</code> | <code>'META'</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:631](../../server/services/studyRepository.ts#L631) | <code>`STUDY#${id}`</code> | <code>'META'</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:640](../../server/services/studyRepository.ts#L640) | <code>item.pk</code> | <code>item.sk</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:651](../../server/services/studyRepository.ts#L651) | <code>'STUDY#' + id</code> | <code>'LIVE#VOICE'</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:660](../../server/services/studyRepository.ts#L660) | <code>'STUDY#' + id</code> | <code>'META'</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:661](../../server/services/studyRepository.ts#L661) | <code>'STUDY#' + id</code> | <code>'LIVE#VOICE'</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:669](../../server/services/studyRepository.ts#L669) | <code>'STUDY#' + id</code> | <code>'LIVE#VOICE'</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:680](../../server/services/studyRepository.ts#L680) | <code>'STUDY#' + id</code> | <code>'LIVE#VOICE'</code> | <code>Not present in this object</code> |
| [server/services/studyRepository.ts:681](../../server/services/studyRepository.ts#L681) | <code>'STUDY#' + id</code> | <code>`USAGE#${usage.createdAt}#${usage.id}`</code> | <code>Not present in this object</code> |
| [server/services/sources/store.ts:14](../../server/services/sources/store.ts#L14) | <code>`STUDY_SOURCE#${id}`</code> | <code>'DRAFT'</code> | <code>Not present in this object</code> |
| [server/services/sources/store.ts:56](../../server/services/sources/store.ts#L56) | <code>`STUDY_SOURCE_LIMIT#${id}`</code> | <code>'USAGE'</code> | <code>Not present in this object</code> |
| [server/services/sources/store.ts:59](../../server/services/sources/store.ts#L59) | <code>`STUDY_SOURCE_LIMIT#${id}`</code> | <code>'USAGE'</code> | <code>Not present in this object</code> |
| [server/services/sources/store.ts:108](../../server/services/sources/store.ts#L108) | <code>`STUDY_UPLOAD#${record.ownerId}`</code> | <code>'ACTIVE'</code> | <code>Not present in this object</code> |

## Source fingerprints

- server/services/studyRepository.ts: b8f2f7a3505ca965a470c26845300df78f1235c45051f5d77fe91d1c397fe979
- server/services/sources/store.ts: 09c553ad30a77fa09e552d796d479e1d986ca1a47d7492c6c80830c80dbc17f6
- server/services/airsContext.ts: b378b87d27a69e4a04626517b20fe2c2813c9416e45fb5943bdc20ca5e003fe0
