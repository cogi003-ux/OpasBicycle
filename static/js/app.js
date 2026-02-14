// =============================================================================
// Opa's Bicycle - Application complète
// =============================================================================

const API_BASE = '';
const BADGE_STORAGE_KEY = 'opas_bicycle_badge_count';
const TOUR_DU_MONDE_KM = 40075;

let toursData = { tours: [], stats: {}, progression: {} };
let currentModalTour = null;
let garageKmFromTours = { Oswald: 0, Alexandre: 0, Damien: 0 };
let lastKnownVersion = null;
let lastKnownToursCount = 0;
let lastKnownFirstTourId = null;

document.addEventListener('DOMContentLoaded', () => { initializeApp(); });

async function initializeApp() {
    if (typeof lucide !== 'undefined') lucide.createIcons();
    const dateEl = document.getElementById('date');
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
    await loadEntries();
    const tourForm = document.getElementById('tourForm');
    if (tourForm) tourForm.addEventListener('submit', handleFormSubmit);
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const tourModal = document.getElementById('tourModal');
        const addBikeModal = document.getElementById('addBikeModal');
        const factureModal = document.getElementById('factureModal');
        if (tourModal && tourModal.classList.contains('modal-open')) closeTourModal();
        else if (addBikeModal && addBikeModal.style.display === 'flex') closeAddBikeModal();
        else if (factureModal && factureModal.style.display === 'flex') closeFactureModal();
    });
    initNavigation();
    initLiveNotification();
    clearAppBadge();
}

function initNavigation() {
    const navTracker = document.getElementById('navTracker');
    const navGarage = document.getElementById('navGarage');
    const trackerEl = document.getElementById('section-tracker');
    const garageEl = document.getElementById('section-garage');
    if (!navTracker || !navGarage || !trackerEl || !garageEl) return;
    navTracker.addEventListener('click', () => {
        trackerEl.classList.remove('section-hidden');
        trackerEl.classList.add('section-active');
        garageEl.classList.add('section-hidden');
        garageEl.classList.remove('section-active');
        navTracker.classList.add('active');
        navTracker.setAttribute('aria-pressed', 'true');
        navGarage.classList.remove('active');
        navGarage.setAttribute('aria-pressed', 'false');
        clearAppBadge();
    });
    navGarage.addEventListener('click', () => {
        garageEl.classList.remove('section-hidden');
        garageEl.classList.add('section-active');
        trackerEl.classList.add('section-hidden');
        trackerEl.classList.remove('section-active');
        navGarage.classList.add('active');
        navGarage.setAttribute('aria-pressed', 'true');
        navTracker.classList.remove('active');
        navTracker.setAttribute('aria-pressed', 'false');
        clearAppBadge();
        loadGarage();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    });
    const addBtn = document.getElementById('garageAddBtn');
    if (addBtn) addBtn.addEventListener('click', openAddBikeModal);
    const addModalClose = document.getElementById('addBikeModalClose');
    if (addModalClose) addModalClose.addEventListener('click', closeAddBikeModal);
    const addForm = document.getElementById('addBikeForm');
    if (addForm) addForm.addEventListener('submit', handleAddBikeSubmit);
}

async function loadEntries() {
    const statsSection = document.getElementById('statsSection');
    const progressionSection = document.getElementById('progressionSection');
    const challengeSection = document.getElementById('challengeSection');
    const historySection = document.getElementById('historySection');
    const emptyStats = { total_global: 0, total_aujourdhui: 0, total_semaine: 0, total_mois: 0, total_annee: 0 };
    const emptyProg = { ville_actuelle: '🏠 Kettenis', prochaine_ville: '🇧🇪 Liège', km_restants: 30, progression: 0, distance_kettenis: 30 };
    const emptyChallenge = { total_oswald: 0, total_alexandre: 0, total_damien: 0, leader: 'Unentschieden', difference: 0, world_tour_oswald: { km: 0, pct: 0, target: TOUR_DU_MONDE_KM }, world_tour_alexandre: { km: 0, pct: 0, target: TOUR_DU_MONDE_KM }, world_tour_damien: { km: 0, pct: 0, target: TOUR_DU_MONDE_KM } };
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(`${API_BASE}/api/tours`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        toursData = data;
        if (statsSection) statsSection.style.display = 'block';
        if (progressionSection) progressionSection.style.display = 'block';
        if (challengeSection) challengeSection.style.display = 'block';
        if (historySection) historySection.style.display = 'block';
        updateStats({ stats_oswald: data.stats_oswald || emptyStats, stats_alexandre: data.stats_alexandre || emptyStats, stats_damien: data.stats_damien || emptyStats });
        updateProgression({ progression_oswald: data.progression_oswald || emptyProg, progression_alexandre: data.progression_alexandre || emptyProg, progression_damien: data.progression_damien || emptyProg });
        const ch = data.challenge || emptyChallenge;
        updateChallenge(ch);
        updateHistoryComparativeBar(ch);
        if (data.tours && data.tours.length > 0) displayTours(data.tours);
        else setEmptyToursLists();
        lastKnownToursCount = (data.tours || []).length;
        lastKnownFirstTourId = (data.tours && data.tours[0]) ? data.tours[0]._index : null;
    } catch (err) {
        console.error('Erreur chargement tours:', err);
        if (statsSection) statsSection.style.display = 'block';
        if (progressionSection) progressionSection.style.display = 'block';
        if (challengeSection) challengeSection.style.display = 'block';
        if (historySection) historySection.style.display = 'block';
        updateStats({ stats_oswald: emptyStats, stats_alexandre: emptyStats, stats_damien: emptyStats });
        updateProgression({ progression_oswald: emptyProg, progression_alexandre: emptyProg, progression_damien: emptyProg });
        updateChallenge(emptyChallenge);
        updateHistoryComparativeBar({ total_oswald: 0, total_alexandre: 0, total_damien: 0 });
        setEmptyToursLists();
    }
    startLiveNotificationCheck();
}

