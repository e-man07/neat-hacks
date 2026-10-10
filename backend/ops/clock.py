"""On-call clock.

Night Shift reasons about "how long until a human would respond", which depends on the local hour.
For the demo, NIGHTSHIFT_LOCAL_TIME (e.g. "03:07") pins the on-call clock to a simulated local
time that then advances in real time. The console labels it as simulated.
"""

from __future__ import annotations

import datetime as dt
import os
import time

_START_WALL = time.time()


def _pinned_start() -> dt.datetime | None:
    raw = os.environ.get("NIGHTSHIFT_LOCAL_TIME", "").strip()
    if not raw:
        return None
    hh, mm = (int(x) for x in raw.split(":"))
    today = dt.datetime.now().replace(hour=hh, minute=mm, second=0, microsecond=0)
    return today


def local_now() -> dt.datetime:
    start = _pinned_start()
    if start is None:
        return dt.datetime.now()
    return start + dt.timedelta(seconds=time.time() - _START_WALL)


def is_simulated() -> bool:
    return bool(os.environ.get("NIGHTSHIFT_LOCAL_TIME", "").strip())


def reset() -> None:
    global _START_WALL
    _START_WALL = time.time()
