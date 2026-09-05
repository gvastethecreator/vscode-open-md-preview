# Publishing open.md Preview

Extension id: `gvastethecreator.open-md-preview`.

This repository is a local candidate. Building a VSIX does not authorize a remote repository, tag, release, Marketplace upload, or Open VSX upload.

## Candidate gate

```powershell
pnpm install --frozen-lockfile
pnpm run quality
$env:VSCODE_TEST_VERSION = "1.134.0"
pnpm run test:integration
Remove-Item Env:VSCODE_TEST_VERSION
pnpm run test:integration
pnpm run test:web
pnpm run vsix
pnpm run inspect:vsix
pnpm run test:vsix
```

Freeze package bytes after the final build and media capture. Record the SHA-256 digest. Installation proof must use that unchanged file in a clean profile.

The manual Release workflow defaults to `artifact-only`. Registry environments and tokens are only configured after explicit publication approval.

Prefer a forward patch for rollback. Never replace bytes under an existing public version or rewrite a public tag.