function setEmptyToursLists() {
    ['toursListOswald', 'toursListAlexandre', 'toursListDamien'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = '<p class="empty-history">Keine Touren</p>'; });
}

function displayTours(tours) {
    const lists = { Oswald: document.getElementById('toursListOswald'), Alexandre: document.getElementById('toursListAlexandre'), Damien: document.getElementById('toursListDamien') };
    Object.values(lists).forEach(el => { if (el) el.innerHTML = ''; });
    if (!tours || tours.length === 0) { Object.values(lists).forEach(el => { if (el) el.innerHTML = '<p class="empty-history">Keine Touren</p>'; }); return; }
    const toursByUser = { Oswald: [], Alexandre: [], Damien: [] };
    tours.forEach(t => { const u = normalizeUser(t.Utilisateur); if (toursByUser[u]) toursByUser[u].push(t); else toursByUser.Oswald.push(t); });
    ['Oswald', 'Alexandre', 'Damien'].forEach(user => {
        const tourList = toursByUser[user];
        const targetList = lists[user];
        if (!targetList) return;
        if (tourList.length === 0) { targetList.innerHTML = '<p class="empty-history">Keine Touren</p>'; return; }
        tourList.forEach((tour, displayIndex) => {
            const tourItem = document.createElement('div');
            const userClass = `tour-item-${user.toLowerCase()}`;
            tourItem.className = `tour-item tour-item-clickable ${userClass}`;
            const realIndex = tour._index !== undefined ? tour._index : displayIndex;
            const tourDataAttr = JSON.stringify(tour).replace(/"/g, '&quot;');
            const photos = tour.photos && Array.isArray(tour.photos) ? tour.photos : [];
            const hasPhotos = photos.length > 0;
            const firstPhotoUrl = hasPhotos ? photos[0] : '';
            const photoPreviewHtml = hasPhotos ? `<div class="tour-photo-preview" title="Fotos anzeigen"><img src="${escapeHtml(firstPhotoUrl)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><span class="tour-photo-icon-fallback" style="display:none">📸</span></div>` : '';
            const parsed = parseTourDate(tour.Date);
            const photoThumbHtml = hasPhotos ? `<div class="tour-photo-compact"><img src="${escapeHtml(firstPhotoUrl)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><span class="tour-photo-icon-fallback" style="display:none">📸</span></div>` : '';
            const userKey = user.toLowerCase();
            tourItem.innerHTML = `<div class="tour-mobile-row"><div class="tour-mobile-calendar"><div class="tour-date-icon"><span class="tour-cal-day">${parsed.day}</span><span class="tour-cal-month">${parsed.month}</span></div></div><div class="tour-mobile-center"><span class="tour-mobile-km">${formatDistance(tour.Km || 0)}</span>${photoThumbHtml}</div><button class="btn-details" type="button">Détails</button></div>${photoPreviewHtml}<div class="tour-field tour-desktop-only"><strong>Datum</strong><div class="tour-datum-row"><div class="tour-date-icon" title="${escapeHtml(tour.Date || '')}"><span class="tour-cal-day">${parsed.day}</span><span class="tour-cal-month">${parsed.month}</span></div><span>${tour.Date || ''}</span></div><span class="tour-user-pill tour-user-pill-${userKey}" title="${user}">${ { Oswald: '🌳', Alexandre: '🌴', Damien: '⚡' }[user] } ${user}</span>${tour.Wetter && String(tour.Wetter).trim() && tour.Wetter !== 'N/A' ? `<span class="tour-wetter">🌤️ ${escapeHtml(String(tour.Wetter).trim())}</span>` : ''}</div><div class="tour-field tour-desktop-only"><strong>Start</strong><span>${tour.Start || ''}</span></div><div class="tour-field tour-desktop-only"><strong>Ziel</strong><span>${tour.Ziel || ''}</span></div><div class="tour-field tour-desktop-only"><strong>Km</strong><span>${formatDistance(tour.Km || 0)}</span></div>${tour.Etape && tour.Etape !== 'NaN' && tour.Etape !== 'nan' && tour.Etape !== 'N/A' ? `<div class="tour-field tour-desktop-only"><strong>Etape</strong><span>${tour.Etape}</span></div>` : ''}${tour.Bemerkungen && String(tour.Bemerkungen).trim() ? `<div class="tour-remark tour-desktop-only">${escapeHtml(String(tour.Bemerkungen).trim())}</div>` : ''}<button class="btn-delete tour-desktop-only" onclick="event.stopPropagation(); deleteTour(${realIndex})" title="Löschen">❌</button>`;
            tourItem.setAttribute('data-tour', tourDataAttr);
            tourItem.addEventListener('click', (e) => { if (!e.target.closest('.btn-delete')) { const data = tourItem.getAttribute('data-tour').replace(/&quot;/g, '"'); openTourModal(JSON.parse(data)); } });
            targetList.appendChild(tourItem);
        });
    });
}

function updateStats(data) {
    ['Oswald', 'Alexandre', 'Damien'].forEach((name, i) => {
        const stats = data[`stats_${['oswald', 'alexandre', 'damien'][i]}`] || {};
        ['Aujourdhui', 'Semaine', 'Mois', 'Annee', 'Total'].forEach((suffix, j) => { const el = document.getElementById(`stat${name}${suffix}`); if (el) el.textContent = formatDistance(stats[['total_aujourdhui', 'total_semaine', 'total_mois', 'total_annee', 'total_global'][j]] || 0); });
    });
}

function updateChallenge(challenge) {
    ['Oswald', 'Alexandre', 'Damien'].forEach(name => {
        const key = name.toLowerCase();
        const elTotal = document.getElementById(`total${name}`);
        if (elTotal) elTotal.textContent = formatDistance(challenge[`total_${key}`] || 0);
        const wt = challenge[`world_tour_${key}`] || { km: 0, pct: 0 };
        const elKm = document.getElementById(`worldTour${name}Km`);
        const elFill = document.getElementById(`worldTour${name}Fill`);
        const elPct = document.getElementById(`worldTour${name}Pct`);
        if (elKm) elKm.textContent = formatDistance(wt.km || 0);
        if (elFill) elFill.style.width = `${Math.min(100, wt.pct || 0)}%`;
        if (elPct) elPct.textContent = formatPercent(wt.pct || 0);
    });
    const msgEl = document.getElementById('challengeMessage');
    if (msgEl) msgEl.textContent = challenge.leader === 'Unentschieden' ? 'Unentschieden! Keine Touren eingetragen oder gleiche Strecke.' : `${challenge.leader} führt mit ${formatDistance(challenge.difference || 0)} Vorsprung!`;
    const pct = (km) => Math.min(100, (km / TOUR_DU_MONDE_KM) * 100);
    const mO = document.getElementById('challengeMarkerOswald'), mA = document.getElementById('challengeMarkerAlexandre'), mD = document.getElementById('challengeMarkerDamien');
    if (mO) mO.style.left = `${pct(challenge.total_oswald || 0)}%`;
    if (mA) mA.style.left = `${pct(challenge.total_alexandre || 0)}%`;
    if (mD) mD.style.left = `${pct(challenge.total_damien || 0)}%`;
}

function updateHistoryComparativeBar(challenge) {
    const o = challenge.total_oswald || 0, a = challenge.total_alexandre || 0, d = challenge.total_damien || 0;
    const total = o + a + d;
    let wO = 0, wA = 0, wD = 0;
    if (total > 0) { const filled = Math.min(100, (total / TOUR_DU_MONDE_KM) * 100); wO = (o / total) * filled; wA = (a / total) * filled; wD = (d / total) * filled; }
    const bO = document.getElementById('historyBarOswald'), bA = document.getElementById('historyBarAlexandre'), bD = document.getElementById('historyBarDamien');
    if (bO) bO.style.width = `${wO}%`; if (bA) bA.style.width = `${wA}%`; if (bD) bD.style.width = `${wD}%`;
}

function updateProgression(data) {
    ['Oswald', 'Alexandre', 'Damien'].forEach(name => {
        const key = name.toLowerCase();
        const prog = data[`progression_${key}`] || {};
        const worldPct = prog.world_tour_pct ?? (prog.progression ?? 0) * 100;
        const nextCity = prog.prochaine_ville || '🇧🇪 Liège';
        const elMsg = document.getElementById(`globeMessage${name}`), elVille = document.getElementById(`villeActuelle${name}`), elProchaine = document.getElementById(`prochaineVille${name}`), elLabel = document.getElementById(`progressBarLabel${name}`), elKm = document.getElementById(`kmRestants${name}`), elFill = document.getElementById(`progressFill${name}`), elText = document.getElementById(`progressText${name}`);
        if (elMsg) elMsg.textContent = `${name} hat ${formatPercent(worldPct)} der Weltreise geschafft!`;
        if (elVille) elVille.textContent = prog.ville_actuelle || '🏠 Kettenis';
        if (elProchaine) elProchaine.textContent = nextCity;
        if (elLabel) elLabel.textContent = `Aktuelle Etappe: Auf dem Weg nach ${nextCity.replace(/^[^\s]+\s/, '')}`;
        if (elKm) elKm.textContent = formatDistance(prog.km_restants ?? 30);
        const pct = Math.min(100, Math.max(0, (prog.progression ?? 0) * 100));
        if (elFill) elFill.style.width = `${pct}%`;
        if (elText) elText.textContent = formatPercent(pct);
    });
    const progO = data.progression_oswald || {}, progA = data.progression_alexandre || {}, progD = data.progression_damien || {};
    const emailLink = document.getElementById('emailLink');
    if (emailLink) emailLink.href = `mailto:cogi003@gmail.com?subject=${encodeURIComponent("Opa's Bicycle Update")}&body=${encodeURIComponent(`Gesamt: ${formatDistance(toursData.stats?.total_global || 0)}\nOswald: ${progO.ville_actuelle || '🏠 Kettenis'}\nAlexandre: ${progA.ville_actuelle || '🏠 Kettenis'}\nDamien: ${progD.ville_actuelle || '🏠 Kettenis'}`)}`;
}

async function loadGarage() {
    const gallery = document.getElementById('garageGallery');
    if (!gallery) return;
    try {
        const res = await fetch(`${API_BASE}/api/entretien`);
        const data = await res.json();
        garageKmFromTours = data.km_from_tours || garageKmFromTours;
        renderGarageCards(data.bikes || []);
    } catch (e) { console.error('Garage load:', e); gallery.innerHTML = '<p class="garage-empty">Fehler beim Laden.</p>'; }
}

function renderGarageCards(bikes) {
    const gallery = document.getElementById('garageGallery');
    if (!gallery) return;
    const userColors = { Oswald: 'var(--user-oswald)', Alexandre: 'var(--user-alexandre)', Damien: 'var(--user-damien)' };
    const userEmoji = { Oswald: '🌳', Alexandre: '🌴', Damien: '⚡' };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const isSoon = (ds) => { if (!ds) return false; const d = new Date(ds); d.setHours(0, 0, 0, 0); const diff = (d - today) / (1000 * 60 * 60 * 24); return diff >= 0 && diff <= 30; };
    const isOverdue = (ds) => { if (!ds) return false; const d = new Date(ds); d.setHours(0, 0, 0, 0); return d < today; };
    const fmtDate = (s) => s ? new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
    if (!bikes || bikes.length === 0) { gallery.innerHTML = '<p class="garage-empty">Noch keine Fahrräder eingetragen.</p>'; return; }
    gallery.innerHTML = bikes.map(b => {
        const color = userColors[b.utilisateur] || 'rgba(255,255,255,0.2)', emoji = userEmoji[b.utilisateur] || '🚲', imgUrl = b.url_photo_velo || '';
        const soon = isSoon(b.date_prochain_entretien), overdue = isOverdue(b.date_prochain_entretien), alertClass = overdue ? 'garage-alert-overdue' : (soon ? 'garage-alert-soon' : '');
        const kmFromTours = garageKmFromTours[b.utilisateur] || 0, totalWithTours = (b.km_actuel || 0) + kmFromTours;
        return `<div class="garage-card-item" data-id="${b.id}" style="--accent: ${color}"><button type="button" class="garage-card-edit-btn" data-id="${b.id}" data-name="${escapeHtml(b.nom_velo || '').replace(/"/g, '&quot;')}" data-user="${b.utilisateur || 'Oswald'}" data-km="${b.km_actuel || 0}" data-date="${b.date_prochain_entretien || ''}" title="Bearbeiten"><i data-lucide="pencil" aria-hidden="true"></i></button><div class="garage-card-image-wrap"><div class="garage-card-image" style="background-image: url('${imgUrl || ''}')">${!imgUrl ? '<span class="garage-card-placeholder">🚲</span>' : ''}</div><div class="garage-card-banner">${emoji} ${escapeHtml(b.nom_velo || 'Mon vélo')}</div></div><div class="garage-card-info"><div class="garage-card-km-row"><p class="garage-card-km"><strong>${formatDistance(b.km_actuel || 0)}</strong> gesamt</p><div class="garage-km-actions"><button type="button" class="garage-km-inc" data-id="${b.id}" data-delta="10" title="+10 km">+10</button><button type="button" class="garage-km-inc" data-id="${b.id}" data-delta="50" title="+50 km">+50</button>${kmFromTours > 0 ? `<button type="button" class="garage-km-sync" data-id="${b.id}" data-user="${b.utilisateur}" title="Sync (+${formatNumber(kmFromTours, 0)} km)">Sync</button>` : ''}</div></div>${kmFromTours > 0 ? `<p class="garage-card-km-tours">${formatDistance(kmFromTours)} aus Touren → ${formatDistance(totalWithTours)} total</p>` : ''}<p class="garage-card-date ${alertClass}">Nächstes Service: ${fmtDate(b.date_prochain_entretien)}${overdue ? ' (Überfällig!)' : ''}${soon && !overdue ? ' (Bald)' : ''}</p><div class="garage-card-actions">${b.url_facture ? `<button type="button" class="garage-btn-facture" data-url="${escapeHtml(b.url_facture)}">Facture</button>` : `<label class="garage-btn-add-facture"><input type="file" accept="image/*,.pdf" data-id="${b.id}" style="display:none">+ Facture</label>`}</div></div></div>`;
    }).join('');
    gallery.querySelectorAll('.garage-btn-facture').forEach(btn => btn.addEventListener('click', () => openFactureModal(btn.dataset.url)));
    gallery.querySelectorAll('.garage-card-edit-btn').forEach(btn => { btn.addEventListener('click', () => { const bike = bikes.find(x => x.id === parseInt(btn.dataset.id, 10)); if (bike) openEditBikeModal(bike); }); });
    gallery.querySelectorAll('.garage-km-inc').forEach(btn => { btn.addEventListener('click', () => incrementBikeKm(parseInt(btn.dataset.id, 10), parseFloat(btn.dataset.delta))); });
    gallery.querySelectorAll('.garage-km-sync').forEach(btn => { btn.addEventListener('click', () => syncBikeKm(parseInt(btn.dataset.id, 10), btn.dataset.user)); });
    gallery.querySelectorAll('.garage-btn-add-facture input').forEach(inp => { inp.addEventListener('change', (e) => { if (e.target.files && e.target.files[0]) uploadBikeFacture(parseInt(inp.dataset.id), e.target.files[0]); }); });
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
    const bikeId = document.getElementById('addBikeId').value.trim(), isEdit = !!bikeId;
    const name = document.getElementById('addBikeName').value.trim() || 'Mon vélo', user = document.getElementById('addBikeUser').value, km = parseFloat(document.getElementById('addBikeKm').value) || 0, date = document.getElementById('addBikeDate').value || null;
    const photoInput = document.getElementById('addBikePhoto'), factureInput = document.getElementById('addBikeFacture');
    try {
        if (isEdit) {
            const res = await fetch(`${API_BASE}/api/entretien/${bikeId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nom_velo: name, utilisateur: user, km_actuel: km, date_prochain_entretien: date || null }) });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Fehler');
            const id = parseInt(bikeId, 10);
            if (photoInput && photoInput.files && photoInput.files[0]) { const fd = new FormData(); fd.append('photo', photoInput.files[0]); fd.append('field', 'photo_velo'); await fetch(`${API_BASE}/api/entretien/${id}/upload`, { method: 'POST', body: fd }); }
            if (factureInput && factureInput.files && factureInput.files[0]) { const fd = new FormData(); fd.append('photo', factureInput.files[0]); fd.append('field', 'facture'); await fetch(`${API_BASE}/api/entretien/${id}/upload`, { method: 'POST', body: fd }); }
            showToast('Fahrrad aktualisiert! 🚲', 'success');
        } else {
            const res = await fetch(`${API_BASE}/api/entretien`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nom_velo: name, utilisateur: user, km_actuel: km, date_prochain_entretien: date }) });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Fehler');
            const id = data.id;
            if (photoInput && photoInput.files && photoInput.files[0]) { const fd = new FormData(); fd.append('photo', photoInput.files[0]); fd.append('field', 'photo_velo'); await fetch(`${API_BASE}/api/entretien/${id}/upload`, { method: 'POST', body: fd }); }
            if (factureInput && factureInput.files && factureInput.files[0]) { const fd = new FormData(); fd.append('photo', factureInput.files[0]); fd.append('field', 'facture'); await fetch(`${API_BASE}/api/entretien/${id}/upload`, { method: 'POST', body: fd }); }
            showToast('Fahrrad hinzugefügt! 🚲', 'success');
        }
        incrementAppBadge(); closeAddBikeModal(); await loadGarage();
    } catch (err) { showToast(err.message || 'Fehler beim Speichern', 'error'); }
}

async function incrementBikeKm(bikeId, delta) {
    try {
        const res = await fetch(`${API_BASE}/api/entretien`), dataRes = await res.json(), bikes = dataRes.bikes || [];
        const b = bikes.find(x => x.id === bikeId); if (!b) return;
        const newKm = (b.km_actuel || 0) + delta;
        const putRes = await fetch(`${API_BASE}/api/entretien/${bikeId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ km_actuel: newKm }) });
        const putData = await putRes.json();
        if (putData.success) { showToast(`+${delta} km`, 'success'); incrementAppBadge(); await loadGarage(); } else throw new Error(putData.error);
    } catch (e) { showToast('Fehler', 'error'); }
}

