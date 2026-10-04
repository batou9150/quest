---
title: L'atelier d'IA agentique
category: Atelier
summary: Comprenez comment fonctionnent les agents d'IA en en construisant un, en trois étapes : jouer à la main, faire écrire votre client par un LLM, puis laisser jouer un agent.
---
The Quantum Quest est un jeu d'aventure textuel qui se joue en HTTP. C'est un bon terrain pour apprendre l'IA agentique : le jeu est un ensemble d'outils, un niveau est une tâche avec un objectif clair, et le score mesure la qualité du résultat.

Un **agent**, c'est une boucle : un modèle choisit un outil, lit le résultat, puis choisit à nouveau, jusqu'à atteindre son objectif. Dans cet atelier, vous y arrivez en trois étapes, chacune construite sur la précédente.

## Les trois étapes

1. [Étape 1 : Jouer à la main](/guides/playing-with-the-api). Jouez le premier niveau dans le navigateur, puis envoyez les mêmes commandes avec `curl`. Vous apprenez l'API, les règles et le calcul du score.
2. [Étape 2 : Un LLM écrit votre client](/guides/writing-a-bot). Donnez la spécification OpenAPI à un LLM et faites-lui écrire un petit client, puis un bot qui rejoue vos coups.
3. [Étape 3 : Laisser jouer un agent](/guides/letting-an-agent-play). Donnez le jeu comme outils à un agent et laissez-le jouer seul. Mesurez, changez une chose, mesurez à nouveau.

Chaque étape a des objectifs, un exercice, un point de contrôle (« c'est terminé quand… ») et des pistes pour aller plus loin.

## Ce que le jeu enseigne

Chaque mécanique du jeu est une leçon sur la construction d'agents :

| Dans le jeu | La leçon |
|---|---|
| `/openapi.json` | **Définitions d'outils.** Un outil est un contrat : nom, description, paramètres. Le modèle ne sait que ce que dit la description. |
| Les messages d'erreur sont des indices | **Des erreurs exploitables.** Une erreur qui dit quoi faire ensuite permet à un agent de se rattraper au lieu de tourner en rond. |
| Le par et les actions comptées | **Chaque appel d'outil a un coût.** Mesurez l'efficacité, pas seulement la réussite. |
| `429` et `X-RateLimit-Remaining` | **Réessais et temporisation.** Le client doit ralentir, pas planter. |
| « Ne collez jamais la clé dans le prompt » | **Les secrets restent hors du contexte.** La clé vit dans le code des outils ; le modèle ne la voit jamais. |
| Les classements des événements | **Une évaluation objective.** Comparez prompts, modèles et descriptions d'outils sur le même niveau, avec un chiffre. |

## Ce qu'il vous faut

- Un navigateur et `curl`.
- Node.js 18+ ou Python 3.11+ (ou le langage de votre choix).
- Un compte sur ce site (connexion avec Google ou GitHub).
- Un LLM : un assistant conversationnel pour l'étape 2, et une clé d'API pour un modèle qui sait appeler des outils pour l'étape 3.

Vous découvrez les jeux d'aventure textuels ? Lisez d'abord [Qu'est-ce qu'un jeu d'aventure textuel ?](/guides/what-is-a-text-adventure) : deux minutes suffisent.
