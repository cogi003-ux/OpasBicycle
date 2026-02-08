from flask import Flask, render_template, request, jsonify
import datetime
import pandas as pd
import requests
import os
import urllib.parse
from database import get_all_tours, add_tour as add_tour_db, delete_tour as delete_tour_db, upload_photo_to_tour as upload_photo_db

app = Flask(__name__)
app.config['JSON_AS_ASCII'] = False

FICHIER_DATA = "journal_velo.csv"
USE_SUPABASE = os.getenv('SUPABASE_URL') and os.getenv('SUPABASE_KEY')
TOUR_DU_MONDE_KM = 40075  # Circonférence de la Terre en km

def _normalize_utilisateur(val):
    """Normalise l'utilisateur : Damien ou Opa. 'Moi' -> 'Damien' pour rétrocompatibilité."""
    v = str(val or 'Opa').strip()
    if v.upper() == 'MOI':
        return 'Damien'
    if v == 'Damien' or v == 'Opa':
        return v
    return 'Opa'

def obtenir_meteo(ville):
    if not ville or ville.strip() == "":
        return "N/A"
    try:
        # Utiliser units=metric dans les params pour forcer les Celsius
        url = f"https://wttr.in/{ville}"
        params = {
            'format': '%C+%t',
            'lang': 'de',
            'units': 'metric'  # Force les degrés Celsius
        }
        r = requests.get(url, params=params, timeout=10)
        if r.status_code == 200:
            result = r.text.strip()
            # Vérification de sécurité : convertir °F en °C si nécessaire
            if '°F' in result:
                import re
                def f_to_c(match):
                    f = float(match.group(1))
                    c = (f - 32) * 5/9
                    return f"{c:.0f}°C"
                result = re.sub(r'(-?\d+(?:\.\d+)?)°F', f_to_c, result)
            return result
        return "N/A"
    except Exception as e:
        print(f"[ERROR] Erreur météo pour {ville}: {e}")
        return "N/A"

def charger_donnees():
    """Charge les données depuis Supabase ou CSV selon la configuration"""
    if USE_SUPABASE:
        # Utiliser Supabase
        tours = get_all_tours()
        if not tours:
            return pd.DataFrame(columns=["Date", "Start", "Etape", "Ziel", "Wetter", "Km", "Bemerkungen", "Utilisateur"])
        
        # Convertir les données Supabase en DataFrame
        data = []
        for tour in tours:
            data.append({
                "Date": tour.get('date', ''),
                "Start": tour.get('start', ''),
                "Etape": tour.get('etape', '') if tour.get('etape') else '',
                "Ziel": tour.get('ziel', ''),
                "Wetter": tour.get('wetter', ''),
                "Km": float(tour.get('km', 0)),
                "Bemerkungen": tour.get('bemerkungen', '') if tour.get('bemerkungen') else '',
                "Utilisateur": _normalize_utilisateur(tour.get('utilisateur', 'Opa'))
            })
        
        df = pd.DataFrame(data)
        if not df.empty:
            df['Date_dt'] = pd.to_datetime(df['Date'], format='%d/%m/%Y', errors='coerce')
        return df
    else:
        # Fallback sur CSV
        if os.path.exists(FICHIER_DATA):
            df = pd.read_csv(FICHIER_DATA)
            df['Date_dt'] = pd.to_datetime(df['Date'], format='%d/%m/%Y', errors='coerce')
            # Ajouter colonne Utilisateur si absente (anciens fichiers) - défaut Opa
            if 'Utilisateur' not in df.columns:
                df['Utilisateur'] = 'Opa'
            df['Utilisateur'] = df['Utilisateur'].fillna('Opa').astype(str).apply(_normalize_utilisateur)
            return df
        return pd.DataFrame(columns=["Date", "Start", "Etape", "Ziel", "Wetter", "Km", "Bemerkungen", "Utilisateur"])

@app.route('/')
def index():
    return render_template('index.html', use_supabase=USE_SUPABASE)