async function syncBikeKm(bikeId, user) {
    const kmFromTours = garageKmFromTours[user] || 0; if (kmFromTours <= 0) return;
    try {
        const res = await fetch(`${API_BASE}/api/entretien`), dataRes = await res.json(), bikes = dataRes.bikes || [];
        const b = bikes.find(x => x.id === bikeId); if (!b) return;
        const newKm = (b.km_actuel || 0) + kmFromTours;
        const putRes = await fetch(`${API_BASE}/api/entretien/${bikeId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ km_actuel: newKm }) });
        const putData = await putRes.json();
        if (putData.success) { showToast(`+${formatNumber(kmFromTours, 0)} km (Touren)`, 'success'); incrementAppBadge(); await loadGarage(); } else throw new Error(putData.error);
    } catch (e) { showToast('Fehler', 'error'); }
}

async function uploadBikeFacture(bikeId, file) {
    try {
        const fd = new FormData(); fd.append('photo', file); fd.append('field', 'facture');
        const res = await fetch(`${API_BASE}/api/entretien/${bikeId}/upload`, { method: 'POST', body: fd }), data = await res.json();
        if (data.success) { showToast('Facture hinzugefügt', 'success'); incrementAppBadge(); await loadGarage(); } else throw new Error(data.error);
    } catch (e) { showToast('Fehler beim Hochladen', 'error'); }
}

function openFactureModal(url) { const img = document.getElementById('factureImage'), m = document.getElementById('factureModal'); if (img && m && url) { img.src = url; m.style.display = 'flex'; m.classList.add('modal-open'); m.setAttribute('aria-hidden', 'false'); } }

function closeFactureModal() { const m = document.getElementById('factureModal'), img = document.getElementById('factureImage'); if (m) { m.classList.remove('modal-open'); m.style.display = 'none'; m.setAttribute('aria-hidden', 'true'); } if (img) img.src = ''; }

function openTourModal(tour) {
    currentModalTour = tour;
    const modal = document.getElementById('tourModal'); if (!modal) return;
    modal.classList.add('modal-open'); modal.setAttribute('aria-hidden', 'false');
    const startPlace = (tour.Start || '').replace(/\s*\(\d{1,2}:\d{2}\)\s*$/, '').trim(), zielPlace = (tour.Ziel || '').replace(/\s*\(\d{1,2}:\d{2}\)\s*$/, '').trim();
    const startTime = (tour.Start || '').match(/\((\d{1,2}:\d{2})\)/)?.[1] || '', zielTime = (tour.Ziel || '').match(/\((\d{1,2}:\d{2})\)/)?.[1] || '';
    const modalDate = document.getElementById('modalDate'), modalRoute = document.getElementById('modalRoute'), modalDistance = document.getElementById('modalDistance'), modalTime = document.getElementById('modalTime'), modalSpeed = document.getElementById('modalSpeed'), modalWetter = document.getElementById('modalWetter');
    if (modalDate) modalDate.textContent = tour.Date || '—';
    if (modalRoute) modalRoute.textContent = `${startPlace || '—'} ➝ ${zielPlace || '—'}`;
    if (modalDistance) modalDistance.textContent = formatDistance(tour.Km || 0);
    let timeStr = '—', speedStr = '—';
    if (startTime && zielTime) {
        const [sh, sm] = startTime.split(':').map(Number), [zh, zm] = zielTime.split(':').map(Number);
        const mins = (zh * 60 + zm) - (sh * 60 + sm);
        if (mins > 0) { const h = Math.floor(mins / 60), m = mins % 60; timeStr = h ? `${h}h ${m}min` : `${m} min`; const km = Number(tour.Km) || 0; if (km > 0) speedStr = `${(km / (mins / 60)).toFixed(1).replace('.', ',')} km/h`; }
    }
    if (modalTime) modalTime.textContent = timeStr; if (modalSpeed) modalSpeed.textContent = speedStr; if (modalWetter) modalWetter.textContent = tour.Wetter && tour.Wetter !== 'N/A' ? tour.Wetter : '—';
    const bemerkWrap = document.getElementById('modalBemerkungenWrap'), bemerkungen = document.getElementById('modalBemerkungen');
    if (tour.Bemerkungen && String(tour.Bemerkungen).trim()) { if (bemerkWrap) bemerkWrap.style.display = 'block'; if (bemerkungen) bemerkungen.textContent = tour.Bemerkungen.trim(); } else { if (bemerkWrap) bemerkWrap.style.display = 'none'; }
    const shareBtn = document.getElementById('modalShareBtn');
    if (shareBtn) shareBtn.onclick = () => { const subject = encodeURIComponent(`Tour ${tour.Date || ''}`); const body = encodeURIComponent(`${startPlace} → ${zielPlace}\n${formatDistance(tour.Km || 0)}\nWetter: ${tour.Wetter || '—'}`); window.location.href = `mailto:?subject=${subject}&body=${body}`; };
    const photosWrap = document.getElementById('modalPhotosWrap'), photosGrid = document.getElementById('modalPhotosGrid');
    const photos = tour.photos && Array.isArray(tour.photos) ? tour.photos : [];
    if (photos.length > 0 && photosGrid) { if (photosWrap) photosWrap.style.display = 'block'; photosGrid.innerHTML = photos.map(url => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="modal-photo-item"><img src="${escapeHtml(url)}" alt="Photo"></a>`).join(''); } else { if (photosWrap) photosWrap.style.display = 'none'; if (photosGrid) photosGrid.innerHTML = ''; }
    const photoBtn = document.getElementById('modalPhotoBtn'), photoInput = document.getElementById('photoFileInput');
    if (photoBtn && photoInput && !photoBtn.disabled) {
        photoBtn.onclick = () => photoInput.click();
        photoInput.onchange = (e) => { const file = e.target.files?.[0]; if (!file || !tour._index) return; if (file.size > 5 * 1024 * 1024) { showToast('Image trop lourde (max 5 Mo)', 'error'); photoInput.value = ''; return; } uploadTourPhoto(tour._index, file); photoInput.value = ''; };
    }
}

