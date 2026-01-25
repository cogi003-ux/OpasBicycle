# 🚲 Opa's Bicycle

Application web moderne pour suivre vos trajets à vélo avec un design glassmorphism élégant. Accessible sur smartphone et ordinateur.

## ✨ Fonctionnalités

- 📝 Enregistrement de trajets avec détails complets (date, lieux, météo, distance, notes)
- 📊 Statistiques en temps réel (semaine, mois, année, total)
- 🌍 Suivi de progression vers un "voyage autour du monde" avec étapes prédéfinies
- 📜 Historique des trajets avec possibilité de suppression
- 📧 Partage rapide par email
- 🎨 Design moderne glassmorphism (effet de verre)
- 📱 Interface responsive (mobile et desktop)

## 🚀 Installation

1. Installer les dépendances :
```bash
pip install -r requirements.txt
```

2. Lancer l'application :
```bash
python app.py
```

3. Ouvrir dans le navigateur :
```
http://localhost:5000
```

## 📱 Accès depuis un smartphone

Pour accéder à l'application depuis votre smartphone sur le même réseau :

1. Trouver l'adresse IP de votre ordinateur :
   - Mac/Linux : `ifconfig` ou `ip addr`
   - Windows : `ipconfig`

2. Lancer l'application avec :
```bash
python app.py
```

3. Sur votre smartphone, ouvrir :
```
http://VOTRE_IP:5000
```

## 🎨 Design

L'application utilise un design **glassmorphism** moderne avec :
- Effets de transparence et flou (backdrop-filter)
- Animations fluides
- Dégradés de couleurs dynamiques
- Interface responsive adaptée aux petits écrans

## 📂 Structure du projet

```
Opa'sBicycle/
├── app.py                 # Backend Flask
├── journal_velo.csv       # Base de données (CSV)
├── templates/
│   └── index.html        # Interface HTML
├── static/
│   ├── css/
│   │   └── style.css     # Styles glassmorphism
│   └── js/
│       └── app.js        # Logique JavaScript
├── requirements.txt       # Dépendances Python
└── README.md             # Documentation
```

## 🔧 Technologies utilisées

- **Backend** : Flask (Python)
- **Frontend** : HTML5, CSS3 (glassmorphism), JavaScript (ES6+)
- **Données** : Pandas, CSV
- **Météo** : API wttr.in

## 📝 Notes

- Les données sont stockées dans `journal_velo.csv`
- La météo est récupérée automatiquement pour les lieux de départ et d'arrivée
- L'application fonctionne hors ligne (sauf pour la météo)

## 🌐 Déploiement

Pour déployer en production, vous pouvez utiliser :
- **Heroku** : Ajouter un `Procfile` avec `web: gunicorn app:app`
- **PythonAnywhere** : Uploader les fichiers et configurer l'application web
- **VPS** : Utiliser Gunicorn + Nginx

Exemple avec Gunicorn :
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

## 📄 Licence

Projet personnel - Opa's Bicycle
