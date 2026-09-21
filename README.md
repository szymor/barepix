# barepix

A lightweight, self-hosted photo and video web gallery written in Python. Uses a flat-file architecture with no database. Album structure is dynamically derived from filesystem folders.

## Features

- **Zero Database**: All metadata derived from filesystem structure
- **FastAPI Backend**: High-performance async server with video streaming support
- **Responsive WebUI**: Grid views, lightbox, and HTML5 video player
- **Nginx-Ready**: Easily reverse-proxy behind Nginx with byte-range support
- **Simple Configuration**: Single `config.yaml` file

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

## Video Streaming

Videos are served with HTML5 native streaming and byte-range request support, enabling seeking without downloading the entire file.

## Supported Formats

- **Images**: JPG, JPEG, PNG, WebP
- **Videos**: MP4, MOV, MKV

## License

MIT
