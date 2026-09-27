#!/usr/bin/env python3
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SOURCE_URL = "https://raw.githubusercontent.com/Pippo26442999/.exFAT/main/exFAT.json"
GAMES_PATH = Path("games.json")
LANG_OVERRIDES_PATH = Path("language-overrides.json")

TITLE_ID_RE = re.compile(r"\b([A-Z]{4}\d{5})\b")
VERSION_RE = re.compile(r"\bv(\d+(?:\.\d+)+)\b", re.I)
FW_BACKPORT_RE = re.compile(r"(\d+\.xx)\s*backpor[kt]", re.I)
FW_STANDARD_RE = re.compile(r"standard\s*\(?\s*(\d+\.xx)", re.I)
FW_BEYOND_RE = re.compile(r"(\d+\.xx)\s*and\s*beyond", re.I)

FPKG_AKIA_FIELDS = (
    ("fpkg_backport_akia", "FPKG BACKPORT"),
    ("fpkg_akia", "FPKG"),
    ("fpkg_standard_akia", "FPKG STANDARD"),
)

def clean(value):
    if not isinstance(value, str):
        return ""
    return " ".join(value.replace("\u00a0", " ").split()).strip()

def source_fetch():
    req = urllib.request.Request(
        SOURCE_URL,
        headers={"User-Agent": "zer0game-fpkg-metadata-sync/1.0"},
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        raw = response.read()
    data = json.loads(raw.decode("utf-8"))
    if not isinstance(data, list):
        raise RuntimeError("Source exFAT.json is not a JSON array")
    return data

def has_fpkg(item):
    if not isinstance(item, dict):
        return False
    if clean(item.get("fpkg_size")):
        return True
    for key, value in item.items():
        if key.startswith("fpkg_") and clean(value):
            return True
    return False

def is_direct_akirabox(value):
    value = clean(value)
    if not value:
        return False
    try:
        from urllib.parse import urlparse
        host = (urlparse(value).hostname or "").lower()
    except Exception:
        return False
    return (
        host == "akirabox.com"
        or host.endswith(".akirabox.com")
        or host == "akirabox.to"
        or host.endswith(".akirabox.to")
    )

def preferred_direct_akia(item):
    for field, label in FPKG_AKIA_FIELDS:
        value = clean(item.get(field))
        if is_direct_akirabox(value):
            return value, label
    return "", ""

def title_id_from_tags(item):
    tags = item.get("tags") if isinstance(item.get("tags"), list) else []
    for tag in tags:
        match = TITLE_ID_RE.search(clean(tag))
        if match:
            return match.group(1)
    for value in (item.get("titleId"), item.get("title_id"), item.get("ppsA"), item.get("ppsa")):
        match = TITLE_ID_RE.search(clean(value))
        if match:
            return match.group(1)
    return ""

def version_from_item(item):
    direct = clean(item.get("version"))
    if direct:
        return direct.lstrip("vV")
    tags = item.get("tags") if isinstance(item.get("tags"), list) else []
    for tag in tags:
        match = VERSION_RE.search(clean(tag))
        if match:
            return match.group(1)
    return ""

def firmware_from_item(item):
    tags = [clean(x) for x in item.get("tags", []) if clean(x)]
    for tag in tags:
        m = FW_BACKPORT_RE.search(tag)
        if m:
            return f"{m.group(1)} BackPort"
    for tag in tags:
        m = FW_STANDARD_RE.search(tag)
        if m:
            return m.group(1)
    for tag in tags:
        m = FW_BEYOND_RE.search(tag)
        if m:
            return f"{m.group(1)} and beyond"
    return ""

def source_notes(item):
    parts = []
    tags = [clean(x) for x in item.get("tags", []) if clean(x)]
    useful_tags = [
        t for t in tags
        if not TITLE_ID_RE.search(t) and not VERSION_RE.search(t)
    ]
    if useful_tags:
        parts.append(". ".join(useful_tags))

    credits = (
        ("Files credit", item.get("credits_files")),
        ("Backport credit", item.get("credits_backport")),
        ("DLC credit", item.get("credits_dlc") or item.get("credits_dlcs")),
        ("FPKG credit", item.get("credits_fpkg") or item.get("fpkg_author")),
    )
    for label, value in credits:
        value = clean(value)
        if value:
            parts.append(f"{label}: {value}")

    how_to = clean(item.get("how_to_play"))
    if how_to:
        parts.append(how_to)

    text = ". ".join(p.rstrip(".") for p in parts if p)
    return (text + ".") if text else ""

def load_language_overrides():
    if not LANG_OVERRIDES_PATH.exists():
        return {}
    data = json.loads(LANG_OVERRIDES_PATH.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}

def valid_languages(value):
    if not isinstance(value, dict):
        return {"text": [], "audio": []}
    text = value.get("text") if isinstance(value.get("text"), list) else []
    audio = value.get("audio") if isinstance(value.get("audio"), list) else []
    return {
        "text": [clean(x) for x in text if clean(x)],
        "audio": [clean(x) for x in audio if clean(x)],
    }

def language_override_for(overrides, title_id, title):
    composite = f"{title_id}|{title}"
    if composite in overrides:
        return valid_languages(overrides.get(composite, {}))
    return valid_languages(overrides.get(title_id, {}))

def build_new_game(item, title_id, overrides, direct_url, download_label):
    title = clean(item.get("title"))
    language_override = language_override_for(overrides, title_id, title)
    source_image = clean(item.get("image"))

    # No source download URL is copied into the destination catalog.
    # New covers may use the source image only when creating a brand-new entry;
    # existing covers are never overwritten by this synchronizer.
    game = {
        "title": title,
        "titleId": title_id,
        "version": version_from_item(item),
        "firmware": firmware_from_item(item),
        "size": clean(item.get("fpkg_size")) or clean(item.get("size")),
        "status": "released",
        "date": clean(item.get("date")),
        "cover": source_image,
        "languages": language_override,
        "notes": source_notes(item),
        "releaseUrl": "",
        "infoUrl": "",
        "languageSource": "verified override" if (language_override["text"] or language_override["audio"]) else "",
        "directUrl": direct_url,
        "downloadLabel": download_label,
        "dlcAvailable": False,
        "genres": [],
        "ps5Frame": True,
    }
    return game

def merge():
    source = source_fetch()
    dest = json.loads(GAMES_PATH.read_text(encoding="utf-8"))
    games = dest.get("games", [])
    if not isinstance(games, list):
        raise RuntimeError("games.json: games must be an array")

    overrides = load_language_overrides()
    by_id = {}
    for game in games:
        tid = clean(game.get("titleId"))
        if tid:
            by_id.setdefault(tid, []).append(game)

    added = 0
    updated = 0
    skipped_no_akia = 0
    skipped_no_id = 0

    for item in source:
        if not has_fpkg(item):
            continue

        # Only direct Akirabox FPKG mirrors are eligible. Link Lock is never stored.
        direct_url, download_label = preferred_direct_akia(item)
        if not direct_url:
            skipped_no_akia += 1
            continue

        title_id = title_id_from_tags(item)
        title = clean(item.get("title"))
        if not title_id or not title:
            skipped_no_id += 1
            continue

        candidates = by_id.get(title_id, [])
        current = next((g for g in candidates if clean(g.get("title")).casefold() == title.casefold()), None)
        if current is None and len(candidates) == 1:
            current = candidates[0]

        if current is None:
            new_game = build_new_game(item, title_id, overrides, direct_url, download_label)
            games.append(new_game)
            by_id.setdefault(title_id, []).append(new_game)
            added += 1
            continue

        before = json.dumps(current, sort_keys=True, ensure_ascii=False)

        # Existing cover is intentionally never touched.
        current["version"] = version_from_item(item) or current.get("version", "")
        current["firmware"] = firmware_from_item(item) or current.get("firmware", "")
        current["size"] = clean(item.get("fpkg_size")) or current.get("size", "")
        current["notes"] = source_notes(item) or current.get("notes", "")
        current["directUrl"] = direct_url
        current["downloadLabel"] = download_label
        current.pop("purchaseUrl", None)

        override = language_override_for(overrides, title_id, title)
        if override["text"] or override["audio"]:
            current["languages"] = override
            current["languageSource"] = "verified override"
        else:
            current["languages"] = valid_languages(current.get("languages", {}))

        after = json.dumps(current, sort_keys=True, ensure_ascii=False)
        if before != after:
            updated += 1

    serialized = json.dumps(games, ensure_ascii=False)
    if "library-decrypt" in serialized or "link-lock-pippo" in serialized:
        raise RuntimeError("Refusing to write games.json because Link Lock is present")

    dest["games"] = games
    dest["updated"] = datetime.now(timezone.utc).date().isoformat()
    GAMES_PATH.write_text(json.dumps(dest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    missing_languages = [
        {"title": g.get("title", ""), "titleId": g.get("titleId", "")}
        for g in games
        if not valid_languages(g.get("languages", {}))["text"]
        and not valid_languages(g.get("languages", {}))["audio"]
    ]

    print(f"FPKG metadata sync: added={added}, updated={updated}, skipped_no_akia={skipped_no_akia}, skipped_no_id={skipped_no_id}")
    print(f"Language audit: {len(missing_languages)} entries still need verified language metadata")
    for row in missing_languages[:50]:
        print(f"  - {row['title']} ({row['titleId']})")

if __name__ == "__main__":
    try:
        merge()
    except Exception as exc:
        print(f"sync failed: {exc}", file=sys.stderr)
        raise
