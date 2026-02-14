// Configuration
const API_BASE = '';
const BADGE_STORAGE_KEY = 'opas_bicycle_badge_count';

// Badge PWA (compatible navigateurs sans support)
function setAppBadgeSafe(count) {
    try {
        if (typeof navigator !== 'undefined' && typeof navigator.setAppBadge === 'function') {
            navigator.setAppBadge(count).catch(() => {});
        }
    } catch (_) {}
}
function clearAppBadgeSafe() {
    try {
        if (typeof navigator !== 'undefined' && typeof navigator.clearAppBadge === 'function') {
            navigator.clearAppBadge().catch(() => {});
        }
    } catch (_) {}
}
function getStoredBadgeCount() {
    try {
        const n = parseInt(localStorage.getItem(BADGE_STORAGE_KEY) || '0', 10);
        return isNaN(n) ? 0 : Math.max(0, n);
    } catch (_) { return 0; }
}
function setStoredBadgeCount(n) {
    try {
        localStorage.setItem(BADGE_STORAGE_KEY, String(Math.max(0, n)));
    } catch (_) {}
}
function incrementAppBadge() {
    const count = getStoredBadgeCount() + 1;
    setStoredBadgeCount(count);
    setAppBadgeSafe(count);
}
function clearAppBadge() {
    setStoredBadgeCount(0);
    clearAppBadgeSafe();
}

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
    // Initialiser les icônes Lucide (stats dashboard)
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    // Définir la date d'aujourd'hui par défaut
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
    
    // Charger les données
    await loadTours();
    
    // Écouter le formulaire
    document.getElementById('tourForm').addEventListener('submit', handleFormSubmit);
    
    // Fermer la modale avec Escape
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (document.getElementById('tourModal').classList.contains('modal-open')) closeTourModal();
        else if (document.getElementById('addBikeModal').style.display === 'flex') closeAddBikeModal();
        else if (document.getElementById('factureModal').style.display === 'flex') closeFactureModal();
    });

    // Notification Live : vérification toutes les 60 s (nouveau code ou nouvelles données)
    startLiveNotificationCheck();
    initLiveNotificationButton();

    // Garage (Entretien)
    initNavGarage();
    await loadGarageBikes();

    // Badge PWA : effacement à l'ouverture (l'utilisateur consulte l'app)
    clearAppBadge();
}

let lastKnownVersion = null;
let lastKnownToursCount = 0;
let lastKnownFirstTourId = null;

async function startLiveNotificationCheck() {
    try {
        const verRes = await fetch(`${API_BASE}/api/version`);
        if (verRes.ok) {
            const v = await verRes.json();
            lastKnownVersion = v.version || null;
        }
    } catch (_) {}
    if (toursData.tours && toursData.tours.length > 0) {
        lastKnownToursCount = toursData.tours.length;
        lastKnownFirstTourId = toursData.tours[0]._index;
    }
    setInterval(checkForUpdates, 60000);
}

function checkForUpdates() {
    (async () => {
        let hasNew = false;
        try {
            const verRes = await fetch(`${API_BASE}/api/version`);
            if (verRes.ok) {
                const v = await verRes.json();
                const cur = v.version || null;
                if (lastKnownVersion !== null && cur !== null && cur !== lastKnownVersion) {
                    hasNew = true;
                }
            }
        } catch (_) {}
        if (!hasNew) {
            try {
                const res = await fetch(`${API_BASE}/api/tours`);
                if (res.ok) {
                    const data = await res.json();
                    const tours = data.tours || [];
                    if (tours.length > lastKnownToursCount) hasNew = true;
                    if (!hasNew && tours.length > 0 && tours[0]._index !== lastKnownFirstTourId) hasNew = true;
                }
            } catch (_) {}
        }
        if (hasNew) {
            showLiveNotificationBanner();
            incrementAppBadge();
        }
    })();
}

function showLiveNotificationBanner() {
    const banner = document.getElementById('liveNotificationBanner');
    if (banner) banner.style.display = 'flex';
}

function hideLiveNotificationBanner() {
    const banner = document.getElementById('liveNotificationBanner');
    if (banner) banner.style.display = 'none';
}

