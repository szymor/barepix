import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple


class MediaScanner:
    def __init__(self, root_dir: str, extensions: set, sort_by: str = "name", sort_order: str = "asc"):
        self.root_dir = Path(root_dir)
        self.extensions = extensions
        self.default_sort_by = sort_by
        self.default_sort_order = sort_order
        self._cache: Optional[Dict] = None

    def scan(self) -> Dict:
        if self._cache is not None:
            return self._cache

        albums = {}
        if not self.root_dir.exists():
            self._cache = albums
            return albums

        for dirpath, dirnames, filenames in os.walk(self.root_dir):
            dir_path = Path(dirpath)
            if dir_path == self.root_dir:
                continue

            rel_path = dir_path.relative_to(self.root_dir)
            album_name = str(rel_path)

            media_files = self._scan_folder(dir_path)
            if media_files:
                albums[album_name] = media_files

        self._cache = albums
        return albums

    def get_albums(self, sort_by: Optional[str] = None, sort_order: Optional[str] = None) -> List[Tuple[str, List[Dict]]]:
        albums = self.scan()
        sort_by = sort_by or self.default_sort_by
        sort_order = sort_order or self.default_sort_order
        reverse = sort_order == "desc"

        items = list(albums.items())
        if sort_by == "date":
            items.sort(key=lambda x: self._dir_mtime(x[0]), reverse=reverse)
        elif sort_by == "count":
            items.sort(key=lambda x: len(x[1]), reverse=reverse)
        else:
            items.sort(key=lambda x: x[0].lower(), reverse=reverse)
        return items

    def _dir_mtime(self, album_name: str) -> float:
        try:
            return (self.root_dir / album_name).stat().st_mtime
        except OSError:
            return 0.0

    def _scan_folder(self, folder: Path) -> List[Dict]:
        files = []
        try:
            for f in sorted(folder.iterdir()):
                if f.is_file() and f.suffix.lstrip(".").lower() in self.extensions:
                    ext = f.suffix.lstrip(".").lower()
                    files.append({
                        "name": f.name,
                        "path": str(f),
                        "extension": ext,
                        "is_video": ext in ["mp4", "mov", "mkv"],
                        "size": f.stat().st_size,
                    })
        except PermissionError:
            pass
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
