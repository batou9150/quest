---
title: Qu'est-ce qu'un jeu d'aventure textuel ?
category: Premiers pas
summary: Le genre en deux minutes, et comment The Quantum Quest en fait un jeu de programmation.
---

Un **jeu d'aventure textuel** (on parle aussi de *fiction interactive*) est un jeu où tout passe par le texte. Le jeu décrit l'endroit où vous vous trouvez ; vous répondez par de courtes commandes comme `look`, `take key` ou `go north`. Pas de graphismes : le monde existe dans les descriptions, et dans votre tête.

Le genre remonte aux années 1970, avec des jeux comme *Colossal Cave Adventure* et *Zork*. Leurs énigmes consistent à remarquer les détails, à apporter le bon objet au bon endroit et à combiner les choses avec astuce.

## Comment se joue The Quantum Quest

Chaque **niveau** est un petit monde : quelques salles, des objets à trouver et des énigmes à résoudre. Vous gagnez un niveau en trouvant la sortie.

Les commandes restent en anglais :

| Commande | Ce qu'elle fait |
|---|---|
| `look` | Décrit la salle où vous êtes : ses objets et ses sorties |
| `inventory` | Liste ce que vous portez |
| `examine <chose>` | Examine de près un objet ou une sortie |
| `move <sortie>` | Passe par une sortie, par exemple `move north` (ou simplement `n`) |
| `take <objet>` / `drop <objet>` | Prend ou pose un objet |
| `use <objet> [on <chose>]` | Utilise un objet, seul ou sur autre chose |

## La particularité : c'est une API

Chaque commande est aussi un endpoint HTTP. Vous pouvez jouer dans le terminal du navigateur (**Jouer** dans le menu), mais aussi avec `curl`, avec un script que vous écrivez, ou avec un agent d'IA que vous construisez. Voir [Jouer avec l'API](/guides/playing-with-the-api).

## Le score

Chaque niveau rapporte un certain nombre de points si vous le terminez dans son *par* : un nombre d'actions. Chaque action au-delà du par coûte quelques points. `look` et `inventory` sont gratuites : regardez autour de vous autant que vous voulez ; ce sont l'errance et les tentatives au hasard qui coûtent cher.

## Conseils

- Lisez chaque description. La réponse est généralement écrite quelque part.
- Utilisez `examine` sur tout ce qui paraît inhabituel, sorties comprises.
- Si quelque chose ne marche pas, le jeu vous dit généralement pourquoi.
- Une porte verrouillée ? Cherchez ce qui l'ouvre dans une autre salle.
