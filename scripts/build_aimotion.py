#!/usr/bin/env python3
"""Build the aimotion demo catalog (166 demos, 12 groups) for the hub.

Source of truth is the cokacmotion skill index:
  <cokacmotion>/skills/aimotion/index.json
Outputs:
  data/aimotion.json                    (repo copy, same bytes as the frontend snapshot)
  frontend/public/data/aimotion.json    (static-mode snapshot served by the SPA)

Categories = the skill's own 12 groups (stable English slugs). Tags = a curated rule set
over each demo's `libraries` and `tech` string, so library sections (three.js, GSAP, …)
and technique families (셰이더, 타이포, 광학 …) are both browsable. A demo with no rule
match falls back to its category as a tag, so nothing is untagged.

Usage: build_aimotion.py [index.json path]
Env:   COKACMOTION_INDEX, SITE_BASE (default https://dogebi.github.io/cokacmotion)
"""
import json
import os
import re
import sys
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_BASE = os.environ.get("SITE_BASE", "https://dogebi.github.io/cokacmotion").rstrip("/")
REPO_URL = "https://github.com/dogebi/cokacmotion"
DEFAULT_INDEX = os.environ.get(
    "COKACMOTION_INDEX", "/mnt/d/dev/cokacmotion/skills/aimotion/index.json"
)

# category name -> slug (stable URL segment; the Korean names are not URL-safe)
GROUP_SLUGS = {
    "웹 그래픽 기법": "web-graphics",
    "아날로그 표현": "analog",
    "웹 플랫폼 기술": "web-platform",
    "자연 현상 · 광학 · 수학": "nature-optics",
    "실험 타이포그래피": "experimental-type",
    "GSAP": "gsap-group",
    "유명 라이브러리": "libraries",
    "웹 네이티브 애니메이션": "web-native-animation",
    "영상 표현력": "video-craft",
    "타이포그래피 모션그래픽": "type-motion",
    "모션그래픽 디자인": "motion-design",
    "3D 장면": "3d-scenes",
}

# library name -> (slug, label)
LIBRARY_TAGS = {
    "three.js": ("three-js", "three.js"),
    "GSAP": ("gsap", "GSAP"),
    "opentype.js": ("opentype", "opentype.js"),
    "d3": ("d3", "d3"),
    "world-atlas": ("geo-data", "지도 데이터"),
    "Rapier2D": ("physics", "물리 엔진"),
    "rough.js": ("roughjs", "rough.js"),
    "perfect-freehand": ("freehand", "freehand"),
    "PixiJS": ("pixijs", "PixiJS"),
    "anime.js": ("anime-js", "anime.js"),
    "Motion": ("motion", "Motion"),
    "lottie-web": ("lottie", "Lottie"),
    "p5.js": ("p5js", "p5.js"),
    "Paper.js": ("paperjs", "Paper.js"),
    "Zdog": ("zdog", "Zdog"),
    "matter-js": ("matter-js", "matter-js"),
    "mo.js": ("mojs", "mo.js"),
    "Babylon.js": ("babylon", "Babylon.js"),
    "Tone.js": ("tone-js", "Tone.js"),
}

# (regex over the lowercased `tech` string, slug, label)
TECH_TAGS = [
    (r"fe ?turbulence|fe ?displacement|svg ?필터", "svg-filter", "SVG 필터"),
    (r"\bsvg\b|smil", "svg", "SVG"),
    (r"webgpu|wgsl", "webgpu", "WebGPU"),
    (r"webgl|glsl|shader|셰이더|raymarch|레이마칭|\bsdf\b|프래그먼트|volumetric|볼류메트릭|거리장", "shader", "셰이더"),
    (r"\bcss\b|keyframes|preserve-3d|@keyframes", "css", "CSS"),
    (r"canvas 2d|\bcanvas\b", "canvas", "Canvas 2D"),
    (r"\bthree\b|three\.js|\b3d\b|아이소메트릭|턴테이블|터테이블|isometric", "3d", "3D"),
    (r"particle|입자|점구름|point cloud|군집|murmuration|swarm|스미어", "particles", "입자"),
    (r"physics|물리|rapier|matter|cloth|천 시뮬|fracture|파괴|보행|스프링", "physics", "물리"),
    (r"시뮬레이션|simulation|fluid|유체|반응-확산|reaction|diffusion|침식|erosion|성장|growth|유속|curl|파동 방정식|wave equation", "simulation", "시뮬레이션"),
    (r"gpgpu|비토닉|bitonic|정렬망|픽셀 정렬", "gpu", "GPU 컴퓨트"),
    (r"광학|간섭|분산|굴절|프리즘|prism|커스틱|caustic|프레넬|fresnel|스펙트럼|박막|thin-film|색수차|lens", "optics", "광학·빛"),
    (r"typography|타이포|글자|활자|\btype\b|glyph|글리프|lettering|자간|조판|모아쓰기|한글|글꼴|font", "typography", "타이포그래피"),
    (r"audio|오디오|사운드|웨이브폼|waveform|tone\.js|beat|립싱크", "audio", "오디오·사운드"),
    (r"자막|caption|subtitle|karaoke|노래방|타이틀 시퀀스|title sequence|엔딩 크레딧|크레딧", "captions", "자막·타이틀"),
    (r"카메라|camera|줌|\bzoom\b|parallax|시차|멀티플레인|dolly|1인칭|pov", "camera", "카메라·시차"),
    (r"색 보정|color grade|grade|\blut\b|relight|재조명|lighting|조명|스포트라이트|틸트시프트", "color", "색·조명"),
    (r"dataviz|데이터 ?시각화|chart|차트|graph|그래프|통계|아이소타입|통계 지도|\bmap\b|지도|\broute\b|경로", "data-viz", "데이터 시각화"),
    (r"절차|procedural|프랙털|fractal|노이즈|noise|fbm|generative|타일|truchet|패턴", "procedural", "절차 생성"),
    (r"수채화|유화|판화|필름|목탄|붓|먹|웹툰|risograph|woodcut|super8|vhs|폴라로이드|polaroid|암실|활판|자수|neon|네온|marbling|마블링|stained glass|letterpress|종이|스톱모션|조이트로프|원통|스트로보|실크스크린|스텐실", "analog", "아날로그 재료"),
    (r"전환|transition|reveal|sting|pop ?out|팝아웃|dissolve|와이프|비교 장면|장면 전환", "transition", "전환·리빌"),
    (r"시간 재매핑|타임랩스|time-lapse|루프|speed ramp|속도 곡선|시간 압축", "time", "시간 연출"),
    (r"리그|rig|표정|마스코트|캐릭터|관절|스프라이트", "character", "캐릭터"),
    (r"주석|annotation|오도미터|계기|HUD|시선 유도|메신저|말풍선|대화", "ui-scene", "UI·주석"),
]

