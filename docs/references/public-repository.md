# Publishing Flowst Airs

Status 2026-10-05: independent checkout at `C:/Users/DELL/Desktop/flowst-air`, public remote `estheticallybawo/flowst-air`, default branch `codex/bring-your-source`. Preserve the private Flowst history. Actual validation is recorded in [verification](verification.md).

The product is Flowst Airs. The folder is flowst-air; the package retains flowst-air-bring-your-source. package.json private controls npm publication, not GitHub visibility.

## Prepare

Use only this independent checkout, preserving the original private Flowst repo/history. Run npm run docs:check and npm run repo:check. Review the manifest, sources/assets, fixtures and claims. Exclude credentials, learner records, dependencies, compiled output and deployment bindings. Disclose existing Amina foundation; distinguish implemented Kai/memory observations from future longitudinal work and label fixtures as fixtures.

Sign in under the intended owner. Never commit tokens or put them in command arguments. Runtime checks remain required for runtime changes; documentation alone does not require another build.

## Publish after review and publication instruction

Run from this standalone checkout. These commands update the existing public remote after review; preparation tools do not publish.

```powershell
Set-Location 'C:\Users\DELL\Desktop\flowst-air'
gh auth status
npm run docs:check
npm run repo:check
git add --pathspec-from-file=docs/generated/public-paths.txt
git diff --cached --stat
git diff --cached
git commit -m "Update verified Flowst Airs slice"
git push origin HEAD:codex/bring-your-source
```

Publishing the initial codex/bring-your-source branch is valid; verify the remote default branch. A later main rename is a separate decision. If the name exists or an organization owns it, choose the exact owner/name first. No force-push or original-repo visibility conversion.

The generated path list stages only manifest entries plus the manifest itself. Deliberately review manifest changes. The scanner reports possible credential locations without values; resolve findings before pushing.

## Judge access

Verify public GitHub access signed out and fixture instructions from a clean checkout. Add the accessible demo URL when deployment access is confirmed. Public code does not fix deployment protection or signed callbacks. The fixture path needs no provider keys.

Primary references: [GitHub local-code guide](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github), [CLI create](https://cli.github.com/manual/gh_repo_create).

The active owner-confirmed checkout is Desktop/flowst-air. Context-aware work preserves that independent snapshot and reconciles it with the previously published standalone history. Only reviewed export files are staged; the private Flowst repository is excluded. Canonical public repository: [estheticallybawo/flowst-air](https://github.com/estheticallybawo/flowst-air).
