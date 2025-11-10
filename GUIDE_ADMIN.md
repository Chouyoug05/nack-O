# Guide d'accès au compte Admin

## Comment accéder au tableau de bord Admin

### Étape 1 : Vérifier votre statut admin

1. **Connectez-vous** à votre compte sur l'application
2. **Accédez à la page de diagnostic** : `/admin-check`
   - URL complète : `https://votre-domaine.com/admin-check`
   - Ou tapez dans la barre d'adresse : `/admin-check` après votre URL de base

3. Cette page vous indiquera :
   - ✅ Si vous êtes connecté
   - ✅ Si vous avez un document admin dans Firestore
   - ✅ Si le système vous reconnaît comme admin

### Étape 2 : Créer un compte admin (si nécessaire)

Si la page `/admin-check` indique que le document admin n'existe pas, vous devez créer un compte admin.

#### Option A : Utiliser le script promoteAdmin.mjs (Recommandé)

1. **Ouvrez un terminal** dans le dossier du projet
2. **Exécutez le script** avec votre UID (visible sur la page `/admin-check`) :

```bash
# Windows PowerShell
$env:FIREBASE_PROJECT_ID="nack-8c299"
$env:SERVICE_ACCOUNT_JSON='{"type":"service_account",...}' # Votre JSON complet
node scripts/promoteAdmin.mjs VOTRE_UID_ICI
```

**OU** si vous avez un fichier de service account :

```bash
# Windows PowerShell
$env:FIREBASE_PROJECT_ID="nack-8c299"
$env:SERVICE_ACCOUNT_PATH="chemin/vers/votre/service-account.json"
node scripts/promoteAdmin.mjs VOTRE_UID_ICI
```

#### Option B : Créer manuellement dans Firebase Console

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet : `nack-8c299`
3. Allez dans **Firestore Database**
4. Créez une collection nommée `admins` (si elle n'existe pas)
5. Créez un document avec :
   - **Document ID** : Votre UID (visible sur `/admin-check`)
   - **Champs** :
     - `role` : `"admin"` (string)
     - `createdAt` : timestamp (nombre)
     - `updatedAt` : timestamp (nombre)

### Étape 3 : Accéder au tableau de bord Admin

Une fois le document admin créé :

1. **Rechargez la page** `/admin-check`
2. **Vérifiez** que tous les indicateurs sont verts ✅
3. **Cliquez sur** "Essayer d'accéder à /admin" ou allez directement à `/admin`

## URL directes

- **Page de diagnostic** : `/admin-check`
- **Tableau de bord Admin** : `/admin`

## Dépannage

### Problème : "Vous n'êtes pas autorisé"
- Vérifiez que le document admin existe dans Firestore
- Déconnectez-vous et reconnectez-vous
- Videz le cache du navigateur (Ctrl+Shift+Delete)

### Problème : Le document existe mais je ne peux pas accéder
- Attendez quelques secondes pour la synchronisation
- Rechargez complètement la page (Ctrl+F5)
- Vérifiez la console du navigateur (F12) pour les erreurs

### Problème : Je ne trouve pas mon UID
- Allez sur `/admin-check` - votre UID est affiché sur cette page
- Ou allez dans Firebase Console > Authentication > Users

## Aide supplémentaire

Si vous avez toujours des problèmes, la page `/admin-check` vous donnera des instructions détaillées et pourra même corriger automatiquement certains problèmes.

