// ==========================================
// 1. INISIALISASI PETA & BASEMAPS (Layer Control)
// ==========================================
const map = L.map('map', { doubleClickZoom: false }).setView([-6.945, 109.785], 15); 
map.attributionControl.setPrefix('Dibuat oleh Tim KKN Undip Desa Tulis 2026 | <a href="https://leafletjs.com">Leaflet</a>');

// Pilihan Basemap
const googleSat = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 20, attribution: 'Google Satellite' }).addTo(map);
const osmStreet = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: 'OpenStreetMap' });

L.control.layers({
    "Citra Satelit": googleSat,
    "Peta Jalan": osmStreet
}, null, { position: 'topleft' }).addTo(map);

let routingControl = null;
let currentLat = -6.950677; // Default awal jika GPS mati
let currentLng = 109.788766;

map.on('dblclick', function() {
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }
    const infoPanel = document.getElementById('route-info');
    if (infoPanel) infoPanel.style.display = 'none'; 
});


// ==========================================
// 2. SET LOKASI SAYA (GPS REAL-TIME)
// ==========================================
const userMarker = L.circleMarker([currentLat, currentLng], {
    radius: 7, fillColor: "#3498db", color: "#ffffff", weight: 2, fillOpacity: 1, zIndexOffset: 1000
}).addTo(map).bindTooltip("Lokasi Anda", { permanent: true, direction: 'right', offset: [5, 0], className: 'label-tempat' });

// Aktifkan Pelacakan Lokasi Otomatis
map.locate({setView: false, watch: true, enableHighAccuracy: true});
map.on('locationfound', function(e) {
    currentLat = e.latlng.lat;
    currentLng = e.latlng.lng;
    userMarker.setLatLng(e.latlng).bindPopup("<b>Lokasi anda saat ini</b>");
});
map.on('locationerror', function(e) {
    console.log("GPS dinonaktifkan atau gagal diakses. Menggunakan lokasi default.");
    userMarker.bindPopup("<b>Lokasi Default (GPS Mati)</b>");
});


// ==========================================
// 3. MASKING & BATAS ADMINISTRASI 
// ==========================================
map.createPane('paneMasking'); map.getPane('paneMasking').style.zIndex = 350;
map.createPane('paneJalanDesa'); map.getPane('paneJalanDesa').style.zIndex = 351;
map.createPane('paneJalanPantura'); map.getPane('paneJalanPantura').style.zIndex = 352;
map.createPane('paneBatasDesa'); map.getPane('paneBatasDesa').style.zIndex = 353; 
map.getPane('paneMasking').style.pointerEvents = 'none';
map.getPane('paneBatasDesa').style.pointerEvents = 'none';

const desaCoords = batasDesaData.features[0].geometry.coordinates[0][0].map(coord => [coord[1], coord[0]]);
L.polygon([ [[-90, -180], [90, -180], [90, 180], [-90, 180]], desaCoords ], {
    pane: 'paneMasking', stroke: false, fillColor: '#000000', fillOpacity: 0.65     
}).addTo(map);

proj4.defs("EPSG:32749", "+proj=utm +zone=49 +south +datum=WGS84 +units=m +no_defs");
function konversiKoordinat(coords) {
    const converted = proj4("EPSG:32749", "EPSG:4326", coords);
    return L.latLng(converted[1], converted[0]);
}

// Garis Tepi Desa Putus-putus
L.geoJSON(batasDesaData, {
    pane: 'paneBatasDesa',
    style: function(feature) { return { color: "#f9f9f9", weight: 3, fillOpacity: 0, dashArray: "5, 5" }; }
}).addTo(map);


// ==========================================
// 4. GROUPING, FILTERING & MARKER CLUSTER
// ==========================================
const layerGroups = {
    "Pusat Pemerintahan": L.markerClusterGroup().addTo(map),
    "Fasilitas Ibadah": L.markerClusterGroup().addTo(map),
    "Fasilitas Kesehatan": L.markerClusterGroup().addTo(map),
    "Fasilitas Pendidikan": L.markerClusterGroup().addTo(map),
    "UMKM": L.markerClusterGroup().addTo(map),
    "Keamanan Lingkungan": L.markerClusterGroup().addTo(map),
    "Jalan Desa": L.layerGroup().addTo(map),
    "Jalan Pantura": L.layerGroup().addTo(map)
};

L.geoJSON(jalanDesaData, { pane: 'paneJalanDesa', coordsToLatLng: konversiKoordinat, style: { color: "#c9a01a", weight: 3, opacity: 0.8 } }).addTo(layerGroups["Jalan Desa"]);
L.geoJSON(jalanPanturaData, { pane: 'paneJalanPantura', coordsToLatLng: konversiKoordinat, style: { color: "#2c12f3", weight: 6, opacity: 0.9 } }).bindTooltip("Jl. PANTURA", { sticky: true, className: 'label-tempat' }).addTo(layerGroups["Jalan Pantura"]);

