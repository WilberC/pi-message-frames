import { UserMessageComponent, AssistantMessageComponent, ToolExecutionComponent, BashExecutionComponent, CustomMessageComponent, CompactionSummaryMessageComponent, BranchSummaryMessageComponent, SkillInvocationMessageComponent, InteractiveMode, type ExtensionAPI } from '@earendil-works/pi-coding-agent';
import * as tui from '@earendil-works/pi-tui';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { installFrames, fmtDuration } from './frame.mjs';

// Persisted toggles, e.g. {"timer":true,"clock":false}, in
// $PI_CODING_AGENT_DIR/message-frames.json. Unknown keys are kept.
function configPath(): string {
 return path.join(process.env.PI_CODING_AGENT_DIR ?? path.join(os.homedir(), '.pi/agent'), 'message-frames.json');
}

function loadConfig(): { timer: boolean; clock: boolean } {
 try {
  const raw = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  return {timer: raw.timer !== false, clock: raw.clock !== false};
 } catch {
  return {timer: true, clock: true};
 }
}

function saveConfig(cfg: { timer: boolean; clock: boolean }): void {
 fs.writeFileSync(configPath(), JSON.stringify(cfg, null, '\t') + '\n');
}

// '14:03' from a session-entry timestamp string; omitted when unparseable.
function clockOf(ts: unknown): string {
 const d = ts ? new Date(ts as string) : null;
 return d && !isNaN(d.getTime())
  ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  : '';
}

type Show = { timer: boolean; clock: boolean };

function label(base: string, life: { firstMs: number; lastMs: number } | undefined, ts: unknown, show: Show): string {
 const parts = [base];
 if (show.timer && life && life.lastMs > life.firstMs) parts.push(String(fmtDuration(life.lastMs - life.firstMs)));
 const clock = show.clock ? clockOf(ts) : '';
 if (clock) parts.push(clock);
 return parts.join(' · ');
}

export default function messageFrames(pi: ExtensionAPI) {
 let controller: ReturnType<typeof installFrames> | undefined;
 let disabled = false;
 const enable = (ctx: any) => {
  if (ctx.mode !== 'tui' || controller) return;
  const cfg = loadConfig();
  const show = (): Show => ({...cfg});
  try {
   // CustomEntryComponent is not exported. Use the host's own chat route to
   // capture its actual constructor without loading another package instance.
   let CustomEntryComponent: any;
   InteractiveMode.prototype.addCustomEntryToChat.call({
    session: {extensionRunner: {getEntryRenderer: () => () => new tui.Container()}},
    outputPad: 1, toolOutputExpanded: false,
    chatContainer: {addChild: (component: any) => { CustomEntryComponent = component.constructor; }},
   } as any, {customType: 'message-frames-probe'} as any);
   controller = installFrames([
    // Static messages freeze at first render, so they never carry a duration.
    [UserMessageComponent, (c: any, m, s) => label('User', m, c.timestamp, s), [91, 174, 230], {done: () => true, clock: () => cfg.clock}],
    [AssistantMessageComponent, (c: any, m, s) => label('Assistant', m, c.timestamp, s), [156, 136, 224], {done: (c: any) => c.isStreaming === false, timer: () => cfg.timer, clock: () => cfg.clock}],
    [ToolExecutionComponent, (c: any, m, s) => label(c.toolName === 'bash' ? 'Bash (tool)' : `Tool: ${c.toolName}`, m, undefined, s), [215, 170, 91], {collapse: true, done: (c: any) => (c as any).isPartial === false, timer: () => cfg.timer}],
    [BashExecutionComponent, (_c: any, m, s) => label('Bash', m, undefined, s), [215, 170, 91], {collapse: true, done: (c: any) => (c as any).exitCode !== undefined, timer: () => cfg.timer}],
    [CustomMessageComponent, (c: any, m, s) => label(/agent/i.test(c.message?.customType ?? '') ? 'Subagent' : 'Custom', m, undefined, s), [104, 191, 156], {done: () => true}],
    [CompactionSummaryMessageComponent, (_c: any, m, s) => label('Compaction', m, undefined, s), [156, 136, 224], {done: () => true}],
    [BranchSummaryMessageComponent, (_c: any, m, s) => label('Branch', m, undefined, s), [156, 136, 224], {done: () => true}],
    [SkillInvocationMessageComponent, (_c: any, m, s) => label('Skill', m, undefined, s), [91, 174, 230], {done: () => true}],
    [CustomEntryComponent, (_c: any, m, s) => label('Custom entry', m, undefined, s), [104, 191, 156], {done: () => true}],
   ], tui);
  } catch (error) {
   ctx.ui.notify(`Message frames disabled: ${String(error)}`, 'error');
  }
 };
 pi.on('session_start', (_event,ctx) => { if (!disabled) enable(ctx); });
 pi.on('session_shutdown', () => { controller?.restore(); controller = undefined; });
 pi.registerCommand('message-frames', {
  description: 'Message frames: on | off | status | timer on|off | clock on|off (presentation only; default on after reload)',
  handler: async (args,ctx) => {
   const action = args.trim() || 'status';
   const toggle = /^(timer|clock)\s+(on|off)$/i.exec(action);
   if (toggle) {
    const cfg = loadConfig();
    cfg[toggle[1].toLowerCase() as 'timer' | 'clock'] = toggle[2].toLowerCase() === 'on';
    saveConfig(cfg);
    // Title functions read the config object captured in enable() through
    // loadConfig, so persisting is enough; re-enable picks it up freshly.
    if (controller) { controller.restore(); controller = undefined; }
    if (!disabled) enable(ctx);
    ctx.ui.notify(`Message frames: ${toggle[1].toLowerCase()}: ${cfg[toggle[1].toLowerCase() as 'timer' | 'clock'] ? 'on' : 'off'}`, 'info');
    return;
   }
   if (!['on','off','status'].includes(action)) {
    ctx.ui.notify('Usage: /message-frames on|off|status|timer on|off|clock on|off', 'error'); return;
   }
   if (action === 'off') { disabled = true; controller?.restore(); controller = undefined; }
   if (action === 'on') { disabled = false; enable(ctx); }
   if (action === 'status') {
    const cfg = loadConfig();
    ctx.ui.notify(`Message frames: ${controller ? 'on' : 'off'} · timer: ${cfg.timer ? 'on' : 'off'} · clock: ${cfg.clock ? 'on' : 'off'}`, 'info');
    return;
   }
   ctx.ui.notify(`Message frames: ${controller ? 'on' : 'off'}`, 'info');
  },
 });
}
