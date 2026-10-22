/** Editable presentation copy. Operational metrics continue to come from the API. */
export const storyContent = {
  label: 'DEVELOPER COMMAND CENTER',
  action: 'Към панелите',
  destination: 'workspace-panels',
  scenes: [
    { label: 'Наблюдавай', title: 'Всичко под контрол.', description: 'Твоите сайтове, промени и сигнали. В едно пространство.' },
    { label: 'Проследявай', title: 'От промяната до публикуването.', description: 'GitHub commits и Vercel deployments — свързани с работата ти.' },
    { label: 'Реагирай', title: 'Виж важното. Действай навреме.', description: 'Реални проверки. История на инцидентите. Ясна следваща стъпка.' },
  ],
} as const;

export const clamp = (value: number) => Math.min(1, Math.max(0, value));
export function storyTimeline(progress: number) {
  const p = clamp(progress);
  // Deliberate readable holds, connected motion, then a composed final view.
  const ease = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
  const motion = p < .12 ? 0 : p < .44 ? ease((p - .12) / .32) * .5
    : p < .56 ? .5 : p < .88 ? .5 + ease((p - .56) / .32) * .5 : 1;
  return { motion, chapter: p < .36 ? 0 : p < .72 ? 1 : 2 };
}
