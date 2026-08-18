import os
import re
import sys

if sys.platform == "win32":
    for _stream in (sys.stdout, sys.stderr):
        try:
            _stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

import json
import argparse
import subprocess
import tempfile
import urllib.request

import yt_dlp
from yt_dlp.postprocessor import EmbedThumbnailPP
from PIL import Image
import musicbrainzngs as _mb

try:
    import syncedlyrics
except Exception:
    syncedlyrics = None

_mb.set_useragent('ytb-down-cli', '1.0', 'https://github.com/ytb-down')

import ssl
ssl._create_default_https_context = ssl._create_unverified_context


class C:
    RESET   = "\033[0m"
    INFO    = "\033[37m"
    OK      = "\033[92m"
    WARN    = "\033[93m"
    ERR     = "\033[91m"
    SECTION = "\033[96;1m"


def _supports_color():
    return sys.stdout.isatty() and os.environ.get("NO_COLOR") is None


_COLOR = _supports_color()


def log(msg, tag="info"):
    if not _COLOR:
        print(msg)
        return
    color = {
        "info": C.INFO, "ok": C.OK, "warn": C.WARN,
        "err": C.ERR, "section": C.SECTION,
    }.get(tag, C.INFO)
    print(f"{color}{msg}{C.RESET}")


def set_status(msg):
    sys.stdout.write(f"\r\033[K{msg}")
    sys.stdout.flush()


def set_progress(pct):
    pct = max(0.0, min(1.0, pct))
    width = 30
    filled = int(width * pct)
    bar = "█" * filled + "░" * (width - filled)
    sys.stdout.write(f"\r\033[K[{bar}] {pct*100:5.1f}%")
    sys.stdout.flush()


STRINGS = {
    "uk": {
        "log_fetch": "Отримання інформації про трек…",
        "log_original": "  Оригінал",
        "log_cleaned": "  Очищено ",
        "log_album": "  Альбом  ",
        "log_year_found": "  Рік     ",
        "log_year_miss": "  Рік      : не знайдено",
        "log_dl": "Завантаження аудіо…",
        "log_dl_done": "  ✓ Завантаження завершено",
        "log_thumb": "Обробка обкладинки…",
        "log_thumb_crop": "  Обрізано",
        "log_thumb_embed": "  Обкладинку вбудовано (1:1)",
        "log_thumb_miss": "  Обкладинку не знайдено",
        "log_thumb_skip": "Обкладинку пропущено (--no-meta)",
        "log_meta": "Запис метаданих…",
        "log_meta_ok": "  ID3-теги записано",
        "log_meta_err": "  Помилка запису метаданих",
        "log_meta_skip": "Запис метаданих пропущено (--no-meta)",
        "log_meta_stripped": "  ✓ Усі метадані та приховані поля видалено",
        "log_lrc": "Пошук LRC…",
        "log_lrc_ok": "  ✓ LRC записано",
        "log_lrc_miss": "  LRC не знайдено",
        "log_lrc_skip": "  LRC вимкнено",
        "log_video_detected": "  Посилання на відео - парсимо назву…",
        "log_video_parsed": "  Розпарсено",
        "log_video_enrich": "Пошук метаданих у базі MusicBrainz…",
        "log_video_enriched": "  ✓ Знайдено",
        "log_video_no_enrich": "  Не знайдено - використовуємо розпарсену назву",
        "log_video_no_split": "  Назва не містить 'Виконавець - Пісня' - використовуємо як є",
        "log_saved": "✓ Збережено",
        "log_error": "✗ Помилка",
        "status_querying": "Запит метаданих…",
        "status_crop": "Обрізання обкладинки…",
        "status_tags": "Запис ID3-тегів…",
        "status_done": "Готово -",
        "dl_busy": "Завантаження…",
        "log_playlist": "Виявлено плейлист",
        "log_pl_title": "  Назва   ",
        "log_pl_count": "  Треків  ",
        "log_pl_err": "  Не вдалося завантажити плейлист",
        "log_pl_track": "Трек",
        "log_pl_of": "з",
        "status_pl_load": "Завантаження плейлиста…",
        "status_pl_track": "Трек",
        "log_list_saved": "✓ Посилання збережено у",
        "log_list_none": "Плейлист порожній - нічого зберігати",
    },
    "en": {
        "log_fetch": "Fetching track info…",
        "log_original": "  Original",
        "log_cleaned": "  Cleaned ",
        "log_album": "  Album   ",
        "log_year_found": "  Year    ",
        "log_year_miss": "  Year     : not found",
        "log_dl": "Downloading audio…",
        "log_dl_done": "  ✓ Download complete",
        "log_thumb": "Processing thumbnail…",
        "log_thumb_crop": "  Cropped",
        "log_thumb_embed": "  Cover embedded (1:1)",
        "log_thumb_miss": "  Thumbnail not found",
        "log_thumb_skip": "Thumbnail skipped (--no-meta)",
        "log_meta": "Writing metadata…",
        "log_meta_ok": "  ID3 tags written",
        "log_meta_err": "  Metadata write failed",
        "log_meta_skip": "Metadata writing skipped (--no-meta)",
        "log_meta_stripped": "  ✓ All metadata and hidden fields removed",
        "log_lrc": "Searching LRC…",
        "log_lrc_ok": "  ✓ LRC written",
        "log_lrc_miss": "  LRC not found",
        "log_lrc_skip": "  LRC disabled",
        "log_video_detected": "  Video URL detected - parsing title…",
        "log_video_parsed": "  Parsed",
        "log_video_enrich": "Enriching metadata via MusicBrainz…",
        "log_video_enriched": "  ✓ Found",
        "log_video_no_enrich": "  Not found - using parsed title",
        "log_video_no_split": "  Title has no 'Artist - Title' pattern - using as-is",
        "log_saved": "✓ Saved",
        "log_error": "✗ Error",
        "status_querying": "Querying metadata…",
        "status_crop": "Cropping thumbnail…",
        "status_tags": "Writing ID3 tags…",
        "status_done": "Done -",
        "dl_busy": "Downloading…",
        "log_playlist": "Playlist detected",
        "log_pl_title": "  Title   ",
        "log_pl_count": "  Tracks  ",
        "log_pl_err": "  Failed to load playlist",
        "log_pl_track": "Track",
        "log_pl_of": "of",
        "status_pl_load": "Loading playlist…",
        "status_pl_track": "Track",
        "log_list_saved": "✓ Links saved to",
        "log_list_none": "Playlist is empty - nothing to save",
    },
}


