# Architecture and limits

[Back to the README](../README.md)

## Integration boundary

The actual chat-route prototypes are wrapped: UserMessageComponent,
AssistantMessageComponent, ToolExecutionComponent, BashExecutionComponent,
CustomMessageComponent (including registered message renderers),
CompactionSummaryMessageComponent, BranchSummaryMessageComponent,
SkillInvocationMessageComponent and CustomEntryComponent. The last class is not
exported, so a constructed isolated entry through the host's own chat route
captures its constructor without loading a duplicate package instance or
reading session data. `render` and existing `handleMouse` methods are wrapped;
mouse coordinates map back to original rows, removed chrome columns, content
width and height. New frame rails do not dispatch clicks to content.

No tools, message transformers, model hooks, execution handlers, schema
changes, session access or execution overrides are registered. Original
renderers still own Markdown, thinking, streaming, collapse/expand state,
truncation and content. Render width reserves two columns.

A process-wide symbol shares ownership across repeated installs; final cleanup
restores the exact previous render/mouse descriptors, including inherited
methods. Missing render APIs and competing wrappers at install time produce a
visible notification and leave framing disabled. This is private-version-coupled
code, not a promise of support for future Pi versions. Re-test before upgrading.

## Rendering

Rounded outline and Gentle float chrome are recognized only as complete outer
cards; their titles and body remain, but their rails are replaced. Manual
Bash's first/last native horizontal rules are replaced. Native backgrounds are
replaced, while foreground SGR (including RGB/indexed colors), attributes and
OSC survive. The new border is re-colored after content resets. Blank and
right-padding rows receive the same continuous background as text. Grain is a
stable low-amplitude row variation, combined with a subtle vertical gradient.
**Transparency is an ANSI truecolor simulation over a dark base, not real alpha
compositing.**

## Performance

Pi re-renders the whole chat on every keystroke, so the frame wrapper runs once
per message per key. Painted frames are cached per component and reused while
the body lines (compared by identity), width, title and collapse state are
unchanged. When only the title moves (live timer, end time, markers), just the
title row is repainted.

## Known limitations

- One-column terminals cannot show both corners or a title; narrow frames clip
  content according to the installed TUI width helpers.
- Empty components that Pi intentionally hides remain hidden, including custom
  entries whose renderer returns nothing. Native system messages remain hidden.
- Summary and skill collapse/expand behavior stays with Pi.
- Inline terminal images have not been visually verified.
- Other extensions that replace render methods after installation cannot be
  safely unwrapped; disabling does not overwrite another extension's later
  replacement.
- The simulated fill is designed for dark terminals; it does not sample the
  actual terminal background.
- No editor, footer, header, HUD or widgets are modified.

## References

Consulted raw GitHub sources in `j0k3r-dev-rgl/j0k3r-pi` on `main`:
`extensions/j0k3r-theme/src/render/borders.ts`,
`extensions/j0k3r-theme/src/render/ToolCard.ts`, and
`extensions/subagents/src/render/completion-message.ts`. Only the rounded glyph
vocabulary (`╭ ╮ ╰ ╯ │ ─`) and the titled-role visual idea were used; the
implementation is original and no source was copied. That repository's
`LICENSE` raw URL returned HTTP 404, so no upstream license is asserted.
