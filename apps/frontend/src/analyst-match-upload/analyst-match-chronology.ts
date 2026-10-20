type TimedEvent = Readonly<{ videoMinute: string; addedTime: string }>;

function moment(event: TimedEvent): number {
  const [minute, inlineAdded] = event.videoMinute.split('+');
  return Number(minute) + Number(inlineAdded ?? (event.addedTime.trim() || '0'));
}

/** Presentation order only: preserve the original index for edits and equal moments. */
export function chronologicalCapturedEvents<T extends TimedEvent>(events: readonly T[]): { event: T; index: number }[] {
  return events.map((event, index) => ({ event, index }))
    .sort((a, b) => moment(a.event) - moment(b.event) || a.index - b.index);
}
