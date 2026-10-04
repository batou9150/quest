---
title: Étape 2 : Un LLM écrit votre client
category: Atelier
summary: Donnez la spécification OpenAPI à un LLM, faites-lui écrire un client et un bot, puis faites rejouer un niveau par le bot.
---
À l'étape 1, vous avez joué à la main. Maintenant, un LLM écrit le code qui joue : vous gardez la main sur la conception et la relecture, le LLM tape. C'est l'étape 2 de l'[atelier d'IA agentique](/guides/agentic-ai-workshop).

## Vous allez apprendre

- Comment une spécification OpenAPI sert de contrat entre une API et ses clients, humains ou LLM.
- Comment briefer un LLM pour que le code qu'il écrit soit correct, et comment le vérifier par rapport à la spécification.
- Comment un client doit gérer la clé, les erreurs et les limites de débit.

## Exercice

1. Téléchargez [`/openapi.json`](/openapi.json).
2. Ouvrez votre LLM (assistant conversationnel ou de code), collez toute la spécification, puis ce brief. Changez de langage si vous voulez :

> Voici la spécification OpenAPI d'une API de jeu. Écris un petit client Node.js (Node 18+, sans dépendance) avec une fonction par opération. Lis l'URL de base dans `QUEST_URL` et la clé d'API dans `QUEST_KEY` ; envoie la clé dans l'en-tête `Authorization: ApiKey <clé>`. Quand un appel échoue, renvoie le corps JSON (`error` et `message`) au lieu de lever une exception, et affiche-le. Sur un `429`, attends le nombre de secondes de `Retry-After` et réessaie une fois. Ajoute un petit point d'entrée en ligne de commande : `node quest.mjs look`, `node quest.mjs move north`, etc.

3. Lisez le code avant de le lancer. Vérifiez chaque chemin, méthode et champ du corps par rapport à la spécification. Si quelque chose est inventé, dites au LLM ce qui ne va pas et demandez une correction.
4. Lancez-le sur votre niveau actif : `look`, `inventory`, puis une action qui échoue.
5. Demandez au LLM d'ajouter un mode **rejeu** : il lit une liste de commandes dans un fichier et les joue dans l'ordre. Recommencez le premier niveau depuis le Choix du niveau, écrivez vos coups gagnants de l'étape 1 dans le fichier, et rejouez-les.

## C'est terminé quand…

- Votre client rejoue le premier niveau à partir d'une liste de coups et affiche le score final.
- La clé d'API est lue dans l'environnement : elle n'apparaît dans aucun fichier, prompt ou capture d'écran.

## Pour aller plus loin

- **Un explorateur.** Demandez un bot qui cartographie le monde : depuis chaque salle, il essaie chaque sortie, retient où elle mène et utilise `examine` sur ce qu'il trouve. Essayez-le sur **The Dust World**, puis recommencez le niveau et rejouez uniquement les coups nécessaires.
- **Temporisation.** Faites surveiller `X-RateLimit-Remaining` par le client pour qu'il ralentisse avant d'atteindre le `429`.
- **Compter.** Affichez le nombre d'actions comptées jusque-là à côté du par du niveau.

## À garder en tête

- `examine`, `move`, `take`, `drop` et `use` comptent comme des **actions** et font baisser votre score au-delà du par. Explorez pendant une partie, puis **recommencez** le niveau depuis le Choix du niveau et rejouez uniquement les coups nécessaires.
- Les sorties verrouillées répondent `400 locked` avec un indice dans `message` : enregistrez-le, il vous dit quoi chercher.
- Restez sous la limite de débit (voir l'en-tête `X-RateLimit-Remaining`) et ralentissez en cas de `429`.

## Comparez avec un client minimal

Une fois le vôtre fonctionnel, comparez-le avec celui-ci. C'est le plus petit client qui fait le travail (Node.js 18 ou plus, sans dépendance) :

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

Que fait le vôtre de mieux ? Que fait-il qu'il ne devrait pas faire ?

## Les leçons

- **La spécification est un contrat.** Le LLM a écrit du code correct parce que la spécification dit exactement ce que chaque opération prend et renvoie. À l'étape 3, la même spécification devient la définition des outils de l'agent.
- **Les secrets restent hors du contexte.** La clé va dans une variable d'environnement, jamais dans le code que vous collez dans une conversation, et jamais dans un prompt.
- **Réessais et temporisation.** Un programme appelle bien plus vite que vous : il doit respecter `Retry-After` au lieu d'échouer ou de saturer le serveur.

Suite : [Étape 3 : Laisser jouer un agent](/guides/letting-an-agent-play).
