/**
 * Firestore documents. Paths:
 *   users/{uid}                        UserDoc
 *   users/{uid}/progress/{levelId}     ProgressDoc
 *   identities/{provider}:{providerId} IdentityDoc   (login → uid)
 *   sessions/{sha256(token)}           SessionDoc
 *   apiKeys/{sha256(key)}              ApiKeyDoc
 *   levels/{levelId}                   LevelDoc
 *   events/{eventId}                   EventDoc
 *   events/{eventId}/scores/{uid}      EventScoreDoc
 *   guides/{slug}                      GuideDoc
 */
import type { GameState, Level } from '@quest/engine';
import type { AuthProvider, EventInput, GuideInput, Role } from '@quest/shared';

export interface UserDoc {
  displayName: string;
  displayNameLower: string;
  firstName: string;
  lastName: string;
  email: string;
  emailLower: string;
  avatarUrl: string;
  bio: string;
  role: Role;
  banned: boolean;
  provider: AuthProvider | 'dev';
  apiKeyHash: string | null;
  apiKeyPrefix: string | null;
  activeLevelId: string | null;
  totalScore: number;
  createdAt: string;
}

export interface ProgressDoc {
  /** Current run; null after an admin reset. */
  state: GameState | null;
  bestScore: number | null;
  completions: number;
  updatedAt: string;
}

export interface IdentityDoc {
  uid: string;
}

export interface SessionDoc {
  uid: string;
  expiresAt: string;
}

export interface ApiKeyDoc {
  uid: string;
  createdAt: string;
}

export type LevelDoc = Level & { published: boolean; updatedAt: string };

export type EventDoc = EventInput & { createdAt: string };

export interface EventScoreDoc {
  displayName: string;
  score: number;
  /** Best score per level during the event. */
  levels: Record<string, number>;
  updatedAt: string;
}

/** Texts per language (`locales.en` always exists); the image and publication are shared. */
export type GuideDoc = GuideInput & { author: string; publishedAt: string; updatedAt: string };

export const paths = {
  user: (uid: string) => `users/${uid}`,
  progress: (uid: string, levelId?: string) => (levelId ? `users/${uid}/progress/${levelId}` : `users/${uid}/progress`),
  identity: (provider: string, providerId: string) => `identities/${provider}:${providerId}`,
  session: (hash: string) => `sessions/${hash}`,
  apiKey: (hash: string) => `apiKeys/${hash}`,
  level: (id: string) => `levels/${id}`,
  event: (id: string) => `events/${id}`,
  eventScore: (eventId: string, uid?: string) => (uid ? `events/${eventId}/scores/${uid}` : `events/${eventId}/scores`),
  guide: (slug: string) => `guides/${slug}`,
};
