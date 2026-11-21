# Message frames (fork with collapse + timestamps)

Fork of [`message-frames`](https://github.com/RamonsDka/gs3-sidebar/tree/main/extensions/message-frames)
by RamonsDka (MIT), extended with **passive collapse**, **click to expand** and
**timestamps/durations** in frame titles. Presentation-only framing for the
installed Pi 1.5.0 / Gentle Pi main build.

Install: symlink or copy this directory into your Pi extension discovery
directory (`~/.gentle-shell/agent/extensions/message-frames` for gentle-shell,
`~/.pi/agent/extensions/message-frames` otherwise), then `/reload`.

- `/message-frames on` installs the wrappers.
- `/message-frames off` restores the original render and mouse descriptors immediately;
  the next normal redraw shows the original presentation.
- `/message-frames status` reports the current state, including both toggles.
- `/message-frames timer on|off` shows or hides the per-frame duration.
- `/message-frames start on|off` shows or hides the start time
  (session clock for user/assistant, first render otherwise).
- `/message-frames end on|off` shows or hides the end time
  (`Assistant · ▶ 09:03 · ⏹ 09:05 · ⏱ 1.5s`); static frames (user, summaries)
  never show one. All three persist across sessions and default on.
  `clock on|off` remains as an alias of `start` for 0.2.0 configs.

Each frame's duration freezes when that frame's own work ends (tool result
received, bash exit code set, assistant streaming finished, static messages at
first render), so waiting at the user prompt or watching other frames stream no
longer inflates a finished frame's time. Other arguments show
`Usage: /message-frames on|off|status|timer on|off|clock on|off` without
changing state.
- Shutdown/reload restores the originals; a new runtime defaults to on.
  To disable permanently, exclude this extension through the host's existing
  extension controls, or remove its directory from discovery while Pi is closed.

## Collapse and expand (fork)

`ToolExecutionComponent` and `BashExecutionComponent` frames collapse passively:
only the first `collapsedLines` (default 3) body lines show, plus a hint row
(`▾ N more lines · click to expand`). A left click on the frame toggles between
collapsed and expanded; components without their own `handleMouse` (Bash)
receive an injected click-only handler that is removed again on restore.
Original `Ctrl+O` expand behavior of the native components still works when
clicks are routed through the wrapped mouse path.

## Timestamps and durations (fork)

`User` and `Assistant` titles append the message clock (`HH:MM`) from the
session-entry timestamp Pi already passes to those components. `Tool`, `Bash`
and `Assistant` titles append a derived duration (`500ms`, `1.5s`, `1:35`)
measured from first to last render — approximate, frame-accurate only while a
component is actively streaming. Titles read `✦ Assistant · ▶ 14:03 · ⏹ 14:05 · ⏱ 1.5s`. A frame whose
duration is still running carries a trailing `…`, and a failed result
appends `✗` (bash exit code ≠ 0, tool `isError`). Leading glyphs identify each
frame kind: `❯` user, `✦` assistant, `⚙` tool, `$` bash, `⟳` subagent,
`≡` compaction/branch, `◇` skill/custom.

When the agent settles (`agent_settled`), any tool or assistant frame that
never reported completion (aborted run, cancelled tool) is frozen, so its `…`
marker and running duration stop. A cancelled user bash (`!cmd`) counts as
done.

## Performance

Pi re-renders the whole chat on every keystroke, so the frame wrapper runs
once per message per key. Painted frames are cached per component and reused
while the body lines (compared by identity), width, title and collapse state
are unchanged. When only the title moves (live timer, end time, markers), just
the title row is repainted.

## Credits and license

This is a fork of [`message-frames`](https://github.com/RamonsDka/gs3-sidebar/tree/main/extensions/message-frames)
by **RamonsDka** (gs3-sidebar), MIT licensed. All framing core — the render
wrappers, ANSI background compositing, OSC 133 zone preservation, unframing of
existing chrome and the ownership/restore protocol — is his original work.
This fork adds passive collapse, click-to-expand, render-cycle metadata and
timestamp/duration titles, and packages the result as an installable Pi
package. See LICENSE for the dual copyright notice.

## Integration boundary

The actual chat-route prototypes are wrapped: UserMessageComponent,
AssistantMessageComponent, ToolExecutionComponent, BashExecutionComponent,
CustomMessageComponent (including registered message renderers),
CompactionSummaryMessageComponent, BranchSummaryMessageComponent,
SkillInvocationMessageComponent and CustomEntryComponent. The last class is not
exported, so a constructed isolated entry through the host's own chat route
captures its constructor without loading a duplicate package instance or reading
session data. `render` and existing `handleMouse` methods are wrapped; mouse
coordinates map back to original rows, removed chrome columns, content width and
height. New frame rails do not dispatch clicks to content.
No tools, message transformers, model
hooks, execution handlers, schema changes, session access or execution overrides
are registered. Original renderers still own Markdown, thinking, streaming,
collapse/expand state, truncation and content. Render width reserves two columns.
A process-wide symbol shares ownership across repeated installs; final cleanup
restores the exact previous render/mouse descriptors, including inherited methods.
Missing render APIs and competing wrappers at install time produce a visible
notification and leave framing disabled. This is private-version-coupled code,
not a promise of support for future Pi versions. Re-test before upgrading.

Rounded outline and Gentle float chrome are recognized only as complete outer
cards; their titles and body remain, but their rails are replaced. Manual Bash's
first/last native horizontal rules are replaced. Native backgrounds are replaced,
while foreground SGR (including RGB/indexed colors), attributes and OSC survive.
The new border is re-colored after content resets. Blank and right-padding rows
receive the same continuous background as text. Grain is a stable low-amplitude
row variation, combined with a subtle vertical gradient. **Transparency is an
ANSI truecolor simulation over a dark base, not real alpha compositing.**

## Verification

From the repository root, with `PI_PKG_ROOT` pointing to the installed `@earendil-works/pi-coding-agent` package (the tests print SKIP without it):

```sh
node --test extensions/message-frames/frame.test.mjs
node --test extensions/message-frames/integration.test.mjs
node --test extensions/message-frames/*.test.mjs
script -q -e -c 'node --test extensions/message-frames/integration.test.mjs' /dev/null
```

Tests use only isolated constructed messages and installed render classes, with
no providers, sessions or shell/tool executions. Integration also uses Pi's
actual extension loader and confirms prototype identity and restore/reload.
The tests load Pi's render classes from `PI_PKG_ROOT`. No TypeScript compiler was
available in the inspected installation; loader success is not a typecheck.
A human `/reload` visual check is the normal post-load acceptance step, not an
automated verification result. The PTY command checks isolated integration only.

## Known limitations / review focus

One-column terminals cannot show both corners or a title; narrow frames clip
content according to the installed TUI width helpers. Empty components that Pi
intentionally hides remain hidden, including custom entries whose renderer returns
nothing. All nine native message/custom-entry routes above are covered; native
system messages remain hidden. Summary and skill collapse/expand behavior stays
with Pi. Regression tests cover tool mouse dispatch for plain, outline and float
renderers, including original row/column/width/height and descriptor restoration.
Inline terminal images have not been visually verified.
Other extensions that replace render methods after installation cannot be safely
unwrapped; disabling does not overwrite another extension's later replacement.
The simulated fill is designed for dark terminals; it does not sample the actual
terminal background. No editor, footer, header, HUD or widgets are modified.

## Reference and license

Consulted raw GitHub sources in `j0k3r-dev-rgl/j0k3r-pi` on `main`:
`extensions/j0k3r-theme/src/render/borders.ts`,
`extensions/j0k3r-theme/src/render/ToolCard.ts`, and
`extensions/subagents/src/render/completion-message.ts`.
Only the rounded glyph vocabulary (`╭ ╮ ╰ ╯ │ ─`) and titled-role visual idea
were used. Implementation is original; no source or execution overrides copied.
The repository-root `LICENSE` raw URL returned HTTP 404; no upstream license is
asserted and no unlicensed code was transplanted.
