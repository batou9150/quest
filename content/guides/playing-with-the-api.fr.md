---
title: Étape 1 : Jouer à la main
category: Atelier
summary: Jouez le premier niveau dans le navigateur, puis avec curl, une requête par commande. Apprenez l'API, les règles et le score.
---
Avant qu'un programme ou un agent puisse jouer, il faut connaître le jeu vous-même : ce que fait chaque commande, à quoi ressemblent les réponses, et ce qui fait un bon score. C'est l'étape 1 de l'[atelier d'IA agentique](/guides/agentic-ai-workshop).

## Vous allez apprendre

- Comment fonctionne le jeu : salles, objets, sorties, et comment se termine un niveau.
- Comment fonctionne le score : un *par* (un nombre d'actions comptées), et une pénalité par action au-delà.
- Comment appeler l'API du jeu avec `curl` : authentification, requêtes, réponses et erreurs.

## Exercice

1. **Connectez-vous**, ouvrez **Choix du niveau** et démarrez **The Ring Beneath the Mountain**. Jouez-le dans le navigateur (**Jouer** dans le menu) jusqu'à quitter le niveau. Notez votre score.
2. Obtenez une clé d'API et rejouez une partie du niveau avec `curl` (sections ci-dessous). Recommencez d'abord le niveau depuis le Choix du niveau : un niveau terminé répond `level_finished`.
3. Faites échouer une action exprès (ouvrir une porte verrouillée, prendre un objet fixé) et lisez l'erreur.
4. Lancez une requête avec `curl -i` et trouvez l'en-tête `X-RateLimit-Remaining`.

## C'est terminé quand…

- Vous avez fini le premier niveau, et vous savez expliquer votre score.
- Vous avez joué au moins trois commandes avec `curl`, dont une qui a échoué.

## Pour aller plus loin

- Finissez le niveau dans le par (tous les points).
- Ouvrez [`/openapi.json`](/openapi.json) et trouvez, pour chaque commande, son nom, ses paramètres et les erreurs qu'elle peut renvoyer.
- Jouez le deuxième niveau, **The Dust World**, uniquement avec `curl`.

## 1. Obtenir votre clé d'API

1. **Connectez-vous**, puis ouvrez **Choix du niveau** et **démarrez** un niveau. L'API de jeu agit toujours sur votre *niveau actif* : le dernier que vous avez démarré ou repris.
2. Ouvrez **Accès API** et cliquez sur **Générer une clé d'API**. Copiez-la tout de suite : elle n'est affichée qu'une fois. Vous pouvez en générer une nouvelle à tout moment ; l'ancienne cesse alors de fonctionner.

```bash
export QUEST_URL=https://<ce-site>        # l'adresse de ce site
export QUEST_KEY=qk_...                    # votre clé
```

Chaque requête envoie la clé dans l'en-tête `Authorization` :

```
Authorization: ApiKey <votre clé>
```

## 2. Regarder autour de soi

```bash
curl -s "$QUEST_URL/game/look" -H "Authorization: ApiKey $QUEST_KEY"
```

```json
{
  "name": "Briefing Room",
  "description": "A windowless room deep inside the mountain. ...",
  "items": ["Mission Tablet", "Coffee Mug"],
  "exits": ["north"]
}
```

Les textes du jeu (salles, objets, messages) sont en anglais par défaut. Ajoutez `?lang=fr` à l'URL (ou envoyez l'en-tête `Accept-Language: fr`) pour les recevoir en français : `/game/look?lang=fr`. Les commandes, les noms de sorties (`north`, `ring`...) et les codes d'erreur restent en anglais ; les noms d'objets se tapent en français comme en anglais.

## 3. Agir

Les actions sont des requêtes `POST` avec un petit corps JSON :

```bash
q() { curl -s "$QUEST_URL/game/$1" -H "Authorization: ApiKey $QUEST_KEY" -H 'Content-Type: application/json' ${2:+-d "$2"}; echo; }

q look
q inventory
q examine '{"target": "Mission Tablet"}'
q take    '{"itemName": "Coffee Mug"}'
q drop    '{"itemName": "Coffee Mug"}'
q move    '{"exit": "north"}'
q use     '{"direct_object": "Coffee Mug"}'
q use     '{"direct_object": "key", "indirect_object": "door"}'
```

Les noms ne tiennent pas compte de la casse, et le nom de l'objet comme un alias court fonctionnent généralement (`"Mission Tablet"` ou `"tablet"`).

Quand un `move` vous fait sortir du niveau, la réponse est votre résultat au lieu d'une salle :

```json
{ "message": "You step through ... Level complete in 14 actions.", "score": 100 }
```

## 4. Le score

Chaque niveau rapporte un certain nombre de points si vous le terminez dans son *par*. `examine`, `move`, `take`, `drop` et `use` sont des actions comptées ; chaque action comptée au-delà du par coûte quelques points. `look` et `inventory` sont gratuites.

## 5. Les erreurs

Les erreurs reviennent avec un statut HTTP et un corps JSON que vous pouvez afficher tel quel :

| Statut | `error` | Signification |
|---|---|---|
| 400 | `unknown_target`, `unknown_exit`, `locked`, `not_takeable`, `not_carrying` | L'action a échoué dans le jeu ; lisez `message` pour un indice |
| 400 | `level_finished` | Niveau terminé : relancez-le depuis le Choix du niveau pour rejouer |
| 401 | `invalid_api_key` | Clé absente, erronée ou révoquée |
| 409 | `no_active_level` | Démarrez d'abord un niveau depuis le Choix du niveau |
| 429 | `rate_limited` | Trop d'appels : attendez le nombre de secondes indiqué par `Retry-After` |

```json
{ "error": "locked", "message": "The badge reader blinks red. You need an access badge." }
```

Chaque réponse porte aussi `X-RateLimit-Limit` et `X-RateLimit-Remaining` : le nombre d'appels qu'il vous reste dans la minute en cours.

## 6. La spécification complète

La description OpenAPI complète est disponible sur [`/openapi.json`](/openapi.json). Chargez-la dans Postman, Insomnia ou votre générateur de code préféré. Vous la donnerez à un LLM à l'étape suivante.

## Les leçons

- **Les messages d'erreur sont des indices.** « You need an access badge » vous dit exactement quoi faire. Un agent lit les erreurs de la même façon : plus elles sont exploitables, plus vite il se rattrape.
- **Chaque action a un coût.** Le par transforme « a-t-il fini ? » en « a-t-il bien fini ? ». Vous mesurerez votre agent avec ce même chiffre.
- **Les limites de débit font partie du contrat.** Un humain n'atteint jamais 60 appels par minute ; un programme, si. Gardez `Retry-After` en tête pour l'étape 2.

Suite : [Étape 2 : Un LLM écrit votre client](/guides/writing-a-bot).