async function uploadTourPhoto(tourId, file) {
    const photoBtn = document.getElementById('modalPhotoBtn'); if (photoBtn) { photoBtn.disabled = true; photoBtn.textContent = '⏳ Envoi...'; }
    try {
        const fd = new FormData(); fd.append('photo', file);
        const res = await fetch(`${API_BASE}/api/tours/${tourId}/photos`, { method: 'POST', body: fd }), data = await res.json();
        if (data.success) { showToast('Photo ajoutée ! 📸', 'success'); await loadEntries(); const updated = toursData.tours && toursData.tours.find(t => t._index === tourId); if (updated && currentModalTour && currentModalTour._index === tourId) { currentModalTour.photos = updated.photos || []; openTourModal(currentModalTour); } } else showToast(data.error || 'Erreur', 'error');
    } catch (err) { showToast('Erreur upload', 'error'); }
    finally { if (photoBtn) { photoBtn.disabled = false; photoBtn.textContent = '📸 Ajouter des photos'; } }
}

function closeTourModal() { const m = document.getElementById('tourModal'); if (m) { m.classList.remove('modal-open'); m.setAttribute('aria-hidden', 'true'); } currentModalTour = null; }

function printTourDetail() {
    if (!currentModalTour) return;
    const content = document.querySelector('.modal-glass'); if (!content) return;
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Tour ${currentModalTour.Date || ''}</title><style>body{font-family:sans-serif;padding:20px;background:#0f172a;color:#fff;}.modal-bike-animation,.modal-close,.btn-modal{display:none;}</style></head><body>${content.innerHTML}</body></html>`);
    w.document.close(); w.print(); w.close();
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn'), meteoLoading = document.getElementById('meteoLoading');
    if (submitBtn) { submitBtn.disabled = true; const span = submitBtn.querySelector('span'); if (span) span.textContent = 'Wird gespeichert...'; }
    if (meteoLoading) meteoLoading.style.display = 'block';
    const formData = { date: document.getElementById('date')?.value || '', depart: document.getElementById('depart')?.value || 'Kettenis', etape: document.getElementById('etape')?.value || '', arrivee: document.getElementById('arrivee')?.value || 'Kettenis', distance: parseFloat(document.getElementById('distance')?.value) || 0, heure_depart: document.getElementById('heure_depart')?.value || '10:00', heure_etape: document.getElementById('heure_etape')?.value || '11:30', heure_arrivee: document.getElementById('heure_arrivee')?.value || '12:30', notes: document.getElementById('notes')?.value || '', utilisateur: document.getElementById('utilisateur')?.value || 'Oswald' };
    try {
        const res = await fetch(`${API_BASE}/api/tours`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) }), data = await res.json();
        if (data.success) {
            showToast('Tour gespeichert! 🎉', 'success'); incrementAppBadge(); document.getElementById('tourForm')?.reset();
            const dateEl = document.getElementById('date'); if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
            const depart = document.getElementById('depart'), arrivee = document.getElementById('arrivee'), heure_depart = document.getElementById('heure_depart'), heure_etape = document.getElementById('heure_etape'), heure_arrivee = document.getElementById('heure_arrivee'), utilisateur = document.getElementById('utilisateur');
            if (depart) depart.value = 'Kettenis'; if (arrivee) arrivee.value = 'Kettenis'; if (heure_depart) heure_depart.value = '10:00'; if (heure_etape) heure_etape.value = '11:30'; if (heure_arrivee) heure_arrivee.value = '12:30'; if (utilisateur) utilisateur.value = 'Oswald';
            await loadEntries(); celebrate();
        } else showToast(data.error || 'Fehler beim Speichern', 'error');
    } catch (err) { showToast('Fehler beim Speichern', 'error'); }
    finally { if (submitBtn) { submitBtn.disabled = false; const span = submitBtn.querySelector('span'); if (span) span.textContent = 'Tour speichern'; } if (meteoLoading) meteoLoading.style.display = 'none'; }
}

