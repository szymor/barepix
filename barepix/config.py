import yaml
from dataclasses import dataclass, field
from typing import List


@dataclass
class GalleryConfig:
    title: str = "BarePix Gallery"
    root_dir: str = "./photos"
    host: str = "127.0.0.1"
    port: int = 8081
    password: str = ""
    images_extensions: List[str] = field(default_factory=lambda: ["jpg", "jpeg", "png", "webp", "heic", "heif"])
    videos_extensions: List[str] = field(default_factory=lambda: ["mp4", "mov", "mkv"])

    @classmethod
    def from_yaml(cls, path: str = "config.yaml") -> "GalleryConfig":
        with open(path) as f:
            data = yaml.safe_load(f)
        g = data.get("gallery", {})
        return cls(
            title=g.get("title", "BarePix Gallery"),
            root_dir=g.get("root_dir", "./photos"),
            host=g.get("host", "127.0.0.1"),
            port=g.get("port", 8081),
            password=g.get("password", ""),
            images_extensions=g.get("allowed_extensions", {}).get("images", ["jpg", "jpeg", "png", "webp", "heic", "heif"]),
            videos_extensions=g.get("allowed_extensions", {}).get("videos", ["mp4", "mov", "mkv"]),
        )

    @property
    def supported_extensions(self) -> set:
        return set(self.images_extensions + self.videos_extensions)