def is_playlist_url(text):
    text = text.strip()
    return (
        ("list=" in text and "youtube" in text) or
        ("browse/VL" in text) or
        ("music.youtube.com" in text and "list=" in text)
    )


def get_playlist_tracks(playlist_url, debug=False):
    opts = {
        "quiet": True,
        "no_warnings": False,
        "extract_flat": "in_playlist",
        "extractor_args": _extractor_args(),
        **_cookies_opts(),
        **_js_runtime_opts(),
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(playlist_url, download=False)

    pl_title = info.get("title") or info.get("playlist_title") or "Unknown Playlist"
    raw_entries = info.get("entries") or []

    if debug:
        log(f"  [debug] сирих записів у плейлисті: {len(raw_entries)}", "info")
        for idx, e in enumerate(raw_entries[:5], 1):
            log(f"  [debug] entry {idx}: id={e.get('id')!r} url={e.get('url')!r} "
                f"title={e.get('title')!r}", "info")

    _VIDEO_ID_RE = re.compile(r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})")

    def _resolve_video_id(entry):
        raw_id = entry.get("id")
        if raw_id and re.fullmatch(r"[A-Za-z0-9_-]{11}", raw_id):
            return raw_id

        candidate = entry.get("url") or entry.get("webpage_url") or entry.get("original_url") or ""
        if candidate:
            if re.fullmatch(r"[A-Za-z0-9_-]{11}", candidate):
                return candidate
            m = _VIDEO_ID_RE.search(candidate)
            if m:
                return m.group(1)
        return None

    tracks = []
    seen_ids = set()
    skipped = 0
    duplicates = 0
    for entry in raw_entries:
        vid_id = _resolve_video_id(entry)
        if not vid_id:
            skipped += 1
            continue
        if vid_id in seen_ids:
            duplicates += 1
            continue
        seen_ids.add(vid_id)
        url = f"https://music.youtube.com/watch?v={vid_id}"
        tracks.append({"url": url, "title": entry.get("title") or vid_id})

    if skipped:
        log(f"  ⚠ Пропущено {skipped} недоступних/нерозпізнаних записів у плейлисті", "warn")
    if duplicates:
        log(f"  ⚠ Пропущено {duplicates} дублікатів id у плейлисті "
            f"(ознака проблем з парсингом - спробуйте запустити з --debug)", "warn")

    return pl_title, tracks


_JUNK_WORD = (
    r"remaster(?:ed)?"
    r"|edition|version|mix|re-?release"
    r"|official\s*(?:audio|video|music\s*video|lyric\s*video)"
    r"|deluxe|expanded|anniversary|special|collector'?s?"
    r"|mono|stereo|hd|4k|hq|hi[- ]?res"
    r"|explicit|clean|radio\s*edit|single|album"
    r"|original|motion\s*picture|soundtrack|score"
    r"|bonus(?:\s*track)?|studio(?:\s*track|\s*version)?"
)
JUNK_PATTERNS = [
    r"\((?=[^)]*(?:" + _JUNK_WORD + r"))[^)]*\)",
    r"\b\d{4}\s*(?:remaster(?:ed)?|edition|version|mix|re-?release)\b",
    r"\b(?:remaster(?:ed)?|official\s*(?:audio|video|music\s*video|lyric\s*video))\b",
    r"\b(?:deluxe|expanded|anniversary|special|collector'?s?)\s*(?:edition|version)?\b",
    r"\b(?:mono|stereo|hd|4k|hq|hi[- ]?res)\s*(?:version|remaster)?\b",
    r"\b(?:explicit|clean|radio\s*edit|single\s*version|album\s*version)\b",
    r"\b(?:original\s*(?:motion\s*picture\s*)?(?:soundtrack|score|version))\b",
    r"\[.*?\]",
    r"\(\s*\)",
]


