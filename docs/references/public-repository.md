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
git push origin HEAD:codex/context-aware-practice
```

GitHub retains `codex/bring-your-source` as the repository default branch. Select `codex/context-aware-practice` in GitHub to inspect the current release tree; the default branch and Vercel production branch serve different purposes. A default-branch rename is a separate decision. No force-push or original-repo visibility conversion.

The generated path list stages only manifest entries plus the manifest itself. Deliberately review manifest changes. The scanner reports possible credential locations without values; resolve findings before pushing.

## Judge access

Verify public GitHub access signed out and fixture instructions from a clean checkout. Add the accessible demo URL when deployment access is confirmed. Public code does not fix deployment protection or signed callbacks. The fixture path needs no provider keys.

Primary references: [GitHub local-code guide](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github), [CLI create](https://cli.github.com/manual/gh_repo_create).

The active owner-confirmed checkout is Desktop/flowst-air. Context-aware work preserves that independent snapshot and reconciles it with the previously published standalone history. Only reviewed export files are staged; the private Flowst repository is excluded. Canonical public repository: [estheticallybawo/flowst-air](https://github.com/estheticallybawo/flowst-air).

## Automatic release branch — 5 October 2026

The owner authorized automatic deployments from `codex/context-aware-practice` in `estheticallybawo/flowst-air`. Vercel project `amira-study` must link to that repository and use that production branch. The root `vercel.json` enables exactly that branch with `{ "**": false, "codex/context-aware-practice": true }`; other branches remain disabled. This supersedes the earlier manual-only release policy for this slice.

Verify the application, generated documentation and reviewed export hashes before a release push. Confirm the remote commit and a Ready production deployment with the same SHA afterward. The private Flowst demonstration uses its own repository, project and release branch. Keep private Flowst history and host components outside this public slice.

Branch-rule semantics: [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration).
