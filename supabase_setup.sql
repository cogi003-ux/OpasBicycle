-- Script SQL pour créer la table 'rides' dans Supabase
-- À exécuter dans l'éditeur SQL de Supabase

CREATE TABLE IF NOT EXISTS rides (
    id SERIAL PRIMARY KEY,
    date VARCHAR(10) NOT NULL,
    start VARCHAR(255) NOT NULL,
    etape VARCHAR(255),
    ziel VARCHAR(255) NOT NULL,
    wetter VARCHAR(255),
    km DECIMAL(10, 1) NOT NULL,
    bemerkungen TEXT,
    utilisateur VARCHAR(10) DEFAULT 'Opa',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Créer un index sur la date pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_rides_date ON rides(date);

-- Créer un index sur created_at pour le tri
CREATE INDEX IF NOT EXISTS idx_rides_created_at ON rides(created_at DESC);
