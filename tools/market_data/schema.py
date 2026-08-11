from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import date, datetime, timezone
import json
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class DailyBar:
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float
    amount: float | None = None


def normalize_date(value: object) -> str:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = str(value).strip()
    if len(text) == 8 and text.isdigit():
        return f"{text[:4]}-{text[4:6]}-{text[6:]}"
    return datetime.fromisoformat(text.replace("/", "-")).date().isoformat()


def build_dataset(
    bars: Iterable[DailyBar],
    *,
    symbol: str,
    name: str,
    source: str,
    volume_unit: str,
) -> dict[str, object]:
    ordered = sorted(bars, key=lambda item: item.date)
    if len(ordered) < 2:
        raise ValueError("At least two daily bars are required")
    return {
        "schemaVersion": 1,
        "symbol": symbol,
        "name": name,
        "source": source,
        "volumeUnit": volume_unit,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "candles": [asdict(item) for item in ordered],
    }


def write_dataset(dataset: dict[str, object], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(dataset, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
