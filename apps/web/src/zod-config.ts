import { z } from 'zod';

// Zod probes for eval() support when schemas are created, which the Content-Security-Policy blocks.
// Imported first in main.tsx so it runs before any schema module.
z.config({ jitless: true });