async function deleteTour(index) {
    if (!confirm('Möchten Sie diese Tour wirklich löschen?')) return;
    try {
        const res = await fetch(`${API_BASE}/api/tours/${index}`, { method: 'DELETE' }), data = await res.json();
        if (data.success) { showToast('Tour gelöscht', 'success'); await loadEntries(); } else showToast('Fehler beim Löschen', 'error');
    } catch (err) { showToast('Fehler beim Löschen', 'error'); }
}

function setAppBadgeSafe(count) { try { if (typeof navigator !== 'undefined' && typeof navigator.setAppBadge === 'function') navigator.setAppBadge(count).catch(() => {}); } catch (_) {} }
function clearAppBadgeSafe() { try { if (typeof navigator !== 'undefined' && typeof navigator.clearAppBadge === 'function') navigator.clearAppBadge().catch(() => {}); } catch (_) {} }
function getStoredBadgeCount() { try { const n = parseInt(localStorage.getItem(BADGE_STORAGE_KEY) || '0', 10); return isNaN(n) ? 0 : Math.max(0, n); } catch (_) { return 0; } }
function setStoredBadgeCount(n) { try { localStorage.setItem(BADGE_STORAGE_KEY, String(Math.max(0, n))); } catch (_) {} }
function incrementAppBadge() { const count = getStoredBadgeCount() + 1; setStoredBadgeCount(count); setAppBadgeSafe(count); }
function clearAppBadge() { setStoredBadgeCount(0); clearAppBadgeSafe(); }

