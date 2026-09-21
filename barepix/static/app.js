const API_BASE = '';
let allAlbums = [];
let allMedia = [];
let currentAlbum = null;
let lightboxIndex = 0;
let currentSortBy = 'name';
let currentSortOrder = 'asc';

function buildSortBar() {
    return `
        <div class="sort-bar">
            <label>Sort by:</label>
            <select id="sort-by">
                <option value="name" ${currentSortBy === 'name' ? 'selected' : ''}>Name</option>
                <option value="date" ${currentSortBy === 'date' ? 'selected' : ''}>Date Modified</option>
                <option value="count" ${currentSortBy === 'count' ? 'selected' : ''}>Media Count</option>
            </select>
            <label>Order:</label>
            <select id="sort-order">
                <option value="asc" ${currentSortOrder === 'asc' ? 'selected' : ''}>Ascending</option>
                <option value="desc" ${currentSortOrder === 'desc' ? 'selected' : ''}>Descending</option>
            </select>
        </div>
        <div class="album-grid" id="album-grid"></div>`;
}

function renderAlbumGrid() {
    const grid = document.getElementById('album-grid');
    let html = '';
    for (const album of allAlbums) {
        const coverSrc = album.cover
            ? `/api/media/${encodeURIComponent(album.name)}/${encodeURIComponent(album.cover.split('/').pop())}`
            : '';
        const coverHtml = album.cover
            ? `<img class="album-cover" src="${coverSrc}" alt="${escapeHtml(album.name)}" loading="lazy" onerror="this.style.display='none'">`
            : '';
        const fallback = album.cover ? '' : '<div class="album-cover video-cover">📷</div>';
        html += `
            <div class="album-card" onclick="showAlbum('${escapeHtml(album.name, true)}')">
                ${coverHtml}${fallback}
                <div class="album-info">
                    <h2>${escapeHtml(album.name)}</h2>
                    <p>${album.count} media</p>
                </div>
            </div>`;
    }
    grid.innerHTML = html;
}

function attachSortListeners() {
    document.getElementById('sort-by').addEventListener('change', function() {
        currentSortBy = this.value;
        loadAlbums().then(renderAlbumGrid);
    });
    document.getElementById('sort-order').addEventListener('change', function() {
        currentSortOrder = this.value;
        loadAlbums().then(renderAlbumGrid);
    });
}

function loadAlbums() {
    const url = `/api/albums?sort_by=${currentSortBy}&sort_order=${currentSortOrder}`;
    return fetch(url).then(r => r.json()).then(data => { allAlbums = data; });
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('app').innerHTML = buildSortBar();
    attachSortListeners();
    loadAlbums().then(renderAlbumGrid);
});

function showAlbum(name) {
    currentAlbum = name;
    const app = document.getElementById('app');
    document.getElementById('gallery-title').textContent = name;

    fetch(`${API_BASE}/api/album/${encodeURIComponent(name)}`)
        .then(r => r.json())
        .then(media => {
            allMedia = media;
            let html = `
                <div class="album-nav">
                    <a class="back-btn" onclick="backToAlbums()"><span>←</span> Albums</a>
                    <span>${escapeHtml(name)}</span>
                </div>
                <div class="media-grid">`;

            for (let i = 0; i < media.length; i++) {
                const m = media[i];
                const isVideo = m.is_video;
                const thumbUrl = `/api/media/${encodeURIComponent(name)}/${encodeURIComponent(m.name)}`;
                html += `
                    <div class="media-item" onclick="openLightbox(${i})">
                        ${isVideo
                            ? '<div class="album-cover video-cover" style="height:240px">🎬</div>'
                            : `<img src="${thumbUrl}" alt="${escapeHtml(m.name)}" loading="lazy">`
                        }
                        ${isVideo ? '<span class="video-icon">▶</span>' : ''}
                    </div>`;
            }
            html += '</div>';
            app.innerHTML = html;
        });
}

function backToAlbums() {
    const app = document.getElementById('app');
    document.getElementById('gallery-title').textContent = 'Gallery';
    app.innerHTML = buildSortBar();
    attachSortListeners();
    loadAlbums().then(renderAlbumGrid);
}

function openLightbox(index) {
    if (!allMedia[index]) return;
    lightboxIndex = index;
    const m = allMedia[index];
    const lb = document.getElementById('lightbox');
    const content = document.getElementById('lightbox-content');
    const caption = document.getElementById('lightbox-caption');

    if (m.is_video) {
        content.innerHTML = `<video src="/api/media/${encodeURIComponent(currentAlbum)}/${encodeURIComponent(m.name)}" controls></video>`;
    } else {
        content.innerHTML = `<img src="/api/media/${encodeURIComponent(currentAlbum)}/${encodeURIComponent(m.name)}" alt="${escapeHtml(m.name)}">`;
    }
    caption.textContent = m.name;
    lb.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    document.getElementById('lightbox').classList.add('hidden');
    document.body.style.overflow = '';
}

function navigateLightbox(dir) {
    lightboxIndex = (lightboxIndex + dir + allMedia.length) % allMedia.length;
    openLightbox(lightboxIndex);
}

function escapeHtml(str, forAttr) {
    if (forAttr) return str.replace(/'/g, "\\'");
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
document.getElementById('lightbox-prev').addEventListener('click', () => navigateLightbox(-1));
document.getElementById('lightbox-next').addEventListener('click', () => navigateLightbox(1));

document.addEventListener('keydown', (e) => {
    const lb = document.getElementById('lightbox');
    if (!lb.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigateLightbox(-1);
    if (e.key === 'ArrowRight') navigateLightbox(1);
});
