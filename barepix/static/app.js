const API_BASE = '';
let allAlbums = [];
let allMedia = [];
let currentAlbum = null;
let lightboxIndex = 0;

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const album = params.get('album');

    const resp = await fetch(`${API_BASE}/api/albums`);
    allAlbums = await resp.json();

    if (album) {
        showAlbum(album);
    } else {
        showAlbums();
    }
});

function showAlbums() {
    const app = document.getElementById('app');
    const titleEl = document.getElementById('gallery-title');
    titleEl.textContent = 'Gallery';

    let html = '<div class="album-grid">';
    for (const album of allAlbums) {
        const coverSrc = album.cover
            ? `/api/media/${album.name}/${encodeURIComponent(album.cover.split('/').pop())}`
            : '';
        const coverHtml = album.cover
            ? `<img class="album-cover" src="${coverSrc}" alt="${album.name}" loading="lazy" onerror="this.style.display='none'">`
            : '';
        const fallback = album.cover ? '' : '<div class="album-cover video-cover">📷</div>';

        html += `
            <div class="album-card" onclick="showAlbum('${escapeHtml(album.name)}')">
                ${coverHtml}${fallback}
                <div class="album-info">
                    <h2>${escapeHtml(album.name)}</h2>
                    <p>${album.count} media</p>
                </div>
            </div>`;
    }
    html += '</div>';
    app.innerHTML = html;
}

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
                    <a class="back-btn" onclick="showAlbums()"><span>←</span> Albums</a>
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

function escapeHtml(str) {
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
