# Configuration Supabase pour Opa's Bicycle

Ce guide vous explique comment configurer Supabase pour que les données de Opa ne s'effacent jamais.

## 📋 Étapes de configuration

### 1. Créer un projet Supabase

1. Allez sur [supabase.com](https://supabase.com)
2. Créez un compte ou connectez-vous
3. Cliquez sur "New Project"
4. Remplissez les informations :
   - **Name** : OpasBicycle (ou autre nom)
   - **Database Password** : Choisissez un mot de passe fort (notez-le !)
   - **Region** : Choisissez la région la plus proche
5. Cliquez sur "Create new project"
6. Attendez quelques minutes que le projet soit créé

### 2. Créer la table dans Supabase

1. Dans votre projet Supabase, allez dans **SQL Editor** (dans le menu de gauche)
2. Cliquez sur **New query**
3. Copiez et collez le contenu du fichier `supabase_setup.sql`
4. Cliquez sur **Run** (ou appuyez sur Ctrl+Enter)
5. Vous devriez voir "Success. No rows returned"

**Optionnel – Entretien (Garage) :** Pour activer la vue Garage, exécutez aussi `supabase_entretien.sql`, puis créez le bucket **entretien_velo** dans Storage → New bucket (public).

### 3. Récupérer les clés API

1. Dans votre projet Supabase, allez dans **Settings** (⚙️) → **API**
2. Vous verrez deux informations importantes :
   - **Project URL** : C'est votre `SUPABASE_URL`
   - **anon public key** : C'est votre `SUPABASE_KEY`

### 4. Configurer les variables d'environnement

#### Pour le développement local :

Créez un fichier `.env` à la racine du projet avec :

```env
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_KEY=votre_cle_api_anon
```

**Important** : Le fichier `.env` est dans `.gitignore` et ne sera pas versionné.

#### Pour le déploiement (Render, Heroku, etc.) :

Ajoutez les variables d'environnement dans les paramètres de votre service :

- **SUPABASE_URL** : L'URL de votre projet
- **SUPABASE_KEY** : La clé anon/public

### 5. Migrer les données existantes (optionnel)

Si vous avez déjà des données dans `journal_velo.csv`, vous pouvez les migrer :

```bash
# Installer les dépendances si ce n'est pas fait
pip install -r requirements.txt

# Configurer les variables d'environnement (voir étape 4)
# Puis exécuter le script de migration
python migrate_to_supabase.py
```

## ✅ Vérification

Une fois configuré, l'application utilisera automatiquement Supabase si les variables d'environnement sont définies. Sinon, elle utilisera le CSV en fallback.

Pour vérifier que tout fonctionne :

1. Lancez l'application : `python app.py`
2. Ajoutez un nouveau tour
3. Vérifiez dans Supabase (Table Editor) que le tour apparaît dans la table `tours`

## 🔒 Sécurité

- Ne partagez jamais vos clés API
- Le fichier `.env` est déjà dans `.gitignore`
- Utilisez la clé **anon/public** pour le frontend, pas la clé **service_role**

## 📚 Ressources

- [Documentation Supabase](https://supabase.com/docs)
- [Guide Python Supabase](https://supabase.com/docs/reference/python/introduction)
