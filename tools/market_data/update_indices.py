from __future__ import annotations

import argparse
from datetime import date, datetime, timezone
import json
from pathlib import Path
from typing import Any

from .providers import load_akshare_daily
from .schema import build_dataset


MARKETS = (
    {"id": "sh000300", "name": "沪深300", "displayCode": "000300", "badge": "CSI"},
    {"id": "sh000001", "name": "上证指数", "displayCode": "000001", "badge": "SSE"},
    {"id": "sz399001", "name": "深证成指", "displayCode": "399001", "badge": "SZSE"},
    {"id": "sh000905", "name": "中证500", "displayCode": "000905", "badge": "CSI"},
    {"id": "sz399006", "name": "创业板指", "displayCode": "399006", "badge": "GEM"},
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Update the public Chinese index catalog")
    parser.add_argument("--start", default="2015-01-01")
    parser.add_argument("--end", default=date.today().isoformat())
    parser.add_argument("--output-root", type=Path, default=Path("public/data"))
    return parser.parse_args()


def read_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def dataset_changed(existing: dict[str, Any] | None, current: dict[str, Any]) -> bool:
    if existing is None:
        return True
    compared_fields = ("schemaVersion", "symbol", "name", "source", "volumeUnit", "candles")
    return any(existing.get(field) != current.get(field) for field in compared_fields)


def main() -> None:
    args = parse_args()
    generated_at = datetime.now(timezone.utc).isoformat()
    prepared: list[tuple[dict[str, str], dict[str, Any], Path]] = []

    for market in MARKETS:
        bars = load_akshare_daily(market["id"], args.start, args.end)
        dataset = build_dataset(
            bars,
            symbol=market["id"],
            name=market["name"],
            source="AKShare",
            volume_unit="亿",
        )
        output = args.output_root / "markets" / f"{market['id']}.json"
        prepared.append((market, dataset, output))

    summaries: list[dict[str, Any]] = []
    default_dataset: dict[str, Any] | None = None
    changed_count = 0
    for market, dataset, output in prepared:
        existing = read_json(output)
        if dataset_changed(existing, dataset):
            write_json(output, dataset)
            changed_count += 1
        elif existing is not None:
            dataset = existing

        candles = dataset["candles"]
        latest = candles[-1]
        previous = candles[-2]
        summaries.append(
            {
                **market,
                "file": f"data/markets/{market['id']}.json",
                "source": dataset["source"],
                "volumeUnit": dataset["volumeUnit"],
                "latestDate": latest["date"],
                "latestClose": latest["close"],
                "changePct": (latest["close"] / previous["close"] - 1) * 100,
            }
        )
        if market["id"] == "sh000300":
            default_dataset = dataset

    if default_dataset is None:
        raise RuntimeError("Default沪深300 dataset was not generated")

    default_output = args.output_root / "market_daily.json"
    if dataset_changed(read_json(default_output), default_dataset):
        write_json(default_output, default_dataset)

    manifest_output = args.output_root / "markets" / "index.json"
    manifest = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "markets": summaries,
    }
    existing_manifest = read_json(manifest_output)
    if existing_manifest and existing_manifest.get("markets") == summaries:
        manifest["generatedAt"] = existing_manifest.get("generatedAt", generated_at)
    else:
        changed_count += 1
    write_json(manifest_output, manifest)

    print(f"Updated {len(summaries)} markets; {changed_count} datasets changed")


if __name__ == "__main__":
    main()
