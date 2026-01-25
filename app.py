from flask import Flask, render_template, request, jsonify
import datetime
import pandas as pd
import requests
import os
import urllib.parse
from database import get_all_tours, add_tour as add_tour_db, delete_tour as delete_tour_db

app = Flask(__name__)
app.config['JSON_AS_ASCII'] = False

FICHIER_DATA = "journal_velo.csv"
USE_SUPABASE = os.getenv('SUPABASE_URL') and os.getenv('SUPABASE_KEY')

def obtenir_meteo(ville):
    if not ville or ville.strip() == "":
        return "N/A"
    try:
        url = f"https://wttr.in/{ville}?format=%C+%t&lang=de"
        r = requests.get(url, timeout=10)
        return r.text.strip() if r.status_code == 200 else "N/A"
    except:
        return "N/A"

def charger_donnees():
    """Charge les données depuis Supabase ou CSV selon la configuration"""
    if USE_SUPABASE:
        # Utiliser Supabase
        tours = get_all_tours()
        if not tours:
            return pd.DataFrame(columns=["Date", "Start", "Etape", "Ziel", "Wetter", "Km", "Bemerkungen"])
        
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
                "Bemerkungen": tour.get('bemerkungen', '') if tour.get('bemerkungen') else ''
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
            return df
        return pd.DataFrame(columns=["Date", "Start", "Etape", "Ziel", "Wetter", "Km", "Bemerkungen"])

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/tours', methods=['GET'])
def get_tours():
    df = charger_donnees()
    if df.empty:
        return jsonify({
            'tours': [],
            'stats': {
                'total_global': 0,
                'total_aujourdhui': 0,
                'total_semaine': 0,
                'total_mois': 0,
                'total_annee': 0
            },
            'progression': {
                'ville_actuelle': '🏠 Kettenis',
                'prochaine_ville': '🇧🇪 Verviers',
                'km_restants': 18,
                'progression': 0
            }
        })
    
    total_global = df['Km'].sum()
    
    # Stats temporelles
    auj = pd.Timestamp.now().normalize()
    total_aujourdhui = df[df['Date_dt'] == auj]['Km'].sum()
    total_semaine = df[df['Date_dt'] >= (auj - pd.Timedelta(days=auj.dayofweek))]['Km'].sum()
    total_mois = df[df['Date_dt'] >= auj.replace(day=1)]['Km'].sum()
    total_annee = df[df['Date_dt'] >= auj.replace(month=1, day=1)]['Km'].sum()
    
    # Étapes
    etapes = [
        (0, "🏠 Kettenis"),
        (18, "🇧🇪 Verviers"),
        (42, "🇧🇪 Lüttich (Liège)"),
        (75, "🇧🇪 Tongeren"),
        (105, "🇧🇪 Hasselt"),
        (135, "🇧🇪 Löwen (Leuven)"),
        (155, "🇧🇪 Brüssel"),
        (185, "🇧🇪 Gent"),
        (212, "🇧🇪 Knokke-Heist"),
        (245, "🇧🇪 Kortrijk (Courtrai)"),
        (280, "🇩🇪 Gummersbach"),
        (310, "🇩🇪 Siegen"),
        (340, "🇩🇪 Marburg"),
        (370, "🇩🇪 Giessen"),
        (405, "🇩🇪 Wetzlar"),
        (435, "🇩🇪 Fulda"),
        (465, "🇩🇪 Bad Hersfeld"),
        (500, "🇩🇪 Eisenach"),
        (530, "🇩🇪 Gotha"),
        (560, "🇩🇪 Erfurt"),
        (590, "🇩🇪 Weimar"),
        (620, "🇩🇪 Jena"),
        (650, "🇩🇪 Gera"),
        (680, "🇩🇪 Zwickau"),
        (715, "🇩🇪 Chemnitz"),
        (750, "🇩🇪 Dresden"),
        (785, "🇩🇪 Görlitz"),
        (830, "🇵🇱 Legnica"),
        (890, "🇵🇱 Breslau (Wrocław)"),
        (1060, "🇵🇱 Kattowitz"),
        (1130, "🇵🇱 Krakau"),
        (1360, "🇺🇦 Lwiw (Lemberg)"),
        (1500, "🇺🇦 Ternopil"),
        (40075, "🌍 Weltreise!")
    ]
    
    ville_actuelle = etapes[0][1]
    km_palier_actuel = etapes[0][0]
    prochaine_ville = etapes[1][1]
    km_palier_suivant = etapes[1][0]
    
    for i in range(len(etapes)):
        if total_global >= etapes[i][0]:
            ville_actuelle = etapes[i][1]
            km_palier_actuel = etapes[i][0]
            if i + 1 < len(etapes):
                prochaine_ville = etapes[i+1][1]
                km_palier_suivant = etapes[i+1][0]
    
    km_restants = max(0.0, km_palier_suivant - total_global)
    diff_seg = km_palier_suivant - km_palier_actuel
    prog_v = (total_global - km_palier_actuel) / diff_seg if diff_seg > 0 else 1.0
    
    # Convertir en format pour l'API
    if USE_SUPABASE:
        # Utiliser les données Supabase directement
        tours_data = get_all_tours()
        tours = []
        for tour in tours_data:
            tour_dict = {
                'Date': tour.get('date', ''),
                'Start': tour.get('start', ''),
                'Etape': tour.get('etape', '') if tour.get('etape') else '',
                'Ziel': tour.get('ziel', ''),
                'Wetter': tour.get('wetter', ''),
                'Km': float(tour.get('km', 0)),
                'Bemerkungen': tour.get('bemerkungen', '') if tour.get('bemerkungen') else '',
                '_index': tour.get('id')  # Utiliser l'ID Supabase comme index
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
            tours.append(tour_dict)
    
    return jsonify({
        'tours': tours,
        'stats': {
            'total_global': float(total_global),
            'total_aujourdhui': float(total_aujourdhui),
            'total_semaine': float(total_semaine),
            'total_mois': float(total_mois),
            'total_annee': float(total_annee)
        },
        'progression': {
            'ville_actuelle': ville_actuelle,
            'prochaine_ville': prochaine_ville,
            'km_restants': float(km_restants),
            'progression': float(prog_v)
        }
    })

@app.route('/api/tours', methods=['POST'])
def add_tour():
    data = request.json
    
    date_tour = datetime.datetime.strptime(data['date'], '%Y-%m-%d').date()
    v_dep = data.get('depart', 'Kettenis')
    v_etp = data.get('etape', '')
    v_ret = data.get('arrivee', 'Kettenis')
    dist = float(data.get('distance', 0))
    h_dep = data.get('heure_depart', '10:00')
    h_etp = data.get('heure_etape', '11:30')
    h_ret = data.get('heure_arrivee', '12:30')
    notes = data.get('notes', '')
    
    m_dep = obtenir_meteo(v_dep)
    m_ret = obtenir_meteo(v_ret)
    
    nouvelle_entree = {
        "Date": date_tour.strftime("%d/%m/%Y"),
        "Start": f"{v_dep} ({h_dep})",
        "Etape": f"{v_etp} ({h_etp})" if v_etp else "N/A",
        "Ziel": f"{v_ret} ({h_ret})",
        "Wetter": f"{m_dep} / {m_ret}",
        "Km": dist,
        "Bemerkungen": notes
    }
    
    if USE_SUPABASE:
        # Sauvegarder dans Supabase
        success = add_tour_db(nouvelle_entree)
        if success:
            return jsonify({'success': True, 'message': 'Tour gespeichert!'})
        else:
            return jsonify({'success': False, 'error': 'Erreur lors de la sauvegarde'}), 500
    else:
        # Fallback sur CSV
        df = charger_donnees()
        if 'Date_dt' in df.columns:
            df = df.drop(columns=['Date_dt'])
        df = pd.concat([df, pd.DataFrame([nouvelle_entree])], ignore_index=True)
        df.to_csv(FICHIER_DATA, index=False)
        return jsonify({'success': True, 'message': 'Tour gespeichert!'})

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
