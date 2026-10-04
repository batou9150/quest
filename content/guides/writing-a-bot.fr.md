---
title: Écrire un bot
category: API
summary: Automatisez le jeu en quelques lignes, puis laissez un agent d'IA jouer à votre place.
---

Une fois que vous savez jouer avec `curl` ([Jouer avec l'API](/guides/playing-with-the-api)), l'étape suivante est de laisser un programme jouer.

## Un client minimal

Ce script Node.js (Node 18 ou plus, sans dépendance) enveloppe chaque commande du jeu dans une fonction :

```js
// quest.mjs : lancez-le avec  QUEST_URL=... QUEST_KEY=... node quest.mjs
const { QUEST_URL, QUEST_KEY } = process.env;

async function call(command, body) {
  const res = await fetch(`${QUEST_URL}/game/${command}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `ApiKey ${QUEST_KEY}`, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) console.log(`  ✗ ${data.error}: ${data.message}`);
  return data;
}

const game = {
  look: () => call('look'),
  inventory: () => call('inventory'),
  examine: (target) => call('examine', { target }),
  move: (exit) => call('move', { exit }),
  take: (itemName) => call('take', { itemName }),
  drop: (itemName) => call('drop', { itemName }),
  use: (direct_object, indirect_object) => call('use', { direct_object, indirect_object }),
};

const room = await game.look();
console.log(room.name, '-', room.description);
for (const item of room.items ?? []) {
  console.log(`${item}: ${(await game.examine(item)).description}`);
}
```

## Un explorateur

Un bon premier bot cartographie le monde : depuis chaque salle, il essaie chaque sortie, retient où elle mène et utilise `examine` sur tout ce qu'il croise. À garder en tête :

- `examine`, `move`, `take`, `drop` et `use` comptent comme des **actions** et font baisser votre score au-delà du par. Explorez pendant une partie, puis **recommencez** le niveau depuis le Choix du niveau et rejouez uniquement les coups nécessaires.
- Les sorties verrouillées répondent `400 locked` avec un indice dans `message` : enregistrez-le, il vous dit quoi chercher.
- Restez sous la limite de débit (voir l'en-tête `X-RateLimit-Remaining`) et ralentissez en cas de `429`.

## Laisser jouer un agent d'IA

Le jeu a aussi été conçu pour les agents d'IA. Donnez à votre agent :

1. Le fichier OpenAPI, [`/openapi.json`](/openapi.json), comme définition de ses outils (la plupart des frameworks d'agents savent le charger directement), ou les sept fonctions ci-dessus comme outils.
2. Votre clé d'API, dans le code des outils. Ne la collez jamais dans le prompt.
3. Un objectif, par exemple :

> Tu joues à un jeu d'aventure textuel au moyen d'outils. Appelle d'abord `look`. Lis attentivement chaque description, utilise `examine` sur tout ce qui paraît inhabituel et ramasse les objets qui pourraient servir. Quand une action échoue, lis le message d'erreur : c'est un indice. Ton objectif est de quitter le niveau par sa sortie finale, en un minimum d'actions. `look` et `inventory` sont gratuites.

Le jeu étant en anglais, vous pouvez aussi écrire ce prompt en anglais. Suivez le raisonnement de l'agent, puis comparez son score au vôtre dans les classements des **Événements**.
