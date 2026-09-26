import { describe, expect, it } from 'vitest';
import { MILESTONE_MESSAGES, crossedMilestones, milestonesReachedBy } from './milestones';

describe('jalons de progression', () => {
  it('ignore les textes de moins de 20 étapes', () => {
    expect(crossedMilestones(19, 0, 19)).toEqual([]);
  });

  it('active les trois jalons pour exactement 20 étapes', () => {
    expect(crossedMilestones(20, 4, 5)).toEqual([25]);
    expect(crossedMilestones(20, 9, 10)).toEqual([50]);
    expect(crossedMilestones(20, 14, 15)).toEqual([75]);
  });

  it('arrondit les seuils à l’étape terminée suivante', () => {
    expect(crossedMilestones(21, 5, 6)).toEqual([25]);
    expect(crossedMilestones(21, 10, 11)).toEqual([50]);
    expect(crossedMilestones(21, 15, 16)).toEqual([75]);
  });

  it('ne déclenche rien lors d’un retour en arrière', () => {
    expect(crossedMilestones(20, 15, 5)).toEqual([]);
  });

  it('retrouve les jalons déjà atteints pour une reprise', () => {
    expect(milestonesReachedBy(20, 11)).toEqual([25, 50]);
  });

  it('fournit les trois messages chaleureux attendus', () => {
    expect(MILESTONE_MESSAGES[25]).toContain('un quart');
    expect(MILESTONE_MESSAGES[50]).toContain('la moitié');
    expect(MILESTONE_MESSAGES[75]).toContain('la fin');
  });
});
