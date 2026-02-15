-- Table Entretien : vélos et maintenance liés aux utilisateurs
-- À exécuter dans l'éditeur SQL de Supabase
-- Bucket à créer manuellement : entretien_velo (Storage → New bucket → public)

CREATE TABLE IF NOT EXISTS entretien (
    id SERIAL PRIMARY KEY,
    utilisateur VARCHAR(20) NOT NULL DEFAULT 'Oswald' CHECK (utilisateur IN ('Oswald', 'Titine', 'Alexandre', 'Damien')),
    nom_velo VARCHAR(255) NOT NULL DEFAULT 'Mon vélo',
    km_actuel DECIMAL(12, 1) DEFAULT 0,
    date_prochain_entretien DATE,
    url_photo_velo TEXT,
    url_facture TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entretien_utilisateur ON entretien(utilisateur);

COMMENT ON TABLE entretien IS 'Entretien vélos - photos et factures stockées dans bucket entretien_velo';
