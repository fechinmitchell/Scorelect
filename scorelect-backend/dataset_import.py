# dataset_import.py
# Admin spreadsheet -> Firestore dataset importer.
#
# Wires into app.py exactly like modelbuilder.py does:
#
#     from dataset_import import dataset_import_bp, init_dataset_import
#     ...
#     init_dataset_import(db)
#     app.register_blueprint(dataset_import_bp)
#
# Endpoints:
#   POST /admin-analyze-spreadsheet  -> parse headers + sample rows, suggest a mapping, return warnings
#   POST /admin-import-spreadsheet   -> apply the (possibly edited) mapping, group rows into games, write to Firestore
#
# Both are admin-only (verified via Firebase ID token + adminSettings/datasetConfig.adminUsers).

import io
import math
import logging
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from flask import Blueprint, request, jsonify
from firebase_admin import auth as fb_auth

logger = logging.getLogger("dataset_import")

dataset_import_bp = Blueprint("dataset_import", __name__)

_db = None


def init_dataset_import(db):
    """Call once from app.py after Firestore is initialized."""
    global _db
    _db = db
    logger.info("Dataset importer: Firebase initialized")


# ---------------------------------------------------------------------------
# Target schema -- the canonical event fields a Scorelect game expects.
# 'sample row' values map into each game's gameData[] array.
# ---------------------------------------------------------------------------
TARGET_FIELDS = [
    "action", "playerName", "playerNumber", "team", "position",
    "x", "y", "minute", "half", "outcome", "foot", "pressure",
    "xG", "xP", "xPoints", "timestamp", "notes", "category",
]

# A separate group of columns used at the *game* level, not per-event.
GAME_LEVEL_FIELDS = ["matchDate"]

# Synonyms for auto-suggesting a mapping. Keys are canonical fields; values are
# normalized header candidates (lowercase, alphanumerics only).
_SYNONYMS = {
    "x":            ["x", "xcoord", "xcoordinate", "posx", "startx", "locationx", "shotx"],
    "y":            ["y", "ycoord", "ycoordinate", "posy", "starty", "locationy", "shoty"],
    "action":       ["action", "type", "event", "eventtype", "actiontype", "shottype", "kicktype"],
    "playerName":   ["player", "playername", "name", "athlete", "shooter"],
    "playerNumber": ["number", "playernumber", "jersey", "squadnumber", "no", "jerseyno"],
    "team":         ["team", "teamname", "club", "side"],
    "position":     ["position", "pos", "role", "line"],
    "outcome":      ["outcome", "result", "scored", "success", "made", "converted"],
    "minute":       ["minute", "min", "time", "clock", "gametime"],
    "half":         ["half", "period", "qtr", "quarter"],
    "xG":           ["xg", "expectedgoals"],
    "xP":           ["xp", "expectedpoints"],
    "xPoints":      ["xpoints", "expectedpts"],
    "foot":         ["foot", "footedness", "kickingfoot"],
    "pressure":     ["pressure", "pressured", "contested", "defenderdistance"],
    "timestamp":    ["timestamp", "ts", "datetime"],
    "notes":        ["notes", "note", "comment", "comments", "description"],
    "category":     ["category", "cat", "phase"],
    "matchDate":    ["date", "matchdate", "gamedate", "fixturedate", "day"],
}

# Headers that strongly suggest a "which match does this row belong to" grouping column.
_GAME_COLUMN_CANDIDATES = [
    "match", "game", "fixture", "gameid", "matchid", "gamename",
    "fixtureid", "round", "opponent", "opposition", "matchup",
]


def _norm(header):
    """Normalize a header for fuzzy matching: lowercase, alphanumerics only."""
    return "".join(ch for ch in str(header).lower() if ch.isalnum())


def _suggest_mapping(columns):
    """Return {spreadsheet_column: canonical_field_or_None} best-guess mapping."""
    mapping = {}
    used = set()
    for col in columns:
        n = _norm(col)
        match = None
        for field, candidates in _SYNONYMS.items():
            if field in used:
                continue
            if n in candidates:
                match = field
                break
        if match:
            mapping[col] = match
            used.add(match)
        else:
            mapping[col] = None
    return mapping


def _detect_game_column(columns):
    for col in columns:
        if _norm(col) in _GAME_COLUMN_CANDIDATES:
            return col
    return None


def _read_dataframe(file_storage):
    """Read an uploaded xlsx/xls/csv into a DataFrame. Raises ValueError on bad input."""
    filename = (file_storage.filename or "").lower()
    raw = file_storage.read()
    if not raw:
        raise ValueError("The uploaded file is empty.")
    buf = io.BytesIO(raw)
    if filename.endswith(".csv"):
        return pd.read_csv(buf)
    if filename.endswith(".xlsx") or filename.endswith(".xls"):
        # openpyxl handles .xlsx; xlrd would be needed for legacy .xls
        return pd.read_excel(buf)
    raise ValueError("Unsupported file type. Upload a .xlsx, .xls, or .csv file.")


