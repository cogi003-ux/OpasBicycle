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
    
    // Fermer la modale avec Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.getElementById('tourModal').classList.contains('modal-open')) {
            closeTourModal();
        }
    });
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
        
        updateStats({
            stats_damien: data.stats_damien || { total_global: 0, total_aujourdhui: 0, total_semaine: 0, total_mois: 0, total_annee: 0 },
            stats_opa: data.stats_opa || { total_global: 0, total_aujourdhui: 0, total_semaine: 0, total_mois: 0, total_annee: 0 }
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
            stats_damien: { total_global: 0, total_aujourdhui: 0, total_semaine: 0, total_mois: 0, total_annee: 0 },
            stats_opa: { total_global: 0, total_aujourdhui: 0, total_semaine: 0, total_mois: 0, total_annee: 0 }
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

// Statistiken pro Nutzer aktualisieren
function updateStats(data) {
    const statsDamien = data.stats_damien || {};
    const statsOpa = data.stats_opa || {};
    
    document.getElementById('statDamienAujourdhui').textContent = formatDistance(statsDamien.total_aujourdhui || 0);
    document.getElementById('statDamienSemaine').textContent = formatDistance(statsDamien.total_semaine || 0);
    document.getElementById('statDamienMois').textContent = formatDistance(statsDamien.total_mois || 0);
    document.getElementById('statDamienAnnee').textContent = formatDistance(statsDamien.total_annee || 0);
    document.getElementById('statDamienTotal').textContent = formatDistance(statsDamien.total_global || 0);
    
    document.getElementById('statOpaAujourdhui').textContent = formatDistance(statsOpa.total_aujourdhui || 0);
    document.getElementById('statOpaSemaine').textContent = formatDistance(statsOpa.total_semaine || 0);
    document.getElementById('statOpaMois').textContent = formatDistance(statsOpa.total_mois || 0);
    document.getElementById('statOpaAnnee').textContent = formatDistance(statsOpa.total_annee || 0);
    document.getElementById('statOpaTotal').textContent = formatDistance(statsOpa.total_global || 0);
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
    const worldPctDamien = progDamien.world_tour_pct ?? (progDamien.progression ?? 0) * 100;
    document.getElementById('globeMessageDamien').textContent = `Damien hat ${formatPercent(worldPctDamien)} der Weltreise geschafft!`;
    document.getElementById('villeActuelleDamien').textContent = progDamien.ville_actuelle || '🏠 Kettenis';
    const kmRestDamien = progDamien.km_restants ?? 30;
    const nextCityDamien = progDamien.prochaine_ville || '🇧🇪 Liège';
    document.getElementById('prochaineVilleDamien').textContent = nextCityDamien;
    document.getElementById('progressBarLabelDamien').textContent = `Aktuelle Etappe: Auf dem Weg nach ${nextCityDamien.replace(/^[^\s]+\s/, '')}`;
    document.getElementById('kmRestantsDamien').textContent = formatDistance(kmRestDamien);
    const pctDamien = Math.min(100, Math.max(0, (progDamien.progression ?? 0) * 100));
    document.getElementById('progressFillDamien').style.width = `${pctDamien}%`;
    document.getElementById('progressTextDamien').textContent = formatPercent(pctDamien);
    
    // Opa-Spalte
    const worldPctOpa = progOpa.world_tour_pct ?? (progOpa.progression ?? 0) * 100;
    document.getElementById('globeMessageOpa').textContent = `Opa hat ${formatPercent(worldPctOpa)} der Weltreise geschafft!`;
    document.getElementById('villeActuelleOpa').textContent = progOpa.ville_actuelle || '🏠 Kettenis';
    const kmRestOpa = progOpa.km_restants ?? 30;
    const nextCityOpa = progOpa.prochaine_ville || '🇧🇪 Liège';
    document.getElementById('prochaineVilleOpa').textContent = nextCityOpa;
    document.getElementById('progressBarLabelOpa').textContent = `Aktuelle Etappe: Auf dem Weg nach ${nextCityOpa.replace(/^[^\s]+\s/, '')}`;
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
            tourItem.className = 'tour-item tour-item-clickable';
            const realIndex = tour._index !== undefined ? tour._index : displayIndex;
            const tourDataAttr = JSON.stringify(tour).replace(/"/g, '&quot;');
            const photos = tour.photos && Array.isArray(tour.photos) ? tour.photos : [];
            const hasPhotos = photos.length > 0;
            const firstPhotoUrl = hasPhotos ? photos[0] : '';
            const photoPreviewHtml = hasPhotos
                ? `<div class="tour-photo-preview" title="Fotos anzeigen">
                    <img src="${escapeHtml(firstPhotoUrl)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                    <span class="tour-photo-icon-fallback" style="display:none">📸</span>
                   </div>`
                : '';
            tourItem.innerHTML = `
            ${photoPreviewHtml}
            <div class="tour-field">
                <strong>Datum</strong>
                <span>${tour.Date || ''}</span>
                ${tour.Wetter && String(tour.Wetter).trim() && tour.Wetter !== 'N/A' ? `
                <span class="tour-wetter">🌤️ ${escapeHtml(String(tour.Wetter).trim())}</span>
                ` : ''}
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
            <button class="btn-delete" onclick="event.stopPropagation(); deleteTour(${realIndex})" title="Löschen">❌</button>
        `;
            
            tourItem.setAttribute('data-tour', tourDataAttr);
            tourItem.addEventListener('click', (e) => {
                if (!e.target.closest('.btn-delete')) {
                    const data = tourItem.getAttribute('data-tour').replace(/&quot;/g, '"');
                    openTourModal(JSON.parse(data));
                }
            });
            targetList.appendChild(tourItem);
        });
    });
}

