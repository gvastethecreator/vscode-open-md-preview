# Compatibility

| Target | Expected behavior |
| --- | --- |
| VS Code 1.134.0 | Minimum desktop host; automatic preview, focus preservation, toggle, and reading layer |
| VS Code 1.136.1 | Current stable validation and Marketplace capture |
| VS Code Web | Browser bundle, virtual workspace, automatic preview, toggle, and controls |
| Remote workspace | UI-first extension kind with workspace-host fallback |
| Virtual workspace | Supported; no filesystem dependency |
| Restricted Mode | Supported; no workspace code execution |
| Light, dark, high contrast | VS Code color variables only |
| Reduced motion | No smooth-scroll animation |

The extension does not support automatic preview for MDX, diffs, notebooks, untitled files, or recognized prompt, instruction, agent, and skill files.
