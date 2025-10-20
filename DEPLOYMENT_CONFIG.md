# Configuration pour différents types de déploiement

## Pour Vercel
Créer un fichier `vercel.json` à la racine du projet :

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

## Pour Netlify
Créer un fichier `public/_redirects` :

```
/*    /index.html   200
```

## Pour Apache
Créer un fichier `.htaccess` dans le dossier public :

```apache
Options -MultiViews
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.html [QSA,L]
```

## Pour Nginx
Configuration dans le fichier nginx.conf :

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

## Pour GitHub Pages
Créer un fichier `public/404.html` identique à `index.html`
