import asyncio
import io
import json
import logging
import shutil
import subprocess
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from PIL import Image, ImageOps

logger = logging.getLogger("barepix")

try:
    import pillow_heif
    pillow_heif.register_heif_opener()
    HAVE_HEIF = True
except ImportError:
    HAVE_HEIF = False

HEIF_FORMATS = {"HEIF", "HEIC"}
HAVE_FFMPEG = shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None
MAX_VIDEO_DIM = 720
MAX_VIDEO_FPS = 30
VIDEO_GOP = 60
MAX_CONCURRENT_TRANSCODES = 2

_transcode_semaphore = asyncio.Semaphore(MAX_CONCURRENT_TRANSCODES)


def _parse_fps(value: str) -> float:
    try:
        num, den = value.split("/")
        den = float(den)
        return float(num) / den if den else 0.0
    except (ValueError, ZeroDivisionError):
        return 0.0


def probe_video(path: str) -> dict:
    cmd = ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", path]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail="ffprobe failed")
    data = json.loads(result.stdout)
    vcodec = acodec = None
    width = height = 0
    fps = 0.0
    for s in data.get("streams", []):
        if s.get("codec_type") == "video":
            vcodec = s.get("codec_name")
            width = int(s.get("width", 0))
            height = int(s.get("height", 0))
            fps = _parse_fps(s.get("r_frame_rate", "0/1"))
        elif s.get("codec_type") == "audio":
            acodec = s.get("codec_name")
    return {"vcodec": vcodec, "acodec": acodec, "width": width, "height": height, "fps": fps}


def build_ffmpeg_cmd(path: str, probe: dict) -> list:
    vcodec = probe["vcodec"]
    acodec = probe["acodec"]
    height = probe["height"]
    fps = probe.get("fps", 0.0)

    can_remux = (vcodec == "h264" and acodec == "aac" and height <= MAX_VIDEO_DIM)

    cmd = ["ffmpeg", "-y", "-nostdin", "-hide_banner", "-loglevel", "error", "-i", path]

    if can_remux:
        cmd += ["-c", "copy"]
    else:
        filters = []
        if fps > MAX_VIDEO_FPS:
            filters.append(f"fps={MAX_VIDEO_FPS}")
        if height > MAX_VIDEO_DIM:
            filters.append(f"scale=-2:{MAX_VIDEO_DIM}")
        if filters:
            cmd += ["-vf", ",".join(filters)]
        needs_video_recode = bool(filters) or (vcodec != "h264")
        if needs_video_recode:
            cmd += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                    "-g", str(VIDEO_GOP),
                    "-profile:v", "high", "-level", "4.0", "-pix_fmt", "yuv420p"]
        else:
            cmd += ["-c:v", "copy"]
        if acodec != "aac":
            cmd += ["-c:a", "aac", "-b:a", "128k"]
        else:
            cmd += ["-c:a", "copy"]

    cmd += ["-movflags", "frag_keyframe+empty_moov+default_base_moof", "-f", "mp4", "pipe:1"]
    return cmd


async def stream_ffmpeg(cmd: list):
    async with _transcode_semaphore:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stderr_lines = []

        async def drain_stderr():
            while True:
                line = await proc.stderr.readline()
                if not line:
                    break
                stderr_lines.append(line.decode("utf-8", "replace"))
                if len(stderr_lines) > 50:
                    stderr_lines.pop(0)

        stderr_task = asyncio.create_task(drain_stderr())
        try:
            while True:
                chunk = await proc.stdout.read(65536)
                if not chunk:
                    break
                yield chunk
        finally:
            if proc.returncode is None:
                proc.terminate()
                try:
                    await asyncio.wait_for(proc.wait(), timeout=5)
                except asyncio.TimeoutError:
                    proc.kill()
                    await proc.wait()
            await stderr_task
            if proc.returncode not in (0, None):
                logger.error("ffmpeg exited %s: %s", proc.returncode, "".join(stderr_lines[-5:]))


def create_api(scanner, config):
    router = APIRouter()

    @router.get("/albums")
    def get_albums(
        sort_by: Optional[str] = Query(None, description="Sort field: name, date, count"),
        sort_order: Optional[str] = Query(None, description="asc or desc"),
    ):
        if sort_by not in (None, "name", "date", "count"):
            raise HTTPException(status_code=400, detail="Invalid sort_by")
        if sort_order not in (None, "asc", "desc"):
            raise HTTPException(status_code=400, detail="Invalid sort_order")

        result = []
        for name, media in scanner.get_albums(sort_by, sort_order):
            result.append({
                "name": name,
                "count": len(media),
                "cover": scanner.get_album_cover(name),
            })
        return JSONResponse(result)

    @router.get("/album/{album_name:path}")
    def get_album(album_name: str):
        albums = scanner.scan()
        if album_name not in albums:
            raise HTTPException(status_code=404, detail="Album not found")
        return JSONResponse(albums[album_name])

    @router.get("/media/{album_name:path}/{filename:path}")
    def get_media(album_name: str, filename: str):
        albums = scanner.scan()
        media = albums.get(album_name, [])
        for m in media:
            if m["name"] == filename:
                path = m["path"]
                if m["is_video"]:
                    if not HAVE_FFMPEG:
                        raise HTTPException(status_code=501, detail="ffmpeg is required for video playback but was not found")
                    try:
                        probe = probe_video(path)
                        cmd = build_ffmpeg_cmd(path, probe)
                        return StreamingResponse(
                            stream_ffmpeg(cmd),
                            media_type="video/mp4",
                            headers={"Accept-Ranges": "none"},
                        )
                    except HTTPException:
                        raise
                    except Exception as e:
                        raise HTTPException(status_code=500, detail=f"Transcoding failed: {str(e)}")
                if m["extension"] in ("heic", "heif"):
                    if not HAVE_HEIF:
                        raise HTTPException(status_code=501, detail="HEIC support not installed")
                    try:
                        img = Image.open(path)
                        img.load()
                    except Exception:
                        raise HTTPException(status_code=415, detail="Unsupported or corrupt image file")
                    if img.format in HEIF_FORMATS:
                        img = ImageOps.exif_transpose(img)
                        buf = io.BytesIO()
                        img.convert("RGB").save(buf, format="JPEG", quality=85)
                        buf.seek(0)
                        return Response(content=buf.read(), media_type="image/jpeg")
                    actual_type = Image.MIME.get(img.format)
                    return FileResponse(path, media_type=actual_type) if actual_type else FileResponse(path)
                return FileResponse(path)
        raise HTTPException(status_code=404, detail="Media not found")

    @router.get("/health")
    def health():
        return {"status": "ok"}

    return router
