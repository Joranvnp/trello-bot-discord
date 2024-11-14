# Budget Bot - Guide d'utilisation

## Description

Budget Bot est un bot Discord interactif qui permet de gérer des tâches en intégration avec Trello. Il offre une variété de commandes pour créer, lister, déplacer et mettre à jour des tâches, ainsi que pour gérer les membres du tableau Trello.

## Fonctionnalités

- **Création de tâches** directement depuis Discord.
- **Listing des tâches** dans différentes colonnes de Trello.
- **Déplacement de tâches** entre les colonnes.
- **Mise à jour des informations** des tâches.
- **Affichage des informations détaillées** d'une tâche.
- **Gestion des membres** du tableau Trello.
- **Assignation et désassignation** de tâches aux membres.
- **Marquage des tâches** comme terminées ou en progression.
- **Alerte automatique** des tickets en cours toutes les heures.

## Prérequis

- **Node.js** (version 14 ou supérieure)
- **npm** (gestionnaire de paquets Node.js)
- Un **compte Discord** avec les autorisations pour créer un bot
- Un **compte Trello** avec une clé API et un token

## Installation

1. **Cloner le dépôt du projet :**

   ```bash
   git clone <URL_DU_DÉPÔT>
   ```

2. **Naviguer dans le dossier du projet :**

   ```bash
   cd budget-bot
   ```

3. **Installer les dépendances :**

   ```bash
   npm install
   ```

## Configuration

1. **Créer une application Discord :**

   - Rendez-vous sur le [Portail des développeurs Discord](https://discord.com/developers/applications).
   - Créez une nouvelle application et récupérez le **TOKEN** du bot.

2. **Obtenir les identifiants Trello :**

   - Connectez-vous à votre compte Trello.
   - Rendez-vous sur la [page des développeurs Trello](https://trello.com/app-key) pour obtenir votre **TRELLO_KEY** et **TRELLO_TOKEN**.

3. **Configurer les variables d'environnement :**

   Créez un fichier `.env` à la racine du projet avec le contenu suivant :

   ```env
   TOKEN=VOTRE_TOKEN_DISCORD
   TRELLO_KEY=VOTRE_CLÉ_TRELLO
   TRELLO_TOKEN=VOTRE_TOKEN_TRELLO
   BOARD_ID=ID_DU_TABLEAU_TRELLO
   CHANNEL_ID=ID_DU_CANAL_DISCORD
   ```

   - **TOKEN** : Le token du bot Discord.
   - **TRELLO_KEY** : Votre clé API Trello.
   - **TRELLO_TOKEN** : Votre token API Trello.
   - **BOARD_ID** : L'ID du tableau Trello à gérer.
   - **CHANNEL_ID** : L'ID du canal Discord où le bot enverra les alertes.

## Utilisation

Pour démarrer le bot, exécutez la commande suivante :

```bash
node main.js
```

Le bot est maintenant actif et prêt à répondre aux commandes sur votre serveur Discord.

## Commandes Disponibles

- `!listCards` : Afficher les cartes dans une liste sélectionnée.
- `!create` : Créer une nouvelle tâche.

  - **Utilisation :**

    ```bash
    !create | <Nom de la Tâche> | <Description de la Tâche>
    ```

- `!list` : Lister toutes les tâches dans une colonne sélectionnée.
- `!done <ID de la Tâche>` : Marquer une tâche comme terminée.
- `!progress <ID de la Tâche>` : Marquer une tâche comme en cours.
- `!move <ID de la Tâche>` : Déplacer une tâche vers une autre liste.
- `!assign <ID de la Tâche>` : Assigner une tâche à un membre.
- `!unassign <ID de la Tâche>` : Désassigner un membre d'une tâche.
- `!update <ID de la Tâche> <Nouveau Nom> <Nouvelle Description>` : Mettre à jour les détails d'une tâche.
- `!info <ID de la Tâche>` : Afficher les détails d'une tâche.
- `!members` : Lister tous les membres du tableau Trello.
- `!member` : Afficher les détails d'un membre spécifique.
- `!help` : Afficher la liste des commandes disponibles.

## Exemples d'Utilisation

- **Créer une nouvelle tâche :**

  ```bash
  !create | Ticket #123 : Correction Bug | Corriger le bug sur la page de login
  ```

- **Lister les tâches dans une colonne :**

  ```bash
  !list
  ```

- **Marquer une tâche comme terminée :**

  ```bash
  !done 123
  ```

## Structure du Projet

- `main.js` : Code principal du bot.
- `package.json` : Fichier listant les dépendances du projet.
- `.gitignore` : Fichiers à ignorer par git.
- `.env` : Fichier contenant les variables d'environnement (non inclus dans le dépôt).

## Dépendances

Le projet utilise les dépendances suivantes :

```json
{
  "dependencies": {
    "discord.js": "^14.16.3",
    "dotenv": "^16.4.5",
    "trello": "^0.11.0"
  }
}
```

Assurez-vous que ces dépendances sont installées en exécutant :

```bash
npm install
```

## Auteur

- **Joran Vanpeene** - Développeur du projet.
- ©2024 Joran Vanpeene. Tous droits réservés.

---
