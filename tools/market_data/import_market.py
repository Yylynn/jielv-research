from __future__ import annotations

import argparse
from datetime import date
from pathlib import Path

from .providers import (
    load_akshare_daily,
    load_csv_daily,
    load_futu_daily,
    load_tqsdk_daily,
    load_wind_daily,
)
from .schema import build_dataset, write_dataset


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export normalized daily market data")
    parser.add_argument(
        "--provider",
        choices=("akshare", "wind", "futu", "tqsdk", "csv"),
        required=True,
    )
    parser.add_argument("--symbol", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--start", default="2015-01-01")
    parser.add_argument("--end", default=date.today().isoformat())
    parser.add_argument("--input", type=Path, help="CSV path when provider=csv")
    parser.add_argument("--host", default="127.0.0.1", help="FutuOpenD host")
    parser.add_argument("--port", type=int, default=11111, help="FutuOpenD port")
    parser.add_argument("--volume-divisor", type=float)
    parser.add_argument("--volume-unit")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("public/data/market_daily.json"),
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.provider == "akshare":
        divisor = args.volume_divisor or 100_000_000.0
        bars = load_akshare_daily(args.symbol, args.start, args.end, divisor)
        source = "AKShare"
        volume_unit = args.volume_unit or "亿"
    elif args.provider == "wind":
        divisor = args.volume_divisor or 100_000_000.0
        bars = load_wind_daily(args.symbol, args.start, args.end, divisor)
        source = "Wind"
        volume_unit = args.volume_unit or "亿"
    elif args.provider == "futu":
        divisor = args.volume_divisor or 100_000_000.0
        bars = load_futu_daily(
            args.symbol,
            args.start,
            args.end,
            divisor,
            host=args.host,
            port=args.port,
        )
        source = "富途 OpenAPI"
        volume_unit = args.volume_unit or "亿"
    elif args.provider == "tqsdk":
        bars = load_tqsdk_daily(args.symbol, args.start, args.end)
        source = "天勤量化"
        volume_unit = args.volume_unit or "手"
    else:
        if not args.input:
            raise SystemExit("--input is required when provider=csv")
        bars = load_csv_daily(args.input, args.volume_divisor or 1.0)
        source = "CSV 导入"
        volume_unit = args.volume_unit or ""

    dataset = build_dataset(
        bars,
        symbol=args.symbol,
        name=args.name,
        source=source,
        volume_unit=volume_unit,
    )
    write_dataset(dataset, args.output)
    print(f"Exported {len(bars)} bars to {args.output}")


if __name__ == "__main__":
    main()