@app.route('/api/tours', methods=['GET'])
def get_tours():
    try:
        df = charger_donnees()
    except Exception as e:
        print(f"[ERROR] Erreur lors du chargement des données: {e}")
        # Retourner des données vides plutôt que de planter
        df = pd.DataFrame(columns=["Date", "Start", "Etape", "Ziel", "Wetter", "Km", "Bemerkungen", "Utilisateur"])
    
    if df.empty:
        empty_prog = {
            'ville_actuelle': '🏠 Kettenis',
            'prochaine_ville': '🇧🇪 Liège',
            'km_restants': 30.0,
            'progression': 0.0,
            'distance_kettenis': 30.0,
            'world_tour_pct': 0.0
        }
        empty_stats = {
            'total_global': 0,
            'total_aujourdhui': 0,
            'total_semaine': 0,
            'total_mois': 0,
            'total_annee': 0
        }
        return jsonify({
            'tours': [],
            'stats': empty_stats,
            'stats_damien': empty_stats.copy(),
            'stats_opa': empty_stats.copy(),
            'progression': empty_prog,
            'progression_damien': empty_prog.copy(),
            'progression_opa': empty_prog.copy(),
            'challenge': {
                'total_damien': 0,
                'total_opa': 0,
                'leader': 'Unentschieden',
                'difference': 0,
                'world_tour_damien': {'km': 0, 'pct': 0, 'target': TOUR_DU_MONDE_KM},
                'world_tour_opa': {'km': 0, 'pct': 0, 'target': TOUR_DU_MONDE_KM}
            }
        })
    
    total_global = df['Km'].sum()
    
    # Stats temporelles : somme filtrée par Utilisateur (Damien / Opa)
    df_util = df.copy()
    if 'Utilisateur' not in df_util.columns:
        df_util['Utilisateur'] = 'Opa'
    df_util['Utilisateur'] = df_util['Utilisateur'].fillna('Opa').astype(str).apply(_normalize_utilisateur)
    df_damien = df_util[df_util['Utilisateur'] == 'Damien']  # Uniquement les tours de Damien
    df_opa = df_util[df_util['Utilisateur'] == 'Opa']        # Uniquement les tours d'Opa
    
    auj = pd.Timestamp.now().normalize()
    def _stats(df_sub):
        if df_sub.empty:
            return {'total_global': 0.0, 'total_aujourdhui': 0.0, 'total_semaine': 0.0, 'total_mois': 0.0, 'total_annee': 0.0}
        return {
            'total_global': float(df_sub['Km'].sum()),
            'total_aujourdhui': float(df_sub[df_sub['Date_dt'] == auj]['Km'].sum()),
            'total_semaine': float(df_sub[df_sub['Date_dt'] >= (auj - pd.Timedelta(days=auj.dayofweek))]['Km'].sum()),
            'total_mois': float(df_sub[df_sub['Date_dt'] >= auj.replace(day=1)]['Km'].sum()),
            'total_annee': float(df_sub[df_sub['Date_dt'] >= auj.replace(month=1, day=1)]['Km'].sum())
        }
    
    stats_global = _stats(df)
    total_aujourdhui = stats_global['total_aujourdhui']
    total_semaine = stats_global['total_semaine']
    total_mois = stats_global['total_mois']
    total_annee = stats_global['total_annee']
    stats_damien = _stats(df_damien)
    stats_opa = _stats(df_opa)
    
    # Étapes basées sur distances routières réelles depuis Kettenis (tous les 30 km jusqu'à 6000 km, puis tous les 500 km)
    etapes = []
    
    # De 0 à 6000 km : une ville tous les 30 km
    villes_30km = [
        (0, "🏠 Kettenis"),
        (30, "🇧🇪 Liège"),
        (60, "🇳🇱 Maastricht"),
        (90, "🇧🇪 Hasselt"),
        (120, "🇧🇪 Leuven"),
        (150, "🇧🇪 Bruxelles"),
        (180, "🇧🇪 Anvers"),
        (210, "🇧🇪 Gand"),
        (240, "🇧🇪 Bruges"),
        (270, "🇧🇪 Ostende"),
        (300, "🇫🇷 Lille"),
        (330, "🇫🇷 Arras"),
        (360, "🇫🇷 Amiens"),
        (390, "🇫🇷 Beauvais"),
        (420, "🇫🇷 Paris"),
        (450, "🇫🇷 Chartres"),
        (480, "🇫🇷 Orléans"),
        (510, "🇫🇷 Tours"),
        (540, "🇫🇷 Poitiers"),
        (570, "🇫🇷 Angoulême"),
        (600, "🇫🇷 Bordeaux"),
        (630, "🇫🇷 Arcachon"),
        (660, "🇫🇷 Bayonne"),
        (690, "🇪🇸 San Sebastian"),
        (720, "🇪🇸 Bilbao"),
        (750, "🇪🇸 Santander"),
        (780, "🇪🇸 Oviedo"),
        (810, "🇪🇸 Gijón"),
        (840, "🇪🇸 Avilés"),
        (870, "🇪🇸 La Coruña"),
        (900, "🇪🇸 Vigo"),
        (930, "🇵🇹 Porto"),
        (960, "🇵🇹 Coimbra"),
        (990, "🇵🇹 Leiria"),
        (1020, "🇵🇹 Lisbonne"),
        (1050, "🇵🇹 Setúbal"),
        (1080, "🇵🇹 Évora"),
        (1110, "🇪🇸 Badajoz"),
        (1140, "🇪🇸 Mérida"),
        (1170, "🇪🇸 Cáceres"),
        (1200, "🇪🇸 Plasencia"),
        (1230, "🇪🇸 Ávila"),
        (1260, "🇪🇸 Madrid"),
        (1290, "🇪🇸 Guadalajara"),
        (1320, "🇪🇸 Sigüenza"),
        (1350, "🇪🇸 Calatayud"),
        (1380, "🇪🇸 Saragosse"),
        (1410, "🇪🇸 Huesca"),
        (1440, "🇪🇸 Jaca"),
        (1470, "🇫🇷 Pau"),
        (1500, "🇫🇷 Tarbes"),
        (1530, "🇫🇷 Toulouse"),
        (1560, "🇫🇷 Carcassonne"),
        (1590, "🇫🇷 Narbonne"),
        (1620, "🇫🇷 Montpellier"),
        (1650, "🇫🇷 Nîmes"),
        (1680, "🇫🇷 Avignon"),
        (1710, "🇫🇷 Orange"),
        (1740, "🇫🇷 Valence"),
        (1770, "🇫🇷 Romans-sur-Isère"),
        (1800, "🇫🇷 Grenoble"),
        (1830, "🇫🇷 Chambéry"),
        (1860, "🇫🇷 Annecy"),
        (1890, "🇫🇷 Genève"),
        (1920, "🇨🇭 Lausanne"),
        (1950, "🇨🇭 Berne"),
        (1980, "🇨🇭 Lucerne"),
        (2010, "🇨🇭 Zurich"),
        (2040, "🇨🇭 Schaffhausen"),
        (2070, "🇩🇪 Constance"),
        (2100, "🇩🇪 Ulm"),
        (2130, "🇩🇪 Augsbourg"),
        (2160, "🇩🇪 Munich"),
        (2190, "🇩🇪 Rosenheim"),
        (2220, "🇦🇹 Salzbourg"),
        (2250, "🇦🇹 Linz"),
        (2280, "🇦🇹 Vienne"),
        (2310, "🇸🇰 Bratislava"),
        (2340, "🇭🇺 Győr"),
        (2370, "🇭🇺 Budapest"),
        (2400, "🇭🇺 Székesfehérvár"),
        (2430, "🇭🇺 Szombathely"),
        (2460, "🇦🇹 Graz"),
        (2490, "🇸🇮 Ljubljana"),
        (2520, "🇭🇷 Zagreb"),
        (2550, "🇭🇷 Karlovac"),
        (2580, "🇭🇷 Rijeka"),
        (2610, "🇭🇷 Pula"),
        (2640, "🇮🇹 Trieste"),
        (2670, "🇮🇹 Venise"),
        (2700, "🇮🇹 Padoue"),
        (2730, "🇮🇹 Vérone"),
        (2760, "🇮🇹 Brescia"),
        (2790, "🇮🇹 Milan"),
        (2820, "🇮🇹 Pavie"),
        (2850, "🇮🇹 Gênes"),
        (2880, "🇮🇹 La Spezia"),
        (2910, "🇮🇹 Pise"),
        (2940, "🇮🇹 Florence"),
        (2970, "🇮🇹 Arezzo"),
        (3000, "🇮🇹 Pérouse"),
        (3030, "🇮🇹 Terni"),
        (3060, "🇮🇹 Rome"),
        (3090, "🇮🇹 Latina"),
        (3120, "🇮🇹 Naples"),
        (3150, "🇮🇹 Salerne"),
        (3180, "🇮🇹 Potenza"),
        (3210, "🇮🇹 Bari"),
        (3240, "🇮🇹 Brindisi"),
        (3270, "🇬🇷 Igoumenitsa"),
        (3300, "🇬🇷 Ioannina"),
        (3330, "🇬🇷 Larissa"),
        (3360, "🇬🇷 Lamia"),
        (3390, "🇬🇷 Athènes"),
        (3420, "🇬🇷 Le Pirée"),
        (3450, "🇬🇷 Corinthe"),
        (3480, "🇬🇷 Patras"),
        (3510, "🇬🇷 Pyrgos"),
        (3540, "🇬🇷 Kalamata"),
        (3570, "🇬🇷 Sparte"),
        (3600, "🇬🇷 Tripoli"),
        (3630, "🇬🇷 Argos"),
        (3660, "🇬🇷 Nauplie"),
        (3690, "🇬🇷 Épidaure"),
        (3720, "🇬🇷 Mycènes"),
        (3750, "🇬🇷 Corinthe"),
        (3780, "🇬🇷 Thèbes"),
        (3810, "🇬🇷 Chalkida"),
        (3840, "🇬🇷 Volos"),
        (3870, "🇬🇷 Thessalonique"),
        (3900, "🇬🇷 Kavala"),
        (3930, "🇧🇬 Plovdiv"),
        (3960, "🇧🇬 Sofia"),
        (3990, "🇧🇬 Pernik"),
        (4020, "🇷🇸 Niš"),
        (4050, "🇷🇸 Belgrade"),
        (4080, "🇷🇸 Novi Sad"),
        (4110, "🇭🇺 Szeged"),
        (4140, "🇭🇺 Kecskemét"),
        (4170, "🇭🇺 Debrecen"),
        (4200, "🇷🇴 Oradea"),
        (4230, "🇷🇴 Cluj-Napoca"),
        (4260, "🇷🇴 Târgu Mureș"),
        (4290, "🇷🇴 Brașov"),
        (4320, "🇷🇴 Bucarest"),
        (4350, "🇷🇴 Ploiești"),
        (4380, "🇷🇴 Pitești"),
        (4410, "🇷🇴 Craiova"),
        (4440, "🇷🇴 Drobeta-Turnu Severin"),
        (4470, "🇷🇴 Timișoara"),
        (4500, "🇷🇸 Subotica"),
        (4530, "🇭🇺 Szeged"),
        (4560, "🇭🇺 Békéscsaba"),
        (4590, "🇭🇺 Arad"),
        (4620, "🇷🇴 Arad"),
        (4650, "🇷🇴 Deva"),
        (4680, "🇷🇴 Alba Iulia"),
        (4710, "🇷🇴 Sibiu"),
        (4740, "🇷🇴 Sighișoara"),
        (4770, "🇷🇴 Târgu Mureș"),
        (4800, "🇷🇴 Miercurea Ciuc"),
        (4830, "🇷🇴 Bacău"),
        (4860, "🇷🇴 Iași"),
        (4890, "🇲🇩 Chișinău"),
        (4920, "🇺🇦 Odessa"),
        (4950, "🇺🇦 Mykolaïv"),
        (4980, "🇺🇦 Kherson"),
        (5010, "🇺🇦 Melitopol"),
        (5040, "🇺🇦 Marioupol"),
        (5070, "🇺🇦 Donetsk"),
        (5100, "🇺🇦 Luhansk"),
        (5130, "🇷🇺 Rostov-sur-le-Don"),
        (5160, "🇷🇺 Krasnodar"),
        (5190, "🇷🇺 Sotchi"),
        (5220, "🇬🇪 Batoumi"),
        (5250, "🇬🇪 Koutaïssi"),
        (5280, "🇬🇪 Tbilissi"),
        (5310, "🇬🇪 Gori"),
        (5340, "🇬🇪 Mtskheta"),
        (5370, "🇦🇲 Erevan"),
        (5400, "🇦🇲 Gyumri"),
        (5430, "🇬🇪 Tbilissi"),
        (5460, "🇦🇿 Bakou"),
        (5490, "🇦🇿 Sumqayıt"),
        (5520, "🇦🇿 Ganja"),
        (5550, "🇦🇿 Şəki"),
        (5580, "🇬🇪 Tbilissi"),
        (5610, "🇹🇷 Trabzon"),
        (5640, "🇹🇷 Rize"),
        (5670, "🇹🇷 Erzurum"),
        (5700, "🇹🇷 Kars"),
        (5730, "🇹🇷 Ağrı"),
        (5760, "🇹🇷 Van"),
        (5790, "🇹🇷 Diyarbakır"),
        (5820, "🇹🇷 Gaziantep"),
        (5850, "🇹🇷 Adana"),
        (5880, "🇹🇷 Mersin"),
        (5910, "🇹🇷 Antalya"),
        (5940, "🇹🇷 Konya"),
        (5970, "🇹🇷 Ankara"),
        (6000, "🇹🇷 Istanbul")
    ]
    
    etapes.extend(villes_30km)
    
    # Au-delà de 6000 km : tour du monde (itinéraire cohérent Istanbul → Asie → Amériques → Europe)
    # Istanbul (6000) → Turquie → Caucase → Iran → Asie centrale → Chine → Asie du Sud-Est
    # → Océanie/Amériques → Europe. Distances cumulées depuis Kettenis.
    villes_500km = [
        (6500, "🇹🇷 Ankara"),
        (7000, "🇬🇪 Tbilissi"),
        (7500, "🇦🇿 Bakou"),
        (8000, "🇹🇲 Achgabat"),
        (8500, "🇺🇿 Tachkent"),
        (9000, "🇰🇿 Almaty"),
        (9500, "🇨🇳 Ürümqi"),
        (10000, "🇨🇳 Lanzhou"),
        (10500, "🇨🇳 Xi'an"),
        (11000, "🇨🇳 Pékin"),
        (11500, "🇰🇷 Séoul"),
        (12000, "🇯🇵 Tokyo"),
        (12500, "🇯🇵 Osaka"),
        (13000, "🇹🇼 Taipei"),
        (13500, "🇭🇰 Hong Kong"),
        (14000, "🇻🇳 Hô Chi Minh-Ville"),
        (14500, "🇰🇭 Phnom Penh"),
        (15000, "🇹🇭 Bangkok"),
        (15500, "🇲🇲 Rangoun"),
        (16000, "🇮🇳 Calcutta"),
        (16500, "🇮🇳 Mumbai"),
        (17000, "🇦🇪 Dubaï"),
        (17500, "🇸🇦 Riyad"),
        (18000, "🇪🇬 Le Caire"),
        (18500, "🇱🇾 Tripoli"),
        (19000, "🇹🇳 Tunis"),
        (19500, "🇩🇿 Alger"),
        (20000, "🇲🇦 Casablanca"),
        (20500, "🇪🇸 Madrid"),
        (21000, "🇫🇷 Paris"),
        (21500, "🇬🇧 Londres"),
        (22000, "🇮🇸 Reykjavik"),
        (22500, "🇨🇦 St. John's"),
        (23000, "🇨🇦 Québec"),
        (23500, "🇨🇦 Toronto"),
        (24000, "🇺🇸 New York"),
        (24500, "🇺🇸 Washington"),
        (25000, "🇺🇸 Atlanta"),
        (25500, "🇺🇸 Miami"),
        (26000, "🇲🇽 Cancún"),
        (26500, "🇲🇽 Mexico"),
        (27000, "🇬🇹 Guatemala"),
        (27500, "🇨🇷 San José"),
        (28000, "🇵🇦 Panama"),
        (28500, "🇨🇴 Bogota"),
        (29000, "🇪🇨 Quito"),
        (29500, "🇵🇪 Lima"),
        (30000, "🇧🇴 La Paz"),
        (30500, "🇦🇷 Buenos Aires"),
        (31000, "🇺🇾 Montevideo"),
        (31500, "🇧🇷 São Paulo"),
        (32000, "🇧🇷 Rio de Janeiro"),
        (32500, "🇧🇷 Salvador"),
        (33000, "🇸🇳 Dakar"),
        (33500, "🇪🇸 Las Palmas"),
        (34000, "🇪🇸 Madrid"),
        (34500, "🇫🇷 Bordeaux"),
        (35000, "🇫🇷 Paris"),
        (35500, "🇧🇪 Bruxelles"),
        (36000, "🇳🇱 Amsterdam"),
        (36500, "🇩🇪 Hambourg"),
        (37000, "🇩🇰 Copenhague"),
        (37500, "🇸🇪 Stockholm"),
        (38000, "🇫🇮 Helsinki"),
        (38500, "🇷🇺 Saint-Pétersbourg"),
        (39000, "🇷🇺 Moscou"),
        (39500, "🇵🇱 Varsovie"),
        (40000, "🇩🇪 Berlin"),
        (40075, "🌍 Weltreise!")
    ]
    
    etapes.extend(villes_500km)

    def _compute_progression(total_km, etapes_list):
        """Berechnet Fortschritt für eine gegebene Gesamtstrecke in km."""
        ville_actuelle = etapes_list[0][1]
        km_palier_actuel = etapes_list[0][0]
        prochaine_ville = etapes_list[1][1]
        km_palier_suivant = etapes_list[1][0]
        distance_kettenis = 0.0
        for i in range(len(etapes_list)):
            if total_km >= etapes_list[i][0]:
                ville_actuelle = etapes_list[i][1]
                km_palier_actuel = etapes_list[i][0]
                if i + 1 < len(etapes_list):
                    prochaine_ville = etapes_list[i+1][1]
                    km_palier_suivant = etapes_list[i+1][0]
                    distance_kettenis = float(etapes_list[i+1][0])
        km_restants = max(0.0, km_palier_suivant - total_km)
        diff_seg = km_palier_suivant - km_palier_actuel
        prog_v = (total_km - km_palier_actuel) / diff_seg if diff_seg > 0 else 1.0
        return {
            'ville_actuelle': ville_actuelle,
            'prochaine_ville': prochaine_ville,
            'km_restants': float(km_restants),
            'progression': float(prog_v),
            'distance_kettenis': float(distance_kettenis)
        }

    # Calcul du Challenge Damien vs Opa
    total_damien = stats_damien['total_global']
    total_opa = stats_opa['total_global']
    difference = abs(total_damien - total_opa)
    if total_damien > total_opa:
        leader = 'Damien'
    elif total_opa > total_damien:
        leader = 'Opa'
    else:
        leader = 'Unentschieden'
    
    # Challenge individuel Tour du Monde (40 075 km chacun)
    pct_damien = min(100.0, (total_damien / TOUR_DU_MONDE_KM) * 100)
    pct_opa = min(100.0, (total_opa / TOUR_DU_MONDE_KM) * 100)
    
    challenge = {
        'total_damien': float(total_damien),
        'total_opa': float(total_opa),
        'leader': leader,
        'difference': float(difference),
        'world_tour_damien': {
            'km': float(total_damien),
            'pct': float(pct_damien),
            'target': TOUR_DU_MONDE_KM
        },
        'world_tour_opa': {
            'km': float(total_opa),
            'pct': float(pct_opa),
            'target': TOUR_DU_MONDE_KM
        }
    }

    # Individueller Fortschritt für Damien und Opa (inkl. Weltreise-Prozent)
    progression_damien = _compute_progression(total_damien, etapes)
    progression_opa = _compute_progression(total_opa, etapes)
    progression_global = _compute_progression(total_global, etapes)
    progression_damien['world_tour_pct'] = float(pct_damien)
    progression_opa['world_tour_pct'] = float(pct_opa)

    # Convertir en format pour l'API
    if USE_SUPABASE:
        # Utiliser les données Supabase directement
        tours_data = get_all_tours()
        tours = []
        for tour in tours_data:
            photos = tour.get('photos')
            if not isinstance(photos, list):
                photos = photos if photos else []
            tour_dict = {
                'Date': tour.get('date', ''),
                'Start': tour.get('start', ''),
                'Etape': tour.get('etape', '') if tour.get('etape') else '',
                'Ziel': tour.get('ziel', ''),
                'Wetter': tour.get('wetter', ''),
                'Km': float(tour.get('km', 0)),
                'Bemerkungen': tour.get('bemerkungen', '') if tour.get('bemerkungen') else '',
                'Utilisateur': _normalize_utilisateur(tour.get('utilisateur', 'Opa')),
                '_index': tour.get('id'),  # Utiliser l'ID Supabase comme index
                'photos': photos
            }
            tours.append(tour_dict)
    else:
        # Utiliser le DataFrame (CSV)
        df_visu = df.sort_index(ascending=False)
        if 'Date_dt' in df_visu.columns:
            df_visu = df_visu.drop(columns=['Date_dt'])
        df_visu = df_visu.fillna('')
        tours = []
        for idx, row in df_visu.iterrows():
            tour_dict = row.to_dict()
            tour_dict['_index'] = int(idx)
            if 'Utilisateur' not in tour_dict or pd.isna(tour_dict.get('Utilisateur')):
                tour_dict['Utilisateur'] = 'Opa'
            else:
                tour_dict['Utilisateur'] = _normalize_utilisateur(tour_dict['Utilisateur'])
            tour_dict['photos'] = []  # Pas de photos en mode CSV
            tours.append(tour_dict)
    
    return jsonify({
        'tours': tours,
        'stats': stats_global,
        'stats_damien': stats_damien,
        'stats_opa': stats_opa,
        'progression': progression_global,
        'progression_damien': progression_damien,
        'progression_opa': progression_opa,
        'challenge': challenge
    })

