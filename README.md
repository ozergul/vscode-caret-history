# Caret History

WebStorm-style caret position history navigation for VS Code.

## Features

- **True caret history**: Tracks actual cursor position changes, not just file navigation
- **Hybrid navigation**: Uses caret history first, falls back to VS Code's native navigation when empty
- **Smart filtering**: Ignores small movements (< 5 lines) to avoid cluttering history
- **Works everywhere**: Mouse clicks, keyboard navigation, Go to Definition - all tracked equally

## Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Go Back | `Ctrl+Alt+Left` | `Cmd+Alt+Left` |
| Go Forward | `Ctrl+Alt+Right` | `Cmd+Alt+Right` |

### Manual Keybinding Setup

If the default keybindings don't work (due to conflicts with other extensions), add these to your `keybindings.json` (`Cmd+Shift+P` → "Preferences: Open Keyboard Shortcuts (JSON)"):

```json
[
  {
    "key": "cmd+alt+left",
    "command": "caretHistory.back",
    "when": "editorTextFocus"
  },
  {
    "key": "cmd+alt+right",
    "command": "caretHistory.forward",
    "when": "editorTextFocus"
  }
]
```

For Windows/Linux, replace `cmd` with `ctrl`.

## Commands

- `Caret History: Go Back` - Navigate to previous caret position
- `Caret History: Go Forward` - Navigate to next caret position
- `Caret History: Clear` - Clear all history

## How It Works

1. Every cursor movement that jumps 5+ lines is recorded
2. When you press "Go Back", it navigates through your caret history
3. If caret history is empty, it falls back to VS Code's built-in navigation
4. New cursor movements clear the forward stack (like a web browser)

## Why Use This?

VS Code's built-in navigation (`workbench.action.navigateBack`) only tracks:
- File switches
- Go to Definition
- Symbol navigation

It doesn't track regular cursor movements within a file. This extension fills that gap, giving you WebStorm-like navigation.

## Release Notes

### 0.0.1

Initial release with core functionality:
- Caret position tracking
- Back/Forward navigation
- Hybrid fallback to VS Code navigation
- Small movement filtering
