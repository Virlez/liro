export const MIN_MILESTONE_STEPS = 20;
export const MILESTONE_DURATION_MS = 4_000;

export const READING_MILESTONES = [25, 50, 75] as const;
export type ReadingMilestone = (typeof READING_MILESTONES)[number];

export const MILESTONE_MESSAGES: Record<ReadingMilestone, string> = {
  25: 'Bien lancé : un quart du texte est déjà parcouru.',
  50: 'Beau chemin parcouru : tu es arrivé à la moitié.',
  75: 'Tu approches de la fin. Continue à ton rythme.',
};

function milestoneStep(totalSteps: number, milestone: ReadingMilestone): number {
  return Math.ceil((totalSteps * milestone) / 100);
}

export function milestonesReachedBy(
  totalSteps: number,
  completedSteps: number,
): ReadingMilestone[] {
  if (totalSteps < MIN_MILESTONE_STEPS) return [];
  return READING_MILESTONES.filter(
    (milestone) => completedSteps >= milestoneStep(totalSteps, milestone),
  );
}

export function crossedMilestones(
  totalSteps: number,
  fromCompletedSteps: number,
  toCompletedSteps: number,
): ReadingMilestone[] {
  if (totalSteps < MIN_MILESTONE_STEPS || toCompletedSteps <= fromCompletedSteps) return [];
  return READING_MILESTONES.filter((milestone) => {
    const step = milestoneStep(totalSteps, milestone);
    return fromCompletedSteps < step && toCompletedSteps >= step;
  });
}