TAG_LABELS = {}


def tags_for(demo: dict, group_name: str, group_slug: str) -> list[str]:
    slugs: list[str] = []

    def add(slug: str, label: str) -> None:
        if slug not in slugs:
            slugs.append(slug)
        TAG_LABELS.setdefault(slug, label)

    for lib in demo.get("libraries") or []:
        if lib in LIBRARY_TAGS:
            add(*LIBRARY_TAGS[lib])

    tech = (demo.get("tech") or "").lower()
    for pattern, slug, label in TECH_TAGS:
        if slug not in slugs and re.search(pattern, tech):
            add(slug, label)

    if not slugs:  # keep the catalog fully tagged: fall back to the category itself
        add(group_slug, group_name)
    return slugs


def main() -> None:
    index_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_INDEX
    with open(index_path, encoding="utf-8") as f:
        src = json.load(f)

    groups = []
    for i, g in enumerate(src["groups"]):
        slug = GROUP_SLUGS.get(g["name"]) or f"group-{i + 1}"
        groups.append(
            {
                "slug": slug,
                "name": g["name"],
                "description": g["description"],
                "sort_order": i + 1,
                "demo_count": sum(1 for d in src["demos"] if d["group"] == g["name"]),
            }
        )
    group_slug = {g["name"]: g["slug"] for g in groups}

    demos = []
    for d in sorted(src["demos"], key=lambda x: x["number"]):
        slug = group_slug[d["group"]]
        demos.append(
            {
                "id": d["id"],
                "number": d["number"],
                "title": d["title"],
                "tech": d["tech"],
                "group": slug,
                "group_name": d["group"],
                "tags": tags_for(d, d["group"], slug),
                "libraries": d.get("libraries") or [],
                "points": (d.get("points") or [])[:4],
                "scene": d.get("scene") or "",
                "live_url": f"{SITE_BASE}/{d['id']}/",
                "poster_url": f"{SITE_BASE}/{d['id']}/out/poster.jpg" if d.get("poster") else "",
                "notes_url": f"{REPO_URL}/blob/main/skills/aimotion/demos/{d['id']}/NOTES.md",
            }
        )

    counts: dict[str, int] = {}
    for d in demos:
        for t in d["tags"]:
            counts[t] = counts.get(t, 0) + 1
    tags = [
        {"slug": s, "name": TAG_LABELS[s], "demo_count": n}
        for s, n in sorted(counts.items(), key=lambda kv: (-kv[1], TAG_LABELS[kv[0]]))
    ]

    catalog = {
        "source": index_path,
        "site": SITE_BASE,
        "repo": REPO_URL,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "count": len(demos),
        "group_count": len(groups),
        "groups": groups,
        "tags": tags,
        "demos": demos,
    }

    for path in (
        os.path.join(ROOT, "data", "aimotion.json"),
        os.path.join(ROOT, "frontend", "public", "data", "aimotion.json"),
    ):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(catalog, f, ensure_ascii=False, indent=1)
        print(f"wrote {path} ({os.path.getsize(path)} bytes)")

    untagged = [d["id"] for d in demos if not d["tags"]]
    print(f"aimotion: {len(demos)} demos, {len(groups)} groups, {len(tags)} tags")
    print("  groups:", ", ".join(f"{g['slug']} {g['demo_count']}" for g in groups))
    print("  tags:", ", ".join(f"{t['name']}={t['demo_count']}" for t in tags))
    if untagged:
        print(f"  warn: {len(untagged)} untagged: {', '.join(untagged[:10])}", file=sys.stderr)


if __name__ == "__main__":
    main()
