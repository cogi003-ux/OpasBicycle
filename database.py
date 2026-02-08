"""
Module pour gérer la connexion à Supabase
"""
from supabase import create_client, Client
import os
import uuid
from typing import List, Dict, Optional, Tuple

TABLE_NAME = 'rides'
PHOTOS_BUCKET = 'tour-photos'
DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'

def log_debug(message: str):
    """Log uniquement si DEBUG est activé"""
    if DEBUG:
        print(f"[DEBUG] {message}")

def log_error(message: str):
    """Log les erreurs toujours"""
    print(f"[ERROR] {message}")

def get_supabase_client() -> Optional[Client]:
    """
    Crée et retourne un client Supabase
    Retourne None si les variables d'environnement ne sont pas configurées
    """
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_KEY')
    
    # Logs détaillés pour débogage (uniquement si DEBUG activé)
    log_debug("Vérification variables d'environnement")
    log_debug(f"SUPABASE_URL présent: {bool(supabase_url)}")
    if supabase_url and DEBUG:
        log_debug(f"SUPABASE_URL longueur: {len(supabase_url)} caractères")
        log_debug(f"SUPABASE_URL commence par: {supabase_url[:20]}...")
    log_debug(f"SUPABASE_KEY présent: {bool(supabase_key)}")
    if supabase_key and DEBUG:
        log_debug(f"SUPABASE_KEY longueur: {len(supabase_key)} caractères")
        log_debug(f"SUPABASE_KEY commence par: {supabase_key[:10]}...")
    
    if not supabase_url or not supabase_key:
        log_error("⚠️  SUPABASE_URL ou SUPABASE_KEY non définis dans les variables d'environnement")
        return None
    
    try:
        log_debug("Création du client Supabase...")
        client = create_client(supabase_url, supabase_key)
        log_debug("Client Supabase créé avec succès")
        return client
    except Exception as e:
        log_error(f"Erreur lors de la création du client Supabase: {type(e).__name__}: {e}")
        if DEBUG:
            import traceback
            log_error("Traceback complet:")
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
    try:
        client = get_supabase_client()
        if not client:
            log_debug("Client Supabase non disponible")
            return []
        
        # Ne pas bloquer si la table n'existe pas encore
        try:
            response = client.table(TABLE_NAME).select('*').order('id', desc=True).execute()
            return response.data if response.data else []
        except Exception as e:
            error_msg = str(e).lower()
            # Si la table n'existe pas, retourner une liste vide plutôt que de planter
            if 'relation' in error_msg and 'does not exist' in error_msg:
                log_debug(f"Table '{TABLE_NAME}' n'existe pas encore")
                return []
            else:
                log_error(f"Erreur lors de la récupération des tours: {e}")
                return []
    except Exception as e:
        log_error(f"Exception dans get_all_tours: {e}")
        return []