def clean_string(s, strip_junk=True):
    if not s:
        return s
    if strip_junk:
        for pattern in JUNK_PATTERNS:
            s = re.sub(pattern, "", s, flags=re.IGNORECASE)
    s = re.sub(r"[\s\-–—]+$", "", s)
    s = re.sub(r"^[\s\-–—]+", "", s)
    s = re.sub(r"\s{2,}", " ", s)
    return s.strip()


def sanitize_filename(s):
    return re.sub(r'[\\/*?:"<>|]', "", s)


def crop_to_square(image_path):
    with Image.open(image_path) as img:
        img = img.convert("RGB")
        w, h = img.size
        side = min(w, h)
        left = (w - side) // 2
        top = (h - side) // 2
        cropped = img.crop((left, top, left + side, top + side))
    cropped.save(image_path, "JPEG", quality=95)
    return w, h, side


def find_thumbnail(base_path):
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        p = base_path + ext
        if os.path.exists(p):
            return p
    return None


def extract_year_from_info(info):
    if info.get("release_year"):
        return str(info["release_year"])
    rd = info.get("release_date") or ""
    if len(rd) >= 4 and rd[:4].isdigit():
        return rd[:4]
    ud = info.get("upload_date") or ""
    if len(ud) >= 4 and ud[:4].isdigit():
        return ud[:4]
    return None


def get_lrc(artist, title):
    if syncedlyrics is None:
        return None
    try:
        return syncedlyrics.search(f"{artist} {title}")
    except Exception:
        return None


def save_lrc(lrc, mp3_path):
    lrc_path = os.path.splitext(mp3_path)[0] + ".lrc"
    with open(lrc_path, "w", encoding="utf-8") as f:
        f.write(lrc)


def _bundled(name):
    base = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(base, name)
    return path if os.path.exists(path) else name


def apply_final_metadata(mp3_path, artist, title, album=None, year=None):
    temp = mp3_path + ".tmp.mp3"
    ffmpeg_bin = _bundled("ffmpeg.exe") if os.name == "nt" else _bundled("ffmpeg")
    cmd = [
        ffmpeg_bin, "-y", "-i", mp3_path,
        "-map", "0", "-map_metadata", "-1",
        "-c", "copy", "-id3v2_version", "3",
        "-metadata", f"artist={artist}",
        "-metadata", f"title={title}",
    ]
    if album:
        cmd += ["-metadata", f"album={album}"]
    if year:
        cmd += ["-metadata", f"date={year}"]
    cmd.append(temp)
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        return False
    os.replace(temp, mp3_path)
    return True


