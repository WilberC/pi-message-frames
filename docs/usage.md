# Usage

[Back to the README](../README.md)

## Commands

- `/message-frames on` installs the wrappers.
- `/message-frames off` restores the original render and mouse descriptors
  immediately; the next normal redraw shows the original presentation.
- `/message-frames status` reports the current state, including every toggle.
- `/message-frames timer on|off` shows or hides the per-frame duration.
- `/message-frames start on|off` shows or hides the start time (session clock
  for user/assistant, first render otherwise).
- `/message-frames end on|off` shows or hides the end time
  (`Assistant · ▶ 09:03 · ⏹ 09:05 · ⏱ 1.5s`); static frames (user, summaries)
  never show one.

All three toggles persist across sessions and default on. `clock on|off`
remains as an alias of `start` for 0.2.0 configs. Other arguments show
`Usage: /message-frames on|off|status|timer on|off|clock on|off` without
changing state.

Shutdown and reload restore the originals; a new runtime defaults to on. To
disable the extension permanently, exclude it through the host's extension
controls, or uninstall the package while Pi is closed.

## Collapse and expand

`ToolExecutionComponent` and `BashExecutionComponent` frames collapse
passively: only the first `collapsedLines` (default 3) body lines show, plus a
hint row (`▾ N more lines · click to expand`). A left click on the frame
toggles between collapsed and expanded; components without their own
`handleMouse` (Bash) receive an injected click-only handler that is removed
again on restore. The native `Ctrl+O` expand behavior still works when clicks
are routed through the wrapped mouse path.

## Timestamps and durations

`User` and `Assistant` titles append the message clock (`HH:MM`) from the
session-entry timestamp Pi already passes to those components. `Tool`, `Bash`
and `Assistant` titles append a derived duration (`500ms`, `1.5s`, `1:35`)
measured from first to last render — approximate, frame-accurate only while a
component is actively streaming.

- A frame whose duration is still running carries a trailing `…`.
- A failed result appends `✗` (bash exit code ≠ 0, tool `isError`).
- Leading glyphs identify each frame kind: `❯` user, `✦` assistant, `⚙` tool,
  `$` bash, `⟳` subagent, `≡` compaction/branch, `◇` skill/custom.

Each frame's duration freezes when that frame's own work ends (tool result
received, bash exit code set, assistant streaming finished, static messages at
first render), so waiting at the prompt or watching other frames stream never
inflates a finished frame's time.

When the agent settles (`agent_settled`), any tool or assistant frame that
never reported completion (aborted run, cancelled tool) is frozen, so its `…`
marker and running duration stop. A cancelled user bash (`!cmd`) counts as
done.
