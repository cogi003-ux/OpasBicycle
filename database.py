"""
Module pour gérer la connexion à Supabase
"""
from supabase import create_client, Client
import os
from typing import List, Dict, Optional

def get_supabase_client() -> Optional[Client]:
    """
    Crée et retourne un client Supabase
    Retourne None si les variables d'environnement ne sont pas configurées
    """
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_KEY')
    
    if not supabase_url or not supabase_key:
        return None
    
    return create_client(supabase_url, supabase_key)

def get_all_tours() -> List[Dict]:
    """Récupère tous les tours depuis Supabase"""
    client = get_supabase_client()
    if not client:
        return []
    
    try:
        response = client.table('tours').select('*').order('id', desc=True).execute()
        return response.data if response.data else []
    except Exception as e:
        print(f"Erreur lors de la récupération des tours: {e}")
        return []

def add_tour(tour_data: Dict) -> bool:
    """Ajoute un nouveau tour dans Supabase"""
    client = get_supabase_client()
    if not client:
        return False
    
    try:
        # Préparer les données pour Supabase
        supabase_data = {
            'date': tour_data.get('Date'),
            'start': tour_data.get('Start'),
            'etape': tour_data.get('Etape') or '',
            'ziel': tour_data.get('Ziel'),
            'wetter': tour_data.get('Wetter'),
            'km': float(tour_data.get('Km', 0)),
            'bemerkungen': tour_data.get('Bemerkungen') or ''
        }
        
        response = client.table('tours').insert(supabase_data).execute()
        return True
    except Exception as e:
        print(f"Erreur lors de l'ajout du tour: {e}")
        return False

def delete_tour(tour_id: int) -> bool:
    """Supprime un tour de Supabase par son ID"""
    client = get_supabase_client()
    if not client:
        return False
    
    try:
        client.table('tours').delete().eq('id', tour_id).execute()
        return True
    except Exception as e:
        print(f"Erreur lors de la suppression du tour: {e}")
        return False