def _clean_value(v):
    """Convert pandas/numpy values into JSON/Firestore-safe Python types."""
    if v is None:
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        f = float(v)
        return None if math.isnan(f) else f
    if isinstance(v, (np.bool_,)):
        return bool(v)
    if isinstance(v, (pd.Timestamp, datetime)):
        return v.isoformat()
    if pd.isna(v):
        return None
    return v


def _build_warnings(df, mapping, game_column):
    warnings = []
    cols = list(df.columns)

    # Unnamed columns (pandas labels blank headers 'Unnamed: N')
    unnamed = [c for c in cols if str(c).startswith("Unnamed:")]
    if unnamed:
        warnings.append(
            f"{len(unnamed)} column(s) have no header and will likely be junk: {', '.join(map(str, unnamed))}."
        )

    # Duplicate headers
    seen, dupes = set(), set()
    for c in cols:
        if c in seen:
            dupes.add(c)
        seen.add(c)
    if dupes:
        warnings.append(f"Duplicate column name(s) detected: {', '.join(map(str, dupes))}.")

    # Lots of columns -> probably the wrong sheet
    if len(cols) > 40:
        warnings.append(f"This file has {len(cols)} columns, which is unusually many — double-check it's the right sheet.")

    # Mapped target check: x/y are important for GAA/Soccer pitch + xG models
    mapped_targets = {v for v in mapping.values() if v}
    if "x" not in mapped_targets or "y" not in mapped_targets:
        warnings.append("No X/Y coordinate columns mapped — pitch plots and xG/xP models need these.")

    # Game grouping
    if not game_column:
        warnings.append("No match/game column chosen — every row will be merged into a single game.")

    # Unmapped columns are kept under their original name, just flag them
    unmapped = [c for c in cols if not mapping.get(c) and not str(c).startswith("Unnamed:")]
    if unmapped:
        warnings.append(
            f"{len(unmapped)} column(s) aren't mapped to a known field and will be stored as-is: "
            + ", ".join(map(str, unmapped[:8])) + ("…" if len(unmapped) > 8 else "")
        )

    if len(df) == 0:
        warnings.append("The file has headers but no data rows.")

    return warnings


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
def _verify_admin(req):
    """Return (uid, email, is_admin). Raises ValueError on bad/missing token."""
    header = req.headers.get("Authorization", "")
    token = header.replace("Bearer ", "").strip()
    if not token:
        raise ValueError("Missing Authorization token.")
    decoded = fb_auth.verify_id_token(token)
    uid = decoded.get("uid")
    email = decoded.get("email")

    is_admin = True
    try:
        snap = _db.collection("adminSettings").document("datasetConfig").get()
        if snap.exists:
            admins = (snap.to_dict() or {}).get("adminUsers", [])
            # If an admin list is configured, enforce it. If absent, stay lenient
            # (matches the client-side behaviour in AdminSettings.js).
            if admins:
                is_admin = email in admins
    except Exception as e:
        logger.warning(f"Could not read admin config: {e}")

    return uid, email, is_admin


# ---------------------------------------------------------------------------
# Endpoint 1: analyze
# ---------------------------------------------------------------------------
@dataset_import_bp.route("/admin-analyze-spreadsheet", methods=["POST"])
def admin_analyze_spreadsheet():
    try:
        uid, email, is_admin = _verify_admin(request)
    except Exception as e:
        return jsonify({"error": f"Authentication failed: {e}"}), 401
    if not is_admin:
        return jsonify({"error": "Admin privileges required."}), 403

    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file provided."}), 400

    try:
        df = _read_dataframe(file)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Failed to parse spreadsheet: {e}")
        return jsonify({"error": f"Could not read the file: {e}"}), 400

    columns = [str(c) for c in df.columns]
    mapping = _suggest_mapping(columns)
    game_column = _detect_game_column(columns)
    warnings = _build_warnings(df, mapping, game_column)

    # A few sample rows (cleaned) so the admin can eyeball the data
    sample = df.head(5).where(pd.notnull(df.head(5)), None)
    sample_rows = [
        {str(k): _clean_value(v) for k, v in row.items()}
        for row in sample.to_dict(orient="records")
    ]

    return jsonify({
        "success": True,
        "columns": columns,
        "rowCount": int(len(df)),
        "columnCount": len(columns),
        "suggestedMapping": mapping,
        "suggestedGameColumn": game_column,
        "targetFields": TARGET_FIELDS,
        "gameLevelFields": GAME_LEVEL_FIELDS,
        "sampleRows": sample_rows,
        "warnings": warnings,
    }), 200