def strip_all_metadata(mp3_path):
    temp = mp3_path + ".tmp.mp3"
    ffmpeg_bin = _bundled("ffmpeg.exe") if os.name == "nt" else _bundled("ffmpeg")
    cmd = [
        ffmpeg_bin, "-y", "-i", mp3_path,
        "-map", "0:a:0", "-map_metadata", "-1",
        "-c", "copy", temp,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        return False
    os.replace(temp, mp3_path)
    return True


COOKIES_FILE = None


LIVE_COOKIES_PATH = os.path.join(tempfile.gettempdir(), "ytb-cookies.txt")


def _live_cookies_path():
    return LIVE_COOKIES_PATH if os.path.exists(LIVE_COOKIES_PATH) else None


def _cookies_opts():
    if COOKIES_FILE and os.path.exists(COOKIES_FILE):
        return {"cookiefile": COOKIES_FILE}
    return {}


def _extractor_args():
    return {"youtube": {"player_client": ["web_music", "web"]}}


def _js_runtime_opts():
    return {
        "js_runtimes": {"node": {}},
        "remote_components": {"ejs:github"},
    }


def build_ydl_opts(no_meta=False, quality=None):
    postprocessors = [
        {"key": "FFmpegExtractAudio", "preferredcodec": "mp3",
         "preferredquality": quality or "192"},
    ]
    if not no_meta:
        postprocessors.append({"key": "FFmpegThumbnailsConvertor", "format": "jpg"})
        postprocessors.append({"key": "FFmpegMetadata", "add_metadata": True})

    return {
        "format": (
            "bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio[ext=opus]"
            "/bestaudio/best[ext=mp4]/best"
        ),
        "writethumbnail": not no_meta,
        "quiet": True,
        "no_warnings": False,
        "noplaylist": True,
        "extractor_args": _extractor_args(),
        "postprocessors": postprocessors,
        **_cookies_opts(),
        **_js_runtime_opts(),
    }


def is_ytmusic_track(info):
    return bool(info.get("track") and info.get("artist"))


_SPLIT_RE = re.compile(r"^(.+?)\s*[-–—]\s*(.+)$")
_PIPE_TAIL_RE = re.compile(r"\s*\|.*$")
_COLON_SPLIT_RE = re.compile(r"^(.+?)\s*:\s*(.+)$")
_COLON_ARTIST_MAX_WORDS = 6
_LIVE_TAG_RE = re.compile(r"\bLive\s+(?:In|At)\b", re.IGNORECASE)


def _format_live_title(title):
    m = _LIVE_TAG_RE.search(title)
    if not m:
        return title
    if title[:m.start()].rstrip().endswith("("):
        return title
    prefix = title[:m.start()].rstrip(" -–—").strip()
    suffix = title[m.start():].strip()
    if not prefix:
        return title
    return f"{prefix} ({suffix})"


def parse_artist_title(video_title):
    cleaned = _PIPE_TAIL_RE.sub("", video_title).strip()
    cleaned = re.sub(
        r"\s*[\(\[](?:official\s*(?:video|audio|music\s*video|lyric\s*video)|"
        r"hd|4k|hq|lyrics?|subtitles?|full\s*video|official)[\)\]]\s*$",
        "", cleaned, flags=re.IGNORECASE
    ).strip()

    m = _SPLIT_RE.match(cleaned)
    if m:
        artist, title = m.group(1).strip(), m.group(2).strip()
    elif ":" in cleaned:
        m2 = _COLON_SPLIT_RE.match(cleaned)
        if not m2:
            return None
        artist, title = m2.group(1).strip(), m2.group(2).strip()
        if len(artist.split()) > _COLON_ARTIST_MAX_WORDS:
            return None
    else:
        return None

    title = _format_live_title(title)
    if not artist or not title:
        return None
    return artist, title


def enrich_from_musicbrainz(artist, title):
    def _year(date_str):
        s = (date_str or "")[:4]
        try:
            return int(s) if len(s) == 4 else 9999
        except Exception:
            return 9999

    def _type_rank(rg):
        primary = (rg.get("type") or "").lower()
        sec = [s.lower() for s in (rg.get("secondary-type-list") or [])]
        if "live" in sec:
            return 10
        if "compilation" in sec:
            return 9
        if "remix" in sec:
            return 8
        if "soundtrack" in sec:
            return 7
        if "demo" in sec:
            return 6
        if primary == "album":
            return 0
        if primary == "ep":
            return 1
        if primary == "single":
            return 2
        return 5

    def _try_release_image(release_id):
        try:
            caa = _mb.get_image_list(release_id)
            images = caa.get("images") or []
            front = next((i for i in images if "Front" in (i.get("types") or [])), None)
            img = front or (images[0] if images else None)
            if img:
                return img.get("image") or (img.get("thumbnails") or {}).get("large")
        except Exception:
            pass
        return None

    def _thumb_for_release(release_id, release_group_id=None):
        url = _try_release_image(release_id)
        if url:
            return url
        if not release_group_id:
            return None
        try:
            rg_data = _mb.get_release_group_by_id(release_group_id, includes=["releases"])
            rg_rels = rg_data.get("release-group", {}).get("release-list") or []
        except Exception:
            rg_rels = []
        official = [r for r in rg_rels if (r.get("status") or "").lower() == "official"]
        official.sort(key=lambda r: _year(r.get("date")))
        for rel in official[:8]:
            if rel.get("id") == release_id:
                continue
            url = _try_release_image(rel.get("id"))
            if url:
                return url
        return f"https://coverartarchive.org/release-group/{release_group_id}/front"

    def _norm(s):
        s = (s or "").lower()
        s = re.sub(r"[^\w\s]", "", s)
        s = re.sub(r"\s+", " ", s).strip()
        return s

    def _norm_title(s):
        s = re.sub(r"\s*[\(\[][^\)\]]*[\)\]]\s*$", "", s or "")
        return _norm(s)

    def _artist_matches(candidate_name):
        a, b = _norm(artist), _norm(candidate_name)
        if not a or not b:
            return False
        return a == b or a in b or b in a

    def _title_matches(candidate_title):
        a, b = _norm_title(title), _norm_title(candidate_title)
        return bool(a) and a == b

    search_title = re.sub(r"\s*[\(\[][^\)\]]*[\)\]]\s*$", "", title).strip() or title

    try:
        result = _mb.search_recordings(artist=artist, recording=search_title, limit=100)
        recs = result.get("recording-list") or []
    except Exception:
        recs = []

    if not recs:
        return None

    def _rec_artist(rec):
        credits = rec.get("artist-credit") or []
        return credits[0]["artist"]["name"] if credits else ""

    matched = [
        r for r in recs
        if _artist_matches(_rec_artist(r)) and _title_matches(r.get("title"))
    ]
    if not matched:
        return None

    top_score = int(matched[0].get("ext:score", 0))
    score_floor = min(top_score, 90) - 10
    candidates = [r for r in matched if int(r.get("ext:score", 0)) >= score_floor]

    best = None
    for rec in candidates:
        rel_list = rec.get("release-list") or []
        for rel in rel_list:
            if (rel.get("status") or "").lower() != "official":
                continue
            rg = rel.get("release-group") or {}
            key = (_type_rank(rg), _year(rel.get("date")))
            if best is None or key < best[0]:
                best = (key, rel, rec)

    if not best:
        return None

    _, best_rel, best_rec = best
    credits = best_rec.get("artist-credit") or []
    r_artist = credits[0]["artist"]["name"] if credits else artist
    r_album = (best_rel or {}).get("title") or ""
    r_year = ((best_rel or {}).get("date") or "")[:4]
    best_rgid = ((best_rel or {}).get("release-group") or {}).get("id")
    thumb_url = _thumb_for_release((best_rel or {}).get("id"), best_rgid)

    return {
        "artist": r_artist,
        "title": title,
        "album": r_album,
        "year": r_year,
        "thumbnail_url": thumb_url,
    }


enrich_from_ytmusic = enrich_from_musicbrainz


def fetch_thumbnail_from_url(url, dest_path):
    try:
        urllib.request.urlretrieve(url, dest_path)
        return os.path.exists(dest_path)
    except Exception:
        return False


def download_single(url, output_dir, strip_junk, fetch_lrc, lang,
                     progress_share=(0.0, 1.0), no_meta=False, quality=None):
    t = lambda k: STRINGS[lang].get(k, STRINGS["en"][k])
    p_start, p_end = progress_share
    p_range = p_end - p_start

    def ph(d):
        if d["status"] == "downloading":
            raw = d.get("_percent_str", "").strip()
            pct_str = re.sub(r"\x1b\[[0-9;]*m", "", raw)
            try:
                pct = float(pct_str.replace("%", "")) / 100
                set_progress(p_start + pct * p_range * 0.55)
            except ValueError:
                pass
        elif d["status"] == "finished":
            set_progress(p_start + p_range * 0.55)
            print()
            log(t("log_dl_done"), "ok")

    class Silent:
        def debug(self_, msg): pass
        def info(self_, msg): pass
        def warning(self_, msg): print(f"WARNING: {msg}", file=sys.stderr)
        def error(self_, msg): print(f"ERROR: {msg}", file=sys.stderr)

    ydl_opts = build_ydl_opts(no_meta=no_meta, quality=quality)
    ydl_opts["logger"] = Silent()
    ydl_opts["progress_hooks"] = [ph]

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)

    raw_video_title = info.get("title") or ""
    is_music_track = is_ytmusic_track(info)

    if is_music_track:
        raw_artist = info.get("artist") or "Unknown Artist"
        raw_title = info.get("track") or raw_video_title or "Unknown Title"
        raw_album = info.get("album") or ""
        year = extract_year_from_info(info)
        enriched_thumb_url = None

        artist = clean_string(raw_artist, strip_junk)
        title = clean_string(raw_title, strip_junk)
        album = clean_string(raw_album, strip_junk)

        log(f"{t('log_original')} : {raw_artist} - {raw_title}", "info")
        if strip_junk:
            log(f"{t('log_cleaned')} : {artist} - {title}", "ok")
        if album:
            log(f"{t('log_album')} : {album}", "info")
    else:
        log(t("log_video_detected"), "warn")
        parsed = parse_artist_title(raw_video_title)

        if parsed:
            p_artist, p_title = parsed
            p_artist = clean_string(p_artist, strip_junk)
            p_title = clean_string(p_title, strip_junk)
            log(f"{t('log_video_parsed')} : {p_artist} - {p_title}", "ok")

            log(t("log_video_enrich"), "section")
            set_status(t("status_querying"))
            enriched = enrich_from_ytmusic(p_artist, p_title)
            print()

            if enriched:
                artist = clean_string(enriched["artist"], strip_junk)
                title = clean_string(enriched["title"], strip_junk)
                album = clean_string(enriched["album"], strip_junk)
                year = enriched["year"] or extract_year_from_info(info)
                enriched_thumb_url = enriched.get("thumbnail_url")
                log(
                    f"{t('log_video_enriched')} : {artist} - {title}"
                    + (f" / {album}" if album else "")
                    + (f" ({year})" if year else ""), "ok"
                )
            else:
                artist, title, album = p_artist, p_title, ""
                year = extract_year_from_info(info)
                enriched_thumb_url = None
                log(t("log_video_no_enrich"), "warn")
        else:
            artist = clean_string(info.get("uploader") or "Unknown Artist", strip_junk)
            title = clean_string(raw_video_title or "Unknown Title", strip_junk)
            album = ""
            year = extract_year_from_info(info)
            enriched_thumb_url = None
            log(t("log_video_no_split"), "warn")

    if year:
        log(f"{t('log_year_found')} : {year}", "ok")
    else:
        log(t("log_year_miss"), "warn")

    set_progress(p_start + p_range * 0.60)
    print()

    safe_artist = sanitize_filename(artist)
    safe_title = sanitize_filename(title)
    base_path = os.path.join(output_dir, f"{safe_artist} - {safe_title}")

    if os.path.exists(base_path + ".mp3"):
        n = 2
        while os.path.exists(f"{base_path} ({n}).mp3"):
            n += 1
        base_path = f"{base_path} ({n})"

    ydl_opts["outtmpl"] = f"{base_path}.%(ext)s"

    log(t("log_dl"), "section")
    with yt_dlp.YoutubeDL(ydl_opts) as ydl_final:
        ydl_final.download([url])

    set_progress(p_start + p_range * 0.75)
    print()

    mp3_path = base_path + ".mp3"

    if no_meta:
        log(t("log_thumb_skip"), "section")
        log(t("log_meta_skip"), "section")
        if os.path.exists(mp3_path):
            ok = strip_all_metadata(mp3_path)
            log(t("log_meta_stripped") if ok else t("log_meta_err"), "ok" if ok else "err")

            log(t("log_lrc"), "section")
            if fetch_lrc:
                lrc = get_lrc(artist, title)
                if lrc:
                    save_lrc(lrc, mp3_path)
                    log(t("log_lrc_ok"), "ok")
                else:
                    log(t("log_lrc_miss"), "warn")
            else:
                log(t("log_lrc_skip"), "info")

        set_progress(p_end)
        print()
        log(f"{t('log_saved')}: {mp3_path}", "ok")
        return

    log(t("log_thumb"), "section")
    set_status(t("status_crop"))

    if enriched_thumb_url:
        album_thumb = base_path + "_cover.jpg"
        if fetch_thumbnail_from_url(enriched_thumb_url, album_thumb):
            yt_thumb = find_thumbnail(base_path)
            if yt_thumb and yt_thumb != album_thumb:
                os.remove(yt_thumb)
            thumb = album_thumb
        else:
            thumb = find_thumbnail(base_path)
    else:
        thumb = find_thumbnail(base_path)

    print()
    if thumb:
        w, h, side = crop_to_square(thumb)
        log(f"{t('log_thumb_crop')} {w}×{h} → {side}×{side}px", "ok")
        set_progress(p_start + p_range * 0.85)
        if os.path.exists(mp3_path):
            fake_info = {
                "filepath": mp3_path,
                "thumbnail_filename": thumb,
                "__thumbnail_filename": thumb,
                "ext": "mp3",
                "thumbnails": [{"filepath": thumb}],
            }
            with yt_dlp.YoutubeDL({"quiet": True}) as ydl_embed:
                EmbedThumbnailPP(ydl_embed).run(fake_info)
            log(t("log_thumb_embed"), "ok")
        if os.path.exists(thumb):
            os.remove(thumb)
    else:
        log(t("log_thumb_miss"), "warn")

    set_progress(p_start + p_range * 0.90)
    print()
    log(t("log_meta"), "section")
    set_status(t("status_tags"))
    print()
    if os.path.exists(mp3_path):
        ok = apply_final_metadata(mp3_path, artist, title, album, year)
        log(t("log_meta_ok") if ok else t("log_meta_err"), "ok" if ok else "err")

        log(t("log_lrc"), "section")
        if fetch_lrc:
            lrc = get_lrc(artist, title)
            if lrc:
                save_lrc(lrc, mp3_path)
                log(t("log_lrc_ok"), "ok")
            else:
                log(t("log_lrc_miss"), "warn")
        else:
            log(t("log_lrc_skip"), "info")

    set_progress(p_end)
    print()
    log(f"{t('log_saved')}: {mp3_path}", "ok")


