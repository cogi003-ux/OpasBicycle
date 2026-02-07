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
        updateProgression({
            progression_damien: data.progression_damien || {
                ville_actuelle: '🏠 Kettenis',
                prochaine_ville: '🇧🇪 Liège',
                km_restants: 30,
                progression: 0,
                distance_kettenis: 30
            },
            progression_opa: data.progression_opa || {
                ville_actuelle: '🏠 Kettenis',
                prochaine_ville: '🇧🇪 Liège',
                km_restants: 30,
                progression: 0,
                distance_kettenis: 30
            }
        });
        
        // Afficher le Challenge
        document.getElementById('challengeSection').style.display = 'block';
        updateChallenge(data.challenge || {
            total_damien: 0,
            total_opa: 0,
            leader: 'Unentschieden',
            difference: 0,
            world_tour_damien: { km: 0, pct: 0, target: 40075 },
            world_tour_opa: { km: 0, pct: 0, target: 40075 }
        });
        
        // Toujours afficher l'historique (même vide)
        document.getElementById('historySection').style.display = 'block';
        if (data.tours && data.tours.length > 0) {
            displayTours(data.tours);
        } else {
            document.getElementById('toursListDamien').innerHTML = '<p class="empty-history">Keine Touren</p>';
            document.getElementById('toursListOpa').innerHTML = '<p class="empty-history">Keine Touren</p>';
        }
    } catch (error) {
        console.error('Erreur lors du chargement des tours:', error);
        
        // Afficher quand même les sections avec des valeurs par défaut
        document.getElementById('statsSection').style.display = 'block';
        document.getElementById('progressionSection').style.display = 'block';
        document.getElementById('challengeSection').style.display = 'block';
        document.getElementById('historySection').style.display = 'block';
        
        updateStats({
            total_global: 0,
            total_aujourdhui: 0,
            total_semaine: 0,
            total_mois: 0,
            total_annee: 0
        });
        updateProgression({
            progression_damien: {
                ville_actuelle: '🏠 Kettenis',
                prochaine_ville: '🇧🇪 Liège',
                km_restants: 30,
                progression: 0,
                distance_kettenis: 30
            },
            progression_opa: {
                ville_actuelle: '🏠 Kettenis',
                prochaine_ville: '🇧🇪 Liège',
                km_restants: 30,
                progression: 0,
                distance_kettenis: 30
            }
        });
        
        document.getElementById('challengeSection').style.display = 'block';
        updateChallenge({
            total_damien: 0,
            total_opa: 0,
            leader: 'Unentschieden',
            difference: 0,
            world_tour_damien: { km: 0, pct: 0, target: 40075 },
            world_tour_opa: { km: 0, pct: 0, target: 40075 }
        });
        
        document.getElementById('toursListDamien').innerHTML = '<p class="empty-history">Keine Touren</p>';
        document.getElementById('toursListOpa').innerHTML = '<p class="empty-history">Keine Touren</p>';
        
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

// Challenge Damien vs Opa aktualisieren
function updateChallenge(challenge) {
    document.getElementById('totalDamien').textContent = formatDistance(challenge.total_damien || 0);
    document.getElementById('totalOpa').textContent = formatDistance(challenge.total_opa || 0);
    
    let message = '';
    if (challenge.leader === 'Égalité' || challenge.leader === 'Unentschieden') {
        message = 'Unentschieden! Damien und Opa haben die gleiche Strecke zurückgelegt.';
    } else {
        const diff = formatDistance(challenge.difference || 0);
        message = `${challenge.leader} führt mit ${diff} Vorsprung!`;
    }
    document.getElementById('challengeMessage').textContent = message;
    
    // Tour du Monde individuel (40 075 km chacun)
    const wtDamien = challenge.world_tour_damien || { km: 0, pct: 0 };
    const wtOpa = challenge.world_tour_opa || { km: 0, pct: 0 };
    
    document.getElementById('worldTourDamienKm').textContent = formatDistance(wtDamien.km || 0);
    document.getElementById('worldTourOpaKm').textContent = formatDistance(wtOpa.km || 0);
    
    document.getElementById('worldTourDamienFill').style.width = `${Math.min(100, wtDamien.pct || 0)}%`;
    document.getElementById('worldTourOpaFill').style.width = `${Math.min(100, wtOpa.pct || 0)}%`;
    
    document.getElementById('worldTourDamienPct').textContent = formatPercent(wtDamien.pct || 0);
    document.getElementById('worldTourOpaPct').textContent = formatPercent(wtOpa.pct || 0);
}

// Fortschritt für Damien und Opa aktualisieren (zwei Spalten)
function updateProgression(data) {
    const progDamien = data.progression_damien || {};
    const progOpa = data.progression_opa || {};
    
    // Damien-Spalte
    document.getElementById('villeActuelleDamien').textContent = progDamien.ville_actuelle || '🏠 Kettenis';
    const kmRestDamien = progDamien.km_restants ?? 30;
    document.getElementById('prochaineVilleDamien').textContent = progDamien.prochaine_ville || '🇧🇪 Liège';
    document.getElementById('kmRestantsDamien').textContent = formatDistance(kmRestDamien);
    const pctDamien = Math.min(100, Math.max(0, (progDamien.progression ?? 0) * 100));
    document.getElementById('progressFillDamien').style.width = `${pctDamien}%`;
    document.getElementById('progressTextDamien').textContent = formatPercent(pctDamien);
    
    // Opa-Spalte
    document.getElementById('villeActuelleOpa').textContent = progOpa.ville_actuelle || '🏠 Kettenis';
    const kmRestOpa = progOpa.km_restants ?? 30;
    document.getElementById('prochaineVilleOpa').textContent = progOpa.prochaine_ville || '🇧🇪 Liège';
    document.getElementById('kmRestantsOpa').textContent = formatDistance(kmRestOpa);
    const pctOpa = Math.min(100, Math.max(0, (progOpa.progression ?? 0) * 100));
    document.getElementById('progressFillOpa').style.width = `${pctOpa}%`;
    document.getElementById('progressTextOpa').textContent = formatPercent(pctOpa);
    
    // E-Mail-Link (Gesamtfortschritt)
    const progGlobal = data.progression || progOpa;
    const emailSubject = encodeURIComponent("Opa's Bicycle Update");
    const emailBody = encodeURIComponent(
        `Gesamt: ${formatDistance(toursData.stats?.total_global || 0)}\nDamien: ${progDamien.ville_actuelle || '🏠 Kettenis'}\nOpa: ${progOpa.ville_actuelle || '🏠 Kettenis'}`
    );
    document.getElementById('emailLink').href = `mailto:cogi003@gmail.com?subject=${emailSubject}&body=${emailBody}`;
}

// Afficher les tours en 2 colonnes (Damien | Opa)
function displayTours(tours) {
    const toursListDamien = document.getElementById('toursListDamien');
    const toursListOpa = document.getElementById('toursListOpa');
    toursListDamien.innerHTML = '';
    toursListOpa.innerHTML = '';
    
    if (tours.length === 0) {
        toursListDamien.innerHTML = '<p class="empty-history">Keine Touren</p>';
        toursListOpa.innerHTML = '<p class="empty-history">Keine Touren</p>';
        return;
    }
    
    const toursDamien = tours.filter(t => (t.Utilisateur || 'Opa').trim() === 'Damien');
    const toursOpa = tours.filter(t => (t.Utilisateur || 'Opa').trim() !== 'Damien');
    
    [toursDamien, toursOpa].forEach((tourList, idx) => {
        const targetList = idx === 0 ? toursListDamien : toursListOpa;
        if (tourList.length === 0) {
            targetList.innerHTML = '<p class="empty-history">Keine Touren</p>';
            return;
        }
        tourList.forEach((tour, displayIndex) => {
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
                <strong>Km</strong>
                <span>${formatDistance(tour.Km || 0)}</span>
            </div>
            ${tour.Etape && tour.Etape !== 'NaN' && tour.Etape !== 'nan' && tour.Etape !== 'N/A' ? `
            <div class="tour-field">
                <strong>Etape</strong>
                <span>${tour.Etape}</span>
            </div>
            ` : ''}
            ${tour.Bemerkungen && String(tour.Bemerkungen).trim() ? `
            <div class="tour-remark">${escapeHtml(String(tour.Bemerkungen).trim())}</div>
            ` : ''}
            <button class="btn-delete" onclick="deleteTour(${realIndex})" title="Löschen">❌</button>
        `;
        
            targetList.appendChild(tourItem);
        });
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
        notes: document.getElementById('notes').value,
        utilisateur: document.getElementById('utilisateur').value || 'Opa'
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
            document.getElementById('utilisateur').value = 'Opa';
            
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

// Zahlenformat DE/BE: Tausendpunkt, Dezimalkomma (z.B. 13.000,0 km)
function formatNumber(num, decimals = 1) {
    const n = Number(num);
    if (isNaN(n)) return '0,0';
    const [intPart, decPart] = n.toFixed(decimals).split('.');
    const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return decPart ? `${intFormatted},${decPart}` : intFormatted;
}

function formatDistance(km) {
    return `${formatNumber(km, 1)} km`;
}

function formatPercent(pct) {
    return `${formatNumber(pct, 1)} %`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
