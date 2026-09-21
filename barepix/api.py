from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse


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
                    media_type = "video/mp4" if m["extension"] == "mp4" else "video/quicktime" if m["extension"] == "mov" else "video/x-matroska"
                    return FileResponse(path, media_type=media_type, filename=m["name"])
                return FileResponse(path)
        raise HTTPException(status_code=404, detail="Media not found")

    @router.get("/health")
    def health():
        return {"status": "ok"}

    return router