let currentModalTour = null;

function openTourModal(tour) {
    currentModalTour = tour;
    const modal = document.getElementById('tourModal');
    modal.classList.add('modal-open');
    modal.setAttribute('aria-hidden', 'false');
    
    const startPlace = (tour.Start || '').replace(/\s*\(\d{1,2}:\d{2}\)\s*$/, '').trim();
    const zielPlace = (tour.Ziel || '').replace(/\s*\(\d{1,2}:\d{2}\)\s*$/, '').trim();
    const startTime = (tour.Start || '').match(/\((\d{1,2}:\d{2})\)/)?.[1] || '';
    const zielTime = (tour.Ziel || '').match(/\((\d{1,2}:\d{2})\)/)?.[1] || '';
    
    document.getElementById('modalDate').textContent = tour.Date || '—';
    document.getElementById('modalRoute').textContent = `${startPlace || '—'} ➝ ${zielPlace || '—'}`;
    document.getElementById('modalDistance').textContent = formatDistance(tour.Km || 0);
    
    let timeStr = '—';
    let speedStr = '—';
    if (startTime && zielTime) {
        const [sh, sm] = startTime.split(':').map(Number);
        const [zh, zm] = zielTime.split(':').map(Number);
        const mins = (zh * 60 + zm) - (sh * 60 + sm);
        if (mins > 0) {
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            timeStr = h ? `${h}h ${m}min` : `${m} min`;
            const km = Number(tour.Km) || 0;
            if (km > 0) {
                const speed = (km / (mins / 60)).toFixed(1).replace('.', ',');
                speedStr = `${speed} km/h`;
            }
        }
    }
    document.getElementById('modalTime').textContent = timeStr;
    document.getElementById('modalSpeed').textContent = speedStr;
    document.getElementById('modalWetter').textContent = tour.Wetter && tour.Wetter !== 'N/A' ? tour.Wetter : '—';
    
    const bemerkWrap = document.getElementById('modalBemerkungenWrap');
    if (tour.Bemerkungen && String(tour.Bemerkungen).trim()) {
        bemerkWrap.style.display = 'block';
        document.getElementById('modalBemerkungen').textContent = tour.Bemerkungen.trim();
    } else {
        bemerkWrap.style.display = 'none';
    }
    
    const shareBtn = document.getElementById('modalShareBtn');
    shareBtn.onclick = () => {
        const subject = encodeURIComponent(`Tour ${tour.Date || ''}`);
        const body = encodeURIComponent(`${startPlace} → ${zielPlace}\n${formatDistance(tour.Km || 0)}\nWetter: ${tour.Wetter || '—'}`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    };

    // Afficher les photos du tour
    const photosWrap = document.getElementById('modalPhotosWrap');
    const photosGrid = document.getElementById('modalPhotosGrid');
    const photos = tour.photos && Array.isArray(tour.photos) ? tour.photos : [];
    if (photos.length > 0) {
        photosWrap.style.display = 'block';
        photosGrid.innerHTML = photos.map(url => `
            <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="modal-photo-item">
                <img src="${escapeHtml(url)}" alt="Photo du tour">
            </a>
        `).join('');
    } else {
        photosWrap.style.display = 'none';
        photosGrid.innerHTML = '';
    }

    // Bouton Ajouter des photos (Supabase uniquement)
    const photoBtn = document.getElementById('modalPhotoBtn');
    const photoInput = document.getElementById('photoFileInput');
    if (photoBtn && photoInput) {
        photoBtn.onclick = () => photoInput.click();
        photoInput.onchange = (e) => {
            const file = e.target.files?.[0];
            if (!file || !tour._index) return;
            if (file.size > 5 * 1024 * 1024) {
                showToast('Image trop lourde (max 5 Mo)', 'error');
                photoInput.value = '';
                return;
            }
            uploadTourPhoto(tour._index, file);
            photoInput.value = '';
        };
    }
}

async function uploadTourPhoto(tourId, file) {
    const photoBtn = document.getElementById('modalPhotoBtn');
    if (photoBtn) {
        photoBtn.disabled = true;
        photoBtn.textContent = '⏳ Envoi...';
    }
    try {
        const formData = new FormData();
        formData.append('photo', file);
        const response = await fetch(`${API_BASE}/api/tours/${tourId}/photos`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (data.success) {
            showToast('Photo ajoutée ! 📸', 'success');
            await loadTours();
            const updated = toursData.tours.find(t => t._index === tourId);
            if (updated && currentModalTour && currentModalTour._index === tourId) {
                currentModalTour.photos = updated.photos || [];
                openTourModal(currentModalTour);
            }
        } else {
            showToast(data.error || 'Erreur lors de l\'envoi', 'error');
        }
    } catch (err) {
        console.error('Erreur upload photo:', err);
        showToast('Erreur lors de l\'envoi de la photo', 'error');
    } finally {
        if (photoBtn) {
            photoBtn.disabled = false;
            photoBtn.textContent = '📸 Ajouter des photos';
        }
    }
}

function closeTourModal() {
    document.getElementById('tourModal').classList.remove('modal-open');
    document.getElementById('tourModal').setAttribute('aria-hidden', 'true');
    currentModalTour = null;
}

function printTourDetail() {
    if (!currentModalTour) return;
    const printContent = document.querySelector('.modal-glass').innerHTML;
    const w = window.open('', '_blank');
    w.document.write(`
        <html><head><title>Tour ${currentModalTour.Date || ''}</title>
        <style>body{font-family:sans-serif;padding:20px;background:#0f172a;color:#fff;}
        .modal-bike-animation,.modal-close,.btn-modal{display:none;}</style></head>
        <body>${printContent}</body></html>
    `);
    w.document.close();
    w.print();
    w.close();
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

// Zahlenformat DE/BE: Dezimalkomma, kein Tausendertrennzeichen (z.B. 12890,0 km)
function formatNumber(num, decimals = 1) {
    const n = Number(num);
    if (isNaN(n)) return '0,0';
    const [intPart, decPart] = n.toFixed(decimals).split('.');
    return decPart ? `${intPart},${decPart}` : intPart;
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