def run_download(url, output_dir, strip_junk, fetch_lrc, lang, debug=False,
                  no_meta=False, quality=None):
    t = lambda k: STRINGS[lang].get(k, STRINGS["en"][k])
    if is_playlist_url(url):
        run_playlist(url, output_dir, strip_junk, fetch_lrc, lang, debug=debug,
                     no_meta=no_meta, quality=quality)
        return
    log(t("log_fetch"), "section")
    download_single(url, output_dir, strip_junk, fetch_lrc, lang,
                     progress_share=(0.0, 1.0), no_meta=no_meta, quality=quality)


def run_playlist(url, output_dir, strip_junk, fetch_lrc, lang, debug=False,
                  no_meta=False, quality=None):
    t = lambda k: STRINGS[lang].get(k, STRINGS["en"][k])
    set_status(t("status_pl_load"))
    print()
    log(t("log_playlist"), "section")

    pl_title, tracks = get_playlist_tracks(url, debug=debug)
    total = len(tracks)

    log(f"{t('log_pl_title')} : {pl_title}", "ok")
    log(f"{t('log_pl_count')} : {total}", "info")

    if total == 0:
        log(t("log_pl_err"), "err")
        return

    failed = 0
    for i, track in enumerate(tracks, 1):
        p_start = (i - 1) / total
        p_end = i / total
        header = f"\n── {t('log_pl_track')} {i} {t('log_pl_of')} {total}: {track['title']} ──"
        log(header, "section")
        log(f"  URL: {track['url']}", "info")
        try:
            download_single(
                url=track["url"], output_dir=output_dir, strip_junk=strip_junk,
                fetch_lrc=fetch_lrc, lang=lang,
                progress_share=(p_start, p_end),
                no_meta=no_meta, quality=quality,
            )
        except Exception as e:
            failed += 1
            log(f"  {t('log_error')}: {e}", "err")

    print()
    ok_count = total - failed
    log(f"\n✓ {pl_title} - {ok_count}/{total} треків збережено у {output_dir}", "ok")


