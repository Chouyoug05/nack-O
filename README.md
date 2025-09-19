# Nack Gabonese Drinks Hub

## Déploiement (Vite)

1) Variables d’environnement (Vercel/Netlify/Firebase Hosting) – créer un fichier `.env` local à partir de `env.example` et configurer ces clés dans votre hébergeur:

```
VITE_PUBLIC_BASE_URL=https://app.votre-domaine.com
VITE_SINGPAY_CLIENT_ID=... (ne pas committer)
VITE_SINGPAY_CLIENT_SECRET=... (ne pas committer)
VITE_SINGPAY_WALLET=682211c3ac445b0a4e899383
VITE_SINGPAY_DISBURSEMENT=686119e88718fef8d176f4fa
```

2) Build & output
- Build: `npm run build`
- Output: `dist`

3) Redirections paiement
- Success: `${VITE_PUBLIC_BASE_URL}/payment/success`
- Error: `${VITE_PUBLIC_BASE_URL}/payment/error`
- Déclarez ces URLs dans le back-office SingPay.

4) Notes de sécurité
- Les identifiants SingPay sont utilisés côté front pour ce lancement test. Avant la prod, déporter l’appel vers une fonction serverless/proxy pour ne pas exposer les secrets.

## Abonnement & Essai
- Nouveaux comptes: essai gratuit 7 jours (popup guide + compte à rebours).
- Après 7 jours: blocage avec bouton de paiement SingPay.
- Paiement réussi: abonnement actif 30 jours (compte à rebours affiché).

## Fonctionnalités en cours
- Équipe: disponible en novembre (boutons désactivés + message).
- Événements: disponible en décembre (popup d’information à l’ouverture de l’onglet).

## Développement local
```
npm i
npm run dev
```

Technos: Vite + React + TypeScript + Tailwind + shadcn-ui.