function initLiveNotificationButton() {
    const btn = document.getElementById('liveNotificationBtn');
    if (btn) {
        btn.addEventListener('click', () => {
            clearAppBadge();
            window.location.reload(true);
        });
    }
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
        
        const emptyStats = { total_global: 0, total_aujourdhui: 0, total_semaine: 0, total_mois: 0, total_annee: 0 };
        const emptyProg = { ville_actuelle: '🏠 Kettenis', prochaine_ville: '🇧🇪 Liège', km_restants: 30, progression: 0, distance_kettenis: 30 };
        updateStats({
            stats_oswald: data.stats_oswald || emptyStats,
            stats_alexandre: data.stats_alexandre || emptyStats,
            stats_damien: data.stats_damien || emptyStats
        });
        updateProgression({
            progression_oswald: data.progression_oswald || emptyProg,
            progression_alexandre: data.progression_alexandre || emptyProg,
            progression_damien: data.progression_damien || emptyProg
        });
        
        document.getElementById('challengeSection').style.display = 'block';
        const ch = data.challenge || {
            total_oswald: 0, total_alexandre: 0, total_damien: 0,
            leader: 'Unentschieden', difference: 0,
            world_tour_oswald: { km: 0, pct: 0, target: 40075 },
            world_tour_alexandre: { km: 0, pct: 0, target: 40075 },
            world_tour_damien: { km: 0, pct: 0, target: 40075 }
        };
        updateChallenge(ch);
        updateHistoryComparativeBar(ch);
        
        document.getElementById('historySection').style.display = 'block';
        if (data.tours && data.tours.length > 0) {
            displayTours(data.tours);
        } else {
            document.getElementById('toursListOswald').innerHTML = '<p class="empty-history">Keine Touren</p>';
            document.getElementById('toursListAlexandre').innerHTML = '<p class="empty-history">Keine Touren</p>';
            document.getElementById('toursListDamien').innerHTML = '<p class="empty-history">Keine Touren</p>';
        }
    } catch (error) {
        console.error('Erreur lors du chargement des tours:', error);
        
        // Afficher quand même les sections avec des valeurs par défaut
        document.getElementById('statsSection').style.display = 'block';
        document.getElementById('progressionSection').style.display = 'block';
        document.getElementById('challengeSection').style.display = 'block';
        document.getElementById('historySection').style.display = 'block';
        
        const emptyStats = { total_global: 0, total_aujourdhui: 0, total_semaine: 0, total_mois: 0, total_annee: 0 };
        const emptyProg = { ville_actuelle: '🏠 Kettenis', prochaine_ville: '🇧🇪 Liège', km_restants: 30, progression: 0, distance_kettenis: 30 };
        updateStats({
            stats_oswald: emptyStats, stats_alexandre: emptyStats, stats_damien: emptyStats
        });
        updateProgression({
            progression_oswald: emptyProg, progression_alexandre: emptyProg, progression_damien: emptyProg
        });
        updateChallenge({
            total_oswald: 0, total_alexandre: 0, total_damien: 0,
            leader: 'Unentschieden', difference: 0,
            world_tour_oswald: { km: 0, pct: 0, target: 40075 },
            world_tour_alexandre: { km: 0, pct: 0, target: 40075 },
            world_tour_damien: { km: 0, pct: 0, target: 40075 }
        });
        updateHistoryComparativeBar({ total_oswald: 0, total_alexandre: 0, total_damien: 0 });
        document.getElementById('toursListOswald').innerHTML = '<p class="empty-history">Keine Touren</p>';
        document.getElementById('toursListAlexandre').innerHTML = '<p class="empty-history">Keine Touren</p>';
        document.getElementById('toursListDamien').innerHTML = '<p class="empty-history">Keine Touren</p>';
        
        // Ne pas afficher de toast d'erreur pour ne pas perturber l'utilisateur
        // Le formulaire reste fonctionnel même si le chargement échoue
    }
}

// Parser la date du tour (dd/mm/yyyy) pour l'icône calendrier
function parseTourDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return { day: '?', month: '?' };
    const parts = dateStr.trim().split(/[\/\-\.]/);
    if (parts.length < 2) return { day: '?', month: '?' };
    const day = parseInt(parts[0], 10) || '?';
    const monthNum = parseInt(parts[1], 10);
    const months = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
    const month = (monthNum >= 1 && monthNum <= 12) ? months[monthNum - 1] : '?';
    return { day, month };
}