def run_batch(file_path, output_dir, strip_junk, fetch_lrc, lang, debug=False,
              no_meta=False, quality=None):
    if not os.path.exists(file_path):
        log(f"Файл не знайдено: {file_path}", "err")
        sys.exit(1)
    with open(file_path, encoding="utf-8") as f:
        urls = [line.strip() for line in f if line.strip() and not line.startswith("#")]

    if not urls:
        log("Список посилань порожній.", "warn")
        return

    total = len(urls)
    for i, url in enumerate(urls, 1):
        log(f"\n── {i}/{total}: {url} ──", "section")
        try:
            run_download(url, output_dir, strip_junk, fetch_lrc, lang, debug=debug,
                         no_meta=no_meta, quality=quality)
        except Exception as e:
            log(f"✗ Помилка: {e}", "err")


def get_single_track_info(url, debug=False):
    """Lightweight metadata-only lookup for a single (non-playlist) video -
    just enough to build a display title, without touching format
    resolution or audio postprocessors the way a real download would."""
    opts = {
        "quiet": True,
        "no_warnings": False,
        "skip_download": True,
        "noplaylist": True,
        "extractor_args": _extractor_args(),
        **_cookies_opts(),
        **_js_runtime_opts(),
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)

    if is_ytmusic_track(info):
        artist = (info.get("artist") or "").strip()
        track  = (info.get("track") or info.get("title") or "Unknown").strip()
        title  = f"{artist} - {track}" if artist else track
    else:
        title = info.get("title") or "Unknown"

    return [{"title": title, "url": url}]


