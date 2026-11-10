#!/usr/bin/env python3
"""Turn raw yt-dlp metadata (NDJSON) into the hub seed file (data/seed.json).

Usage: python3 scripts/build_seed.py /tmp/ess/videos.ndjson

Taxonomy is derived from what the channel actually publishes, not invented:
  그림 퀴즈   — 틀린 그림 / 못 맞추는 이미지 시리즈
  웹앱 데모   — 직접 만든 웹앱 링크를 붙인 클립
  날짜 클립   — 제목이 날짜로만 기록된 짧은 컷
  사운드·기타 — 음식·음악 등 단발 소재
"""
import json
import re
import sys
from datetime import datetime, timezone

CATEGORIES = [
    {
        "slug": "puzzle",
        "name": "그림 퀴즈",
        "description": "틀린 그림 찾기, 100% 못 맞추는 이미지 시리즈. 한 장면에서 다른 곳을 찾는 클립입니다.",
        "sort_order": 1,
    },
    {
        "slug": "web-demo",
        "name": "웹앱 데모",
        "description": "직접 만든 웹앱을 링크와 함께 남긴 클립. 지금도 열어 볼 수 있는 것들입니다.",
        "sort_order": 2,
    },
    {
        "slug": "daily-clip",
        "name": "날짜 클립",
        "description": "날짜로만 기록해 둔 짧은 컷 모음. 만든 날의 스냅샷입니다.",
        "sort_order": 3,
    },
    {
        "slug": "misc",
        "name": "사운드·기타",
        "description": "음식·음악처럼 시리즈로 묶이지 않는 단발 소재.",
        "sort_order": 4,
    },
]

TAGS = [
    ("그림찾기", "그림찾기"),
    ("quiz", "퀴즈"),
    ("webapp", "웹앱"),
    ("netlify", "Netlify"),
    ("clip", "클립"),
    ("music", "음악"),
    ("food", "음식"),
    ("shorts", "쇼츠"),
]

DATE_TITLE = re.compile(r"^\d{4}年\d{1,2}月\d{1,2}日$")
PUZZLE = re.compile(r"(틀린\s*그림|못\s*맞추|못맞추|이미지\s*찾기)")


def classify(title: str, description: str):
    text = f"{title} {description}"
    cats, tags = [], []
    if PUZZLE.search(text):
        cats.append("puzzle")
        tags += ["그림찾기", "quiz"]
    if "netlify.app" in text or "http" in text:
        cats.append("web-demo")
        tags += ["webapp", "netlify"]
    if DATE_TITLE.match(title.strip()):
        cats.append("daily-clip")
        tags.append("clip")
    if not cats:
        cats.append("misc")
        if re.search(r"(짜장면|음식|먹)", text):
            tags.append("food")
        if re.search(r"(POP|음악|노래|사운드)", text, re.I):
            tags.append("music")
    tags.append("shorts")
    # stable order, no duplicates
    seen, ordered = set(), []
    for t in tags:
        if t not in seen:
            seen.add(t)
            ordered.append(t)
    return cats, ordered


def iso(published: str) -> str:
    if published:
        dt = datetime.strptime(published, "%Y%m%d").replace(tzinfo=timezone.utc)
        return dt.isoformat().replace("+00:00", "Z")
    return datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z")


def main(path: str) -> None:
    recs = [json.loads(line) for line in open(path, encoding="utf-8") if line.strip()]
    videos, seen = [], set()
    for r in recs:
        vid = r.get("id")
        if not vid or vid in seen:
            continue
        seen.add(vid)
        title = (r.get("title") or "").strip()
        description = (r.get("description") or "").strip()
        duration = int(r.get("duration") or 0)
        cats, tags = classify(title, description)
        videos.append(
            {
                "id": vid,
                "title": title or vid,
                "description": description,
                "published_at": iso(r.get("upload_date") or ""),
                "duration_seconds": duration,
                "kind": "short" if duration <= 60 else "long",
                "thumbnail_url": f"https://i.ytimg.com/vi/{vid}/hq720.jpg",
                "view_count": int(r.get("view_count") or 0),
                "like_count": int(r.get("like_count") or 0),
                "weekly_views": None,
                "categories": cats,
                "tags": tags,
            }
        )
    videos.sort(key=lambda v: v["published_at"], reverse=True)
    seed = {
        "source": "https://www.youtube.com/@essential911",
        "generated_at": datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z"),
        "categories": CATEGORIES,
        "tags": [{"slug": s, "name": n} for s, n in TAGS],
        "videos": videos,
    }
    out = "data/seed.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(seed, f, ensure_ascii=False, indent=2)
    per_cat = {}
    for v in videos:
        for c in v["categories"]:
            per_cat[c] = per_cat.get(c, 0) + 1
    print(f"wrote {out}: {len(videos)} videos, {len(CATEGORIES)} categories, {len(TAGS)} tags")
    print("category counts:", per_cat)
    print("kinds:", {k: sum(1 for v in videos if v['kind'] == k) for k in ('short', 'long')})


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/ess/videos.ndjson")
