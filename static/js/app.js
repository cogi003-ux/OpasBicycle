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

function showSection(sectionId) {
    const trackerEl = document.getElementById('section-tracker');
    const garageEl = document.getElementById('section-garage');
    if (!trackerEl || !garageEl) return;
    trackerEl.classList.remove('section-active');
    trackerEl.classList.add('section-hidden');
    garageEl.classList.remove('section-active');
    garageEl.classList.add('section-hidden');
    const target = document.getElementById('section-' + sectionId);
    if (target) {
        target.classList.remove('section-hidden');
        target.classList.add('section-active');
    }
}

function initNavGarage() {
    // Les ecouteurs nav Tracker/Garage sont attaches dans DOMContentLoaded
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