def run_list(url, output_file, with_titles, lang, debug=False):
    """Print (or save) the link(s) for a playlist or a single track, without downloading anything."""
    t = lambda k: STRINGS[lang].get(k, STRINGS["en"][k])

    set_status(t("status_pl_load"))
    print()

    if is_playlist_url(url):
        log(t("log_playlist"), "section")
        pl_title, tracks = get_playlist_tracks(url, debug=debug)
        log(f"{t('log_pl_title')} : {pl_title}", "ok")
        log(f"{t('log_pl_count')} : {len(tracks)}", "info")
    else:
        tracks = get_single_track_info(url, debug=debug)
        log(f"{t('log_pl_count')} : {len(tracks)}", "info")

    total = len(tracks)

    if total == 0:
        log(t("log_list_none"), "warn")
        return

    lines = [f"{tr['url']}\t{tr['title']}" if with_titles else tr["url"] for tr in tracks]

    if output_file:
        with open(output_file, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
        log(f"{t('log_list_saved')} {output_file}", "ok")
    else:
        print()
        for line in lines:
            print(line)


def _add_common_options(sp):
    sp.add_argument("-o", "--output", default=os.getcwd(),
                     help="Output folder (default: current directory)")
    sp.add_argument("--strip", action="store_true",
                     help="Strip junk tags from title/artist (Remastered, Deluxe Edition...) "
                          "[off by default]")
    sp.add_argument("--lrc", action="store_true",
                     help="Search and save synced lyrics (.lrc) [off by default]")
    sp.add_argument("--no-meta", action="store_true", dest="no_meta",
                     help="Save with NO metadata at all: no cover art, no ID3 tags, "
                          "no hidden fields (comment/description/etc.)")
    sp.add_argument("-q", "-q:a", dest="quality", default=None, metavar="QUALITY",
                     help="ffmpeg audio quality: VBR 0(best)-9(worst) or a bitrate like "
                          "'192K' (default: 192 CBR). Alias: -q:a")
    sp.add_argument("--lang", choices=["uk", "en"], default="en",
                     help="Log language (default: en)")
    sp.add_argument("--debug", action="store_true",
                     help="Show diagnostic info about raw playlist entries")
    sp.add_argument("--cookies", default=None, metavar="FILE",
                     help="Path to a cookies.txt (Netscape format) to authenticate requests. "
                          "Falls back to the YTB_COOKIES_FILE env var if not given. Needed when "
                          "requests come from a cloud/datacenter IP and YouTube demands "
                          "'Sign in to confirm you're not a bot'.")


def build_url_parser():
    """ytbdown <URL> [options] - track or playlist, type auto-detected."""
    p = argparse.ArgumentParser(
        prog="ytbdown",
        description="Console downloader for music from YouTube / YouTube Music.",
    )
    p.add_argument("url", help="Link to a track or a playlist")
    _add_common_options(p)
    return p


def build_batch_parser():
    """ytbdown batch <file> [options] - list of links from a file."""
    p = argparse.ArgumentParser(
        prog="ytbdown batch",
        description="Download a list of links from a file (one per line).",
    )
    p.add_argument("file", help="Path to a text file with a list of URLs")
    _add_common_options(p)
    return p


def build_list_parser():
    """ytbdown list <url> [options] - print/save track link(s) for a playlist or a single track."""
    p = argparse.ArgumentParser(
        prog="ytbdown list",
        description="Print the link (and title) for a single track, or every track in a playlist, "
                     "without downloading anything. Pair with 'ytbdown batch' to download them afterwards.",
    )
    p.add_argument("url", help="Link to a track or a playlist")
    p.add_argument("-o", "--output", default=None, metavar="FILE",
                     help="Write links to this text file (one per line) instead of printing them")
    p.add_argument("--titles", action="store_true",
                     help="Also print/save each track's title next to its link, tab-separated")
    p.add_argument("--lang", choices=["uk", "en"], default="en",
                     help="Log language (default: en)")
    p.add_argument("--debug", action="store_true",
                     help="Show diagnostic info about raw playlist entries")
    p.add_argument("--cookies", default=None, metavar="FILE",
                     help="Path to a cookies.txt (Netscape format) to authenticate requests. "
                          "Falls back to the YTB_COOKIES_FILE env var if not given.")
    return p


def print_top_help():
    print(__doc__)
    print("Usage:")
    print("  ytbdown <URL> [options]              - download a track or a playlist")
    print("  ytbdown batch <file.txt> [options]   - download a list of links from a file")
    print("  ytbdown list <url> [options]         - print/save link(s) + title(s) for a track or playlist")
    print()
    print("Common options:")
    print("  -o, --output DIR   Output folder (default: current directory)")
    print("  --strip            Strip junk tags (Remastered, Deluxe Edition...) [off by default]")
    print("  --lrc              Search/save synced lyrics (.lrc) [off by default]")
    print("  --no-meta          No metadata at all: no cover, no ID3 tags, no hidden fields")
    print("  -q, -q:a QUALITY   ffmpeg audio quality: VBR 0(best)-9(worst) or bitrate")
    print("                     like '192K' (default: 192 CBR)")
    print("  --lang {uk,en}     Log language (default: en)")
    print("  --debug            Diagnostic info about raw playlist entries")
    print("  --cookies FILE     cookies.txt for authenticated requests (or YTB_COOKIES_FILE env var)")
    print()
    print("'list' options:")
    print("  -o, --output FILE  Write links to this text file instead of printing them")
    print("  --titles           Also print/save each track's title (tab-separated)")


def main():
    global COOKIES_FILE
    argv = sys.argv[1:]

    if not argv or argv[0] in ("-h", "--help"):
        print_top_help()
        if os.name == "nt":
            input("\nPress Enter to close this window… ")
        sys.exit(0)

    if argv[0] == "list":
        parser = build_list_parser()
        args = parser.parse_args(argv[1:])
        COOKIES_FILE = args.cookies or _live_cookies_path() or os.environ.get("YTB_COOKIES_FILE")
        try:
            run_list(args.url, args.output, args.titles, args.lang, debug=args.debug)
        except KeyboardInterrupt:
            print()
            log("Перервано користувачем.", "warn")
            sys.exit(130)
        except Exception as e:
            log(f"\n✗ Помилка: {e}", "err")
            sys.exit(1)
        return

    is_batch = argv[0] == "batch"
    parser = build_batch_parser() if is_batch else build_url_parser()
    args = parser.parse_args(argv[1:] if is_batch else argv)
    COOKIES_FILE = args.cookies or _live_cookies_path() or os.environ.get("YTB_COOKIES_FILE")

    output_dir = os.path.abspath(args.output)
    os.makedirs(output_dir, exist_ok=True)
    strip_junk = args.strip
    fetch_lrc = args.lrc
    lang = args.lang

    try:
        if is_batch:
            run_batch(args.file, output_dir, strip_junk, fetch_lrc, lang, debug=args.debug,
                      no_meta=args.no_meta, quality=args.quality)
        else:
            run_download(args.url, output_dir, strip_junk, fetch_lrc, lang, debug=args.debug,
                         no_meta=args.no_meta, quality=args.quality)
    except KeyboardInterrupt:
        print()
        log("Перервано користувачем.", "warn")
        sys.exit(130)
    except Exception as e:
        log(f"\n✗ Помилка: {e}", "err")
        sys.exit(1)


if __name__ == "__main__":
    main()