def add_tour(tour_data: Dict) -> tuple[bool, str]:
    """
    Ajoute un nouveau tour dans Supabase
    Retourne (success: bool, message: str)
    """
    log_debug("===== DÉBUT add_tour =====")
    log_debug(f"Données reçues: {tour_data}")
    
    client = get_supabase_client()
    if not client:
        error_msg = "Supabase non configuré: SUPABASE_URL ou SUPABASE_KEY manquants"
        log_error(error_msg)
        return False, error_msg
    
    # Vérifier que la table existe
    log_debug(f"Vérification de l'existence de la table '{TABLE_NAME}'...")
    if not ensure_table_exists():
        error_msg = f"La table '{TABLE_NAME}' n'existe pas dans Supabase. Veuillez l'exécuter dans SQL Editor."
        log_error(error_msg)
        return False, error_msg
    log_debug(f"Table '{TABLE_NAME}' existe")
    
    try:
        # Préparer les données pour Supabase - ALIGNEMENT EXACT avec les colonnes de la table
        # Colonnes Supabase: date, start, etape, ziel, wetter, km, bemerkungen (toutes en minuscules)
        log_debug("Préparation des données pour Supabase...")
        
        # Conversion et validation des types de données SQL
        date_str = str(tour_data.get('Date', '')).strip()
        start_str = str(tour_data.get('Start', '')).strip()
        ziel_str = str(tour_data.get('Ziel', '')).strip()
        km_value = tour_data.get('Km', 0)
        
        # Convertir km en float (DECIMAL en SQL)
        try:
            km_float = float(km_value) if km_value else 0.0
        except (ValueError, TypeError):
            km_float = 0.0
        
        # Préparer les données avec les noms de colonnes EXACTS (minuscules)
        utilisateur = str(tour_data.get('Utilisateur', 'Oswald')).strip()
        if utilisateur not in ('Oswald', 'Alexandre', 'Damien'):
            utilisateur = 'Damien' if utilisateur.upper() == 'MOI' else 'Oswald'
        
        supabase_data = {
            'date': date_str,  # VARCHAR(10) NOT NULL
            'start': start_str,  # VARCHAR(255) NOT NULL
            'ziel': ziel_str,  # VARCHAR(255) NOT NULL
            'km': km_float,  # DECIMAL(10, 1) NOT NULL - converti en float
            'utilisateur': utilisateur,  # Oswald, Alexandre ou Damien
            # Champs optionnels (peuvent être NULL)
            'etape': None,
            'wetter': None,
            'bemerkungen': None
        }
        
        # Gérer les champs optionnels
        etape_val = tour_data.get('Etape', '')
        if etape_val and etape_val != 'N/A' and str(etape_val).strip():
            supabase_data['etape'] = str(etape_val).strip()
        
        wetter_val = tour_data.get('Wetter', '')
        if wetter_val and str(wetter_val).strip():
            supabase_data['wetter'] = str(wetter_val).strip()
        
        bemerkungen_val = tour_data.get('Bemerkungen', '')
        if bemerkungen_val and str(bemerkungen_val).strip():
            supabase_data['bemerkungen'] = str(bemerkungen_val).strip()
        
        # Log des données préparées
        log_debug("Données préparées pour Supabase (colonnes en minuscules):")
        for key, value in supabase_data.items():
            log_debug(f"  {key}: {repr(value)} (type: {type(value).__name__})")
        
        # Valider les champs requis (NOT NULL dans SQL)
        if not supabase_data['date']:
            error_msg = "La date est requise"
            log_error(error_msg)
            return False, error_msg
        if not supabase_data['start']:
            error_msg = "Le lieu de départ est requis"
            log_error(error_msg)
            return False, error_msg
        if not supabase_data['ziel']:
            error_msg = "Le lieu d'arrivée est requis"
            log_error(error_msg)
            return False, error_msg
        
        # Insérer dans Supabase
        log_debug(f"Tentative d'insertion dans la table '{TABLE_NAME}'...")
        log_debug(f"Données à insérer: {supabase_data}")
        
        response = client.table(TABLE_NAME).insert(supabase_data).execute()
        
        log_debug("Réponse Supabase reçue")
        log_debug(f"Response.data: {response.data}")
        
        if response.data:
            tour_id = response.data[0].get('id', 'N/A') if response.data else 'N/A'
            log_debug(f"Tour enregistré avec succès. ID: {tour_id}")
            return True, "Tour enregistré avec succès"
        else:
            error_msg = "Aucune donnée retournée par Supabase"
            log_error(error_msg)
            return False, error_msg
            
    except Exception as e:
        error_msg = str(e)
        error_type = type(e).__name__
        log_error("===== ERREUR LORS DE L'AJOUT DU TOUR =====")
        log_error(f"Type d'erreur: {error_type}")
        log_error(f"Erreur Supabase: {e}")
        print(f"Erreur Supabase: {e}")  # Log supplémentaire pour Render
        if DEBUG:
            try:
                log_error(f"Données qui ont causé l'erreur: {supabase_data}")
            except:
                log_error("Données non disponibles")
            import traceback
            log_error("Traceback complet:")
            traceback.print_exc()
        log_error("===========================================")
        
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


def upload_photo_to_tour(tour_id: int, file_content: bytes, filename: str, content_type: str) -> Tuple[bool, str]:
    """
    Envoie une photo vers le bucket tour-photos et enregistre l'URL dans la colonne photos du tour.
    Retourne (success: bool, url_ou_erreur: str)
    """
    client = get_supabase_client()
    if not client:
        return False, "Supabase non configuré"

    # Extension et nom unique pour éviter les collisions
    ext = os.path.splitext(filename)[1].lower() or '.jpg'
    if ext not in ('.jpg', '.jpeg', '.png', '.gif', '.webp'):
        ext = '.jpg'
    storage_path = f"{tour_id}/{uuid.uuid4().hex}{ext}"

    try:
        # Upload vers Supabase Storage
        client.storage.from_(PHOTOS_BUCKET).upload(
            storage_path,
            file_content,
            file_options={"content-type": content_type or "image/jpeg"}
        )
        # Récupérer l'URL publique
        public_url = client.storage.from_(PHOTOS_BUCKET).get_public_url(storage_path)

        # Récupérer les photos actuelles, ajouter la nouvelle URL
        response = client.table(TABLE_NAME).select('photos').eq('id', tour_id).single().execute()
        photos = response.data.get('photos') if response.data else []
        if not isinstance(photos, list):
            photos = photos if photos else []
        photos.append(public_url)

        # Mettre à jour la colonne photos
        client.table(TABLE_NAME).update({'photos': photos}).eq('id', tour_id).execute()
        return True, public_url
    except Exception as e:
        log_error(f"Erreur lors de l'upload photo pour tour {tour_id}: {e}")
        return False, str(e)
