// Configuration
const API_BASE = '';

// État de l'application
let toursData = {
    tours: [],
    stats: {},
    progression: {}
};

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    // Définir la date d'aujourd'hui par défaut
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
    
    // Charger les données
    await loadTours();
    
    // Écouter le formulaire
    document.getElementById('tourForm').addEventListener('submit', handleFormSubmit);
}

// Charger les tours depuis l'API
async function loadTours() {
    try {
        // Timeout pour éviter que l'application reste bloquée
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 secondes max
        
        const response = await fetch(`${API_BASE}/api/tours`, {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        toursData = data;
        
        // Toujours afficher les stats et la progression
        document.getElementById('statsSection').style.display = 'block';
        document.getElementById('progressionSection').style.display = 'block';
        
        updateStats(data.stats || {
            total_global: 0,
            total_aujourdhui: 0,
            total_semaine: 0,
            total_mois: 0,
            total_annee: 0
        });
        updateProgression(data.progression || {
            ville_actuelle: '🏠 Kettenis',
            prochaine_ville: '🇧🇪 Verviers',
            km_restants: 18,
            progression: 0
        });
        
        // Toujours afficher l'historique (même vide)
        document.getElementById('historySection').style.display = 'block';
        if (data.tours && data.tours.length > 0) {
            displayTours(data.tours);
        } else {
            const toursList = document.getElementById('toursList');
            toursList.innerHTML = '<p style="color: rgba(255,255,255,0.8); text-align: center; padding: 20px; font-weight: 600;">Keine Touren vorhanden</p>';
        }
    } catch (error) {
        console.error('Erreur lors du chargement des tours:', error);
        
        // Afficher quand même les sections avec des valeurs par défaut
        document.getElementById('statsSection').style.display = 'block';
        document.getElementById('progressionSection').style.display = 'block';
        document.getElementById('historySection').style.display = 'block';
        
        updateStats({
            total_global: 0,
            total_aujourdhui: 0,
            total_semaine: 0,
            total_mois: 0,
            total_annee: 0
        });
        updateProgression({
            ville_actuelle: '🏠 Kettenis',
            prochaine_ville: '🇧🇪 Liège',
            km_restants: 30,
            progression: 0,
            distance_kettenis: 30
        });
        
        const toursList = document.getElementById('toursList');
        toursList.innerHTML = '<p style="color: rgba(255,255,255,0.8); text-align: center; padding: 20px; font-weight: 600;">Keine Touren vorhanden</p>';
        
        // Ne pas afficher de toast d'erreur pour ne pas perturber l'utilisateur
        // Le formulaire reste fonctionnel même si le chargement échoue
    }
}

// Mettre à jour les statistiques
function updateStats(stats) {
    document.getElementById('statAujourdhui').textContent = formatDistance(stats.total_aujourdhui || 0);
    document.getElementById('statSemaine').textContent = formatDistance(stats.total_semaine);
    document.getElementById('statMois').textContent = formatDistance(stats.total_mois);
    document.getElementById('statAnnee').textContent = formatDistance(stats.total_annee);
    document.getElementById('statTotal').textContent = formatDistance(stats.total_global);
}

// Mettre à jour la progression
function updateProgression(progression) {
    document.getElementById('villeActuelle').textContent = progression.ville_actuelle;
    
    // Afficher "Nächste Etappe: [Ville] à [Distance] de Kettenis"
    const distanceKettenis = progression.distance_kettenis || progression.km_restants;
    const prochaineVilleText = `${progression.prochaine_ville} à ${formatDistance(distanceKettenis)} de Kettenis`;
    document.getElementById('prochaineVille').textContent = prochaineVilleText;
    document.getElementById('kmRestants').textContent = formatDistance(progression.km_restants);
    
    const progressPercent = Math.min(100, Math.max(0, progression.progression * 100));
    document.getElementById('progressFill').style.width = `${progressPercent}%`;
    document.getElementById('progressText').textContent = `${progressPercent.toFixed(1)}%`;
    
    // Mettre à jour le lien email
    const emailSubject = encodeURIComponent("Opa's Bicycle Update");
    const emailBody = encodeURIComponent(
        `Gesamt: ${formatDistance(toursData.stats.total_global)}\nOrt: ${progression.ville_actuelle}`
    );
    document.getElementById('emailLink').href = `mailto:cogi003@gmail.com?subject=${emailSubject}&body=${emailBody}`;
}

// Afficher les tours
function displayTours(tours) {
    const toursList = document.getElementById('toursList');
    toursList.innerHTML = '';
    
    if (tours.length === 0) {
        toursList.innerHTML = '<p style="color: rgba(255,255,255,0.8); text-align: center; padding: 20px;">Keine Touren vorhanden</p>';
        return;
    }
    
    // Les tours sont déjà triés par ordre décroissant d'index
    tours.forEach((tour, displayIndex) => {
        const tourItem = document.createElement('div');
        tourItem.className = 'tour-item';
        
        // Utiliser l'index réel du DataFrame stocké dans _index
        const realIndex = tour._index !== undefined ? tour._index : displayIndex;
        
        tourItem.innerHTML = `
            <div class="tour-field">
                <strong>Datum</strong>
                <span>${tour.Date || ''}</span>
            </div>
            <div class="tour-field">
                <strong>Start</strong>
                <span>${tour.Start || ''}</span>
            </div>
            <div class="tour-field">
                <strong>Ziel</strong>
                <span>${tour.Ziel || ''}</span>
            </div>
            <div class="tour-field">
                <strong>Wetter</strong>
                <span>${tour.Wetter || ''}</span>
            </div>
            <div class="tour-field">
                <strong>Km</strong>
                <span>${formatDistance(tour.Km || 0)}</span>
            </div>
            <div class="tour-field">
                <strong>Bemerkungen</strong>
                <span>${(tour.Bemerkungen && tour.Bemerkungen !== 'NaN' && tour.Bemerkungen !== 'nan') ? tour.Bemerkungen : ''}</span>
            </div>
            ${tour.Etape && tour.Etape !== 'NaN' && tour.Etape !== 'nan' && tour.Etape !== 'N/A' ? `
            <div class="tour-field">
                <strong>Etape</strong>
                <span>${tour.Etape}</span>
            </div>
            ` : ''}
            <button class="btn-delete" onclick="deleteTour(${realIndex})" title="Löschen">❌</button>
        `;
        
        toursList.appendChild(tourItem);
    });
}

// Gérer la soumission du formulaire
async function handleFormSubmit(e) {
    e.preventDefault();
    
    // Désactiver le bouton et afficher le chargement météo
    const submitBtn = document.getElementById('submitBtn');
    const meteoLoading = document.getElementById('meteoLoading');
    submitBtn.disabled = true;
    submitBtn.querySelector('span').textContent = 'Wird gespeichert...';
    meteoLoading.style.display = 'block';
    
    const formData = {
        date: document.getElementById('date').value,
        depart: document.getElementById('depart').value,
        etape: document.getElementById('etape').value,
        arrivee: document.getElementById('arrivee').value,
        distance: parseFloat(document.getElementById('distance').value),
        heure_depart: document.getElementById('heure_depart').value,
        heure_etape: document.getElementById('heure_etape').value,
        heure_arrivee: document.getElementById('heure_arrivee').value,
        notes: document.getElementById('notes').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/api/tours`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Tour gespeichert! 🎉', 'success');
            
            // Réinitialiser le formulaire
            document.getElementById('tourForm').reset();
            document.getElementById('date').value = new Date().toISOString().split('T')[0];
            document.getElementById('depart').value = 'Kettenis';
            document.getElementById('arrivee').value = 'Kettenis';
            document.getElementById('heure_depart').value = '10:00';
            document.getElementById('heure_etape').value = '11:30';
            document.getElementById('heure_arrivee').value = '12:30';
            
            // Recharger les données
            await loadTours();
            
            // Animation de célébration
            celebrate();
        } else {
            showToast('Fehler beim Speichern', 'error');
        }
    } catch (error) {
        console.error('Erreur lors de l\'envoi:', error);
        showToast('Fehler beim Speichern', 'error');
    } finally {
        // Réactiver le bouton
        submitBtn.disabled = false;
        submitBtn.querySelector('span').textContent = 'Tour speichern';
        meteoLoading.style.display = 'none';
    }
}

// Supprimer un tour
async function deleteTour(index) {
    if (!confirm('Möchten Sie diese Tour wirklich löschen?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/tours/${index}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Tour gelöscht', 'success');
            await loadTours();
        } else {
            showToast('Fehler beim Löschen', 'error');
        }
    } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        showToast('Fehler beim Löschen', 'error');
    }
}

// Formater la distance
function formatDistance(km) {
    return `${km.toFixed(1).replace('.', ',')} km`;
}

// Afficher une notification toast
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Animation de célébration
function celebrate() {
    // Créer des confettis
    for (let i = 0; i < 50; i++) {
        createConfetti();
    }
}

function createConfetti() {
    const confetti = document.createElement('div');
    confetti.style.position = 'fixed';
    confetti.style.width = '10px';
    confetti.style.height = '10px';
    confetti.style.backgroundColor = getRandomColor();
    confetti.style.left = Math.random() * 100 + '%';
    confetti.style.top = '-10px';
    confetti.style.borderRadius = '50%';
    confetti.style.pointerEvents = 'none';
    confetti.style.zIndex = '9999';
    confetti.style.opacity = '0.8';
    
    document.body.appendChild(confetti);
    
    const animation = confetti.animate([
        { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
        { transform: `translateY(${window.innerHeight + 100}px) rotate(720deg)`, opacity: 0 }
    ], {
        duration: 2000 + Math.random() * 1000,
        easing: 'cubic-bezier(0.5, 0, 0.5, 1)'
    });
    
    animation.onfinish = () => confetti.remove();
}

function getRandomColor() {
    const colors = ['#4caf50', '#2196f3', '#ff9800', '#f44336', '#9c27b0', '#00bcd4'];
    return colors[Math.floor(Math.random() * colors.length)];
}
