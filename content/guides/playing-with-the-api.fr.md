---
title: Jouer avec l'API
category: API
summary: Obtenez une clé d'API et jouez un niveau avec curl, une requête par commande.
---

Tout ce que vous faites dans le terminal du navigateur, vous pouvez le faire en HTTP. Ce guide utilise `curl`, mais n'importe quel langage convient.

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

Les textes du jeu (salles, objets, messages) sont en anglais.

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

## 4. Les erreurs

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

## 5. La spécification complète

La description OpenAPI complète est disponible sur [`/openapi.json`](/openapi.json). Chargez-la dans Postman, Insomnia ou votre générateur de code préféré.