function getMarkerColor(kategori) {
    switch(kategori) {
        case "Pusat Pemerintahan": return "#9b59b6"; case "Fasilitas Ibadah": return "#5965b6";  
        case "Fasilitas Kesehatan": return "#e74c3c"; case "Fasilitas Pendidikan": return "#2ecc71"; 
        case "UMKM": return "#631861"; case "Keamanan Lingkungan": return "#34495e"; default: return "#3498db"; 
    }
}

// Data Array untuk Search
let searchData = [];

// FUNGSI BANTUAN UNTUK GENERATE HTML POPUP AWAL (SIMPEL)
// PERHATIKAN: Menambahkan kata 'event' di dalam parameter onclick
function getPopupAwalHTML(index) {
    const loc = locations[index];
    return `
        <div class="popup-content" style="text-align: center; min-width: 150px;">
            <h3 style="margin-bottom: 8px; border-bottom: 2px solid #e74c3c; padding-bottom: 5px;">${loc.name}</h3>
            <button class="btn-detail-popup" onclick="window.tampilkanDetailBaru(${index}, event)">Detail⬇️</button>
        </div>
    `;
}

locations.forEach((loc, index) => {
    const markerColor = getMarkerColor(loc.type);
    const marker = L.circleMarker([loc.lat, loc.lng], {
        radius: 6, fillColor: markerColor, color: "#ffffff", weight: 1.5, fillOpacity: 1
    })
    .bindTooltip(loc.name, { permanent: false, direction: 'top', className: 'label-tempat' })
    .bindPopup(getPopupAwalHTML(index)); // Ikat popup awal

    if(layerGroups[loc.type]) { marker.addTo(layerGroups[loc.type]); } 
    
    // Simpan referensi marker
    searchData.push({ name: loc.name.toLowerCase(), marker: marker, lat: loc.lat, lng: loc.lng });

    // Reset popup ke tampilan awal jika disilang/ditutup
    marker.on('popupclose', function() {
        setTimeout(() => {
            marker.setPopupContent(getPopupAwalHTML(index));
        }, 300); // Jeda agar perubahan tidak terlihat berkedip saat popup memudar menutup
    });
});

// ==========================================
// FUNGSI GLOBAL UNTUK BERALIH POPUP
// ==========================================

// Fungsi Beralih ke Popup Detail
window.tampilkanDetailBaru = function(index, event) {
    if (event) {
        event.stopPropagation(); // Mencegah klik tembus ke peta dan menutup popup
        event.preventDefault();
    }

    const loc = locations[index];
    const marker = searchData[index].marker;
    let waButtonHTML = loc.whatsapp ? `<a href="https://wa.me/${loc.whatsapp}" target="_blank" class="wa-btn">💬 Chat Pemilik/Admin</a>` : '';
    
    // Generate HTML untuk konten detail lengkap
    // PERHATIKAN: Tombol kembali dan navigasi juga diberi parameter 'event'
    const detailHTML = `
        <div class="popup-content" style="position: relative; min-width: 220px; text-align: left;">
            <h3 style="margin-bottom: 5px; border-bottom: 2px solid #e74c3c; padding-bottom: 5px;">${loc.name}</h3>
            <div class="popup-gallery" style="margin-top: 10px;">
                <figure><img src="${loc.imgBangunan}" onerror="this.src='https://via.placeholder.com/150'"><figcaption>Tampak Depan</figcaption></figure>
                <figure><img src="${loc.imgOrang}" onerror="this.src='https://via.placeholder.com/150'"><figcaption>Penanggung Jawab</figcaption></figure>
            </div>
            <p><strong>Kategori:</strong> ${loc.type}</p>
            <p><strong>Operasional:</strong> ${loc.jamOperasional}</p>
            <p><strong>Info:</strong> ${loc.desc}</p>
            ${waButtonHTML}
            
            <!-- Area Tombol Aksi Bawah -->
            <div style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #bdc3c7; padding-top: 8px;">
                <button onclick="window.kembaliKeAwal(${index}, event)" style="background: #7f8c8d; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;">⬅️ Kembali</button>
                
                <button onclick="window.buatRute(${index}, event)" title="Navigasi ke Sini" style="background-color: #3498db; color: white; border: none; border-radius: 50%; width: 34px; height: 34px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
                </button>
            </div>
        </div>
    `;
    
    // Perintahkan Leaflet untuk menukar isi konten
    marker.setPopupContent(detailHTML);
};

// Fungsi Beralih Kembali ke Popup Awal
window.kembaliKeAwal = function(index, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    searchData[index].marker.setPopupContent(getPopupAwalHTML(index));
};

// Fungsi navigasi rute
window.buatRute = function(index, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    const loc = locations[index];
    if (routingControl) map.removeControl(routingControl);
    
    const infoPanel = document.getElementById('route-info');
    if (infoPanel) { infoPanel.innerHTML = "Menghitung rute..."; infoPanel.style.display = 'block'; }

    routingControl = L.Routing.control({
        waypoints: [ L.latLng(currentLat, currentLng), L.latLng(loc.lat, loc.lng) ], 
        router: L.Routing.osrmv1({ language: 'id', profile: 'driving' }),
        addWaypoints: false, 
        routeLine: function(route, options) {
            return L.Routing.line(route, { addWaypoints: false, extendToWaypoints: true, styles: [{ color: '#0ec733', opacity: 0.9, weight: 8 }] });
        },
        createMarker: function() { return null; }, fitSelectedRoutes: true, show: false 
    }).addTo(map);

    routingControl.on('routesfound', function(e) {
        const distanceMeters = e.routes[0].summary.totalDistance;
        let distanceString = distanceMeters > 1000 ? (distanceMeters / 1000).toFixed(2) + ' km' : Math.round(distanceMeters) + ' meter';
        if (infoPanel) infoPanel.innerHTML = "Jarak Tempuh: <b>" + distanceString + "</b>";
    });
};


