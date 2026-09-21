import os
from pathlib import Path
from typing import Dict, List, Optional


class MediaScanner:
    def __init__(self, root_dir: str, extensions: set):
        self.root_dir = Path(root_dir)
        self.extensions = extensions
        self._cache: Optional[Dict] = None

    def scan(self) -> Dict:
        if self._cache is not None:
            return self._cache

        albums = {}
        if not self.root_dir.exists():
            return albums

        for entry in sorted(self.root_dir.iterdir()):
            if not entry.is_dir():
                continue
            album_name = entry.name
            media_files = self._scan_folder(entry)
            if media_files:
                albums[album_name] = media_files

        self._cache = albums
        return albums

    def _scan_folder(self, folder: Path) -> List[Dict]:
        files = []
        for f in sorted(folder.iterdir()):
            if f.is_file() and f.suffix.lstrip(".").lower() in self.extensions:
                files.append({
                    "name": f.name,
                    "path": str(f),
                    "extension": f.suffix.lstrip(".").lower(),
                    "is_video": f.suffix.lstrip(".").lower() in ["mp4", "mov", "mkv"],
                    "size": f.stat().st_size,
                })
        return files

    def invalidate_cache(self):
        self._cache = None

    def get_album_cover(self, album_name: str) -> Optional[str]:
        albums = self.scan()
        media = albums.get(album_name, [])
        for m in media:
            if not m["is_video"]:
                return m["path"]
        if media:
            return media[0]["path"]
        return None