@app.route('/api/tours', methods=['POST'])
def add_tour():
    try:
        if not request.json:
            return jsonify({'success': False, 'error': 'Aucune donnée reçue'}), 400
        
        data = request.json
        
        # Validation des données requises
        if 'date' not in data:
            return jsonify({'success': False, 'error': 'La date est requise'}), 400
        
        # Conversion des types de données pour SQL
        date_tour = datetime.datetime.strptime(data['date'], '%Y-%m-%d').date()
        v_dep = str(data.get('depart', 'Kettenis')).strip()
        v_etp = str(data.get('etape', '')).strip()
        v_ret = str(data.get('arrivee', 'Kettenis')).strip()
        
        # Conversion explicite en float pour SQL DECIMAL
        try:
            dist = float(data.get('distance', 0)) if data.get('distance') else 0.0
        except (ValueError, TypeError):
            dist = 0.0
        
        h_dep = str(data.get('heure_depart', '10:00')).strip()
        h_etp = str(data.get('heure_etape', '11:30')).strip()
        h_ret = str(data.get('heure_arrivee', '12:30')).strip()
        notes = str(data.get('notes', '')).strip()
        
        m_dep = obtenir_meteo(v_dep)
        m_ret = obtenir_meteo(v_ret)
        
        # Qui a pédalé : Damien ou Opa
        utilisateur = _normalize_utilisateur(data.get('utilisateur', 'Opa'))
        
        nouvelle_entree = {
            "Date": date_tour.strftime("%d/%m/%Y"),
            "Start": f"{v_dep} ({h_dep})",
            "Etape": f"{v_etp} ({h_etp})" if v_etp else "N/A",
            "Ziel": f"{v_ret} ({h_ret})",
            "Wetter": f"{m_dep} / {m_ret}",
            "Km": dist,
            "Bemerkungen": notes,
            "Utilisateur": utilisateur
        }
        
        if USE_SUPABASE:
            # Sauvegarder dans Supabase
            try:
                success, message = add_tour_db(nouvelle_entree)
                if success:
                    return jsonify({'success': True, 'message': 'Tour gespeichert!'})
                else:
                    # Retourner le message d'erreur explicite
                    print(f"[ERROR] Échec de l'enregistrement Supabase: {message}")
                    return jsonify({'success': False, 'error': message}), 500
            except Exception as e:
                error_detail = str(e)
                print(f"[ERROR] Exception lors de l'enregistrement Supabase: {e}")
                print(f"Erreur Supabase: {e}")  # Log supplémentaire pour Render
                import traceback
                traceback.print_exc()
                return jsonify({'success': False, 'error': f'Erreur Supabase: {error_detail}'}), 500
        else:
            # Fallback sur CSV
            try:
                df = charger_donnees()
                if 'Date_dt' in df.columns:
                    df = df.drop(columns=['Date_dt'])
                # S'assurer que la colonne Utilisateur existe
                if 'Utilisateur' not in df.columns:
                    df['Utilisateur'] = 'Opa'
                df = pd.concat([df, pd.DataFrame([nouvelle_entree])], ignore_index=True)
                df.to_csv(FICHIER_DATA, index=False)
                return jsonify({'success': True, 'message': 'Tour gespeichert!'})
            except Exception as e:
                print(f"[ERROR] Exception lors de l'enregistrement CSV: {e}")
                return jsonify({'success': False, 'error': f'Erreur CSV: {str(e)}'}), 500
                
    except ValueError as e:
        print(f"[ERROR] Erreur de validation: {e}")
        return jsonify({'success': False, 'error': f'Données invalides: {str(e)}'}), 400
    except Exception as e:
        print(f"[ERROR] Erreur inattendue dans add_tour: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': f'Erreur serveur: {str(e)}'}), 500

MAX_PHOTO_SIZE = 5 * 1024 * 1024  # 5 Mo

@app.route('/api/tours/<int:tour_id>/photos', methods=['POST'])
def add_photo(tour_id):
    """Envoie une photo vers Supabase et la lie au tour (Supabase uniquement)"""
    if not USE_SUPABASE:
        return jsonify({'success': False, 'error': 'Photos non disponibles en mode CSV'}), 400

    if 'photo' not in request.files and 'file' not in request.files:
        return jsonify({'success': False, 'error': 'Aucun fichier reçu'}), 400

    file = request.files.get('photo') or request.files.get('file')
    if not file or file.filename == '':
        return jsonify({'success': False, 'error': 'Fichier vide'}), 400

    # Vérifier la taille (max 5 Mo) pour éviter de bloquer l'app
    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if size > MAX_PHOTO_SIZE:
        return jsonify({
            'success': False,
            'error': f'Image trop lourde (max 5 Mo). Taille reçue : {size // (1024 * 1024)} Mo'
        }), 400

    try:
        content_type = file.content_type or 'image/jpeg'
        success, result = upload_photo_db(tour_id, file.read(), file.filename or 'photo.jpg', content_type)
        if success:
            return jsonify({'success': True, 'url': result})
        return jsonify({'success': False, 'error': result}), 500
    except Exception as e:
        print(f"[ERROR] Erreur upload photo: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/tours/<int:tour_id>', methods=['DELETE'])
def delete_tour(tour_id):
    if USE_SUPABASE:
        # Supprimer depuis Supabase (tour_id est l'ID Supabase)
        success = delete_tour_db(tour_id)
        if success:
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'error': 'Erreur lors de la suppression'}), 500
    else:
        # Fallback sur CSV (tour_id est l'index du DataFrame)
        df = charger_donnees()
        if tour_id < len(df):
            df = df.drop(tour_id)
            if 'Date_dt' in df.columns:
                df = df.drop(columns=['Date_dt'])
            df.to_csv(FICHIER_DATA, index=False)
            return jsonify({'success': True})
        return jsonify({'success': False, 'error': 'Index invalide'}), 400

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
