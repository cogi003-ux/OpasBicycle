"""
Script pour migrer les données du CSV vers Supabase
À exécuter une seule fois après avoir configuré Supabase
"""
import os
import pandas as pd
from database import get_supabase_client

def migrate_csv_to_supabase():
    """Migre les données du CSV vers Supabase"""
    csv_file = "journal_velo.csv"
    
    if not os.path.exists(csv_file):
        print("Aucun fichier CSV trouvé. Rien à migrer.")
        return
    
    # Vérifier que Supabase est configuré
    client = get_supabase_client()
    if not client:
        print("ERREUR: Supabase n'est pas configuré!")
        print("Assurez-vous d'avoir défini SUPABASE_URL et SUPABASE_KEY dans vos variables d'environnement.")
        return
    
    # Lire le CSV
    df = pd.read_csv(csv_file)
    print(f"Lecture de {len(df)} tours depuis le CSV...")
    
    # Vérifier si des données existent déjà dans Supabase
    existing_tours = client.table('tours').select('id').execute()
    if existing_tours.data:
        response = input(f"Il y a déjà {len(existing_tours.data)} tours dans Supabase. Voulez-vous continuer? (o/n): ")
        if response.lower() != 'o':
            print("Migration annulée.")
            return
    
    # Migrer chaque tour
    success_count = 0
    error_count = 0
    
    for idx, row in df.iterrows():
        try:
            tour_data = {
                'date': row.get('Date', ''),
                'start': row.get('Start', ''),
                'etape': row.get('Etape', '') if pd.notna(row.get('Etape')) else '',
                'ziel': row.get('Ziel', ''),
                'wetter': row.get('Wetter', ''),
                'km': float(row.get('Km', 0)),
                'bemerkungen': row.get('Bemerkungen', '') if pd.notna(row.get('Bemerkungen')) else ''
            }
            
            client.table('tours').insert(tour_data).execute()
            success_count += 1
            print(f"✓ Tour {idx + 1}/{len(df)} migré")
        except Exception as e:
            error_count += 1
            print(f"✗ Erreur pour le tour {idx + 1}: {e}")
    
    print(f"\nMigration terminée!")
    print(f"✓ {success_count} tours migrés avec succès")
    if error_count > 0:
        print(f"✗ {error_count} erreurs")

if __name__ == '__main__':
    migrate_csv_to_supabase()
