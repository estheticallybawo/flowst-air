# Development and verification

Procedures; [actual results](verification.md) are separate.

npm ci and npm run demo start labelled local fixtures, stripped of provider credentials and stored in memory. They do not simulate live voice or prove model availability. See [README](../../README.md).

Runtime checks: npm run typecheck, npm test, npm run test:sources:e2e, npm run build. Choose relevant targeted checks; record bounded startup-timeout retries honestly.

Documentation: npm run docs:generate refreshes the static code-derived storage reference; npm run docs:check checks local file links and generated freshness. It does not validate learning claims, Markdown anchors or deployed cloud resources.

Export: npm run repo:check verifies hashes, compares Git-visible candidate files with the allowlist and scans bounded credential/private-file patterns. It is not a comprehensive secret detector or permission to publish. Review asset rights and foundation/new-work disclosures.

Live checks need permitted sources and configured allowances. The owner chose to run paid/voice tests herself. See [checklist](deployed-video-checklist.md). The MCP review exercises only four read-only GitHub tools.
