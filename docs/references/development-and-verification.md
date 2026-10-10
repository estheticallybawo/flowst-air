# Development and verification

Procedures; [actual results](verification.md) are separate.

npm ci and npm run demo start labelled local fixtures, stripped of provider credentials and stored in memory. They do not simulate live voice or prove model availability. See [README](../../README.md).

Runtime checks: npm run typecheck, npm test, npm run test:sources:e2e, npm run build. Choose relevant targeted checks; record bounded startup-timeout retries honestly.

Documentation: npm run docs:generate refreshes the static code-derived storage reference; npm run docs:check checks local file links and generated freshness. It does not validate learning claims, Markdown anchors or deployed cloud resources.

Export: npm run repo:check verifies hashes, compares Git-visible candidate files with the allowlist and scans bounded credential/private-file patterns. It is not a comprehensive secret detector or permission to publish. Review asset rights and foundation/new-work disclosures.

Live checks need permitted sources and configured providers. Source/video ingestion and model-task allowances remain; cumulative voice quotas are removed and provider charges continue. The owner chose to run paid/voice tests herself. See [checklist](deployed-video-checklist.md). The MCP review exercises only four read-only GitHub tools.

Shared releases: run npm run release:check -- --flowst-path <private-checkout> before pushing. This compares 115 shared files, permits only hash-pinned standalone UI adaptations, and requires the other checkout. After reviewing a shared change in both folders, run npm run parity:update -- --flowst-path <private-checkout> and commit docs/generated/shared-parity.json. npm test and npm run build verify this snapshot without needing private code in Vercel. The snapshot detects unverified changes in standalone; only the cross-repository release check can detect newer changes made solely in Flowst. Never copy private history or environment files.
