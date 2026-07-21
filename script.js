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

// HAPUS LOKASI OFFLINE: Biarkan kosong agar murni menunggu lokasi dari device pengguna
let currentLat = null; 
let currentLng = null;
let userMarker = null; // Marker biru belum dibuat sebelum lokasi nyata ditemukan

map.on('dblclick', function() {
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }
    const infoPanel = document.getElementById('route-info');
    if (infoPanel) infoPanel.style.display = 'none'; 
});


// ==========================================
// 2. SET LOKASI SAYA (BERDASARKAN QR CODE / URL PARAMETER)
// ==========================================

// Fungsi pembaca parameter dari URL (?lat=...&lng=...)
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Menangkap data dari hasil scan QR Code
const qrLat = getUrlParameter('lat');
const qrLng = getUrlParameter('lng');
const qrDusun = getUrlParameter('dusun');

// SKENARIO 1: PENGUNJUNG SCAN BARKODE DARI TIANG
if (qrLat && qrLng) {
    currentLat = parseFloat(qrLat);
    currentLng = parseFloat(qrLng);
    
    let namaLabel = qrDusun ? "Posisi Anda (Tiang Dusun " + qrDusun + ")" : "Posisi Anda (Tiang)";
    
    // Buat marker statis warna oranye agar beda dengan GPS realtime
    userMarker = L.circleMarker([currentLat, currentLng], {
        radius: 8, fillColor: "#e67e22", color: "#ffffff", weight: 2, fillOpacity: 1, zIndexOffset: 1000
    }).addTo(map).bindTooltip(namaLabel, { permanent: true, direction: 'right', offset: [5, 0], className: 'label-tempat' });
    
    // Arahkan pandangan peta langsung menukik ke lokasi tiang tersebut
    map.setView([currentLat, currentLng], 17);

} 
// SKENARIO 2: PENGUNJUNG BUKA WEB BIASA (BUKAN DARI SCAN TIANG)
else {
    function onLocationFound(e) {
        currentLat = e.latlng.lat;
        currentLng = e.latlng.lng;
        
        if (!userMarker) {
            userMarker = L.circleMarker([currentLat, currentLng], {
                radius: 7, fillColor: "#3498db", color: "#ffffff", weight: 2, fillOpacity: 1, zIndexOffset: 1000
            }).addTo(map).bindTooltip("Lokasi Anda", { permanent: true, direction: 'right', offset: [5, 0], className: 'label-tempat' });
        } else {
            userMarker.setLatLng(e.latlng);
        }
    }

    function onLocationError(e) {
        if (e.code !== 3) console.warn("GPS terhambat: " + e.message);
    }

    map.on('locationfound', onLocationFound);
    map.on('locationerror', onLocationError);
    map.locate({ setView: false, watch: true, enableHighAccuracy: false, maximumAge: 10000, timeout: 30000 });
}

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

// FUNGSI BANTUAN UNTUK GENERATE HTML POPUP AWAL
function getPopupAwalHTML(index) {
    const loc = locations[index];
    return `
        <div class="popup-content" style="text-align: center; min-width: 150px;">
            <h3 style="margin-bottom: 8px; border-bottom: 2px solid #5e3ce7; padding-bottom: 5px;">${loc.name}</h3>
            <button class="btn-detail-popup" onclick="window.tampilkanDetailBaru(${index}, event)">Detail⬇️</button>
        </div>
    `;
}

locations.forEach((loc, index) => {
    const markerColor = getMarkerColor(loc.type);
    
    // Label permanen dengan offset untuk mencegah tumpang tindih dengan titik merah
    const marker = L.circleMarker([loc.lat, loc.lng], {
        radius: 6, fillColor: markerColor, color: "#ffffff", weight: 1.5, fillOpacity: 1
    })
    .bindTooltip(loc.name, { permanent: true, direction: 'top', offset: [0, -5], className: 'label-tempat' })
    .bindPopup(getPopupAwalHTML(index));

    if(layerGroups[loc.type]) { marker.addTo(layerGroups[loc.type]); } 
    
    // Simpan referensi marker
    searchData.push({ name: loc.name.toLowerCase(), marker: marker, lat: loc.lat, lng: loc.lng });

    // Reset popup ke tampilan awal jika disilang/ditutup
    marker.on('popupclose', function() {
        setTimeout(() => {
            marker.setPopupContent(getPopupAwalHTML(index));
        }, 300);
    });
});

