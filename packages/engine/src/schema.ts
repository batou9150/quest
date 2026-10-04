import { z } from 'zod';

const id = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/, 'lowercase id: a-z, 0-9, _ and -');

/** Conditions on the game state. All listed conditions must hold. */
export const ConditionSchema = z.object({
  flags: z.array(id).default([]),
  notFlags: z.array(id).default([]),
  inventory: z.array(id).default([]),
});

export const ExitSchema = z.object({
  /** Target room id. Omit together with `finish: true` for the level exit. */
  to: id.optional(),
  /** Moving through this exit completes the level. */
  finish: z.boolean().default(false),
  description: z.string().default('Nothing special.'),
  requires: ConditionSchema.optional(),
  lockedMessage: z.string().default('The way is blocked.'),
});

export const RoomSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  /** Extra sentences appended to the description when their flag is set. */
  descriptionWhen: z.array(z.object({ flag: id, text: z.string() })).default([]),
  items: z.array(id).default([]),
  exits: z.record(z.string(), ExitSchema).default({}),
});

export const ItemSchema = z.object({
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  description: z.string().min(1),
  takeable: z.boolean().default(true),
  /** Message when trying to take a non-takeable item. */
  fixedMessage: z.string().default("It won't budge."),
});

export const EffectSchema = z.union([
  z.object({ setFlag: id }),
  z.object({ clearFlag: id }),
  /** Puts an item in the inventory (creating it if it was nowhere). */
  z.object({ giveItem: id }),
  /** Puts an item in the current room. */
  z.object({ spawnItem: id }),
  /** Removes an item from the inventory and every room. */
  z.object({ removeItem: id }),
]);

/** `use <use> [on <on>]` triggers the first matching rule. */
export const RuleSchema = z.object({
  use: id,
  on: id.optional(),
  /** Room where the rule applies; anywhere if omitted. */
  room: id.optional(),
  requires: ConditionSchema.optional(),
  effects: z.array(EffectSchema).default([]),
  message: z.string().min(1),
});

export const WorldSchema = z.object({
  start: id,
  rooms: z.record(id, RoomSchema),
  items: z.record(id, ItemSchema),
  rules: z.array(RuleSchema).default([]),
});

export const LevelSchema = z
  .object({
    id,
    number: z.number().int().positive(),
    title: z.string().min(1),
    summary: z.string().default(''),
    /** Score for a run that finishes in `par` actions or less. */
    points: z.number().int().positive(),
    par: z.number().int().positive(),
    /** Points lost per counted action above par (never below 20% of `points`). */
    penaltyPerAction: z.number().int().nonnegative().default(5),
    world: WorldSchema,
  })
  .superRefine((level, ctx) => {
    const { world } = level;
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (!world.rooms[world.start]) issue(`start room "${world.start}" does not exist`);
    let hasFinish = false;
    for (const [roomId, room] of Object.entries(world.rooms)) {
      for (const item of room.items) if (!world.items[item]) issue(`room "${roomId}" lists unknown item "${item}"`);
      for (const [dir, exit] of Object.entries(room.exits)) {
        if (exit.finish) hasFinish = true;
        else if (!exit.to || !world.rooms[exit.to]) issue(`exit "${roomId}.${dir}" points to unknown room "${exit.to}"`);
      }
    }
    if (!hasFinish) issue('no exit has finish: true, the level cannot be completed');
    for (const [i, rule] of world.rules.entries()) {
      for (const ref of [rule.use, rule.on]) {
        if (ref && !world.items[ref] && !Object.values(world.rooms).some((r) => ref in r.exits)) {
          issue(`rule #${i} references unknown item or exit "${ref}"`);
        }
      }
      if (rule.room && !world.rooms[rule.room]) issue(`rule #${i} references unknown room "${rule.room}"`);
    }
  });

export type Condition = z.infer<typeof ConditionSchema>;
export type Exit = z.infer<typeof ExitSchema>;
export type RoomDef = z.infer<typeof RoomSchema>;
export type ItemDef = z.infer<typeof ItemSchema>;
export type Effect = z.infer<typeof EffectSchema>;
export type Rule = z.infer<typeof RuleSchema>;
export type World = z.infer<typeof WorldSchema>;
export type Level = z.infer<typeof LevelSchema>;

export class LevelValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid level:\n${issues.map((i) => `- ${i}`).join('\n')}`);
    this.name = 'LevelValidationError';
  }
}

/** Parses and cross-checks a level definition. Throws a LevelValidationError listing every problem. */
export function parseLevel(input: unknown): Level {
  const parsed = LevelSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  throw new LevelValidationError(
    parsed.error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)),
  );
}
