# Security

open.md Preview is local-first. It does not make network requests, collect telemetry, scan the workspace, read files outside VS Code's active-editor APIs, or log document contents.

The extension uses VS Code's native Markdown preview. It does not replace or weaken the configured Markdown preview security level, rewrite resource URLs, or evaluate document content itself.

To report a vulnerability before a remote repository exists, contact the project owner privately. After the repository is created, use a private GitHub security advisory. Do not publish exploit details in an issue.
