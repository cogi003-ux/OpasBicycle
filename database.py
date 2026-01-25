"""
Module pour gérer la connexion à Supabase
"""
from supabase import create_client, Client
import os
from typing import List, Dict, Optional

TABLE_NAME = 'rides'

def get_supabase_client() -> Optional[Client]:
    """
    Crée et retourne un client Supabase
    Retourne None si les variables d'environnement ne sont pas configurées
    """
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_KEY')
    
    if not supabase_url or not supabase_key:
        print("⚠️  SUPABASE_URL ou SUPABASE_KEY non définis dans les variables d'environnement")
        return None
    
    try:
        client = create_client(supabase_url, supabase_key)
        return client
    except Exception as e:
        print(f"Erreur lors de la création du client Supabase: {e}")
        return None

def create_table_if_not_exists():
    """
    Crée la table 'rides' dans Supabase si elle n'existe pas
    Utilise l'API REST de Supabase pour exécuter du SQL
    """
    client = get_supabase_client()
    if not client:
        return False
    
    try:
        # Vérifier si la table existe en essayant de la lire
        # Si elle n'existe pas, on la crée
        try:
            client.table(TABLE_NAME).select('id').limit(1).execute()
            # La table existe déjà
            return True
        except Exception:
            # La table n'existe pas, on la crée
            # Note: Supabase Python client ne supporte pas directement l'exécution SQL
            # On utilise une approche alternative : essayer d'insérer une ligne de test
            # Si ça échoue, on suppose que la table n'existe pas
            # Dans ce cas, l'utilisateur devra créer la table manuellement via le SQL Editor
            # OU on peut utiliser l'API REST directement
            
            # Pour l'instant, on retourne True et on laisse l'utilisateur créer la table
            # via le SQL Editor ou on utilise une migration automatique
            print(f"⚠️  La table '{TABLE_NAME}' n'existe pas encore.")
            print(f"   Veuillez exécuter le SQL suivant dans Supabase SQL Editor:")
            print(f"   CREATE TABLE IF NOT EXISTS {TABLE_NAME} (")
            print(f"       id SERIAL PRIMARY KEY,")
            print(f"       date VARCHAR(10) NOT NULL,")
            print(f"       start VARCHAR(255) NOT NULL,")
            print(f"       etape VARCHAR(255),")
            print(f"       ziel VARCHAR(255) NOT NULL,")
            print(f"       wetter VARCHAR(255),")
            print(f"       km DECIMAL(10, 1) NOT NULL,")
            print(f"       bemerkungen TEXT,")
            print(f"       created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()")
            print(f"   );")
            return False
    except Exception as e:
        print(f"Erreur lors de la vérification/création de la table: {e}")
        return False

def ensure_table_exists():
    """
    S'assure que la table existe, sinon tente de la créer via une requête SQL directe
    """
    client = get_supabase_client()
    if not client:
        return False
    
    # Utiliser l'API REST pour exécuter du SQL
    # Note: Cela nécessite la clé service_role, pas la clé anon
    # Pour une solution plus simple, on vérifie juste si on peut lire la table
    try:
        client.table(TABLE_NAME).select('id').limit(1).execute()
        return True
    except Exception as e:
        # Si l'erreur indique que la table n'existe pas, on affiche les instructions
        error_msg = str(e).lower()
        if 'relation' in error_msg and 'does not exist' in error_msg:
            print(f"\n⚠️  ATTENTION: La table '{TABLE_NAME}' n'existe pas dans Supabase!")
            print(f"   Veuillez créer la table en exécutant ce SQL dans Supabase SQL Editor:\n")
            print(f"   CREATE TABLE {TABLE_NAME} (")
            print(f"       id SERIAL PRIMARY KEY,")
            print(f"       date VARCHAR(10) NOT NULL,")
            print(f"       start VARCHAR(255) NOT NULL,")
            print(f"       etape VARCHAR(255),")
            print(f"       ziel VARCHAR(255) NOT NULL,")
            print(f"       wetter VARCHAR(255),")
            print(f"       km DECIMAL(10, 1) NOT NULL,")
            print(f"       bemerkungen TEXT,")
            print(f"       created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()")
            print(f"   );")
            print(f"\n   Ou utilisez le fichier supabase_setup.sql\n")
        return False

def get_all_tours() -> List[Dict]:
    """Récupère tous les tours depuis Supabase"""
    client = get_supabase_client()
    if not client:
        return []
    
    # S'assurer que la table existe
    ensure_table_exists()
    
    try:
        response = client.table(TABLE_NAME).select('*').order('id', desc=True).execute()
        return response.data if response.data else []
    except Exception as e:
        print(f"Erreur lors de la récupération des tours: {e}")
        return []

def add_tour(tour_data: Dict) -> tuple[bool, str]:
    """
    Ajoute un nouveau tour dans Supabase
    Retourne (success: bool, message: str)
    """
    client = get_supabase_client()
    if not client:
        return False, "Supabase non configuré: SUPABASE_URL ou SUPABASE_KEY manquants"
    
    # Vérifier que la table existe
    if not ensure_table_exists():
        return False, f"La table '{TABLE_NAME}' n'existe pas dans Supabase. Veuillez l'exécuter dans SQL Editor."
    
    try:
        # Préparer les données pour Supabase - vérifier que toutes les colonnes requises sont présentes
        supabase_data = {
            'date': str(tour_data.get('Date', '')),
            'start': str(tour_data.get('Start', '')),
            'etape': str(tour_data.get('Etape', '')) if tour_data.get('Etape') and tour_data.get('Etape') != 'N/A' else None,
            'ziel': str(tour_data.get('Ziel', '')),
            'wetter': str(tour_data.get('Wetter', '')) if tour_data.get('Wetter') else None,
            'km': float(tour_data.get('Km', 0)),
            'bemerkungen': str(tour_data.get('Bemerkungen', '')) if tour_data.get('Bemerkungen') else None
        }
        
        # Valider les champs requis
        if not supabase_data['date']:
            return False, "La date est requise"
        if not supabase_data['start']:
            return False, "Le lieu de départ est requis"
        if not supabase_data['ziel']:
            return False, "Le lieu d'arrivée est requis"
        
        # Insérer dans Supabase
        response = client.table(TABLE_NAME).insert(supabase_data).execute()
        
        if response.data:
            return True, "Tour enregistré avec succès"
        else:
            return False, "Aucune donnée retournée par Supabase"
            
    except Exception as e:
        error_msg = str(e)
        print(f"Erreur détaillée lors de l'ajout du tour: {error_msg}")
        
        # Messages d'erreur plus explicites
        if 'relation' in error_msg.lower() and 'does not exist' in error_msg.lower():
            return False, f"La table '{TABLE_NAME}' n'existe pas. Exécutez le SQL dans Supabase SQL Editor."
        elif 'permission denied' in error_msg.lower() or 'unauthorized' in error_msg.lower():
            return False, "Erreur d'authentification Supabase. Vérifiez SUPABASE_KEY."
        elif 'null value' in error_msg.lower():
            return False, f"Champ requis manquant: {error_msg}"
        else:
            return False, f"Erreur Supabase: {error_msg}"

def delete_tour(tour_id: int) -> bool:
    """Supprime un tour de Supabase par son ID"""
    client = get_supabase_client()
    if not client:
        return False
    
    try:
        client.table(TABLE_NAME).delete().eq('id', tour_id).execute()
        return True
    except Exception as e:
        print(f"Erreur lors de la suppression du tour: {e}")
        return False
