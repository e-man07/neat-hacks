"""Adapters from the upstream orders API to the order shape Harbor's tools use.

Normalised order:
    {order_id, customer, status, items: [{name, price, final_sale}], total,
     delivered_days_ago, final_sale, notes}
"""

from __future__ import annotations

import time
from typing import Any, Callable

from harbor import orders_service

DAY = orders_service.DAY


def _days_ago(ts: float | None) -> int | None:
    if ts is None:
        return None
    return int((time.time() - ts) // DAY)


def lookup_v1(order_id: str) -> dict[str, Any]:
    p = orders_service.get_order(order_id, api_version="v1")
    return {
        "order_id": p["order_id"],
        "customer": p["customer"],
        "status": p["status"],
        "items": [{"name": i["name"], "price": i["price"], "final_sale": i["final_sale"]} for i in p["items"]],
        "total": p["total"],
        "delivered_days_ago": _days_ago(p["delivered_at"]),
        "final_sale": p["final_sale"],
        "notes": p["delivery_notes"],
    }


def lookup_v2(order_id: str) -> dict[str, Any]:
    p = orders_service.get_order(order_id, api_version="v2")["order"]
    return {
        "order_id": p["order_id"],
        "customer": p["customer"],
        "status": p["status"],
        "items": [{"name": i["name"], "price": i["price"], "final_sale": i["final_sale"]} for i in p["items"]],
        "total": p["total"],
        "delivered_days_ago": _days_ago(p["delivered_at"]),
        "final_sale": p["final_sale"],
        "notes": p["delivery_notes"],
    }


ADAPTERS: dict[str, Callable[[str], dict[str, Any]]] = {
    "v1": lookup_v1,
    "v2": lookup_v2,
}


def get_adapter(version: str) -> Callable[[str], dict[str, Any]]:
    try:
        return ADAPTERS[version]
    except KeyError as exc:
        raise ValueError(f"unknown orders adapter '{version}'") from exc
