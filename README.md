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
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### Configuration

Edit `config.yaml`:

```yaml
gallery:
  title: "My Gallery"      # shown as the browser title and page heading
  root_dir: "/path/to/my/photos"
  host: "127.0.0.1"
  port: 8081
  password: ""            # optional; leave empty to disable authentication
  allowed_extensions:
    images: ["jpg", "jpeg", "png", "webp", "heic", "heif"]
    videos: ["mp4", "mov", "mkv"]
```

### Run

```bash
.venv/bin/python -m barepix
# or, after `.venv/bin/pip install .`:
.venv/bin/barepix
```

Open `http://127.0.0.1:8081` in your browser.

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

The bundled `nginx.conf` and `barepix.service` assume the app is installed at `/opt/barepix` and listening on `127.0.0.1:8081`. Adjust the paths and port if you install elsewhere.

1. Install the system dependencies (`ffmpeg` provides both `ffmpeg` and `ffprobe`):

```bash
sudo apt install ffmpeg python3-venv      # Debian/Ubuntu
```

2. Install the app and its Python dependencies into a virtualenv at `/opt/barepix`:

```bash
sudo git clone <repo> /opt/barepix
sudo python3 -m venv /opt/barepix/.venv
sudo /opt/barepix/.venv/bin/pip install -r /opt/barepix/requirements.txt
```

3. In `/opt/barepix/config.yaml`, set `host` to `127.0.0.1`, keep `port` matching the `proxy_pass` target in `nginx.conf`, and point `root_dir` at your photos directory.

4. Install the Nginx and systemd configs. The unit runs `/opt/barepix/.venv/bin/python`, so it uses the same environment you just installed into:

```bash
sudo cp /opt/barepix/nginx.conf /etc/nginx/nginx.conf      # or include it from sites-available
sudo cp /opt/barepix/barepix.service /etc/systemd/system/
sudo systemctl enable --now barepix
```

The service runs as `www-data`; make sure that user can read `/opt/barepix` and your `root_dir`. If a feature still returns `501`, barepix logs a warning at startup naming the missing dependency:

```bash
journalctl -u barepix -n 50
```

If `ffmpeg` lives outside systemd's default `PATH` (snap, conda, linuxbrew, …), point the unit at it:

```ini
Environment=PATH=/snap/bin:/usr/local/bin:/usr/bin:/bin
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
