let allAlbums = [];
let allMedia = [];
let currentAlbum = null;
let lightboxIndex = 0;
let currentSortBy = 'name';
let currentSortOrder = 'asc';
let activeMediaSource = null;
let activeFetchController = null;

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
        const isVideoCover = album.cover && /\.(mp4|mov|mkv)$/i.test(album.cover);
        const thumbSrc = isVideoCover
            ? `/api/thumbnail/${encodeURIComponent(album.name)}/${encodeURIComponent(album.cover.split('/').pop())}`
            : coverSrc;
        const coverHtml = album.cover
            ? `<img class="album-cover" src="${thumbSrc}" alt="${escapeHtml(album.name)}" loading="lazy" onerror="this.style.display='none'">`
            : '';
        const fallback = album.cover ? '' : '<div class="album-cover video-cover">📷</div>';
        html += `
            <div class="album-card" onclick="showAlbum('${escapeHtml(album.name, true)}')">
                ${coverHtml}${fallback}
                ${isVideoCover ? '<span class="video-icon">▶</span>' : ''}
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

function fetchJson(url) {
    return fetch(url).then(r => {
        if (r.status === 401) {
            window.location.href = '/';
            throw new Error('Unauthorized');
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
    });
}

function loadAlbums() {
    const url = `/api/albums?sort_by=${currentSortBy}&sort_order=${currentSortOrder}`;
    return fetchJson(url).then(data => { allAlbums = data; });
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('app').innerHTML = buildSortBar();
    attachSortListeners();
    fetch('/api/auth/status').then(r => r.json()).then(data => {
        if (data.auth_required) {
            document.getElementById('logout-btn').style.display = '';
        }
    }).catch(() => {});
    loadAlbums().then(renderAlbumGrid);
});

function showAlbum(name) {
    currentAlbum = name;
    const app = document.getElementById('app');
    document.getElementById('gallery-title').textContent = name;

    fetchJson(`/api/album/${encodeURIComponent(name)}`)
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
                const thumbUrl = isVideo
                    ? `/api/thumbnail/${encodeURIComponent(name)}/${encodeURIComponent(m.name)}`
                    : `/api/media/${encodeURIComponent(name)}/${encodeURIComponent(m.name)}`;
                const fallbackAttr = isVideo
                    ? ` onerror="this.outerHTML='<div class=\\'album-cover video-cover\\' style=\\'height:240px\\'>🎬</div>'"`
                    : '';
                html += `
                    <div class="media-item" onclick="openLightbox(${i})">
                        <img src="${thumbUrl}" alt="${escapeHtml(m.name)}" loading="lazy"${fallbackAttr}>
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

function stopPlayback() {
    if (activeFetchController) { activeFetchController.abort(); activeFetchController = null; }
    if (activeMediaSource) {
        try { activeMediaSource.endOfStream(); } catch(e) {}
        try { activeMediaSource.removeSourceBuffer(activeMediaSource.sourceBuffers[0]); } catch(e) {}
        activeMediaSource = null;
    }
}