// Statistiken pro Nutzer aktualisieren
function updateStats(data) {
    const users = ['Oswald', 'Alexandre', 'Damien'];
    const keys = ['oswald', 'alexandre', 'damien'];
    users.forEach((name, i) => {
        const stats = data[`stats_${keys[i]}`] || {};
        document.getElementById(`stat${name}Aujourdhui`).textContent = formatDistance(stats.total_aujourdhui || 0);
        document.getElementById(`stat${name}Semaine`).textContent = formatDistance(stats.total_semaine || 0);
        document.getElementById(`stat${name}Mois`).textContent = formatDistance(stats.total_mois || 0);
        document.getElementById(`stat${name}Annee`).textContent = formatDistance(stats.total_annee || 0);
        document.getElementById(`stat${name}Total`).textContent = formatDistance(stats.total_global || 0);
    });
}

// Challenge Generationen-Duell aktualisieren
function updateChallenge(challenge) {
    ['Oswald', 'Alexandre', 'Damien'].forEach(name => {
        const key = name.toLowerCase();
        document.getElementById(`total${name}`).textContent = formatDistance(challenge[`total_${key}`] || 0);
        const wt = challenge[`world_tour_${key}`] || { km: 0, pct: 0 };
        document.getElementById(`worldTour${name}Km`).textContent = formatDistance(wt.km || 0);
        document.getElementById(`worldTour${name}Fill`).style.width = `${Math.min(100, wt.pct || 0)}%`;
        document.getElementById(`worldTour${name}Pct`).textContent = formatPercent(wt.pct || 0);
    });
    
    let message = '';
    if (challenge.leader === 'Unentschieden') {
        message = 'Unentschieden! Keine Touren eingetragen oder gleiche Strecke.';
    } else {
        const diff = formatDistance(challenge.difference || 0);
        message = `${challenge.leader} führt mit ${diff} Vorsprung!`;
    }
    document.getElementById('challengeMessage').textContent = message;

    // Barre Master : position des 3 curseurs sur 40 075 km
    const TARGET = 40075;
    const pct = (km) => Math.min(100, (km / TARGET) * 100);
    document.getElementById('challengeMarkerOswald').style.left = `${pct(challenge.total_oswald || 0)}%`;
    document.getElementById('challengeMarkerAlexandre').style.left = `${pct(challenge.total_alexandre || 0)}%`;
    document.getElementById('challengeMarkerDamien').style.left = `${pct(challenge.total_damien || 0)}%`;
}

// Barre comparative : position relative des 3 utilisateurs sur 40 075 km
function updateHistoryComparativeBar(challenge) {
    const TARGET = 40075;
    const oswald = challenge.total_oswald || 0;
    const alexandre = challenge.total_alexandre || 0;
    const damien = challenge.total_damien || 0;
    const total = oswald + alexandre + damien;
    let wO = 0, wA = 0, wD = 0;
    if (total > 0) {
        const filled = Math.min(100, (total / TARGET) * 100);
        wO = (oswald / total) * filled;
        wA = (alexandre / total) * filled;
        wD = (damien / total) * filled;
    }
    document.getElementById('historyBarOswald').style.width = `${wO}%`;
    document.getElementById('historyBarAlexandre').style.width = `${wA}%`;
    document.getElementById('historyBarDamien').style.width = `${wD}%`;
}

