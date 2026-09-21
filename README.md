# barepix

A lightweight, self-hosted photo and video web gallery written in Python. Uses a flat-file architecture with no database. Album structure is dynamically derived from filesystem folders.

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