// ==========================================
// FUNGSI GLOBAL UNTUK BERALIH POPUP
// ==========================================

window.tampilkanDetailBaru = function(index, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    const loc = locations[index];
    const marker = searchData[index].marker;
    
    // ==========================================
    // PERBAIKAN: Logika Tombol WhatsApp
    // ==========================================
    let waButtonHTML = '';
    if (loc.whatsapp) {
        let nomorWA = loc.whatsapp;
        
        // Otomatis ubah angka "0" di depan menjadi "62" agar valid di API WhatsApp
        if (nomorWA.startsWith('62')) {
            nomorWA = '62' + nomorWA.substring(1);
        }
        
        // Menggunakan <button> dan window.open untuk mencegah "mental" di layar HP
        waButtonHTML = `<button type="button" class="wa-btn" onclick="window.open('https://wa.me/${nomorWA}', '_blank', 'noopener,noreferrer'); event.stopPropagation();">💬 Chat Pemilik/Admin</button>`;
    }
    
    // PERUBAHAN: Tombol ikon kamera kini sejajar dengan judul di kanan atas
    const detailHTML = `
        <div class="popup-content" style="position: relative; min-width: 220px; text-align: left;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e74c3c; padding-bottom: 5px; margin-bottom: 10px;">
                <h3 style="margin: 0; border: none; padding: 0;">${loc.name}</h3>
                <button onclick="window.bukaGaleriFoto(${index}, event)" class="btn-lihat-foto" title="Lihat Foto Lokasi">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                        <circle cx="12" cy="13" r="4"></circle>
                    </svg>
                </button>
            </div>
            
            <p><strong>Kategori:</strong> ${loc.type}</p>
            <p><strong>Operasional:</strong> ${loc.jamOperasional}</p>
            <p><strong>Info:</strong> ${loc.desc}</p>
            ${waButtonHTML}
            
            <div style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #bdc3c7; padding-top: 8px;">
                <button onclick="window.kembaliKeAwal(${index}, event)" style="background: #7f8c8d; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;">⬅️ Kembali</button>
                
                <button onclick="window.buatRute(${index}, event)" title="Navigasi ke Sini" style="background-color: #3498db; color: white; border: none; border-radius: 50%; width: 34px; height: 34px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
                </button>
            </div>
        </div>
    `;
    
    marker.setPopupContent(detailHTML);
};

window.kembaliKeAwal = function(index, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    searchData[index].marker.setPopupContent(getPopupAwalHTML(index));
};

