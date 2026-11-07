import { missions, type TopicId } from '../data/missions';
import { articleExercises } from '../data/exercises/inline';
import { missionStatus } from '../domain/progress/route';
import { useProgress } from '../storage/useProgress';

type Props = { id: TopicId; number?: number; class?: string; className?: string; [attribute: `data-${string}`]: unknown };

export default function MissionStatus({ id, number, class: astroClass, className, ...attributes }: Props) {
  const progress = useProgress();
  const submitted = Object.keys(progress.inline);
  const completed = (topicId: TopicId) => articleExercises[topicId].every(exerciseId => Object.hasOwn(progress.inline, exerciseId));
  const currentId = missions.find(mission => !completed(mission.id))?.id;
  const state = completed(id) ? 'completed' : currentId === id ? 'current' : 'available';
  const status = `${missionStatus(id, submitted)}${state === 'current' ? ' · Рекомендуется' : ''}`;
  return <span {...attributes} className={className ?? astroClass} data-route-state={state}>{number ?? status}</span>;
}
