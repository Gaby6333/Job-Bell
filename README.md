# Espace Équipe

App de l'équipe pour suivre les clients et les services résidentiels (BRS) Bell et Virgin Plus.

- **Aujourd'hui** : tout ce qu'il y a à faire dans la journée (clients à rappeler, installations à confirmer, clients à rappeler après l'installation, problèmes)
- **Clients** : nom, téléphone, ce qu'on a proposé, statut, date de rappel en un clic
- **BRS** : Bell ou Virgin, numéro de commande, services, date d'installation, statut (en attente, installé, problème, tout est bon), rappelé ou non, problème
- Boutons Appeler / Texto partout, photo de la commande, recherche
- Voir toute l'équipe ou seulement les miens
- S'installe sur l'écran d'accueil du téléphone comme une app
- Notification chaque matin à 8 h avec le résumé de la journée (fonction `supabase/functions/resume-matin`)
- Bouton 📅 pour ajouter un rappel ou une installation au calendrier du téléphone

## Essayer tout de suite

Sans rien configurer, l'app marche en **mode essai** : les données restent seulement sur ton appareil.
Ouvre `index.html` dans un navigateur, ou active GitHub Pages (étape 3) et ouvre le lien.

## Mise en place pour l'équipe (≈ 15 minutes, une seule fois)

### 1. Créer la base de données (Supabase)

1. Va sur https://supabase.com et crée un compte gratuit.
2. **New project**. Choisis la région **Canada (Central)**. Garde le mot de passe de la base quelque part.
3. Dans le menu de gauche : **SQL Editor** > **New query**. Colle tout le contenu de `supabase.sql` et clique **Run**.

### 2. Brancher l'app sur la base

1. Dans Supabase : **Project Settings** > **API** (ou **Data API**).
2. Copie le **Project URL** et la clé **anon / public**.
3. Colle-les dans `config.js` :

```js
const SUPABASE_URL = "https://xxxxx.supabase.co"
const SUPABASE_KEY = "eyJhbGciOi..."
```

La clé `anon` peut être publique, c'est prévu comme ça. Ce qui protège les données, ce sont les règles dans `supabase.sql` : il faut être connecté pour voir quoi que ce soit.

### 3. Mettre l'app en ligne (GitHub Pages)

1. Sur GitHub, dans le dépôt : **Settings** > **Pages**.
2. **Source** : *Deploy from a branch*, choisis la branche `main` et le dossier `/ (root)`.
3. Après une minute, le lien apparaît (ex. `https://ton-nom.github.io/Job-Bell/`). C'est ce lien que tu envoies à l'équipe.

### 4. Les comptes de l'équipe

Chaque personne ouvre le lien, clique **Créer un compte** et écrit son nom (c'est ce nom qui apparaît sur ses clients).

**Important :** une fois que tout le monde a son compte, ferme les inscriptions pour qu'un inconnu qui trouverait le lien ne puisse pas voir les clients :
Supabase > **Authentication** > **Sign In / Providers** > décoche **Allow new users to sign up**.
Pour ajouter quelqu'un plus tard : **Authentication** > **Users** > **Invite user**.

Si tu ne veux pas que les gens aient à confirmer leur courriel : **Authentication** > **Sign In / Providers** > **Email** > décoche **Confirm email**.

### 5. Installer sur le téléphone

- **iPhone (Safari)** : bouton Partager > *Sur l'écran d'accueil*.
- **Android (Chrome)** : menu ⋮ > *Ajouter à l'écran d'accueil*.

## Bon à savoir

- **Renseignements personnels** : ce sont des infos de clients (nom, téléphone). Avant de lancer l'app, vérifie avec ton gestionnaire que c'est correct avec les règles de Bell et la Loi 25. Mets seulement ce qui est utile au suivi, pas de numéro de compte, NAS, carte de crédit, etc.
- **Plan gratuit Supabase** : 500 Mo de données (les photos sont réduites à ~150 Ko, donc quelques milliers de photos). Un projet qui n'est pas utilisé pendant 7 jours est mis en pause; il suffit de le réactiver dans Supabase.

## Idées pour plus tard

- Lire le numéro de téléphone directement sur la photo (OCR)
- Rappel par notification le matin des clients à rappeler
- Tableau des ventes du mois par vendeur
- Champs par type de service (Internet, Télé, Mobile, Maison intelligente)
- Exporter en Excel