window.buatRute = function(index, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    // Cek apakah sinyal GPS sudah didapat
    if (!currentLat || !currentLng) {
        alert("Mohon tunggu sebentar, sistem sedang mencari titik lokasi GPS Anda...");
        return; 
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
    const zoom = map.getZoom(); 
    const altKm = 40000 / Math.pow(2, zoom);
    document.getElementById('eye-alt').textContent = altKm > 1 ? altKm.toFixed(2) + " km" : (altKm * 1000).toFixed(0) + " m";
    
    // Logika ala Google Maps: Sembunyikan teks label tempat jika Zoom < 15
    if (zoom < 15) {
        document.getElementById('map').classList.add('hide-labels');
    } else {
        document.getElementById('map').classList.remove('hide-labels');
    }
}

// Fungsi Ringkas untuk mencetak angka ke status bar
function perbaruiKoordinatBar(latlng) {
    document.getElementById('coord-lat').textContent = toDMS(latlng.lat, true);
    document.getElementById('coord-lng').textContent = toDMS(latlng.lng, false);
}

// 1. UNTUK DESKTOP (Komputer): Baca ujung panah mouse
map.on('mousemove', function(e) {
    perbaruiKoordinatBar(e.latlng);
});

// 2. UNTUK HP (Layar Sentuh): Baca titik tengah layar saat peta digeser/cubit
map.on('move', function() {
    perbaruiKoordinatBar(map.getCenter());
});

map.on('zoomend', updateEyeAltitude);
updateEyeAltitude();


// ==========================================
// 6. LEGENDA, KOMPAS, & FUNGSI TOGGLE
// ==========================================
window.toggleLegenda = function() {
    const legendContainer = document.querySelector('.legend-container');
    if (legendContainer) {
        legendContainer.classList.toggle('show');
    }
};

const legend = L.control({ position: 'bottomright' });
legend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'info legend-container');
    const categories = ["Pusat Pemerintahan", "Fasilitas Ibadah", "Fasilitas Kesehatan", "Fasilitas Pendidikan", "UMKM", "Keamanan Lingkungan"];
    
    let content = '<div class="legend-content">';
    content += '<h4>Legenda <button type="button" class="close-legend-btn" onclick="window.toggleLegenda()">✖</button></h4>';
    categories.forEach(cat => { content += `<i style="background:${getMarkerColor(cat)}"></i> ${cat}<br>`; });
    content += '<i style="background:#3498db"></i> Lokasi Anda<br>';
    content += '<hr style="border: 0; border-top: 1px solid #7f8c8d; margin: 8px 0;">';
    content += '<i style="background:#2c12f3; height: 4px; margin-top: 7px; border-radius: 0;"></i> Jalan Pantura<br>';
    content += '<i style="background:#c9a01a; height: 2px; margin-top: 8px; border-radius: 0;"></i> Jalan Desa<br>';
    content += '<i style="background: transparent; border-top: 3px dashed #b1aeae; height: 0; margin-top: 8px; border-radius: 0;"></i> Batas Administrasi<br>';
    content += '</div>';

    let btn = '<button type="button" id="legend-toggle-btn" onclick="window.toggleLegenda()">📜 Legenda</button>';

    div.innerHTML = btn + content;
    L.DomEvent.disableClickPropagation(div);

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

// ==========================================
// 7. FITUR ALAT UKUR PRESISI (LEAFLET-GEOMAN)
// ==========================================

// 1. KUNCI LAYER BAWAAN (Batas Administrasi & Marker Lama)
// Script ini membuat alat hapus Geoman mengabaikan semua layer yang sudah ada di peta,
// sehingga batas desa Anda tidak akan ikut terhapus.
map.eachLayer(function(layer) {
    layer.options.pmIgnore = true;
});

// 2. TAMBAHKAN KONTROL DIGITASI
map.pm.addControls({
    position: 'topleft',
    drawMarker: false,
    drawCircleMarker: false,
    drawPolyline: true,     // Tool ukur jarak (Garis)
    drawRectangle: false,
    drawPolygon: true,      // Tool ukur luas (Poligon)
    drawCircle: false,
    drawText: false,
    editMode: false,
    dragMode: false,
    cutPolygon: false,
    removalMode: true       // Tool hapus
});

// 3. KONFIGURASI VISUAL & SISTEM METRIK
map.pm.setGlobalOptions({ 
    measurements: { measurement: true, displayFormat: 'metric' },
    tooltips: true,
    hintlineStyle: { color: '#e74c3c', dashArray: '5,5' },
    templineStyle: { color: '#e74c3c' },
    pathOptions: { color: '#3498db', fillColor: '#3498db', fillOpacity: 0.4 }
});

