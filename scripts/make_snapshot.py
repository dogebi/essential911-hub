#!/usr/bin/env python3
"""Bake the live API responses into frontend/public/data/*.json for static hosting."""
import json
import os
import sys
import urllib.parse
import urllib.request

API = os.environ.get("API_BASE", "http://127.0.0.1:8099")
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "public", "data")


def opener():
    # never route loopback through the ambient proxy
    return urllib.request.build_opener(urllib.request.ProxyHandler({}))


def get(path: str):
    req = urllib.request.Request(f"{API}{path}", headers={"Accept": "application/json"})
    with opener().open(req, timeout=30) as r:
        return json.load(r)


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    home = get("/api/home")
    categories = get("/api/categories")
    tags = get("/api/tags")

    videos, offset, limit = [], 0, 60
    while True:
        page = get(f"/api/videos?limit={limit}&offset={offset}")
        videos.extend(page["items"])
        total = page["total"]
        offset += limit
        if offset >= total:
            break
        if len(videos) >= 500:
            break

    # hydrate descriptions from the detail endpoint so the static build keeps them
    for v in videos:
        try:
            detail = get(f"/api/videos/{urllib.parse.quote(v['id'])}")["video"]
            v["description"] = detail.get("description", "")
        except Exception as exc:  # noqa: BLE001
            print(f"warn: detail {v['id']} failed: {exc}", file=sys.stderr)

    files = {
        "home.json": home,
        "videos.json": {"items": videos, "total": len(videos)},
        "categories.json": categories,
        "tags.json": tags,
    }
    for name, payload in files.items():
        path = os.path.join(OUT, name)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=1)
        print(f"wrote {path} ({os.path.getsize(path)} bytes)")
    print(f"snapshot: {len(videos)} videos, {len(categories)} categories, {len(tags)} tags")


if __name__ == "__main__":
    main()
