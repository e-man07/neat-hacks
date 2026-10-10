"""SQLite ops store shared by Harbor and Night Shift.

Holds the company's business data (orders ledger, conversations), the deploy log, the control
plane, and Night Shift's incident state. Every write is committed immediately so a crashed
process resumes from the last persisted step.
"""

from __future__ import annotations

import json
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any, Iterable

SCHEMA = """
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    ts REAL NOT NULL,
    release TEXT NOT NULL,
    model TEXT NOT NULL,
    brain TEXT NOT NULL,
    scenario_id TEXT,
    kind TEXT,
    customer_message TEXT,
    reply TEXT,
    outcome TEXT,
    loss_usd REAL DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    tokens INTEGER DEFAULT 0,
    steps INTEGER DEFAULT 0,
    tool_errors INTEGER DEFAULT 0,
    error TEXT,
    trace_id TEXT,
    latency_ms REAL DEFAULT 0,
    transcript_json TEXT,
    replay INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_conv_ts ON conversations(ts);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL NOT NULL,
    trace_id TEXT,
    outcome TEXT NOT NULL,          -- ok | failed | escalated | negative
    value_usd REAL DEFAULT 0,       -- money lost (positive) attributed to this run
    release TEXT,
    model TEXT,
    note TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_trace ON events(trace_id);

CREATE TABLE IF NOT EXISTS ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL NOT NULL,
    order_id TEXT NOT NULL,
    amount REAL NOT NULL,
    reason TEXT,
    conversation_id TEXT,
    release TEXT
);

CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL NOT NULL,
    conversation_id TEXT,
    reason TEXT,
    status TEXT DEFAULT 'open'
);

CREATE TABLE IF NOT EXISTS control (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at REAL NOT NULL,
    updated_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS control_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL NOT NULL,
    key TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    actor TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deploys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL NOT NULL,
    release TEXT NOT NULL,
    previous_release TEXT,
    commit_sha TEXT,
    actor TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    opened_at REAL NOT NULL,
    status TEXT NOT NULL,
    type TEXT,
    severity TEXT,
    title TEXT,
    summary TEXT,
    signals_json TEXT,
    diagnosis_json TEXT,
    impact_json TEXT,
    verification_json TEXT,
    resolved_at REAL,
    mitigated_at REAL
);

CREATE TABLE IF NOT EXISTS incident_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id TEXT NOT NULL,
    ts REAL NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    detail_json TEXT
);

CREATE TABLE IF NOT EXISTS actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id TEXT NOT NULL,
    ts REAL NOT NULL,
    kind TEXT NOT NULL,
    params_json TEXT,
    mode TEXT NOT NULL,
    status TEXT NOT NULL,
    reason TEXT,
    undo_json TEXT
);
"""


class OpsDB:
    """Thread-safe wrapper around one SQLite connection."""

    def __init__(self, path: Path | str, schema: str = SCHEMA):
        self.path = Path(path)
        if str(path) != ":memory:":
            self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._conn = sqlite3.connect(str(path), check_same_thread=False, isolation_level=None)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.executescript(schema)

    # -- generic helpers -------------------------------------------------------------------
    def execute(self, sql: str, params: Iterable[Any] = ()) -> sqlite3.Cursor:
        with self._lock:
            return self._conn.execute(sql, tuple(params))

    def query(self, sql: str, params: Iterable[Any] = ()) -> list[dict[str, Any]]:
        with self._lock:
            return [dict(r) for r in self._conn.execute(sql, tuple(params)).fetchall()]

    def one(self, sql: str, params: Iterable[Any] = ()) -> dict[str, Any] | None:
        rows = self.query(sql, params)
        return rows[0] if rows else None

    def insert(self, table: str, row: dict[str, Any]) -> int:
        cols = ", ".join(row)
        marks = ", ".join("?" for _ in row)
        cur = self.execute(f"INSERT INTO {table} ({cols}) VALUES ({marks})", row.values())
        return int(cur.lastrowid or 0)

    def update(self, table: str, key: str, key_value: Any, values: dict[str, Any]) -> None:
        sets = ", ".join(f"{c} = ?" for c in values)
        self.execute(f"UPDATE {table} SET {sets} WHERE {key} = ?", [*values.values(), key_value])

    def reset(self) -> None:
        with self._lock:
            for table in (
                "conversations",
                "events",
                "ledger",
                "tickets",
                "control",
                "control_history",
                "deploys",
                "incidents",
                "incident_events",
                "actions",
            ):
                self._conn.execute(f"DELETE FROM {table}")

    # -- control plane ---------------------------------------------------------------------
    def get_control(self, key: str, default: str | None = None) -> str | None:
        row = self.one("SELECT value FROM control WHERE key = ?", [key])
        return row["value"] if row else default

    def control_snapshot(self) -> dict[str, str]:
        return {r["key"]: r["value"] for r in self.query("SELECT key, value FROM control")}

    def set_control(self, key: str, value: str | None, actor: str) -> str | None:
        """Set (or clear, with value=None) a control key. Returns the previous value."""
        old = self.get_control(key)
        now = time.time()
        if value is None:
            self.execute("DELETE FROM control WHERE key = ?", [key])
        else:
            self.execute(
                "INSERT INTO control (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value=excluded.value, "
                "updated_at=excluded.updated_at, updated_by=excluded.updated_by",
                [key, value, now, actor],
            )
        self.insert(
            "control_history",
            {"ts": now, "key": key, "old_value": old, "new_value": value, "actor": actor},
        )
        return old


def dumps(value: Any) -> str:
    return json.dumps(value, default=str)


def loads(value: str | None, default: Any = None) -> Any:
    if not value:
        return default
    return json.loads(value)