function openLightbox(index) {
    if (!allMedia[index]) return;
    lightboxIndex = index;
    const m = allMedia[index];
    const lb = document.getElementById('lightbox');
    const content = document.getElementById('lightbox-content');
    const caption = document.getElementById('lightbox-caption');

    content.innerHTML = '';
    stopPlayback();
    if (m.is_video) {
        const videoUrl = `/api/media/${encodeURIComponent(currentAlbum)}/${encodeURIComponent(m.name)}`;
        const videoEl = document.createElement('video');
        videoEl.controls = true;
        videoEl.preload = 'auto';
        videoEl.style.width = '100%';
        content.appendChild(videoEl);
        playVideoStream(videoUrl, videoEl);
    } else {
        const imgUrl = `/api/media/${encodeURIComponent(currentAlbum)}/${encodeURIComponent(m.name)}`;
        content.innerHTML = `<img src="${imgUrl}" alt="${escapeHtml(m.name)}">`;
    }
    caption.textContent = m.name;
    lb.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function findAvcCodecString(bytes) {
    for (let i = 0; i + 8 < bytes.length; i++) {
        if (bytes[i] === 0x61 && bytes[i+1] === 0x76 && bytes[i+2] === 0x63 && bytes[i+3] === 0x43) {
            const hex = (n) => n.toString(16).padStart(2, '0');
            return `avc1.${hex(bytes[i+5])}${hex(bytes[i+6])}${hex(bytes[i+7])}`;
        }
    }
    return null;
}

function hasAudioTrack(bytes) {
    for (let i = 0; i + 4 <= bytes.length; i++) {
        if (bytes[i] === 0x6d && bytes[i+1] === 0x70 && bytes[i+2] === 0x34 && bytes[i+3] === 0x61) return true;
    }
    return false;
}

function showVideoError(videoEl, msg) {
    const parent = videoEl.parentElement;
    if (!parent) return;
    const p = document.createElement('p');
    p.style.color = '#fff';
    p.style.padding = '20px';
    p.textContent = msg || 'Video format not supported by your browser.';
    parent.innerHTML = '';
    parent.appendChild(p);
}

function playVideoStream(url, videoEl) {
    if (typeof MediaSource === 'undefined') {
        videoEl.src = url;
        videoEl.onerror = () => showVideoError(videoEl, 'Video format not supported by your browser. Please use a modern browser.');
        return;
    }
    const mediaSource = new MediaSource();
    activeMediaSource = mediaSource;
    videoEl.src = URL.createObjectURL(mediaSource);
    mediaSource.addEventListener('sourceopen', () => {
        startStreaming(mediaSource, url, videoEl);
    }, { once: true });
    mediaSource.addEventListener('error', () => {
        showVideoError(videoEl, 'Error loading video.');
    }, { once: true });
}

async function startStreaming(mediaSource, url, videoEl) {
    activeFetchController = new AbortController();
    const queue = [];
    let sourceBuffer = null;
    let streamDone = false;

    function pump() {
        if (!sourceBuffer || sourceBuffer.updating || queue.length === 0) return;
        try {
            sourceBuffer.appendBuffer(queue.shift());
        } catch (e) {
            console.error('appendBuffer failed:', e);
        }
    }

    try {
        const res = await fetch(url, { signal: activeFetchController.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const reader = res.body.getReader();

        let init = new Uint8Array(0);
        let codec = null;
        while (!codec && init.length < 512 * 1024) {
            const { done, value } = await reader.read();
            if (done) { streamDone = true; break; }
            const merged = new Uint8Array(init.length + value.length);
            merged.set(init);
            merged.set(value, init.length);
            init = merged;
            codec = findAvcCodecString(init);
        }

        if (!codec) {
            showVideoError(videoEl, 'Unable to determine video format.');
            return;
        }

        const mime = hasAudioTrack(init)
            ? `video/mp4; codecs="${codec}, mp4a.40.2"`
            : `video/mp4; codecs="${codec}"`;

        if (MediaSource.isTypeSupported && !MediaSource.isTypeSupported(mime)) {
            showVideoError(videoEl, 'Video format not supported by your browser.');
            return;
        }

        sourceBuffer = mediaSource.addSourceBuffer(mime);
        sourceBuffer.addEventListener('updateend', () => {
            pump();
            if (streamDone && queue.length === 0 && mediaSource.readyState === 'open') {
                mediaSource.endOfStream();
            }
        });

        queue.push(init);
        pump();

        while (!streamDone) {
            const { done, value } = await reader.read();
            if (done) { streamDone = true; break; }
            queue.push(value);
            pump();
        }
        if (queue.length === 0 && !sourceBuffer.updating && mediaSource.readyState === 'open') {
            mediaSource.endOfStream();
        }
    } catch (e) {
        if (e.name !== 'AbortError') {
            console.error('Video stream error:', e);
            showVideoError(videoEl, 'Error loading video.');
        }
    }
}

function closeLightbox() {
    stopPlayback();
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
