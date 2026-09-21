import uvicorn
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from pathlib import Path
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from barepix.config import GalleryConfig
from barepix.scanner import MediaScanner
from barepix.api import create_api


def create_app(config: GalleryConfig = None) -> FastAPI:
    if config is None:
        config = GalleryConfig.from_yaml()

    scanner = MediaScanner(config.root_dir, config.supported_extensions)

    app = FastAPI(title=config.title, docs_url=None, redoc_url=None)
    app.include_router(create_api(scanner, config), prefix="/api")

    @app.get("/", response_class=HTMLResponse)
    def index(request: Request):
        html_path = Path(__file__).parent / "templates" / "index.html"
        return FileResponse(html_path)

    @app.get("/static/{path:path}")
    def static_assets(path: str):
        static_path = Path(__file__).parent / "static" / path
        if static_path.exists():
            ext = static_path.suffix.lstrip(".")
            mime_types = {
                "css": "text/css",
                "js": "application/javascript",
                "png": "image/png",
                "jpg": "image/jpeg",
                "jpeg": "image/jpeg",
                "svg": "image/svg+xml",
                "ico": "image/x-icon",
            }
            media_type = mime_types.get(ext, "application/octet-stream")
            return FileResponse(static_path, media_type=media_type)
        raise HTTPException(status_code=404)

    return app


def main():
    config = GalleryConfig.from_yaml()
    app = create_app(config)
    uvicorn.run(app, host=config.host, port=config.port)


if __name__ == "__main__":
    main()
