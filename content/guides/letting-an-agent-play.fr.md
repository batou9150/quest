---
title: Étape 3 : Laisser jouer un agent
category: Atelier
summary: Donnez le jeu comme outils à un agent d'IA, laissez-le jouer un niveau seul, puis améliorez-le grâce à son score.
---
À l'étape 2, le LLM écrivait du code et vous le lanciez. Maintenant, c'est le LLM qui décide : il choisit l'outil à appeler, lit le résultat, puis choisit à nouveau, jusqu'à quitter le niveau. C'est l'étape 3 de l'[atelier d'IA agentique](/guides/agentic-ai-workshop).

## Vous allez apprendre

- Comment des outils sont décrits à un modèle, et pourquoi la description compte autant que le code.
- Comment fonctionne une boucle d'agent : modèle, appel d'outil, résultat, appel suivant.
- Comment garder un secret hors du contexte du modèle.
- Comment évaluer un agent avec un chiffre, et l'améliorer un changement à la fois.

## Exercice

1. **Choisissez un framework.** N'importe quel framework ou SDK d'agents qui gère l'appel d'outils convient : prenez celui que vous connaissez, dans votre langage. Mettez la clé d'API de votre modèle dans votre environnement.
2. **Donnez les outils à l'agent.** Soit vous chargez [`/openapi.json`](/openapi.json) comme définition des outils (la plupart des frameworks savent le faire directement), soit vous transformez les fonctions de votre client de l'étape 2 en outils.
3. **Gardez la clé dans le code des outils.** Les outils lisent `QUEST_KEY` dans l'environnement et ajoutent eux-mêmes l'en-tête `Authorization`. Ne collez jamais la clé dans le prompt : le modèle n'en a pas besoin, et tout ce qui est dans le contexte peut finir dans un journal ou une réponse.
4. **Donnez-lui un objectif**, par exemple :

> Tu joues à un jeu d'aventure textuel au moyen d'outils. Appelle d'abord `look`. Lis attentivement chaque description, utilise `examine` sur tout ce qui paraît inhabituel et ramasse les objets qui pourraient servir. Quand une action échoue, lis le message d'erreur : c'est un indice. Ton objectif est de quitter le niveau par sa sortie finale, en un minimum d'actions. `look` et `inventory` sont gratuites.

Pour que le jeu réponde en français, ajoutez `?lang=fr` aux appels de vos outils ; sinon il répond en anglais, et le prompt peut l'être aussi.

5. **Renvoyez les erreurs au modèle.** Quand un appel échoue, l'outil doit renvoyer `error` et `message` comme résultat, pas lever une exception. Le message est l'indice dont l'agent a besoin.
6. **Limitez le nombre d'étapes.** Arrêtez la boucle après un nombre fixe d'appels d'outils (50 suffisent largement pour les niveaux de démonstration), pour qu'un agent perdu ne tourne pas indéfiniment.
7. **Lancez-le** sur **The Dust World** : démarrez le niveau depuis le Choix du niveau, puis lancez l'agent. Affichez chaque appel d'outil et son résultat, et regardez-le jouer.
8. **Mesurez.** Notez trois chiffres : le score, les actions comptées, et le nombre total d'appels d'outils (gratuits compris).
9. **Changez une seule chose** : le prompt, le modèle, ou la description d'un outil. Recommencez le niveau depuis le Choix du niveau et relancez. Comparez.

## C'est terminé quand…

- Votre agent termine un niveau seul, sans aucun coup de votre part.
- Vous avez un tableau d'au moins deux parties (ce qui a changé, score, actions, appels d'outils) et vous savez dire quel changement a aidé.

## Pour aller plus loin

- Jouez **The Derelict**, où l'ordre des actions compte.
- Atteignez le même score avec un modèle plus petit et moins cher.
- Réécrivez la description d'un outil et regardez si l'agent l'utilise autrement.
- Gérez le `429` dans le code des outils, avec `Retry-After`, pour que l'agent ne le voie jamais.
- Comparez le score de votre agent à celui des humains dans le classement des **Événements**. Utilisez un compte séparé pour l'agent si vous voulez qu'il ait sa propre ligne.

## Les leçons

| Ce que vous avez fait | La leçon |
|---|---|
| Chargé `/openapi.json` comme outils | **Définitions d'outils.** Un outil est un contrat ; sa description fait partie du prompt. |
| Renvoyé les messages d'erreur au modèle | **Des erreurs exploitables.** Un agent se rattrape grâce aux erreurs qui disent quoi faire ensuite. |
| Compté les actions et les appels d'outils | **Chaque appel d'outil a un coût.** Dans un vrai système, c'est de la latence, de l'argent ou un effet de bord. |
| Géré le `429` dans le code des outils | **Les réessais et la temporisation** relèvent du code, pas du raisonnement du modèle. |
| Gardé la clé dans le code des outils | **Les secrets restent hors du contexte.** |
| Comparé des parties sur le même niveau | **Une évaluation objective.** Un chiffre par partie, un changement à la fois. |
