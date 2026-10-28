# Volley SMT

Application du club Volley-Ball Loisirs Saint-Mathieu-de-Tréviers (voir `CLAUDE.md`).

## Démarrage local

```bash
npm install
cp .env.example .env.local   # renseigner l'URL et la clé anon du projet Supabase
npm run dev
```

## Configuration Supabase (Authentication)

1. **Sign In / Providers** : Email activé, **« Allow new users to sign up » désactivé**.
2. **URL Configuration** : *Site URL* = URL Vercel de prod ; ajouter `http://localhost:3000/**` aux *Redirect URLs*.
3. **Emails > Magic Link** : coller `supabase/templates/magic_link.html` (lien vers `/auth/confirm?token_hash=…`).
4. **SMTP** : serveur Brevo (`smtp-relay.brevo.com`, port 587).
5. Appliquer les migrations : `supabase db push`.

Les comptes sont créés par le Bureau (import), puis rattachés automatiquement à la fiche adhérent de même email à la première connexion.
