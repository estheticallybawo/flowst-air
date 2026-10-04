# Flowst Airs identity and compatibility

The standalone product is **Flowst Airs**, shortened to **Airs** where space is limited. Bring Your Source is its entry journey. Misu plans; Amina guides verbal practice; Kai's separate evidence interpretation remains proposed. Agent names are not product brand names.

## Current naming

- Folder and npm package: flowst-airs-bring-your-source.
- Study routes: /airs, /airs/new, /airs/:id, /airs/settings; public information at /airs/about and /airs/pricing.
- Product components/styles/access/navigation: Airs*, airs.css and airs-call-room.css.
- Agent voice/model modules: useAminaLiveCall, studyAmina and aminaRealtime.
- Product source/voice configuration: AIRS_* in .env.example and setup instructions. Shared Flowst infrastructure and provider keys retain their established names.
- Development MCP: flowst-airs-github-source; Codex config entry flowst_airs_github_source; reusable source review skill airs-source-review. Exactly four read-only tools remain unchanged.

## Compatibility

Old /air and /amira page links redirect to /airs, preserving the session destination, query and hash. Authentication return paths reject foreign origins and lookalike prefixes. The legacy /api/air/access and /api/amira/access delegate to the same authenticated handler as /api/airs/access. The airs, air and amira surface identifiers retain the same entitlement/source gates.

AIRS_* environment keys take precedence over the old AIR_* and explicitly listed AMINA_* source/text/voice keys and AMIRA_* realtime/access keys in nuxt.config.ts. New configuration examples use Airs keys. MCP accepts only its dedicated read-token key and migration alias alongside minimal OS variables; provider secrets remain excluded. Fixture startup removes legacy and current provider/source secrets.

Persisted AMIRA and MIRO role IDs, and existing AMIRA_* recovery codes, remain wire/storage compatibility identifiers. Renaming them would require an independently verified data/protocol migration. They are never rendered as the product brand. Amina's actual avatar and agent dialogue keep her name.

## Deployment and export

The existing Amina deployment is historical foundation, not proof that the Airs changes are live. Review the new checkout, migrate configured environment keys when deploying, and verify public judge access, live provider callbacks, sign-in and old bookmarks. No hosting URL or provider-agent identifier is changed by a local rebrand.

Windows retained handles on the former checkout. All 217 manifest-listed source files were copied and hash-verified into the fresh Airs checkout before editing. The old checkout is a retired copy; launchers and navigation use only the Airs location.

See [verification](verification.md), [publication](public-repository.md) and [system responsibilities](../design-docs/flowst-airs-system-design.md).

## Misu planner naming

Planner modules/functions use studyMisu.ts and Misu names. Current avatars use misu asset paths. AgentAvatar accepts MISU for new templates and maps it to the existing MIRO record identity, which still renders Misu. Old asset URLs remain available for cached clients; both miro and misu handles remain reserved. Historical verification records keep their original terminology.
