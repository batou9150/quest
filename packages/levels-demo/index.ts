import { parseLevel, type Level } from '@quest/engine';
import raw from './level.json' with { type: 'json' };

/** The public tutorial level. Real levels are kept private and uploaded with `npm run levels:push`. */
export const demoLevel: Level = parseLevel(raw);
