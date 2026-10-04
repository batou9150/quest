import type { EventStatus, EventSummary } from '@quest/shared';
import type { EventDoc } from '../models.ts';

export function eventStatus(event: Pick<EventDoc, 'startTime' | 'endTime'>, now: Date): EventStatus {
  const t = now.getTime();
  if (t < Date.parse(event.startTime)) return 'UPCOMING';
  if (t < Date.parse(event.endTime)) return 'ACTIVE';
  return 'COMPLETED';
}

export function toEventSummary(id: string, event: EventDoc, now: Date): EventSummary {
  return {
    id,
    title: event.title,
    shortDescription: event.shortDescription,
    description: event.description,
    startTime: event.startTime,
    endTime: event.endTime,
    status: eventStatus(event, now),
    levelIds: event.levelIds,
  };
}