// Fortschritt für Oswald, Alexandre und Damien aktualisieren
function updateProgression(data) {
    ['Oswald', 'Alexandre', 'Damien'].forEach(name => {
        const key = name.toLowerCase();
        const prog = data[`progression_${key}`] || {};
        const worldPct = prog.world_tour_pct ?? (prog.progression ?? 0) * 100;
        document.getElementById(`globeMessage${name}`).textContent = `${name} hat ${formatPercent(worldPct)} der Weltreise geschafft!`;
        document.getElementById(`villeActuelle${name}`).textContent = prog.ville_actuelle || '🏠 Kettenis';
        const nextCity = prog.prochaine_ville || '🇧🇪 Liège';
        document.getElementById(`prochaineVille${name}`).textContent = nextCity;
        document.getElementById(`progressBarLabel${name}`).textContent = `Aktuelle Etappe: Auf dem Weg nach ${nextCity.replace(/^[^\s]+\s/, '')}`;
        document.getElementById(`kmRestants${name}`).textContent = formatDistance(prog.km_restants ?? 30);
        const pct = Math.min(100, Math.max(0, (prog.progression ?? 0) * 100));
        document.getElementById(`progressFill${name}`).style.width = `${pct}%`;
        document.getElementById(`progressText${name}`).textContent = formatPercent(pct);
    });
    
    const progOswald = data.progression_oswald || {};
    const progAlexandre = data.progression_alexandre || {};
    const progDamien = data.progression_damien || {};
    const emailSubject = encodeURIComponent("Opa's Bicycle Update");
    const emailBody = encodeURIComponent(
        `Gesamt: ${formatDistance(toursData.stats?.total_global || 0)}\nOswald: ${progOswald.ville_actuelle || '🏠 Kettenis'}\nAlexandre: ${progAlexandre.ville_actuelle || '🏠 Kettenis'}\nDamien: ${progDamien.ville_actuelle || '🏠 Kettenis'}`
    );
    document.getElementById('emailLink').href = `mailto:cogi003@gmail.com?subject=${emailSubject}&body=${emailBody}`;
}

// Normaliser Utilisateur : Opa (ancien) -> Oswald
function normalizeUser(u) {
    const v = (u || 'Oswald').trim();
    return v === 'Opa' ? 'Oswald' : v;
}