// 4. MUNCULKAN POPUP UKURAN PERMANEN SETELAH SELESAI MENGGAMBAR
map.on('pm:create', function(e) {
    var layer = e.layer;
    
    // Izinkan garis/poligon yang BARU digambar ini untuk bisa dihapus oleh user
    layer.options.pmIgnore = false; 
    
    // Coba ambil teks ukuran dari sistem Geoman (jika berhasil)
    var hasilUkuran = "";
    if (layer.getTooltip && layer.getTooltip()) {
        hasilUkuran = layer.getTooltip().getContent();
    }

    // FALLBACK 1: Jika menggambar GARIS (Jarak)
    if (e.shape === 'Line' && (!hasilUkuran || hasilUkuran === "")) {
        var latlngs = layer.getLatLngs();
        var distance = 0;
        for (var i = 0; i < latlngs.length - 1; i++) {
            distance += latlngs[i].distanceTo(latlngs[i + 1]);
        }
        
        var distanceMeter = Math.round(distance).toLocaleString('id-ID');
        
        // Tampilkan Kilometer dan Meter jika jaraknya jauh
        if (distance >= 1000) {
            var distanceKm = (distance / 1000).toFixed(2);
            hasilUkuran = distanceKm + " km<br><span style='font-size:12px; font-weight:normal;'>(" + distanceMeter + " meter)</span>";
        } else {
            hasilUkuran = distanceMeter + " meter";
        }
    }

    // FALLBACK 2: Jika menggambar POLIGON (Luas Area)
    if (e.shape === 'Polygon' && (!hasilUkuran || hasilUkuran === "")) {
        // Mengambil titik sudut luar poligon
        var latlngs = layer.getLatLngs()[0]; 
        var area = 0;
        
        var d2r = Math.PI / 180; 
        var R = 6378137; // Jari-jari bumi
        
        if (latlngs.length > 2) {
            for (var i = 0; i < latlngs.length; i++) {
                var p1 = latlngs[i];
                var p2 = latlngs[(i + 1) % latlngs.length];
                area += ((p2.lng - p1.lng) * d2r) *
                        (2 + Math.sin(p1.lat * d2r) + Math.sin(p2.lat * d2r));
            }
            area = Math.abs(area * R * R / 2.0);
        }

        // Format angka dengan titik sebagai pemisah ribuan (contoh: 15.000)
        var areaMeter = Math.round(area).toLocaleString('id-ID');

        // Tampilkan Hektar dan Meter Persegi sekaligus jika luas > 10.000
        if (area >= 10000) {
            var areaHektar = (area / 10000).toFixed(2);
            hasilUkuran = areaHektar + " ha<br><span style='font-size:12px; font-weight:normal;'>(" + areaMeter + " meter persegi)</span>";
        } else {
            // Tampilkan hanya meter persegi jika lahan lebih kecil dari 1 hektar
            hasilUkuran = areaMeter + " meter persegi"; 
        }
    }

    // Ikat hasil ukuran ke dalam Popup lalu buka secara otomatis
    if (hasilUkuran) {
        layer.bindPopup(
            "<div style='font-size:14px; text-align:center; padding:5px;'>" +
            "<span style='color:#7f8c8d; font-size:12px; display:block; margin-bottom:3px;'>Hasil Ukuran:</span>" +
            "<b>" + hasilUkuran + "</b>" +
            "</div>"
        ).openPopup();
    } else {
        layer.bindPopup("<b>Area berhasil dipetakan.</b>").openPopup();
    }
});


// ==========================================
// 8. FITUR LAPOR WARGA (GOOGLE FORMS CROWDSOURCING)
// ==========================================
let isReportingMode = false;

// Membuat tombol kontrol custom di peta
const laporControl = L.control({ position: 'topright' });

laporControl.onAdd = function(map) {
    const btn = L.DomUtil.create('button', 'lapor-warga-control');
    btn.innerHTML = '📢 Lapor Cepat';
    btn.title = 'Klik untuk melaporkan kejadian/masalah di lokasi tertentu';
    
    L.DomEvent.on(btn, 'click', function(e) {
        L.DomEvent.stopPropagation(e); // Cegah peta ikut terklik
        isReportingMode = !isReportingMode; // Toggle mode on/off
        
        if (isReportingMode) {
            btn.innerHTML = 'Batalkan Lapor ✖';
            btn.classList.add('active');
            document.getElementById('map').classList.add('reporting-mode');
            alert("Mode Lapor Aktif!\nSilakan klik tepat di lokasi masalah pada peta.");
        } else {
            btn.innerHTML = '📢 Lapor Cepat';
            btn.classList.remove('active');
            document.getElementById('map').classList.remove('reporting-mode');
        }
    });
    
    return btn;
};
laporControl.addTo(map);

