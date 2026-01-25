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
    
    # Logs détaillés pour débogage
    print(f"[DEBUG] Vérification variables d'environnement:")
    print(f"[DEBUG] SUPABASE_URL présent: {bool(supabase_url)}")
    if supabase_url:
        print(f"[DEBUG] SUPABASE_URL longueur: {len(supabase_url)} caractères")
        print(f"[DEBUG] SUPABASE_URL commence par: {supabase_url[:20]}...")
    print(f"[DEBUG] SUPABASE_KEY présent: {bool(supabase_key)}")
    if supabase_key:
        print(f"[DEBUG] SUPABASE_KEY longueur: {len(supabase_key)} caractères")
        print(f"[DEBUG] SUPABASE_KEY commence par: {supabase_key[:10]}...")
    
    if not supabase_url or not supabase_key:
        print("[ERROR] ⚠️  SUPABASE_URL ou SUPABASE_KEY non définis dans les variables d'environnement")
        return None
    
    try:
        print("[DEBUG] Création du client Supabase...")
        client = create_client(supabase_url, supabase_key)
        print("[DEBUG] Client Supabase créé avec succès")
        return client
    except Exception as e:
        print(f"[ERROR] Erreur lors de la création du client Supabase: {type(e).__name__}: {e}")
        import traceback
        print(f"[ERROR] Traceback complet:")
        traceback.print_exc()
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
    print(f"[DEBUG] ===== DÉBUT add_tour =====")
    print(f"[DEBUG] Données reçues: {tour_data}")
    
    client = get_supabase_client()
    if not client:
        error_msg = "Supabase non configuré: SUPABASE_URL ou SUPABASE_KEY manquants"
        print(f"[ERROR] {error_msg}")
        return False, error_msg
    
    # Vérifier que la table existe
    print(f"[DEBUG] Vérification de l'existence de la table '{TABLE_NAME}'...")
    if not ensure_table_exists():
        error_msg = f"La table '{TABLE_NAME}' n'existe pas dans Supabase. Veuillez l'exécuter dans SQL Editor."
        print(f"[ERROR] {error_msg}")
        return False, error_msg
    print(f"[DEBUG] Table '{TABLE_NAME}' existe")
    
    try:
        # Préparer les données pour Supabase - vérifier que toutes les colonnes requises sont présentes
        print(f"[DEBUG] Préparation des données pour Supabase...")
        supabase_data = {
            'date': str(tour_data.get('Date', '')),
            'start': str(tour_data.get('Start', '')),
            'etape': str(tour_data.get('Etape', '')) if tour_data.get('Etape') and tour_data.get('Etape') != 'N/A' else None,
            'ziel': str(tour_data.get('Ziel', '')),
            'wetter': str(tour_data.get('Wetter', '')) if tour_data.get('Wetter') else None,
            'km': float(tour_data.get('Km', 0)),
            'bemerkungen': str(tour_data.get('Bemerkungen', '')) if tour_data.get('Bemerkungen') else None
        }
        
        print(f"[DEBUG] Données préparées pour Supabase:")
        for key, value in supabase_data.items():
            print(f"[DEBUG]   {key}: {value} (type: {type(value).__name__})")
        
        # Valider les champs requis
        if not supabase_data['date']:
            error_msg = "La date est requise"
            print(f"[ERROR] {error_msg}")
            return False, error_msg
        if not supabase_data['start']:
            error_msg = "Le lieu de départ est requis"
            print(f"[ERROR] {error_msg}")
            return False, error_msg
        if not supabase_data['ziel']:
            error_msg = "Le lieu d'arrivée est requis"
            print(f"[ERROR] {error_msg}")
            return False, error_msg
        
        # Insérer dans Supabase
        print(f"[DEBUG] Tentative d'insertion dans la table '{TABLE_NAME}'...")
        print(f"[DEBUG] Données à insérer: {supabase_data}")
        response = client.table(TABLE_NAME).insert(supabase_data).execute()
        print(f"[DEBUG] Réponse Supabase reçue")
        print(f"[DEBUG] Type de réponse: {type(response)}")
        print(f"[DEBUG] Response.data: {response.data}")
        print(f"[DEBUG] Response.status_code: {getattr(response, 'status_code', 'N/A')}")
        
        if response.data:
            print(f"[SUCCESS] Tour enregistré avec succès. ID: {response.data[0].get('id', 'N/A') if response.data else 'N/A'}")
            return True, "Tour enregistré avec succès"
        else:
            error_msg = "Aucune donnée retournée par Supabase"
            print(f"[ERROR] {error_msg}")
            return False, error_msg
            
    except Exception as e:
        error_msg = str(e)
        error_type = type(e).__name__
        print(f"[ERROR] ===== ERREUR LORS DE L'AJOUT DU TOUR =====")
        print(f"[ERROR] Type d'erreur: {error_type}")
        print(f"[ERROR] Message d'erreur: {error_msg}")
        print(f"[ERROR] Données qui ont causé l'erreur: {supabase_data}")
        import traceback
        print(f"[ERROR] Traceback complet:")
        traceback.print_exc()
        print(f"[ERROR] ===========================================")
        
        # Messages d'erreur plus explicites
        if 'relation' in error_msg.lower() and 'does not exist' in error_msg.lower():
            return False, f"La table '{TABLE_NAME}' n'existe pas. Exécutez le SQL dans Supabase SQL Editor."
        elif 'permission denied' in error_msg.lower() or 'unauthorized' in error_msg.lower() or '401' in error_msg:
            return False, "Erreur d'authentification Supabase. Vérifiez SUPABASE_KEY."
        elif 'null value' in error_msg.lower() or 'not null' in error_msg.lower():
            return False, f"Champ requis manquant: {error_msg}"
        elif 'column' in error_msg.lower() and 'does not exist' in error_msg.lower():
            return False, f"Colonne inexistante dans la table: {error_msg}"
        else:
            return False, f"Erreur Supabase ({error_type}): {error_msg}"

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
