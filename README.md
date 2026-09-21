# barepix

A lightweight, self-hosted photo and video web gallery written in Python. Uses a flat-file architecture with no database. Album structure is dynamically derived from filesystem folders.

## Use Case

You have a personal photo/video library — possibly accumulated over years from different cameras and phones — and you want to browse it from any device without uploading it somewhere. You want to point it at a folder on a cheap VPS and have it just work, even if the library contains Apple HEIC photos, HEVC videos from an iPhone 14, VP9 clips from a Pixel, and regular JPEGs all mixed together. You are the only user. You don't need sharing, tags, search, or a mobile app — you just want to see your stuff.

### Constraints

- **No GPU.** All video transcoding is pure CPU (x264). A 2-core VPS transcodes 720p at roughly 1.3–2× realtime.
- **No disk cache.** Transcoded video is piped directly to the HTTP response and discarded. The server never writes temp files.
- **No seeking.** Transcoded streams play start-to-finish. You cannot scrub to the middle of a video that was transcoded on the fly.
- **Flat structure.** Albums are filesystem folders. There is no tagging, no search, no metadata beyond filenames and folder hierarchy.
- **No thumbnails.** Album covers are the first image in each folder. There are no pre-generated video previews.

### Pros

- **Zero infrastructure.** No database, no Redis, no image processing pipeline. Just Python + ffmpeg.
- **Handles any source format.** HEVC, VP9, PCM audio — all transcoded on the fly. You never have to re-encode your library beforehand.
- **Universal browser support.** MSE player works in Safari, Chrome, Firefox, and Edge. No browser plugins required.
- **Flat-file, portable.** Your library is just folders on disk. Move it, back it up, rsync it — the gallery follows.
- **Low resource usage.** Streaming transcode with no cache means minimal RAM and disk overhead. A 4 GB VPS is comfortable.
- **Simple deployment.** Single `config.yaml`, runs as `barepix`, ships with a systemd unit and Nginx config.

### Cons

- **No video seeking.** Once a transcoded stream starts, you watch from the beginning or reload.
- **CPU-bound.** Two concurrent transcodes on a 2-core VPS. Third viewer waits.
- **No thumbnails or previews.** Album covers and video stills are loaded live.
- **No search, tags, or organization** beyond folder names.

## Features

- **Zero Database**: All metadata derived from filesystem structure
- **FastAPI Backend**: High-performance async server with video streaming support
- **On-the-Fly Video Transcoding**: Incompatible videos (HEVC, VP9, PCM audio) are transcoded to browser-friendly H.264/AAC while streaming
- **Responsive WebUI**: Grid views, lightbox, and MSE-based video player
- **Nginx-Ready**: Easily reverse-proxy behind Nginx
- **Simple Configuration**: Single `config.yaml` file

## Requirements

- Python 3.9+
- **ffmpeg** (with `ffprobe`) — required for video playback. Install via your package manager:

```bash
sudo apt install ffmpeg      # Debian/Ubuntu
sudo dnf install ffmpeg      # Fedora
```

Without ffmpeg, images work normally but videos return `501 Not Implemented`.

## Quick Start

### Installation

```bash
pip install barepix
```

Or run directly:

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
```

### Run

```bash
barepix
# or
python -m barepix.main
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

Each folder becomes an album. The first image in each folder becomes the album cover.

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
- Seeking is disabled for transcoded streams.
- At most 2 videos are transcoded concurrently to protect the CPU; additional requests wait for a slot.

### Supported Formats

- **Images**: JPG, JPEG, PNG, WebP, HEIC, HEIF (HEIC/HEIF converted to JPEG on the fly)
- **Videos**: MP4, MOV, MKV (transcoded as needed)

## License

MIT