// Afficher les tours en 3 colonnes (Oswald | Alexandre | Damien)
function displayTours(tours) {
    const lists = {
        Oswald: document.getElementById('toursListOswald'),
        Alexandre: document.getElementById('toursListAlexandre'),
        Damien: document.getElementById('toursListDamien')
    };
    Object.values(lists).forEach(el => { el.innerHTML = ''; });
    
    if (tours.length === 0) {
        Object.values(lists).forEach(el => { el.innerHTML = '<p class="empty-history">Keine Touren</p>'; });
        return;
    }
    
    const toursByUser = { Oswald: [], Alexandre: [], Damien: [] };
    tours.forEach(t => {
        const u = normalizeUser(t.Utilisateur);
        if (toursByUser[u]) toursByUser[u].push(t);
        else toursByUser.Oswald.push(t); // fallback
    });
    
    ['Oswald', 'Alexandre', 'Damien'].forEach(user => {
        const tourList = toursByUser[user];
        const targetList = lists[user];
        if (tourList.length === 0) {
            targetList.innerHTML = '<p class="empty-history">Keine Touren</p>';
            return;
        }
        tourList.forEach((tour, displayIndex) => {
            const tourItem = document.createElement('div');
            const userClass = `tour-item-${user.toLowerCase()}`;
            tourItem.className = `tour-item tour-item-clickable ${userClass}`;
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
            const userKey = user.toLowerCase();
            const parsed = parseTourDate(tour.Date);
            const photoThumbHtml = hasPhotos
                ? `<div class="tour-photo-compact"><img src="${escapeHtml(firstPhotoUrl)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><span class="tour-photo-icon-fallback" style="display:none">📸</span></div>`
                : '';
            tourItem.innerHTML = `
            <div class="tour-mobile-row">
                <div class="tour-mobile-calendar">
                    <div class="tour-date-icon"><span class="tour-cal-day">${parsed.day}</span><span class="tour-cal-month">${parsed.month}</span></div>
                </div>
                <div class="tour-mobile-center">
                    <span class="tour-mobile-km">${formatDistance(tour.Km || 0)}</span>
                    ${photoThumbHtml}
                </div>
                <button class="btn-details" type="button">Détails</button>
            </div>
            ${photoPreviewHtml}
            <div class="tour-field tour-desktop-only">
                <strong>Datum</strong>
                <div class="tour-datum-row">
                    <div class="tour-date-icon" title="${escapeHtml(tour.Date || '')}">
                        <span class="tour-cal-day">${parsed.day}</span>
                        <span class="tour-cal-month">${parsed.month}</span>
                    </div>
                    <span>${tour.Date || ''}</span>
                </div>
                <span class="tour-user-pill tour-user-pill-${userKey}" title="${user}">${ { Oswald: '🌳', Alexandre: '🌴', Damien: '⚡' }[user] } ${user}</span>
                ${tour.Wetter && String(tour.Wetter).trim() && tour.Wetter !== 'N/A' ? `
                <span class="tour-wetter">🌤️ ${escapeHtml(String(tour.Wetter).trim())}</span>
                ` : ''}
            </div>
            <div class="tour-field tour-desktop-only">
                <strong>Start</strong>
                <span>${tour.Start || ''}</span>
            </div>
            <div class="tour-field tour-desktop-only">
                <strong>Ziel</strong>
                <span>${tour.Ziel || ''}</span>
            </div>
            <div class="tour-field tour-desktop-only">
                <strong>Km</strong>
                <span>${formatDistance(tour.Km || 0)}</span>
            </div>
            ${tour.Etape && tour.Etape !== 'NaN' && tour.Etape !== 'nan' && tour.Etape !== 'N/A' ? `
            <div class="tour-field tour-desktop-only">
                <strong>Etape</strong>
                <span>${tour.Etape}</span>
            </div>
            ` : ''}
            ${tour.Bemerkungen && String(tour.Bemerkungen).trim() ? `
            <div class="tour-remark tour-desktop-only">${escapeHtml(String(tour.Bemerkungen).trim())}</div>
            ` : ''}
            <button class="btn-delete tour-desktop-only" onclick="event.stopPropagation(); deleteTour(${realIndex})" title="Löschen">❌</button>
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
        utilisateur: document.getElementById('utilisateur').value || 'Oswald'
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
            incrementAppBadge(); // Nouvelle sortie → badge pour autres appareils / onglets
            // Réinitialiser le formulaire
            document.getElementById('tourForm').reset();
            document.getElementById('date').value = new Date().toISOString().split('T')[0];
            document.getElementById('depart').value = 'Kettenis';
            document.getElementById('arrivee').value = 'Kettenis';
            document.getElementById('heure_depart').value = '10:00';
            document.getElementById('heure_etape').value = '11:30';
            document.getElementById('heure_arrivee').value = '12:30';
            document.getElementById('utilisateur').value = 'Oswald';
            
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

// --- Garage (Entretien) ---

function initNavGarage() {
    const navTracker = document.getElementById('navTracker');
    const navGarage = document.getElementById('navGarage');
    const mainView = document.getElementById('mainView');
    const garageView = document.getElementById('garageView');
    if (!navTracker || !navGarage || !mainView || !garageView) return;
    navTracker.addEventListener('click', () => {
        mainView.style.display = 'block';
        garageView.style.display = 'none';
        navTracker.classList.add('active');
        navTracker.setAttribute('aria-pressed', 'true');
        navGarage.classList.remove('active');
        navGarage.setAttribute('aria-pressed', 'false');
        clearAppBadge();
    });
    navGarage.addEventListener('click', () => {
        mainView.style.display = 'none';
        garageView.style.display = 'block';
        navGarage.classList.add('active');
        navGarage.setAttribute('aria-pressed', 'true');
        navTracker.classList.remove('active');
        navTracker.setAttribute('aria-pressed', 'false');
        clearAppBadge();
        loadGarageBikes();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    });
    const addBtn = document.getElementById('garageAddBtn');
    if (addBtn) addBtn.addEventListener('click', openAddBikeModal);
    const addModalClose = document.getElementById('addBikeModalClose');
    if (addModalClose) addModalClose.addEventListener('click', closeAddBikeModal);
    const addForm = document.getElementById('addBikeForm');
    if (addForm) addForm.addEventListener('submit', handleAddBikeSubmit);
}

let garageKmFromTours = { Oswald: 0, Alexandre: 0, Damien: 0 };

async function loadGarageBikes() {
    const gallery = document.getElementById('garageGallery');
    if (!gallery) return;
    try {
        const res = await fetch(`${API_BASE}/api/entretien`);
        const data = await res.json();
        garageKmFromTours = data.km_from_tours || garageKmFromTours;
        renderGarageCards(data.bikes || []);
    } catch (e) {
        console.error('Garage load:', e);
        gallery.innerHTML = '<p class="garage-empty">Fehler beim Laden.</p>';
    }
}

function renderGarageCards(bikes) {
    const gallery = document.getElementById('garageGallery');
    if (!gallery) return;
    const userColors = { Oswald: 'var(--user-oswald)', Alexandre: 'var(--user-alexandre)', Damien: 'var(--user-damien)' };
    const userEmoji = { Oswald: '🌳', Alexandre: '🌴', Damien: '⚡' };
    const DAYS_ALERT = 30;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    function isMaintenanceSoon(dateStr) {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        d.setHours(0, 0, 0, 0);
        const diff = (d - today) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= DAYS_ALERT;
    }
    function isMaintenanceOverdue(dateStr) {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        d.setHours(0, 0, 0, 0);
        return d < today;
    }
    function formatDateDE(str) {
        if (!str) return '—';
        const d = new Date(str);
        return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    if (bikes.length === 0) {
        gallery.innerHTML = '<p class="garage-empty">Noch keine Fahrräder eingetragen.</p>';
        return;
    }
    gallery.innerHTML = bikes.map(b => {
        const color = userColors[b.utilisateur] || 'rgba(255,255,255,0.2)';
        const emoji = userEmoji[b.utilisateur] || '🚲';
        const imgUrl = b.url_photo_velo || '';
        const hasFacture = !!b.url_facture;
        const soon = isMaintenanceSoon(b.date_prochain_entretien);
        const overdue = isMaintenanceOverdue(b.date_prochain_entretien);
        const alertClass = overdue ? 'garage-alert-overdue' : (soon ? 'garage-alert-soon' : '');
        const kmFromTours = garageKmFromTours[b.utilisateur] || 0;
        const totalWithTours = (b.km_actuel || 0) + kmFromTours;
        return `
        <div class="garage-card-item" data-id="${b.id}" style="--accent: ${color}">
            <button type="button" class="garage-card-edit-btn" data-id="${b.id}" data-name="${escapeHtml(b.nom_velo || '').replace(/"/g, '&quot;')}" data-user="${b.utilisateur || 'Oswald'}" data-km="${b.km_actuel || 0}" data-date="${b.date_prochain_entretien || ''}" title="Bearbeiten" aria-label="Bearbeiten">
                <i data-lucide="pencil" aria-hidden="true"></i>
            </button>
            <div class="garage-card-image-wrap">
                <div class="garage-card-image" style="background-image: url('${imgUrl || ''}')">
                    ${!imgUrl ? '<span class="garage-card-placeholder">🚲</span>' : ''}
                </div>
                <div class="garage-card-banner">${emoji} ${escapeHtml(b.nom_velo || 'Mon vélo')}</div>
            </div>
            <div class="garage-card-info">
                <div class="garage-card-km-row">
                    <p class="garage-card-km"><strong>${formatDistance(b.km_actuel || 0)}</strong> gesamt</p>
                    <div class="garage-km-actions">
                        <button type="button" class="garage-km-inc" data-id="${b.id}" data-delta="10" title="+10 km">+10</button>
                        <button type="button" class="garage-km-inc" data-id="${b.id}" data-delta="50" title="+50 km">+50</button>
                        ${kmFromTours > 0 ? `<button type="button" class="garage-km-sync" data-id="${b.id}" data-user="${b.utilisateur}" title="Sync mit Touren (+${formatNumber(kmFromTours, 0)} km)">Sync</button>` : ''}
                    </div>
                </div>
                ${kmFromTours > 0 ? `<p class="garage-card-km-tours">${formatDistance(kmFromTours)} aus Touren → ${formatDistance(totalWithTours)} total</p>` : ''}
                <p class="garage-card-date ${alertClass}">
                    Nächstes Service: ${formatDateDE(b.date_prochain_entretien)}
                    ${overdue ? ' (Überfällig!)' : ''}${soon && !overdue ? ' (Bald)' : ''}
                </p>
                <div class="garage-card-actions">
                    ${hasFacture ? `<button type="button" class="garage-btn-facture" data-url="${escapeHtml(b.url_facture)}">Facture</button>` : `<label class="garage-btn-add-facture"><input type="file" accept="image/*,.pdf" data-id="${b.id}" style="display:none">+ Facture</label>`}
                </div>
            </div>
        </div>`;
    }).join('');
    gallery.querySelectorAll('.garage-btn-facture').forEach(btn => {
        btn.addEventListener('click', () => openFactureModal(btn.dataset.url));
    });
    gallery.querySelectorAll('.garage-card-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const bike = bikes.find(x => x.id === parseInt(btn.dataset.id, 10));
            if (bike) openEditBikeModal(bike);
        });
    });
    gallery.querySelectorAll('.garage-km-inc').forEach(btn => {
        btn.addEventListener('click', () => incrementBikeKm(parseInt(btn.dataset.id, 10), parseFloat(btn.dataset.delta, 10)));
    });
    gallery.querySelectorAll('.garage-km-sync').forEach(btn => {
        btn.addEventListener('click', () => syncBikeKm(parseInt(btn.dataset.id, 10), btn.dataset.user));
    });
    gallery.querySelectorAll('.garage-btn-add-facture input').forEach(inp => {
        inp.addEventListener('change', (e) => { if (e.target.files[0]) uploadBikeFacture(parseInt(inp.dataset.id, 10), e.target.files[0]); });
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function openAddBikeModal() {
    document.getElementById('addBikeModalTitle').textContent = 'Neues Fahrrad';
    document.getElementById('addBikeSubmitBtn').textContent = 'Speichern';
    document.getElementById('addBikeId').value = '';
    document.getElementById('addBikeName').value = '';
    document.getElementById('addBikeUser').value = 'Oswald';
    document.getElementById('addBikeKm').value = '0';
    document.getElementById('addBikeDate').value = '';
    document.getElementById('addBikePhoto').value = '';
    document.getElementById('addBikeFacture').value = '';
    const m = document.getElementById('addBikeModal');
    if (m) { m.style.display = 'flex'; m.classList.add('modal-open'); m.setAttribute('aria-hidden', 'false'); }
}

function openEditBikeModal(bike) {
    document.getElementById('addBikeModalTitle').textContent = 'Fahrrad bearbeiten';
    document.getElementById('addBikeSubmitBtn').textContent = 'Aktualisieren';
    document.getElementById('addBikeId').value = String(bike.id || '');
    document.getElementById('addBikeName').value = bike.nom_velo || '';
    document.getElementById('addBikeUser').value = bike.utilisateur || 'Oswald';
    document.getElementById('addBikeKm').value = String(bike.km_actuel || 0);
    document.getElementById('addBikeDate').value = bike.date_prochain_entretien || '';
    document.getElementById('addBikePhoto').value = '';
    document.getElementById('addBikeFacture').value = '';
    const m = document.getElementById('addBikeModal');
    if (m) { m.style.display = 'flex'; m.classList.add('modal-open'); m.setAttribute('aria-hidden', 'false'); }
}

function closeAddBikeModal() {
    const m = document.getElementById('addBikeModal');
    if (m) { m.classList.remove('modal-open'); m.style.display = 'none'; m.setAttribute('aria-hidden', 'true'); }
}

async function handleAddBikeSubmit(e) {
    e.preventDefault();
    const bikeId = document.getElementById('addBikeId').value.trim();
    const isEdit = !!bikeId;
    const name = document.getElementById('addBikeName').value.trim() || 'Mon vélo';
    const user = document.getElementById('addBikeUser').value;
    const km = parseFloat(document.getElementById('addBikeKm').value) || 0;
    const date = document.getElementById('addBikeDate').value || null;
    const photoInput = document.getElementById('addBikePhoto');
    const factureInput = document.getElementById('addBikeFacture');
    try {
        if (isEdit) {
            const res = await fetch(`${API_BASE}/api/entretien/${bikeId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nom_velo: name, utilisateur: user, km_actuel: km, date_prochain_entretien: date || null })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Fehler');
            const id = parseInt(bikeId, 10);
            if (photoInput.files && photoInput.files[0]) {
                const fd = new FormData();
                fd.append('photo', photoInput.files[0]);
                fd.append('field', 'photo_velo');
                await fetch(`${API_BASE}/api/entretien/${id}/upload`, { method: 'POST', body: fd });
            }
            if (factureInput.files && factureInput.files[0]) {
                const fd = new FormData();
                fd.append('photo', factureInput.files[0]);
                fd.append('field', 'facture');
                await fetch(`${API_BASE}/api/entretien/${id}/upload`, { method: 'POST', body: fd });
            }
            showToast('Fahrrad aktualisiert! 🚲', 'success');
            incrementAppBadge();
        } else {
            const res = await fetch(`${API_BASE}/api/entretien`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nom_velo: name, utilisateur: user, km_actuel: km, date_prochain_entretien: date })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Fehler');
            const id = data.id;
            if (photoInput.files && photoInput.files[0]) {
                const fd = new FormData();
                fd.append('photo', photoInput.files[0]);
                fd.append('field', 'photo_velo');
                await fetch(`${API_BASE}/api/entretien/${id}/upload`, { method: 'POST', body: fd });
            }
            if (factureInput.files && factureInput.files[0]) {
                const fd = new FormData();
                fd.append('photo', factureInput.files[0]);
                fd.append('field', 'facture');
                await fetch(`${API_BASE}/api/entretien/${id}/upload`, { method: 'POST', body: fd });
            }
            showToast('Fahrrad hinzugefügt! 🚲', 'success');
            incrementAppBadge();
        }
        closeAddBikeModal();
        await loadGarageBikes();
    } catch (err) {
        showToast(err.message || 'Fehler beim Speichern', 'error');
    }
}

