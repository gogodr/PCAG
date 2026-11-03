import type { PlayerAction, SceneEvent, SceneTrigger, StateValue } from '../../project-format/src/index';

export type FiredTrigger = { action: string; item?: string; target?: string }
  | { type: 'scene_variable_change' | 'game_variable_change'; target: string; old_value: StateValue; value: StateValue }
  | { type: 'character_position'; x: number; y: number; phase: 'start' | 'move' | 'end' };

export const positionTriggerWarning = '// Character position is evaluated live. Keep this handler light; it runs at movement start, every 60 ms, and at the end.';

export function eventFunctionName(id: string): string { return `on_${id.replace(/[^A-Za-z0-9_]/g, '_')}`; }

export function initialEventScript(id: string): string {
  return `/**\n * @param {SceneContext} scene\n * @param {GameContext} game\n * @param {TriggerContext} trigger\n */\nasync function ${eventFunctionName(id)}(scene, game, trigger) {\n  // Example: await scene.elements["door"].playAnimation();\n}\n`;
}

export function withPositionTriggerWarning(id: string, script: string): string {
  script = script.replace(positionTriggerWarning.replace('60 ms', '200 ms'), positionTriggerWarning);
  if (script.includes(positionTriggerWarning)) return script;
  const name = eventFunctionName(id);
  const signature = new RegExp(`\\bfunction\\s+${name}\\s*\\([^)]*\\)\\s*\\{`).exec(script);
  if (!signature) return `${positionTriggerWarning}\n${script}`;
  const offset = signature.index + signature[0].length;
  return `${script.slice(0, offset)}\n  ${positionTriggerWarning}\n${script.slice(offset)}`;
}

export function matchesTrigger(trigger: SceneTrigger, fired: FiredTrigger): boolean {
  if (trigger.kind === 'character_position') return 'type' in fired && fired.type === 'character_position';
  if (trigger.kind === 'scene_variable_change' || trigger.kind === 'game_variable_change') return 'type' in fired && fired.type === trigger.kind && fired.target === trigger.variableName;
  if (!('action' in fired)) return false;
  if (trigger.kind !== 'player_action') return fired.action === trigger.kind;
  if (fired.action !== `player_${trigger.action}` || !trigger.targetId || fired.target !== trigger.targetId) return false;
  return !trigger.itemId || fired.item === trigger.itemId;
}

export function matchingEvents(events: SceneEvent[], fired: FiredTrigger): SceneEvent[] {
  return events.filter(event => event.triggers.some(trigger => matchesTrigger(trigger, fired)));
}

export function stateChangeTriggers(scope: 'scene' | 'game', before: Record<string, StateValue>, after: Record<string, StateValue>): FiredTrigger[] {
  return Object.entries(after).flatMap(([target, value]) => {
    if (!Object.hasOwn(before, target) || before[target] === value) return [];
    return [{ type: `${scope}_variable_change` as const, target, old_value: before[target]!, value }];
  });
}

export const playerActionLabels: Record<PlayerAction, string> = {
  move_to: 'Player: Move to', talk_to: 'Player: Talk to', view: 'Player: View', push: 'Player: Push', pull: 'Player: Pull',
  open: 'Player: Open', close: 'Player: Close', give: 'Player: Give', use: 'Player: Use',
};
