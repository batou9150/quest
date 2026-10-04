import { parseLevel, type Level } from '@quest/engine';
import theRing from './levels/01-the-ring.json' with { type: 'json' };
import theDustWorld from './levels/02-the-dust-world.json' with { type: 'json' };
import theDerelict from './levels/03-the-derelict.json' with { type: 'json' };

/**
 * The public demo levels, in play order. They are seeded at startup and kept in this public repo on purpose.
 * Real levels are kept private and uploaded with `npm run levels:push`.
 */
export const demoLevels: Level[] = [theRing, theDustWorld, theDerelict].map((raw) => parseLevel(raw));

/** The tutorial: the first demo level. */
export const demoLevel: Level = demoLevels[0]!;