async function incrementBikeKm(bikeId, delta) {
    try {
        const bikes = (await (await fetch(`${API_BASE}/api/entretien`)).json()).bikes || [];
        const b = bikes.find(x => x.id === bikeId);
        if (!b) return;
        const newKm = (b.km_actuel || 0) + delta;
        const res = await fetch(`${API_BASE}/api/entretien/${bikeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ km_actuel: newKm })
        });
        const data = await res.json();
        if (data.success) { showToast(`+${delta} km`, 'success'); incrementAppBadge(); await loadGarageBikes(); }
        else throw new Error(data.error);
    } catch (e) { showToast('Fehler', 'error'); }
}

async function syncBikeKm(bikeId, user) {
    const kmFromTours = garageKmFromTours[user] || 0;
    if (kmFromTours <= 0) return;
    try {
        const bikes = (await (await fetch(`${API_BASE}/api/entretien`)).json()).bikes || [];
        const b = bikes.find(x => x.id === bikeId);
        if (!b) return;
        const newKm = (b.km_actuel || 0) + kmFromTours;
        const res = await fetch(`${API_BASE}/api/entretien/${bikeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ km_actuel: newKm })
        });
        const data = await res.json();
        if (data.success) { showToast(`+${formatNumber(kmFromTours, 0)} km (Touren)`, 'success'); incrementAppBadge(); await loadGarageBikes(); }
        else throw new Error(data.error);
    } catch (e) { showToast('Fehler', 'error'); }
}

async function uploadBikeFacture(bikeId, file) {
    try {
        const fd = new FormData();
        fd.append('photo', file);
        fd.append('field', 'facture');
        const res = await fetch(`${API_BASE}/api/entretien/${bikeId}/upload`, { method: 'POST', body: fd });
        const data = await res.json();
        if (data.success) { showToast('Facture hinzugefügt', 'success'); incrementAppBadge(); await loadGarageBikes(); }
        else throw new Error(data.error);
    } catch (e) { showToast('Fehler beim Hochladen', 'error'); }
}

function openFactureModal(url) {
    const img = document.getElementById('factureImage');
    const m = document.getElementById('factureModal');
    if (img && m && url) {
        img.src = url;
        m.style.display = 'flex';
        m.classList.add('modal-open');
        m.setAttribute('aria-hidden', 'false');
    }
}

function closeFactureModal() {
    const m = document.getElementById('factureModal');
    const img = document.getElementById('factureImage');
    if (m) { m.classList.remove('modal-open'); m.style.display = 'none'; m.setAttribute('aria-hidden', 'true'); }
    if (img) img.src = '';
}
