# Flowst Airs identity and compatibility

The standalone product is **Flowst Airs**, shortened to **Air** where space is limited. Bring Your Source is its entry journey. Misu plans; Amina guides verbal practice; Kai's separate evidence interpretation remains proposed. Agent names are not product brand names.

## Current naming

- Folder and npm package: flowst-air-bring-your-source.
- Study routes: /air, /air/new, /air/:id, /air/settings; public information at /air/about and /air/pricing.
- Product components/styles/access/navigation: Air*, air.css and air-call-room.css.
- Agent voice/model modules: useAminaLiveCall, studyAmina and aminaRealtime.
- Product source/voice configuration: AIR_* in .env.example and setup instructions. Shared Flowst infrastructure and provider keys retain their established names.
- Development MCP: flowst-air-github-source; Codex config entry flowst_air_github_source; reusable source review skill air-source-review. Exactly four read-only tools remain unchanged.

## Compatibility

Old /amira page links redirect to /air, preserving the session destination, query and hash. Authentication return paths reject foreign origins and lookalike prefixes. The legacy /api/amira/access delegates to the same authenticated handler as /api/air/access. Both air and the legacy amira surface identifier retain the same entitlement/source gates.

AIR_* environment keys take precedence over the explicitly listed old AMINA_* source/text/voice keys and AMIRA_* realtime/access keys in nuxt.config.ts. New configuration examples use Air keys. MCP accepts only its dedicated read-token key and migration alias alongside minimal OS variables; provider secrets remain excluded. Fixture startup removes legacy and current provider/source secrets.

Persisted AMIRA and MIRO role IDs, and existing AMIRA_* recovery codes, remain wire/storage compatibility identifiers. Renaming them would require an independently verified data/protocol migration. They are never rendered as the product brand. Amina's actual avatar and agent dialogue keep her name.

## Deployment and export

The existing Amina deployment is historical foundation, not proof that the Air changes are live. Review the new checkout, migrate configured environment keys when deploying, and verify public judge access, live provider callbacks, sign-in and old bookmarks. No hosting URL or provider-agent identifier is changed by a local rebrand.

Windows initially interrupted the folder move. All 214 manifest-listed source files were hash-verified at the new location before editing; obsolete generated artifacts were subsequently removed without following links. The old product folder no longer exists.

See [verification](verification.md), [publication](public-repository.md) and [system responsibilities](../design-docs/flowst-air-system-design.md).