// Aksi yang terjadi ketika peta diklik saat mode lapor sedang ON
map.on('click', function(e) {
    if (isReportingMode) {
        const lat = e.latlng.lat.toFixed(6);
        const lng = e.latlng.lng.toFixed(6);
        
        // Popup konfirmasi sebelum dilempar ke Google Forms
        if(confirm(`Anda akan melaporkan lokasi pada:\nLintang: ${lat}\nBujur: ${lng}\n\nLanjutkan mengisi formulir laporan?`)) {
            
            // ============================================================
            // PERHATIAN: GANTI URL DI BAWAH INI DENGAN LINK GOOGLE FORM ANDA
            // ============================================================
            // Format link harus berupa "Pre-filled Link" (Dapatkan tautan yang sudah terisi)
            // Ganti "entry.111111" dengan ID isian Latitude dan "entry.222222" dengan ID isian Longitude.
            
            const formUrl = `https://docs.google.com/forms/d/e/1FAIpQLSfrwrL-MEPQFOiF0iQI94r0ZKtb9r-g7ZEJTj4ABscLoCdoKg/viewform?usp=publish-editor`;
            
            // Buka Google Forms di tab baru
            window.open(formUrl, '_blank');
            
            // Matikan mode lapor otomatis setelah klik
            isReportingMode = false;
            const btn = document.querySelector('.lapor-warga-control');
            btn.innerHTML = '📢 Lapor Cepat';
            btn.classList.remove('active');
            document.getElementById('map').classList.remove('reporting-mode');
        }
    }
});

// Fungsi untuk membuka layar penuh galeri foto
window.bukaGaleriFoto = function(index, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    const loc = locations[index];
    const kumpulanFoto = [loc.imgBangunan, loc.imgOrang, loc.imgRumah]; 

    let modalHTML = `
        <div id="galeri-overlay" class="galeri-overlay">
            <div class="galeri-modal">
                <button class="close-galeri" onclick="window.tutupGaleriFoto()">✖</button>
                <h3 class="galeri-title">${loc.name}</h3>
                
                <!-- BUNGKUSAN BARU UNTUK PANAH KIRI-KANAN -->
                <div class="slider-wrapper" style="position: relative;">
                    <button class="nav-btn prev-btn" onclick="window.geserGaleri(-1)">&#10094;</button>
                    
                    <div class="galeri-slider" id="galeri-slider">
    `;
    
    kumpulanFoto.forEach((foto, i) => {
        if (foto && foto !== "") {
            modalHTML += `
                <div class="foto-container">
                    <div class="loading-spinner"></div>
                    <img src="${foto}" alt="Foto ${i+1}" 
                         onload="this.classList.add('loaded')" 
                         onerror="this.src='https://via.placeholder.com/400x250?text=Foto+Tidak+Tersedia'; this.classList.add('loaded');">
                </div>
            `;
        }
    });
    
    modalHTML += `
                    </div>
                    
                    <button class="nav-btn next-btn" onclick="window.geserGaleri(1)">&#10095;</button>
                </div>
                <!-- AKHIR BUNGKUSAN -->

                <p class="galeri-hint">👆 Geser atau gunakan panah untuk melihat foto</p>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

// FUNGSI BARU: Untuk menggeser galeri saat tombol panah diklik
window.geserGaleri = function(arah) {
    const slider = document.getElementById('galeri-slider');
    if(slider) {
        // Mendapatkan lebar satu gambar untuk menentukan jarak geser
        const jarakGeser = slider.clientWidth; 
        slider.scrollBy({ left: arah * jarakGeser, behavior: 'smooth' });
    }
};

window.tutupGaleriFoto = function() {
    const overlay = document.getElementById('galeri-overlay');
    if (overlay) {
        overlay.remove();
    }
};



