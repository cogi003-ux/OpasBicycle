-- Migration : Ajouter la colonne 'utilisateur' à la table rides
-- À exécuter dans l'éditeur SQL de Supabase si la table existe déjà

ALTER TABLE rides ADD COLUMN IF NOT EXISTS utilisateur VARCHAR(10) DEFAULT 'Opa';

-- Mettre à jour les enregistrements existants sans utilisateur
UPDATE rides SET utilisateur = 'Opa' WHERE utilisateur IS NULL;