async function startLiveNotificationCheck() {
    try { const verRes = await fetch(`${API_BASE}/api/version`); if (verRes.ok) { const v = await verRes.json(); lastKnownVersion = v.version || null; } } catch (_) {}
    setInterval(checkForUpdates, 60000);
}

function checkForUpdates() {
    (async () => {
        let hasNew = false;
        try { const verRes = await fetch(`${API_BASE}/api/version`); if (verRes.ok) { const v = await verRes.json(); const cur = v.version || null; if (lastKnownVersion !== null && cur !== null && cur !== lastKnownVersion) hasNew = true; } } catch (_) {}
        if (!hasNew) { try { const res = await fetch(`${API_BASE}/api/tours`); if (res.ok) { const data = await res.json(); const tours = data.tours || []; if (tours.length > lastKnownToursCount) hasNew = true; if (!hasNew && tours.length > 0 && tours[0]._index !== lastKnownFirstTourId) hasNew = true; } } catch (_) {} }
        if (hasNew) { const banner = document.getElementById('liveNotificationBanner'); if (banner) banner.style.display = 'flex'; incrementAppBadge(); }
    })();
}

function initLiveNotification() { const btn = document.getElementById('liveNotificationBtn'); if (btn) btn.addEventListener('click', () => { clearAppBadge(); window.location.reload(true); }); }

