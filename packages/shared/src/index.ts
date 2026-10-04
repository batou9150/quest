/**
 * Contract between apps/api and apps/web for the site API (/api/*, /auth/*).
 * The game API (/game/*) is described in apps/api/openapi.json.
 */
import { z } from 'zod';

export const ROLES = ['player', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const LEVEL_STATUSES = ['LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'PLAYED'] as const;
export type LevelStatus = (typeof LEVEL_STATUSES)[number];

export type EventStatus = 'UPCOMING' | 'ACTIVE' | 'COMPLETED';

/** Error body for every non-2xx response. */
export interface ApiError {
  error: string;
  message: string;
}

// --- Auth & profile ----------------------------------------------------------

export type AuthProvider = 'google' | 'github';

/** GET /auth/providers: which login buttons to show. `dev` is only true for local development. */
export interface AuthProviders {
  google: boolean;
  github: boolean;
  dev: boolean;
}

/** GET /api/me (401 when logged out). */
export interface Me {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string;
  bio: string;
  role: Role;
  totalScore: number;
  activeLevelId: string | null;
  /** First characters of the API key, e.g. "qk_3f9a…", or null if none was generated. */
  apiKeyPrefix: string | null;
  createdAt: string;
}

/** PATCH /api/me */
export const UpdateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(40).optional(),
  bio: z.string().trim().max(500).optional(),
});
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;

/** GET /api/me/name-suggestions */
export interface NameSuggestions {
  suggestions: string[];
}

/** POST /api/me/api-key: generates a new key, revoking the previous one. The key is only ever returned here. */
export interface NewApiKey {
  apiKey: string;
  apiKeyPrefix: string;
}

// --- Levels -----------------------------------------------------------------

/** GET /api/levels?lang=fr (logged in): title and summary in `lang` when the level is translated. */
export interface LevelSummary {
  id: string;
  number: number;
  title: string;
  summary: string;
  points: number;
  status: LevelStatus;
  active: boolean;
  bestScore: number | null;
}

/**
 * POST /api/levels/:id/start. Makes the level the active one for /game/*.
 * reset=false resumes an IN_PROGRESS run; PLAYED or AVAILABLE levels always start fresh.
 */
export const StartLevelSchema = z.object({ reset: z.boolean().default(false) });
export type StartLevel = z.infer<typeof StartLevelSchema>;

// --- Events -----------------------------------------------------------------

/** GET /api/events, GET /api/events/:id */
export interface EventSummary {
  id: string;
  title: string;
  shortDescription: string;
  description: string;
  startTime: string;
  endTime: string;
  status: EventStatus;
  /** Levels counted for this event; empty means all levels. */
  levelIds: string[];
}

/** GET /api/events/:id/leaderboard (public; the web page polls it). */
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
}

// --- Languages ---------------------------------------------------------------

/**
 * Languages of the website, guides and game texts (`?lang=` on /api/levels and /game/*).
 * Game commands, exit names and API error messages stay in English.
 */
export const LANGS = ['en', 'fr'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'en';
export const isLang = (value: unknown): value is Lang => (LANGS as readonly unknown[]).includes(value);

// --- Guides -----------------------------------------------------------------

/**
 * GET /api/guides?lang=fr (list: content omitted), GET /api/guides/:slug?lang=fr
 * Texts are in `lang`: the requested language when the guide has it, else English.
 */
export interface Guide {
  slug: string;
  lang: Lang;
  /** Languages this guide is written in. */
  languages: Lang[];
  title: string;
  category: string;
  author: string;
  summary: string;
  imageUrl: string | null;
  content?: string;
  published: boolean;
  publishedAt: string;
}

// --- Admin (/api/admin/*, role admin) ---------------------------------------

/** GET /api/admin/users?q=&cursor= */
export interface AdminUser {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string;
  provider: AuthProvider | 'dev';
  role: Role;
  banned: boolean;
  totalScore: number;
  createdAt: string;
}
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** PATCH /api/admin/users/:id. An admin cannot demote or ban themselves. */
export const AdminUpdateUserSchema = z.object({
  role: z.enum(ROLES).optional(),
  banned: z.boolean().optional(),
});
export type AdminUpdateUser = z.infer<typeof AdminUpdateUserSchema>;
// POST /api/admin/users/:id/reset-progress   → 204
// DELETE /api/admin/users/:id/api-key        → 204

/** GET /api/admin/levels: summary of every level, published or not. */
export interface AdminLevel {
  id: string;
  number: number;
  title: string;
  points: number;
  par: number;
  published: boolean;
  updatedAt: string;
}
// GET    /api/admin/levels/:id     → full level JSON (engine LevelSchema) + { published }
// PUT    /api/admin/levels/:id     → body: engine level JSON. 400 { error: 'invalid_level', issues: string[] }
// PATCH  /api/admin/levels/:id     → body: AdminLevelPatch
// DELETE /api/admin/levels/:id     → 204
export const AdminLevelPatchSchema = z.object({ published: z.boolean() });
export type AdminLevelPatch = z.infer<typeof AdminLevelPatchSchema>;

/** POST /api/admin/events, PUT /api/admin/events/:id; DELETE /api/admin/events/:id → 204 */
export const EventInputSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    shortDescription: z.string().trim().max(200).default(''),
    description: z.string().trim().max(5000).default(''),
    startTime: z.iso.datetime({ offset: true }),
    endTime: z.iso.datetime({ offset: true }),
    levelIds: z.array(z.string()).default([]),
  })
  .refine((e) => Date.parse(e.startTime) < Date.parse(e.endTime), { message: 'endTime must be after startTime', path: ['endTime'] });
export type EventInput = z.infer<typeof EventInputSchema>;

/** The texts of a guide in one language. */
export const GuideTextSchema = z.object({
  title: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(40),
  summary: z.string().trim().max(300).default(''),
  content: z.string().max(100_000),
});
export type GuideText = z.infer<typeof GuideTextSchema>;

/**
 * PUT /api/admin/guides/:slug (create or replace); DELETE /api/admin/guides/:slug → 204
 * English is required; other languages are optional, and readers fall back to English.
 */
export const GuideInputSchema = z.object({
  imageUrl: z.url().nullable().default(null),
  published: z.boolean().default(false),
  locales: z.object({ en: GuideTextSchema, fr: GuideTextSchema.optional() }),
});
export type GuideInput = z.infer<typeof GuideInputSchema>;

/** GET /api/admin/guides → Guide[] (English texts, drafts included); GET /api/admin/guides/:slug → AdminGuide */
export interface AdminGuide {
  slug: string;
  imageUrl: string | null;
  published: boolean;
  publishedAt: string;
  author: string;
  locales: Partial<Record<Lang, GuideText>> & { en: GuideText };
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
