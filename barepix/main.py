import hmac
import uvicorn
from fastapi import FastAPI, Request, HTTPException, Form
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware
from pathlib import Path
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from barepix.config import GalleryConfig
from barepix.scanner import MediaScanner
from barepix.api import create_api

COOKIE_NAME = "bp_auth"


def _check_auth(request: Request, config: GalleryConfig) -> bool:
    if not config.password:
        return True
    cookie = request.cookies.get(COOKIE_NAME)
    return bool(cookie) and hmac.compare_digest(cookie, config.password)


class AuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, config: GalleryConfig):
        super().__init__(app)
        self.config = config

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path.startswith("/static") or path.startswith("/api/auth"):
            return await call_next(request)
        if self.config.password and path.startswith("/api"):
            if not _check_auth(request, self.config):
                return JSONResponse({"detail": "Unauthorized"}, status_code=401)
        return await call_next(request)


def create_app(config: GalleryConfig = None) -> FastAPI:
    if config is None:
        config = GalleryConfig.from_yaml()

    scanner = MediaScanner(config.root_dir, config.supported_extensions, config.sort_by, config.sort_order)

    app = FastAPI(title=config.title, docs_url=None, redoc_url=None)
    app.add_middleware(AuthMiddleware, config=config)

    app.include_router(create_api(scanner, config), prefix="/api")

    @app.get("/api/auth/status")
    def auth_status():
        return {"auth_required": bool(config.password)}

    @app.post("/api/auth/login")
    def auth_login(password: str = Form(...)):
        if not config.password:
            raise HTTPException(status_code=400, detail="Authentication is not configured")
        if not hmac.compare_digest(password, config.password):
            raise HTTPException(status_code=401, detail="Invalid password")
        resp = RedirectResponse(url="/", status_code=303)
        resp.set_cookie(COOKIE_NAME, config.password, httponly=True, samesite="lax", max_age=86400 * 30)
        return resp

    @app.get("/api/auth/logout")
    def auth_logout():
        resp = RedirectResponse(url="/", status_code=303)
        resp.delete_cookie(COOKIE_NAME)
        return resp

    @app.get("/")
    def index(request: Request):
        if not _check_auth(request, config):
            html_path = Path(__file__).parent / "templates" / "login.html"
            return FileResponse(html_path, headers={"Cache-Control": "no-cache"})
        html_path = Path(__file__).parent / "templates" / "index.html"
        return FileResponse(html_path, headers={"Cache-Control": "no-cache"})

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
            return FileResponse(static_path, media_type=media_type, headers={"Cache-Control": "no-cache"})
        raise HTTPException(status_code=404)

    return app


def main():
    config = GalleryConfig.from_yaml()
    app = create_app(config)
    uvicorn.run(app, host=config.host, port=config.port)


if __name__ == "__main__":
    main()
