-- Migration : ajouter Titine comme utilisateur valide dans la table entretien
-- À exécuter dans l'éditeur SQL de Supabase

-- Supprimer l'ancienne contrainte CHECK
ALTER TABLE entretien DROP CONSTRAINT IF EXISTS entretien_utilisateur_check;

-- Ajouter la nouvelle contrainte avec Titine
ALTER TABLE entretien ADD CONSTRAINT entretien_utilisateur_check
    CHECK (utilisateur IN ('Oswald', 'Titine', 'Alexandre', 'Damien'));
