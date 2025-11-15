# Créer un document Admin - Guide Rapide

## Votre UID
```
tMBumI36wQg0uHSel4saih0SepC3
```

## Méthode 1 : Bouton automatique (Le plus simple)

1. Allez sur `/admin-check` dans votre application
2. Connectez-vous avec votre compte (email/mot de passe ou Google)
3. Cliquez sur le bouton **"Créer automatiquement le document admin"**
4. Attendez le message de confirmation
5. Rechargez la page

## Méthode 2 : Firebase Console (Recommandé si le bouton ne fonctionne pas)

### Étapes détaillées :

1. **Ouvrez Firebase Console**
   - URL : https://console.firebase.google.com/
   - Connectez-vous avec votre compte Google

2. **Sélectionnez le projet**
   - Cliquez sur le projet : **nack-8c299**

3. **Accédez à Firestore Database**
   - Dans le menu de gauche, cliquez sur **"Firestore Database"**
   - Ou allez directement : https://console.firebase.google.com/project/nack-8c299/firestore

4. **Créez la collection `admins` (si elle n'existe pas)**
   - Si vous ne voyez pas la collection `admins`, cliquez sur **"Créer une collection"**
   - Nom de la collection : `admins`
   - Cliquez sur **"Suivant"** puis **"Terminé"** (pas besoin de champs pour la collection)

5. **Créez le document admin**
   - Cliquez sur **"Ajouter un document"** dans la collection `admins`
   - Dans **"ID du document"**, collez votre UID : `tMBumI36wQg0uHSel4saih0SepC3`
   - Cliquez sur **"Enregistrer"** (vous ajouterez les champs après)

6. **Ajoutez les champs requis**
   - Cliquez sur le document que vous venez de créer
   - Cliquez sur **"Ajouter un champ"** pour chaque champ suivant :

   **Champ 1 : `role`**
   - Nom du champ : `role`
   - Type : `string` (chaîne)
   - Valeur : `admin`
   - Cliquez sur **"Enregistrer"**

   **Champ 2 : `createdAt`**
   - Nom du champ : `createdAt`
   - Type : `number` (nombre)
   - Valeur : `1735689600000` (ou utilisez la valeur actuelle : `Date.now()` dans la console du navigateur)
   - Cliquez sur **"Enregistrer"**

   **Champ 3 : `updatedAt`**
   - Nom du champ : `updatedAt`
   - Type : `number` (nombre)
   - Valeur : `1735689600000` (même valeur que createdAt)
   - Cliquez sur **"Enregistrer"**

7. **Vérifiez le document**
   - Votre document devrait ressembler à ceci :
   ```
   Document ID: tMBumI36wQg0uHSel4saih0SepC3
   - role: "admin" (string)
   - createdAt: 1735689600000 (number)
   - updatedAt: 1735689600000 (number)
   ```

8. **Rechargez `/admin-check`**
   - Retournez sur votre application
   - Allez sur `/admin-check`
   - Rechargez la page (F5)
   - Vous devriez voir "✅ Document admin trouvé !"
   - Vous serez automatiquement redirigé vers `/admin`

## Méthode 3 : Script Node.js (Pour développeurs)

Si vous avez configuré les credentials Firebase :

```bash
# Dans le terminal, à la racine du projet
node scripts/promoteAdmin.mjs tMBumI36wQg0uHSel4saih0SepC3
```

## Vérification

Après avoir créé le document :

1. Allez sur `/admin-check`
2. Vous devriez voir :
   - ✅ Utilisateur connecté
   - ✅ Document Admin (Firestore) : Existe
   - ✅ Statut Admin (AuthContext) : Oui
3. Vous serez automatiquement redirigé vers `/admin` après quelques secondes

## Problème persistant ?

Si après avoir créé le document, vous ne voyez toujours pas le statut admin :

1. **Déconnectez-vous** et **reconnectez-vous**
2. **Videz le cache** du navigateur (Ctrl+Shift+Delete)
3. **Attendez 10-15 secondes** pour la synchronisation Firestore
4. **Vérifiez la console** (F12) pour les erreurs

