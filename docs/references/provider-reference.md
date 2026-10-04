# Provider references

Primary links; API/account availability needs live verification.

- [ElevenLabs speech conversion](https://elevenlabs.io/docs/api-reference/speech-to-text/convert).
- [Async transcription callbacks](https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/batch/webhooks).
- [GitHub CLI repository creation](https://cli.github.com/manual/gh_repo_create).
- [Adding local code to GitHub](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github).

Local boundaries: [network](../../server/services/sources/network.ts), [GitHub reader](../../server/services/sources/github.ts), [source service](../../server/services/studySources.ts), [model adapter](../../server/services/studyInference.ts), [MCP config](../../mcp/codex-config.example.toml). Groq is default; Bedrock optional; ElevenLabs speech. Providers do not own learning state or permissions.
