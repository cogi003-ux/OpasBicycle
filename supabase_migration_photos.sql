-- Migration : Ajout de la colonne photos pour stocker les URLs des photos des tours
-- À exécuter dans l'éditeur SQL de Supabase
-- Bucket utilisé : tour-photos (créé manuellement dans Storage)

ALTER TABLE rides
ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN rides.photos IS 'Tableau JSON des URLs publiques des photos du tour (Supabase Storage tour-photos)';