function normalizeUser(u) { const v = (u || 'Oswald').trim(); return v === 'Opa' ? 'Oswald' : v; }

function parseTourDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return { day: '?', month: '?' };
    const parts = dateStr.trim().split(/[\/\-\.]/); if (parts.length < 2) return { day: '?', month: '?' };
    const day = parseInt(parts[0], 10) || '?', monthNum = parseInt(parts[1], 10);
    const months = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
    const month = (monthNum >= 1 && monthNum <= 12) ? months[monthNum - 1] : '?';
    return { day, month };
}

function formatNumber(num, decimals) { const n = Number(num); if (isNaN(n)) return '0,0'; const d = decimals != null ? decimals : 1; const [intPart, decPart] = n.toFixed(d).split('.'); return decPart ? `${intPart},${decPart}` : intPart; }
function formatDistance(km) { return `${formatNumber(km, 1)} km`; }
function formatPercent(pct) { return `${formatNumber(pct, 1)} %`; }
function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
function showToast(message, type) { const toast = document.getElementById('toast'); if (!toast) return; toast.textContent = message; toast.className = `toast ${type || 'success'} show`; setTimeout(() => toast.classList.remove('show'), 3000); }
function celebrate() { for (let i = 0; i < 50; i++) createConfetti(); }
function getRandomColor() { const colors = ['#4caf50', '#2196f3', '#ff9800', '#f44336', '#9c27b0', '#00bcd4']; return colors[Math.floor(Math.random() * colors.length)]; }
function createConfetti() {
    const confetti = document.createElement('div');
    confetti.style.cssText = 'position:fixed;width:10px;height:10px;background:' + getRandomColor() + ';left:' + (Math.random() * 100) + '%;top:-10px;border-radius:50%;pointer-events:none;z-index:9999;opacity:0.8';
    document.body.appendChild(confetti);
    confetti.animate([{ transform: 'translateY(0) rotate(0deg)', opacity: 1 }, { transform: `translateY(${window.innerHeight + 100}px) rotate(720deg)`, opacity: 0 }], { duration: 2000 + Math.random() * 1000, easing: 'cubic-bezier(0.5, 0, 0.5, 1)' }).onfinish = () => confetti.remove();
}