# ---------------------------------------------------------------------------
# Endpoint 2: import
# ---------------------------------------------------------------------------
@dataset_import_bp.route("/admin-import-spreadsheet", methods=["POST"])
def admin_import_spreadsheet():
    try:
        uid, email, is_admin = _verify_admin(request)
    except Exception as e:
        return jsonify({"error": f"Authentication failed: {e}"}), 401
    if not is_admin:
        return jsonify({"error": "Admin privileges required."}), 403

    file = request.files.get("file")
    dataset_name = (request.form.get("datasetName") or "").strip()
    sport = (request.form.get("sport") or "GAA").strip()
    game_column = (request.form.get("gameColumn") or "").strip() or None
    overwrite = (request.form.get("overwrite") or "false").lower() == "true"

    # mapping arrives as a JSON string: {spreadsheetColumn: targetFieldOrNull}
    import json
    try:
        mapping = json.loads(request.form.get("mapping") or "{}")
    except Exception:
        return jsonify({"error": "Invalid mapping payload."}), 400

    if not file:
        return jsonify({"error": "No file provided."}), 400
    if not dataset_name:
        return jsonify({"error": "A dataset name is required."}), 400

    try:
        df = _read_dataframe(file)
    except Exception as e:
        return jsonify({"error": f"Could not read the file: {e}"}), 400

    df = df.where(pd.notnull(df), None)
    columns = [str(c) for c in df.columns]

    # Guard against importing onto an existing dataset name unless explicitly told to
    games_ref = _db.collection("savedGames").document(uid).collection("games")
    dataset_norm = dataset_name.lower()
    if not overwrite:
        existing = games_ref.where("datasetName_normalized", "==", dataset_norm).limit(1).stream()
        if any(True for _ in existing):
            return jsonify({
                "error": f'A dataset named "{dataset_name}" already exists. '
                         f'Choose a different name or set overwrite.',
                "code": "DATASET_EXISTS",
            }), 409

    # Identify which mapped column (if any) holds the match date
    date_source_col = None
    for col, target in mapping.items():
        if target == "matchDate":
            date_source_col = col
            break

    # Group rows into games
    if game_column and game_column in columns:
        grouped = df.groupby(df[game_column].astype(str), dropna=False)
        groups = list(grouped)
    else:
        groups = [(dataset_name, df)]

    def row_to_event(row):
        event = {}
        for col in columns:
            raw = _clean_value(row.get(col))
            target = mapping.get(col)
            if target:
                # coerce x/y/xG/xP to floats where possible
                if target in ("x", "y", "xG", "xP", "xPoints", "minute") and raw is not None:
                    try:
                        raw = float(raw)
                    except (TypeError, ValueError):
                        pass
                event[target] = raw
            elif not str(col).startswith("Unnamed:"):
                # preserve unmapped columns under their original header
                event[col] = raw
        return event

    def sanitize_doc_id(name):
        s = str(name).strip().replace("/", "-").replace("\\", "-")
        return (s[:480] or "game") if s else "game"

    now_iso = datetime.now(timezone.utc).isoformat()
    batch = _db.batch()
    pending = 0
    games_written = 0
    events_written = 0
    oversize_games = []

    for group_value, group_df in groups:
        events = [row_to_event(r) for _, r in group_df.iterrows()]
        events = [e for e in events if any(v is not None for v in e.values())]
        if not events:
            continue

        # match date for this group
        match_date = None
        if date_source_col and date_source_col in group_df.columns:
            for _, r in group_df.iterrows():
                d = _clean_value(r.get(date_source_col))
                if d is not None:
                    match_date = str(d)
                    break
        if not match_date:
            match_date = now_iso[:10]

        game_name = sanitize_doc_id(f"{dataset_name} - {group_value}") if game_column else sanitize_doc_id(dataset_name)

        # rough 1MB Firestore document guard
        approx_bytes = len(json.dumps(events, default=str).encode("utf-8"))
        if approx_bytes > 900_000:
            oversize_games.append(game_name)

        doc_ref = games_ref.document(game_name)
        batch.set(doc_ref, {
            "gameData": events,
            "datasetName": dataset_name,
            "datasetName_normalized": dataset_norm,
            "matchDate": match_date,
            "sport": sport,
            "analysisType": "pitch",
            "gameDataCount": len(events),
            "eventCount": len(events),
            "createdAt": now_iso,
            "updatedAt": now_iso,
            "importedFrom": file.filename,
        }, merge=True)

        pending += 1
        games_written += 1
        events_written += len(events)

        if pending >= 400:  # Firestore batch limit is 500
            batch.commit()
            batch = _db.batch()
            pending = 0

    if pending:
        batch.commit()

    result = {
        "success": True,
        "datasetName": dataset_name,
        "sport": sport,
        "gamesWritten": games_written,
        "eventsWritten": events_written,
        "groupedBy": game_column or "(all rows in one game)",
    }
    if oversize_games:
        result["warnings"] = [
            f"{len(oversize_games)} game(s) are close to Firestore's 1MB per-document limit "
            f"and may need splitting: {', '.join(oversize_games[:5])}."
        ]
    logger.info(f"Imported dataset '{dataset_name}' for {email}: {games_written} games, {events_written} events")
    return jsonify(result), 200