// ==========================================
// FITUR SEARCH & FILTER PANEL
// ==========================================
document.getElementById('search-btn').addEventListener('click', function() {
    let query = document.getElementById('search-input').value.toLowerCase();
    let found = searchData.find(item => item.name.includes(query));
    
    if(found && query !== "") {
        map.flyTo([found.lat, found.lng], 18, { animate: true, duration: 1.5 });
        setTimeout(() => found.marker.openPopup(), 1500);
    } else {
        alert("Lokasi tidak ditemukan! Pastikan nama tepat.");
    }
});

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const category = this.getAttribute('data-category');
        this.classList.toggle('active');
        if (this.classList.contains('active')) { map.addLayer(layerGroups[category]); } 
        else { map.removeLayer(layerGroups[category]); }
    });
});

const filterToggleBtn = document.getElementById('filter-toggle-btn');
const filterPanel = document.getElementById('filter-panel');
if (filterToggleBtn && filterPanel) { filterToggleBtn.addEventListener('click', (e) => { e.stopPropagation(); filterPanel.classList.toggle('show'); }); }


// ==========================================
// 5. STATUS BAR ALA GOOGLE EARTH
// ==========================================
function toDMS(coordinate, isLat) {
    const abs = Math.abs(coordinate); const deg = Math.floor(abs);
    const minNotTruncated = (abs - deg) * 60; const min = Math.floor(minNotTruncated);
    const sec = ((minNotTruncated - min) * 60).toFixed(2);
    const dir = coordinate >= 0 ? (isLat ? "U" : "T") : (isLat ? "S" : "B");
    return `${deg < 10 ? "0"+deg : deg}°${min < 10 ? "0"+min : min}'${sec < 10 ? "0"+sec : sec}"${dir}`;
}

function updateEyeAltitude() {
    const zoom = map.getZoom(); const altKm = 40000 / Math.pow(2, zoom);
    document.getElementById('eye-alt').textContent = altKm > 1 ? altKm.toFixed(2) + " km" : (altKm * 1000).toFixed(0) + " m";
}

map.on('mousemove', function(e) {
    document.getElementById('coord-lat').textContent = toDMS(e.latlng.lat, true);
    document.getElementById('coord-lng').textContent = toDMS(e.latlng.lng, false);
});
map.on('zoomend', updateEyeAltitude);
updateEyeAltitude();


// ==========================================
// 6. LEGENDA & KOMPAS
// ==========================================
const legend = L.control({ position: 'bottomright' });
legend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'info legend');
    const categories = ["Pusat Pemerintahan", "Fasilitas Ibadah", "Fasilitas Kesehatan", "Fasilitas Pendidikan", "UMKM", "Keamanan Lingkungan"];
    
    div.innerHTML += '<h4>Legenda</h4>';
    categories.forEach(cat => { div.innerHTML += `<i style="background:${getMarkerColor(cat)}"></i> ${cat}<br>`; });
    div.innerHTML += '<i style="background:#3498db"></i> Lokasi Anda<br>';
    div.innerHTML += '<hr style="border: 0; border-top: 1px solid #7f8c8d; margin: 8px 0;">';
    div.innerHTML += '<i style="background:#2c12f3; height: 4px; margin-top: 7px; border-radius: 0;"></i> Jalan Pantura<br>';
    div.innerHTML += '<i style="background:#c9a01a; height: 2px; margin-top: 8px; border-radius: 0;"></i> Jalan Desa<br>';
    div.innerHTML += '<i style="background: transparent; border-top: 3px dashed #b1aeae; height: 0; margin-top: 8px; border-radius: 0;"></i> Batas Administrasi<br>';
    return div;
};
legend.addTo(map);

const compassControl = L.control({ position: 'topleft' });
compassControl.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'compass-control');
    div.innerHTML = `<div style="background: rgba(0, 0, 0, 0.6); padding: 8px; border-radius: 8px; border: 1px solid #7f8c8d; margin-top: 50px;"><svg width="35" height="35" viewBox="0 0 100 100"><polygon points="50,5 30,50 50,45" fill="#e74c3c" /><polygon points="50,5 70,50 50,45" fill="#c0392b" /><polygon points="50,95 30,50 50,55" fill="#ecf0f1" /><polygon points="50,95 70,50 50,55" fill="#bdc3c7" /><text x="50" y="32" font-family="sans-serif" font-size="16" font-weight="bold" fill="#fff" text-anchor="middle">U</text></svg></div>`;
    return div;
};
compassControl.addTo(map);