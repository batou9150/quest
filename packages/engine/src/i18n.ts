import type { Level } from './schema.ts';

/** The engine's own sentences, in each language it speaks. Commands, exit names and error codes stay in English. */
export interface Messages {
  levelFinished: string;
  notHere: (what: string) => string;
  noExit: (exit: string, exits: string[]) => string;
  complete: (title: string, actions: number) => string;
  alreadyCarried: string;
  taken: (name: string) => string;
  notCarried: (what: string) => string;
  dropped: (name: string) => string;
  useOnWhat: string;
  nothingHappens: string;
  /** Defaults for texts a level leaves out. */
  nothingSpecial: string;
  wayBlocked: string;
  wontBudge: string;
  /** `examine <word>` describes the current room. */
  roomWords: string[];
}

const en: Messages = {
  levelFinished: 'This level is complete. Start it again from Level Select to replay.',
  notHere: (what) => `You don't see any "${what}" here.`,
  noExit: (exit, exits) => `You can't go "${exit}". Exits: ${exits.join(', ') || 'none'}.`,
  complete: (title, actions) => `You step through and leave "${title}" behind. Level complete in ${actions} actions.`,
  alreadyCarried: 'You already carry that.',
  taken: (name) => `Taken: ${name}.`,
  notCarried: (what) => `You aren't carrying any "${what}".`,
  dropped: (name) => `Dropped: ${name}.`,
  useOnWhat: 'Use it on what? Pass an indirect_object.',
  nothingHappens: 'Nothing happens.',
  nothingSpecial: 'Nothing special.',
  wayBlocked: 'The way is blocked.',
  wontBudge: "It won't budge.",
  roomWords: ['room', 'around'],
};

const fr: Messages = {
  levelFinished: 'Ce niveau est terminé. Relancez-le depuis la sélection des niveaux pour le rejouer.',
  notHere: (what) => `Vous ne voyez pas de « ${what} » ici.`,
  noExit: (exit, exits) => `Impossible d'aller « ${exit} ». Sorties : ${exits.join(', ') || 'aucune'}.`,
  complete: (title, actions) => `Vous franchissez le passage et laissez « ${title} » derrière vous. Niveau terminé en ${actions} actions.`,
  alreadyCarried: 'Vous l’avez déjà sur vous.',
  taken: (name) => `Pris : ${name}.`,
  notCarried: (what) => `Vous ne portez pas de « ${what} ».`,
  dropped: (name) => `Posé : ${name}.`,
  useOnWhat: 'Sur quoi ? Précisez un indirect_object.',
  nothingHappens: 'Il ne se passe rien.',
  nothingSpecial: 'Rien de particulier.',
  wayBlocked: 'Le passage est bloqué.',
  wontBudge: 'Impossible de le déplacer.',
  roomWords: ['salle', 'pièce', 'autour'],
};

const MESSAGES: Record<string, Messages> = { en, fr };

/** The engine's sentences in `lang`, English when the engine does not speak it. */
export function messagesFor(lang: string): Messages {
  return MESSAGES[lang] ?? en;
}

/**
 * The level with its texts in `lang`: the `locales[lang]` texts over the English ones, which fill any gap.
 * Item names and aliases in both languages are understood, so English commands keep working.
 * Mechanics (ids, exits, rules, effects) are untouched, so a run can switch language at any time.
 */
export function localize(level: Level, lang: string): Level {
  // Levels stored before translations existed have no `locales`.
  const text = level.locales?.[lang];
  if (!text) return level;
  const { world } = level;
  return {
    ...level,
    title: text.title ?? level.title,
    summary: text.summary ?? level.summary,
    world: {
      ...world,
      rooms: Object.fromEntries(
        Object.entries(world.rooms).map(([roomId, room]) => {
          const t = text.rooms[roomId];
          if (!t) return [roomId, room];
          return [
            roomId,
            {
              ...room,
              name: t.name ?? room.name,
              description: t.description ?? room.description,
              descriptionWhen: room.descriptionWhen.map((d, i) => ({ ...d, text: t.descriptionWhen[i]?.text ?? d.text })),
              exits: Object.fromEntries(
                Object.entries(room.exits).map(([dir, exit]) => [
                  dir,
                  {
                    ...exit,
                    description: t.exits[dir]?.description ?? exit.description,
                    lockedMessage: t.exits[dir]?.lockedMessage ?? exit.lockedMessage,
                  },
                ]),
              ),
            },
          ];
        }),
      ),
      items: Object.fromEntries(
        Object.entries(world.items).map(([itemId, item]) => {
          const t = text.items[itemId];
          if (!t) return [itemId, item];
          const aliases = [...(t.aliases ?? []), item.name, ...item.aliases];
          return [
            itemId,
            {
              ...item,
              name: t.name ?? item.name,
              aliases: [...new Set(aliases)],
              description: t.description ?? item.description,
              fixedMessage: t.fixedMessage ?? item.fixedMessage,
            },
          ];
        }),
      ),
      rules: world.rules.map((rule, i) => ({ ...rule, message: text.rules[i]?.message ?? rule.message })),
    },
  };
}
