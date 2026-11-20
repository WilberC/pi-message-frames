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

type FrameConfig = { timer: boolean; clock: boolean; start: boolean; end: boolean };

// Defaults all on; a legacy {clock:false} from 0.2.0 reads as start:false.
function loadConfig(): FrameConfig {
 try {
  const raw = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  return {timer: raw.timer !== false, clock: raw.clock !== false, start: raw.start ?? raw.clock ?? true, end: raw.end !== false};
 } catch {
  return {timer: true, clock: true, start: true, end: true};
 }
}

function saveConfig(cfg: FrameConfig): void {
 // `clock` stays as the legacy mirror of `start` for older 0.2.0 readers.
 fs.writeFileSync(configPath(), JSON.stringify({timer: cfg.timer, clock: cfg.start, start: cfg.start, end: cfg.end}, null, '\t') + '\n');
}

// '14:03' from ms or a session-entry timestamp string.
function hhmm(value: unknown): string {
 if (typeof value === 'number' && Number.isFinite(value)) {
  const d = new Date(value);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
 }
 const d = value ? new Date(value as string) : null;
 return d && !isNaN(d.getTime()) ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';
}

type Show = { timer: boolean; clock: boolean; start: boolean; end: boolean };

type Life = { firstMs: number; lastMs: number; frozen?: boolean; static?: boolean };

function label(base: string, life: Life | undefined, tsStart: unknown, show: Show): string {
 const parts = [base];
 const wallStart = hhmm(typeof tsStart === 'string' || tsStart == null ? tsStart : undefined) || (life && life.firstMs ? hhmm(life.firstMs) : '');
 const measured = !!(life && life.lastMs > life.firstMs);
 const ended = !!(life && life.frozen && !life.static);
 if (show.start && wallStart) parts.push(wallStart);
 if (show.end && ended) parts.push(`${wallStart || '…'}–${hhmm(life!.lastMs)}`);
 if (show.timer && measured) parts.push(String(fmtDuration(life!.lastMs - life!.firstMs)));
 return parts.join(' · ');
}

export default function messageFrames(pi: ExtensionAPI) {
 let controller: ReturnType<typeof installFrames> | undefined;
 let disabled = false;
 const enable = (ctx: any) => {
  if (ctx.mode !== 'tui' || controller) return;
  const cfg = loadConfig();
  const live = () => ({timer: cfg.timer, start: cfg.start, end: cfg.end});
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
    [UserMessageComponent, (c: any, m, s) => label('User', m, c.timestamp, s), [91, 174, 230], {done: () => true, visible: live}],
    [AssistantMessageComponent, (c: any, m, s) => label('Assistant', m, c.timestamp, s), [156, 136, 224], {done: (c: any) => c.isStreaming === false, visible: live}],
    [ToolExecutionComponent, (c: any, m, s) => label(c.toolName === 'bash' ? 'Bash (tool)' : `Tool: ${c.toolName}`, m, undefined, s), [215, 170, 91], {collapse: true, done: (c: any) => (c as any).isPartial === false, visible: live}],
    [BashExecutionComponent, (_c: any, m, s) => label('Bash', m, undefined, s), [215, 170, 91], {collapse: true, done: (c: any) => (c as any).exitCode !== undefined, visible: live}],
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
   const toggle = /^(timer|clock|start|end)\s+(on|off)$/i.exec(action);
   if (toggle) {
    const key = toggle[1].toLowerCase() === 'clock' ? 'start' : (toggle[1].toLowerCase() as 'timer' | 'start' | 'end');
    const cfg = loadConfig();
    cfg[key] = toggle[2].toLowerCase() === 'on';
    saveConfig(cfg);
    if (controller) { controller.restore(); controller = undefined; }
    if (!disabled) enable(ctx);
    ctx.ui.notify(`Message frames: ${toggle[1].toLowerCase()}: ${cfg[key] ? 'on' : 'off'}`, 'info');
    return;
   }
   if (!['on','off','status'].includes(action)) {
    ctx.ui.notify('Usage: /message-frames on|off|status|timer on|off|start on|off|end on|off', 'error'); return;
   }
   if (action === 'off') { disabled = true; controller?.restore(); controller = undefined; }
   if (action === 'on') { disabled = false; enable(ctx); }
   if (action === 'status') {
    const cfg = loadConfig();
    ctx.ui.notify(`Message frames: ${controller ? 'on' : 'off'} · timer: ${cfg.timer ? 'on' : 'off'} · start: ${cfg.start ? 'on' : 'off'} · end: ${cfg.end ? 'on' : 'off'}`, 'info');
    return;
   }
   ctx.ui.notify(`Message frames: ${controller ? 'on' : 'off'}`, 'info');
  },
 });
}
