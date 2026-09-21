# barepix

A lightweight, self-hosted photo and video web gallery written in Python. Uses a flat-file architecture with no database. Album structure is dynamically derived from filesystem folders.

## Use Case

You have a personal photo/video library — possibly accumulated over years from different cameras and phones — and you want to browse it from any device without uploading it somewhere. You want to point it at a folder on a cheap VPS and have it just work, even if the library contains Apple HEIC photos, HEVC videos from an iPhone 14, VP9 clips from a Pixel, and regular JPEGs all mixed together. It is just for you and your family, so a single shared password keeps strangers out. You don't need per-user accounts, sharing links, tags, search, or a mobile app — you just want to see your stuff.

### Constraints

- **No GPU.** All video transcoding is pure CPU (x264). A 2-core VPS transcodes 720p at roughly 1.3–2× realtime.
- **No disk cache.** Transcoded video is piped directly to the HTTP response and discarded. The server never writes temp files.
- **No seeking.** Transcoded streams play start-to-finish. You cannot scrub to the middle of a video that was transcoded on the fly.
- **Flat structure.** Albums are filesystem folders. There is no tagging, no search, no metadata beyond filenames and folder hierarchy.
- **No pre-generated thumbnails.** Album covers are the first image in each folder. Video stills are extracted on demand and streamed, never cached, so browsing a video-heavy album costs CPU.

### Pros

- **Zero infrastructure.** No database, no Redis, no image processing pipeline. Just Python + ffmpeg.
- **Handles any source format.** HEVC, VP9, PCM audio — all transcoded on the fly. You never have to re-encode your library beforehand.
- **Universal browser support.** MSE player works in Safari, Chrome, Firefox, and Edge. No browser plugins required.
- **Flat-file, portable.** Your library is just folders on disk. Move it, back it up, rsync it — the gallery follows.
- **Low resource usage.** Streaming transcode with no cache means minimal RAM and disk overhead. A 4 GB VPS is comfortable.
- **Simple deployment.** Single `config.yaml`, runs as `barepix`, ships with a systemd unit and Nginx config.
- **Optional password protection.** A single shared password in `config.yaml` keeps the gallery private, with no user accounts to manage.

### Cons

- **No video seeking.** Once a transcoded stream starts, you watch from the beginning or reload.
- **CPU-bound.** Two concurrent transcodes on a 2-core VPS. Third viewer waits.
- **Single shared password.** There are no per-user accounts or permissions; everyone with the password sees the whole library.
- **No search, tags, or organization** beyond folder names.

## Features

- **Zero Database**: All metadata derived from filesystem structure
- **FastAPI Backend**: High-performance async server with video streaming support
- **On-the-Fly Video Transcoding**: Incompatible videos (HEVC, VP9, PCM audio) are transcoded to browser-friendly H.264/AAC while streaming
- **On-the-Fly Video Thumbnails**: The first frame of each video is extracted for grid and album-cover previews, with no disk cache
- **Optional Password Protection**: A single shared password in `config.yaml`; login sets an HTTP-only cookie and the UI shows a logout link
- **Responsive WebUI**: Grid views, lightbox, and MSE-based video player
- **Nginx-Ready**: Easily reverse-proxy behind Nginx
- **Simple Configuration**: Single `config.yaml` file

## Requirements

- Python 3.8+
- **ffmpeg** (with `ffprobe`) — required for video playback and video thumbnails. Install via your package manager:

```bash
sudo apt install ffmpeg      # Debian/Ubuntu
sudo dnf install ffmpeg      # Fedora
```

Without ffmpeg, images work normally but videos and video thumbnails return `501 Not Implemented`.

## Quick Start

### Installation

```bash
git clone <repo>
cd barepix
pip install -r requirements.txt
```

### Configuration

Edit `config.yaml`:

```yaml
gallery:
  title: "My Gallery"
  root_dir: "/path/to/my/photos"
  host: "127.0.0.1"
  port: 8080
  password: ""            # optional; leave empty to disable authentication
  sort_by: "name"         # name, date, or count
  sort_order: "asc"       # asc or desc
  allowed_extensions:
    images: ["jpg", "jpeg", "png", "webp", "heic", "heif"]
    videos: ["mp4", "mov", "mkv"]
```

### Run

```bash
python -m barepix
# or, after `pip install .`:
barepix
```

Open `http://127.0.0.1:8080` in your browser.

## Directory Structure

```
photos/
├── Vacation 2024/
│   ├── beach.jpg
│   └── sunset.png
├── Family/
│   ├── reunion.mp4
│   └── portrait.webp
└── Nature/
    ├── forest.jpg
    └── waterfall.mov
```

Each folder becomes an album. The first non-video file in each folder becomes the album cover; a videos-only folder falls back to its first video, shown as a live-generated thumbnail.

## Authentication

Authentication is optional and off by default. Set a non-empty `password` in `config.yaml` to enable it:

```yaml
gallery:
  password: "our-family-password"
```

When set, the gallery pages and API require the shared password (static assets and the login endpoints are exempt). Visiting the gallery shows a login page; a correct password sets an HTTP-only cookie for 30 days, and the header exposes a logout link. Without a password, the gallery is fully open.

This is a convenience lock for a private, trusted audience, not hardened security:

- The password is stored in plaintext in `config.yaml` and used directly as the cookie value.
- There are no user accounts, roles, or per-album permissions.
- Serve it over HTTPS (e.g. behind the bundled Nginx config) so the password and cookie are not sent in the clear.

## Deployment with Nginx

1. Copy `nginx.conf` to your Nginx configuration
2. Update `root_dir` in `config.yaml` to point to your photos directory
3. Enable the systemd service:

```bash
sudo cp barepix.service /etc/systemd/system/
sudo systemctl enable barepix
sudo systemctl start barepix
```

## Video Playback

Videos are transcoded on the fly and streamed to the browser using MediaSource Extensions (MSE). This makes any source video playable in any modern browser, including Safari.

- Videos already in H.264 + AAC at 720p or below are **remuxed** (container change only, no re-encode).
- Videos larger than 720p are **scaled down to 720p**.
- Videos above 30 fps are **capped at 30 fps**. Frames are dropped *before* scaling, which roughly doubles transcoding throughput versus scaling first.
- Videos with unsupported codecs (HEVC, VP9) or audio (PCM) are **transcoded** to H.264 + AAC.
- Transcoding is piped directly to the HTTP response, so playback starts before encoding finishes. Nothing is written to disk.
- Video thumbnails are extracted from one second into each clip and streamed on demand; like playback, they are never cached to disk.
- Seeking is disabled for transcoded streams.
- At most 2 videos are processed concurrently to protect the CPU; additional playback and thumbnail requests wait for a slot.

### Supported Formats

- **Images**: JPG, JPEG, PNG, WebP, HEIC, HEIF (HEIC/HEIF converted to JPEG on the fly)
- **Videos**: MP4, MOV, MKV (transcoded as needed)

## License

MIT
