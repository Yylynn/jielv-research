from __future__ import annotations

import csv
from datetime import datetime
from getpass import getpass
import os
from pathlib import Path
from typing import Iterable

from .schema import DailyBar, normalize_date


def _number(value: object, field: str) -> float:
    if value is None or str(value).strip() == "":
        raise ValueError(f"Missing {field}")
    return float(str(value).replace(",", ""))


def load_csv_daily(path: Path, volume_divisor: float = 1.0) -> list[DailyBar]:
    aliases = {
        "date": ("date", "trade_date", "datetime", "日期", "交易日期"),
        "open": ("open", "开盘", "开盘价"),
        "high": ("high", "最高", "最高价"),
        "low": ("low", "最低", "最低价"),
        "close": ("close", "收盘", "收盘价"),
        "volume": ("volume", "vol", "成交量"),
        "amount": ("amount", "amt", "成交额"),
    }
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise ValueError("CSV has no header")
        lower_names = {name.strip().lower(): name for name in reader.fieldnames}

        def resolve(field: str, required: bool = True) -> str | None:
            for alias in aliases[field]:
                original = lower_names.get(alias.lower())
                if original:
                    return original
            if required:
                raise ValueError(f"CSV is missing the {field} column")
            return None

        columns = {field: resolve(field, field != "amount") for field in aliases}
        bars: list[DailyBar] = []
        for row in reader:
            amount_column = columns["amount"]
            amount_value = row.get(amount_column, "") if amount_column else ""
            bars.append(
                DailyBar(
                    date=normalize_date(row[columns["date"]]),
                    open=_number(row[columns["open"]], "open"),
                    high=_number(row[columns["high"]], "high"),
                    low=_number(row[columns["low"]], "low"),
                    close=_number(row[columns["close"]], "close"),
                    volume=_number(row[columns["volume"]], "volume") / volume_divisor,
                    amount=float(str(amount_value).replace(",", "")) if str(amount_value).strip() else None,
                )
            )
    return bars


def load_wind_daily(
    symbol: str,
    start: str,
    end: str,
    volume_divisor: float = 100_000_000.0,
) -> list[DailyBar]:
    try:
        from WindPy import w  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError(
            "WindPy is unavailable. Install the Wind terminal Python interface first."
        ) from exc

    start_result = w.start()
    if getattr(start_result, "ErrorCode", 0) != 0:
        raise RuntimeError(f"Wind terminal connection failed: {start_result}")
    result = w.wsd(symbol, "open,high,low,close,volume,amt", start, end, "")
    if result.ErrorCode != 0:
        raise RuntimeError(f"Wind wsd failed with error {result.ErrorCode}")
    fields = {field.upper(): index for index, field in enumerate(result.Fields)}
    bars: list[DailyBar] = []
    for index, timestamp in enumerate(result.Times):
        bars.append(
            DailyBar(
                date=normalize_date(timestamp),
                open=float(result.Data[fields["OPEN"]][index]),
                high=float(result.Data[fields["HIGH"]][index]),
                low=float(result.Data[fields["LOW"]][index]),
                close=float(result.Data[fields["CLOSE"]][index]),
                volume=float(result.Data[fields["VOLUME"]][index]) / volume_divisor,
                amount=float(result.Data[fields["AMT"]][index]),
            )
        )
    return bars


def load_tqsdk_daily(
    symbol: str,
    start: str,
    end: str,
    data_length: int = 8964,
) -> list[DailyBar]:
    try:
        from tqsdk import TqApi, TqAuth  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError("TqSdk is unavailable. Install it with pip install tqsdk -U.") from exc

    username = os.environ.get("TQ_USERNAME") or input("快期账号: ").strip()
    password = os.environ.get("TQ_PASSWORD") or getpass("快期密码: ")
    if not username or not password:
        raise RuntimeError("A TianQin account and password are required")
    api = TqApi(auth=TqAuth(username, password))
    try:
        frame = api.get_kline_serial(symbol, 86400, data_length=data_length)
        start_date = datetime.fromisoformat(start).date()
        end_date = datetime.fromisoformat(end).date()
        bars: list[DailyBar] = []
        for row in frame.itertuples(index=False):
            timestamp = datetime.fromtimestamp(float(row.datetime) / 1_000_000_000)
            if timestamp.date() < start_date or timestamp.date() > end_date:
                continue
            bars.append(
                DailyBar(
                    date=timestamp.date().isoformat(),
                    open=float(row.open),
                    high=float(row.high),
                    low=float(row.low),
                    close=float(row.close),
                    volume=float(row.volume),
                    amount=float(row.amount) if getattr(row, "amount", None) is not None else None,
                )
            )
        return bars
    finally:
        api.close()
