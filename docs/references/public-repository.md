# Publishing Flowst Air

Status 2026-10-04: independent checkout, fresh uncommitted history, no remote, CLI installed but signed out. No publication occurred during documentation preparation.

Suggested name: flowst-air-bring-your-source. The local folder and package are flowst-air-bring-your-source. package.json private controls npm publication, not GitHub visibility.

## Prepare

Use only this independent checkout, preserving the original private Flowst repo/history. Run npm run docs:check and npm run repo:check. Review the manifest, sources/assets, fixtures and claims. Exclude credentials, learner records, dependencies, compiled output and deployment bindings. Disclose existing Amina foundation; identify Kai/memory as target work and fixtures as fixtures.

Sign in under the intended owner. Never commit tokens or put them in command arguments. Runtime checks remain required for runtime changes; documentation alone does not require another build.

## Publish after review and publication instruction

Run from this standalone checkout. These commands create a new public remote and push reviewed files; preparation tools do not run them.

```powershell
Set-Location 'C:\Users\DELL\Desktop\flowst-tutoring\flowst-air-bring-your-source'
gh auth login
gh auth status
npm run docs:check
npm run repo:check
git add --pathspec-from-file=docs/generated/public-paths.txt
git diff --cached --stat
git diff --cached
git commit -m "Initial Flowst Air source-learning proof of concept"
gh repo create flowst-air-bring-your-source --public --source=. --remote=origin --push
```

Publishing the initial codex/bring-your-source branch is valid; verify the remote default branch. A later main rename is a separate decision. If the name exists or an organization owns it, choose the exact owner/name first. No force-push or original-repo visibility conversion.

The generated path list stages only manifest entries plus the manifest itself. Deliberately review manifest changes. The scanner reports possible credential locations without values; resolve findings before pushing.

## Judge access

Verify public GitHub access signed out and fixture instructions from a clean checkout. Add the accessible demo URL when deployment access is confirmed. Public code does not fix deployment protection or signed callbacks. The fixture path needs no provider keys.

Primary references: [GitHub local-code guide](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github), [CLI create](https://cli.github.com/manual/gh_repo_create).
