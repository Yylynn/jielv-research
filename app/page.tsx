"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const GANZHI = Array.from({ length: 60 }, (_, index) => `${STEMS[index % 10]}${BRANCHES[index % 12]}`);
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const VIEW_COUNTS: Record<string, number> = { "3月": 66, "6月": 132, "1年": 250, 全部: 9999 };

type Candle = {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ganzhiIndex: number;
};

type MarketDataset = {
  symbol: string;
  name: string;
  source: string;
  volumeUnit: string;
  mode: "live" | "static" | "demo";
  candles: Candle[];
};

type RawMarketDataset = {
  symbol?: string;
  name?: string;
  source?: string;
  volumeUnit?: string;
  candles?: Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
};

type MarketSummary = {
  id: string;
  name: string;
  displayCode: string;
  badge: string;
  file: string;
  source: string;
  volumeUnit: string;
  latestDate: string;
  latestClose: number;
  changePct: number;
};

const FALLBACK_MARKETS: MarketSummary[] = [
  { id: "sh000300", name: "沪深300", displayCode: "000300", badge: "CSI", file: "data/market_daily.json", source: "行情数据", volumeUnit: "亿", latestDate: "", latestClose: 5551.31, changePct: 0.26 },
  { id: "sh000001", name: "上证指数", displayCode: "000001", badge: "SSE", file: "data/markets/sh000001.json", source: "行情数据", volumeUnit: "亿", latestDate: "", latestClose: 3647.21, changePct: 0.42 },
  { id: "sz399001", name: "深证成指", displayCode: "399001", badge: "SZSE", file: "data/markets/sz399001.json", source: "行情数据", volumeUnit: "亿", latestDate: "", latestClose: 11218.09, changePct: -0.31 },
  { id: "sh000905", name: "中证500", displayCode: "000905", badge: "CSI", file: "data/markets/sh000905.json", source: "行情数据", volumeUnit: "亿", latestDate: "", latestClose: 6017.54, changePct: 0.86 },
  { id: "sz399006", name: "创业板指", displayCode: "399006", badge: "GEM", file: "data/markets/sz399006.json", source: "行情数据", volumeUnit: "亿", latestDate: "", latestClose: 2416.88, changePct: -0.17 },
];

type DetailKey = "date" | "pillars" | "elements" | "term" | "lunar";

function toIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function julianDay(date: Date) {
  let year = date.getFullYear();
  let month = date.getMonth() + 1;
  const day = date.getDate();
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const a = Math.floor(year / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + b - 1524;
}

function ganzhiIndexForDate(date: Date) {
  return ((julianDay(date) + 49) % 60 + 60) % 60;
}

function lunarText(date: Date) {
  try {
    return new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
      month: "long",
      day: "numeric",
    }).format(date);
  } catch {
    return "农历日期";
  }
}

function yearGanzhi(date: Date) {
  const year = date.getFullYear();
  return GANZHI[((year - 4) % 60 + 60) % 60];
}

function elementForStem(stem: string) {
  const map: Record<string, string> = {
    甲: "阳木", 乙: "阴木", 丙: "阳火", 丁: "阴火", 戊: "阳土",
    己: "阴土", 庚: "阳金", 辛: "阴金", 壬: "阳水", 癸: "阴水",
  };
  return map[stem];
}

function solarTerm(date: Date) {
  const key = `${date.getMonth() + 1}-${date.getDate()}`;
  const approximate: Record<string, string> = {
    "1-5": "小寒", "1-20": "大寒", "2-4": "立春", "2-19": "雨水",
    "3-5": "惊蛰", "3-20": "春分", "4-4": "清明", "4-20": "谷雨",
    "5-5": "立夏", "5-21": "小满", "6-5": "芒种", "6-21": "夏至",
    "7-7": "小暑", "7-22": "大暑", "8-7": "立秋", "8-23": "处暑",
    "9-7": "白露", "9-23": "秋分", "10-8": "寒露", "10-23": "霜降",
    "11-7": "立冬", "11-22": "小雪", "12-7": "大雪", "12-21": "冬至",
  };
  return approximate[key] ?? "节气之间";
}

function createMarketData() {
  const result: Candle[] = [];
  const cursor = new Date(2024, 0, 2);
  const end = new Date(2026, 7, 11);
  let lastClose = 3382;
  let seed = 92841;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      const drift = Math.sin(result.length / 31) * 0.003 + 0.00025;
      const change = (random() - 0.48) * 0.023 + drift;
      const open = lastClose * (1 + (random() - 0.5) * 0.007);
      const close = lastClose * (1 + change);
      const high = Math.max(open, close) * (1 + random() * 0.009);
      const low = Math.min(open, close) * (1 - random() * 0.009);
      result.push({
        date: new Date(cursor), open, high, low, close,
        volume: 155 + random() * 145,
        ganzhiIndex: ganzhiIndexForDate(cursor),
      });
      lastClose = close;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

function normalizeMarketDataset(raw: RawMarketDataset, mode: "live" | "static"): MarketDataset {
  const candles = (raw.candles ?? [])
    .map((item) => {
      const date = new Date(`${item.date}T00:00:00`);
      return {
        date,
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        close: Number(item.close),
        volume: Number(item.volume),
        ganzhiIndex: ganzhiIndexForDate(date),
      };
    })
    .filter((item) => (
      !Number.isNaN(item.date.getTime())
      && [item.open, item.high, item.low, item.close, item.volume].every(Number.isFinite)
    ))
    .sort((left, right) => left.date.getTime() - right.date.getTime());
  if (candles.length < 2) throw new Error("行情数据不足");
  return {
    symbol: raw.symbol ?? "000300.SH",
    name: raw.name ?? "沪深300",
    source: raw.source ?? "真实行情",
    volumeUnit: raw.volumeUnit ?? "",
    mode,
    candles,
  };
}

async function loadMarketCatalog(): Promise<{ markets: MarketSummary[]; version: string }> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/markets/index.json`, { cache: "no-store" });
  if (!response.ok) throw new Error("行情清单不可用");
  const raw = await response.json() as { generatedAt?: string; markets?: MarketSummary[] };
  const markets = (raw.markets ?? []).filter((item) => (
    item.id && item.name && item.file
    && Number.isFinite(Number(item.latestClose))
    && Number.isFinite(Number(item.changePct))
  ));
  if (markets.length === 0) throw new Error("行情清单为空");
  return { markets, version: raw.generatedAt ?? "" };
}

async function loadMarketDataset(
  file = "data/market_daily.json",
  allowLocalApi = false,
  version = "",
): Promise<MarketDataset> {
  const apiRoot = import.meta.env.VITE_MARKET_API_URL?.replace(/\/$/, "");
  const sources: Array<{ url: string; mode: "live" | "static" }> = [];
  if (apiRoot && allowLocalApi) sources.push({ url: `${apiRoot}/api/market/daily`, mode: "live" });
  const cacheKey = version ? `?v=${encodeURIComponent(version)}` : "";
  sources.push({ url: `${import.meta.env.BASE_URL}${file}${cacheKey}`, mode: "static" });

  for (const source of sources) {
    try {
      const response = await fetch(source.url, { cache: "no-store" });
      if (!response.ok) continue;
      return normalizeMarketDataset(await response.json() as RawMarketDataset, source.mode);
    } catch {
      // Continue to the next source; the interface always retains its demo fallback.
    }
  }
  throw new Error("没有可用的真实行情数据");
}

function isInGanzhiRange(index: number, start: number, end: number) {
  const distance = (index - start + 60) % 60;
  const span = (end - start + 60) % 60;
  return distance <= span;
}

function buildSegments(data: Candle[], start: number, end: number) {
  const segments: Array<{ start: number; end: number }> = [];
  let currentStart = -1;
  data.forEach((item, index) => {
    const matched = isInGanzhiRange(item.ganzhiIndex, start, end);
    if (matched && currentStart < 0) currentStart = index;
    const nextMatched = index < data.length - 1
      ? isInGanzhiRange(data[index + 1].ganzhiIndex, start, end)
      : false;
    if (matched && !nextMatched) {
      segments.push({ start: currentStart, end: index });
      currentStart = -1;
    }
  });
  return segments;
}

function formatPrice(value: number) {
  return value.toFixed(2);
}

function MarketChart({
  data,
  startGanzhi,
  endGanzhi,
  filterEnabled,
  viewCount,
  viewportEnd,
  selectedIndex,
  onSelect,
  onViewportChange,
  onResetView,
}: {
  data: Candle[];
  startGanzhi: number;
  endGanzhi: number;
  filterEnabled: boolean;
  viewCount: number;
  viewportEnd: number;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  onViewportChange: (viewCount: number, viewportEnd: number) => void;
  onResetView: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1000, height: 510 });
  const [tooltip, setTooltip] = useState({ x: 0, y: 0 });
  const [activeDetail, setActiveDetail] = useState<DetailKey>("date");
  const [isDragging, setIsDragging] = useState(false);
  const [isTooltipPinned, setIsTooltipPinned] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startEnd: number;
    moved: boolean;
    wasPinned: boolean;
  } | null>(null);
  const tooltipIndexRef = useRef<number | null>(null);

  const startIndex = Math.max(0, viewportEnd - viewCount + 1);
  const visible = data.slice(startIndex, viewportEnd + 1);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const resize = () => setSize({ width: node.clientWidth, height: Math.max(430, node.clientHeight) });
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || visible.length === 0) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = size.width * ratio;
    canvas.height = size.height * ratio;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);

    const pad = { left: 18, right: 70, top: 28, bottom: 45 };
    const plotWidth = size.width - pad.left - pad.right;
    const plotHeight = size.height - pad.top - pad.bottom;
    const min = Math.min(...visible.map((item) => item.low));
    const max = Math.max(...visible.map((item) => item.high));
    const range = max - min || 1;
    const xStep = plotWidth / visible.length;
    const yFor = (value: number) => pad.top + ((max - value) / range) * plotHeight;

    ctx.clearRect(0, 0, size.width, size.height);
    ctx.fillStyle = "#07110f";
    ctx.fillRect(0, 0, size.width, size.height);

    ctx.strokeStyle = "rgba(157, 181, 172, 0.12)";
    ctx.lineWidth = 1;
    ctx.font = "11px ui-monospace, monospace";
    ctx.fillStyle = "#73877f";
    for (let line = 0; line <= 5; line += 1) {
      const y = pad.top + (plotHeight / 5) * line;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(size.width - pad.right + 10, y);
      ctx.stroke();
      const price = max - (range / 5) * line;
      ctx.fillText(price.toFixed(0), size.width - pad.right + 18, y + 4);
    }

    visible.forEach((item, index) => {
      const centerX = pad.left + index * xStep + xStep / 2;
      const up = item.close >= item.open;
      const color = up ? "#ff5364" : "#2fd6a2";
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerX, yFor(item.high));
      ctx.lineTo(centerX, yFor(item.low));
      ctx.stroke();
      const bodyTop = yFor(Math.max(item.open, item.close));
      const bodyHeight = Math.max(1.5, Math.abs(yFor(item.open) - yFor(item.close)));
      const bodyWidth = Math.max(1.5, Math.min(8, xStep * 0.62));
      if (up) ctx.fillRect(centerX - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
      else {
        ctx.strokeRect(centerX - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
      }

      if (filterEnabled && isInGanzhiRange(item.ganzhiIndex, startGanzhi, endGanzhi)) {
        ctx.save();
        ctx.strokeStyle = "rgba(207, 255, 93, 0.96)";
        ctx.lineWidth = Math.max(1, Math.min(1.8, xStep * 0.16));
        ctx.shadowColor = "rgba(207, 255, 93, 0.82)";
        ctx.shadowBlur = 7;
        ctx.beginPath();
        ctx.moveTo(centerX, yFor(item.high) - 1);
        ctx.lineTo(centerX, yFor(item.low) + 1);
        ctx.stroke();
        ctx.strokeRect(
          centerX - bodyWidth / 2 - 1.5,
          bodyTop - 1.5,
          bodyWidth + 3,
          bodyHeight + 3,
        );
        ctx.restore();
      }
    });

    if (selectedIndex !== null && selectedIndex >= startIndex && selectedIndex <= viewportEnd) {
      const localIndex = selectedIndex - startIndex;
      const x = pad.left + localIndex * xStep + xStep / 2;
      const item = data[selectedIndex];
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(231, 245, 239, 0.48)";
      ctx.beginPath();
      ctx.moveTo(x, pad.top - 8);
      ctx.lineTo(x, pad.top + plotHeight + 8);
      ctx.stroke();
      ctx.fillStyle = "#e8f4ef";
      ctx.font = "11px ui-monospace, monospace";
      ctx.fillText(toIso(item.date), Math.min(x + 8, size.width - 145), size.height - 15);
      ctx.restore();
    }

    const labelCount = Math.min(6, visible.length);
    ctx.fillStyle = "#73877f";
    ctx.font = "11px ui-monospace, monospace";
    for (let index = 0; index < labelCount; index += 1) {
      const dataIndex = Math.floor((index / Math.max(1, labelCount - 1)) * (visible.length - 1));
      const item = visible[dataIndex];
      const x = pad.left + dataIndex * xStep;
      ctx.fillText(`${item.date.getFullYear()}.${String(item.date.getMonth() + 1).padStart(2, "0")}`, x, size.height - 16);
    }
  }, [data, endGanzhi, filterEnabled, selectedIndex, size, startGanzhi, startIndex, viewportEnd, visible]);

  useEffect(() => draw(), [draw]);

  const locate = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || visible.length === 0) return;
    const bounds = canvas.getBoundingClientRect();
    const plotWidth = bounds.width - 18 - 70;
    const rawIndex = Math.floor(((clientX - bounds.left - 18) / plotWidth) * visible.length);
    const localIndex = Math.max(0, Math.min(visible.length - 1, rawIndex));
    const nextIndex = startIndex + localIndex;
    onSelect(nextIndex);

    // Keep the tooltip still while the pointer moves from the candle into it.
    // Reposition only when the user reaches a different candle.
    if (tooltipIndexRef.current !== nextIndex) {
      tooltipIndexRef.current = nextIndex;
      setTooltip({
        x: Math.min(Math.max(clientX - bounds.left + 14, 20), bounds.width - 510),
        y: Math.min(Math.max(clientY - bounds.top + 14, 14), bounds.height - 260),
      });
    }
    return nextIndex;
  };

  const zoomAt = (clientX: number, deltaY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const plotLeft = bounds.left + 18;
    const plotWidth = Math.max(1, bounds.width - 18 - 70);
    const anchorRatio = Math.max(0, Math.min(1, (clientX - plotLeft) / plotWidth));
    const anchorIndex = startIndex + anchorRatio * Math.max(1, viewCount - 1);
    const scale = Math.exp(deltaY * 0.00125);
    const nextCount = Math.max(24, Math.min(data.length, Math.round(viewCount * scale)));
    let nextStart = Math.round(anchorIndex - anchorRatio * Math.max(1, nextCount - 1));
    nextStart = Math.max(0, Math.min(data.length - nextCount, nextStart));
    onViewportChange(nextCount, nextStart + nextCount - 1);
  };

  const panTo = (clientX: number) => {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || !canvas) return;
    const plotWidth = Math.max(1, canvas.getBoundingClientRect().width - 18 - 70);
    const candleWidth = plotWidth / Math.max(1, viewCount);
    const candleDelta = Math.round((clientX - drag.startX) / candleWidth);
    if (Math.abs(clientX - drag.startX) > 3 && !drag.moved) {
      drag.moved = true;
      setIsTooltipPinned(false);
      tooltipIndexRef.current = null;
      onSelect(null);
    }
    const nextEnd = Math.max(viewCount - 1, Math.min(data.length - 1, drag.startEnd - candleDelta));
    onViewportChange(viewCount, nextEnd);
  };

  const selected = selectedIndex === null ? null : data[selectedIndex];
  const details: Record<DetailKey, { title: string; rows: Array<[string, string]> }> = selected ? {
    date: {
      title: "公历与农历",
      rows: [["公历", toIso(selected.date)], ["星期", WEEKDAYS[selected.date.getDay()]], ["农历", lunarText(selected.date)]],
    },
    pillars: {
      title: "年 · 月 · 日柱",
      rows: [["年柱", yearGanzhi(selected.date)], ["月柱", `${STEMS[(selected.date.getMonth() + 2) % 10]}${BRANCHES[(selected.date.getMonth() + 2) % 12]}`], ["日柱", GANZHI[selected.ganzhiIndex]]],
    },
    elements: {
      title: "五行与阴阳",
      rows: [["日干", `${GANZHI[selected.ganzhiIndex][0]} · ${elementForStem(GANZHI[selected.ganzhiIndex][0])}`], ["日支", GANZHI[selected.ganzhiIndex][1]], ["日主", elementForStem(GANZHI[selected.ganzhiIndex][0])]],
    },
    term: {
      title: "二十四节气",
      rows: [["当前", solarTerm(selected.date)], ["季节", ["冬", "春", "春", "春", "夏", "夏", "夏", "秋", "秋", "秋", "冬", "冬"][selected.date.getMonth()]], ["节律", "按自然日连续计算"]],
    },
    lunar: {
      title: "月相及其他",
      rows: [["农历", lunarText(selected.date)], ["交易日", "日线"], ["历法口径", "北京时间"]],
    },
  } : {} as Record<DetailKey, { title: string; rows: Array<[string, string]> }>;

  const menus: Array<{ key: DetailKey; label: string }> = [
    { key: "date", label: "公历与农历" },
    { key: "pillars", label: "年 · 月 · 日柱" },
    { key: "elements", label: "天干地支 · 五行" },
    { key: "term", label: "二十四节气" },
    { key: "lunar", label: "月相及其他" },
  ];

  return (
    <div
      className={`chart-stage ${isDragging ? "dragging" : ""}`}
      ref={containerRef}
      onMouseLeave={() => {
        if (!isDragging && !isTooltipPinned) {
          tooltipIndexRef.current = null;
          onSelect(null);
        }
      }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const base = selectedIndex ?? viewportEnd;
        onSelect(Math.max(startIndex, Math.min(viewportEnd, base + (event.key === "ArrowRight" ? 1 : -1))));
      }}
    >
      <canvas
        ref={canvasRef}
        tabIndex={0}
        aria-label="指数日K线，可滚轮缩放、拖拽平移，移动鼠标查看行情与传统历法"
        onWheel={(event) => {
          event.preventDefault();
          setIsTooltipPinned(false);
          tooltipIndexRef.current = null;
          onSelect(null);
          zoomAt(event.clientX, event.deltaY);
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = {
            startX: event.clientX,
            startEnd: viewportEnd,
            moved: false,
            wasPinned: isTooltipPinned,
          };
          setIsDragging(true);
        }}
        onPointerMove={(event) => {
          if (dragRef.current) panTo(event.clientX);
          else if (!isTooltipPinned) locate(event.clientX, event.clientY);
        }}
        onPointerUp={(event) => {
          const drag = dragRef.current;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          dragRef.current = null;
          setIsDragging(false);
          if (drag && !drag.moved) {
            if (drag.wasPinned) {
              setIsTooltipPinned(false);
              tooltipIndexRef.current = null;
              onSelect(null);
            } else {
              locate(event.clientX, event.clientY);
              setIsTooltipPinned(true);
            }
          }
        }}
        onPointerCancel={() => {
          dragRef.current = null;
          setIsDragging(false);
        }}
        onDoubleClick={() => {
          setIsTooltipPinned(false);
          tooltipIndexRef.current = null;
          onSelect(null);
          onResetView();
        }}
      />
      {selected && details[activeDetail] && (
        <div className="market-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="tooltip-head">
            <div>
              <strong>{toIso(selected.date)}</strong>
              <span>
                {WEEKDAYS[selected.date.getDay()]} · {GANZHI[selected.ganzhiIndex]}日
                <em className={isTooltipPinned ? "tooltip-lock active" : "tooltip-lock"}>
                  {isTooltipPinned ? "已锁定 · 单击图表取消" : "点击K线锁定"}
                </em>
              </span>
            </div>
            <span className={selected.close >= selected.open ? "quote-up" : "quote-down"}>
              {selected.close >= selected.open ? "+" : ""}{((selected.close / selected.open - 1) * 100).toFixed(2)}%
            </span>
          </div>
          <div className="quote-row">
            <span>开 {formatPrice(selected.open)}</span><span>高 {formatPrice(selected.high)}</span>
            <span>低 {formatPrice(selected.low)}</span><span>收 {formatPrice(selected.close)}</span>
          </div>
          <div className="tooltip-panels">
            <div className="tooltip-menu">
              {menus.map((menu) => (
                <button
                  key={menu.key}
                  className={activeDetail === menu.key ? "active" : ""}
                  onMouseEnter={() => setActiveDetail(menu.key)}
                  onFocus={() => setActiveDetail(menu.key)}
                  onClick={() => setActiveDetail(menu.key)}
                >
                  {menu.label}<span>›</span>
                </button>
              ))}
            </div>
            <div className="tooltip-detail">
              <h4>{details[activeDetail].title}</h4>
              {details[activeDetail].rows.map(([label, value]) => (
                <div className="detail-row" key={label}><span>{label}</span><strong>{value}</strong></div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniCalendar({
  month,
  selected,
  startGanzhi,
  endGanzhi,
  filterEnabled,
  onChangeMonth,
  onPick,
}: {
  month: Date;
  selected: Date | null;
  startGanzhi: number;
  endGanzhi: number;
  filterEnabled: boolean;
  onChangeMonth: (offset: number) => void;
  onPick: (date: Date) => void;
}) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<Date | null> = Array(firstDay).fill(null);
  for (let day = 1; day <= days; day += 1) cells.push(new Date(year, monthIndex, day));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <section className="calendar-card">
      <div className="calendar-title">
        <div><span className="eyebrow">历法日历</span><h3>{year}年 {monthIndex + 1}月</h3></div>
        <div className="month-switch">
          <button aria-label="上个月" onClick={() => onChangeMonth(-1)}>‹</button>
          <button aria-label="下个月" onClick={() => onChangeMonth(1)}>›</button>
        </div>
      </div>
      <div className="week-row">{["日", "一", "二", "三", "四", "五", "六"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendar-grid">
        {cells.map((date, index) => {
          if (!date) return <span className="day-cell empty" key={`empty-${index}`} />;
          const indexOfGanzhi = ganzhiIndexForDate(date);
          const matched = filterEnabled && isInGanzhiRange(indexOfGanzhi, startGanzhi, endGanzhi);
          const isSelected = selected && toIso(selected) === toIso(date);
          const weekend = date.getDay() === 0 || date.getDay() === 6;
          return (
            <button
              key={toIso(date)}
              className={`day-cell ${matched ? "matched" : ""} ${isSelected ? "selected" : ""} ${weekend ? "weekend" : ""}`}
              onClick={() => onPick(date)}
              aria-label={`${toIso(date)} ${GANZHI[indexOfGanzhi]}日`}
            >
              <strong>{date.getDate()}</strong>
              <span>{GANZHI[indexOfGanzhi]}</span>
            </button>
          );
        })}
      </div>
      <div className="calendar-legend">{filterEnabled && <span><i />命中区间</span>}<span><i className="trade" />交易日</span></div>
    </section>
  );
}

export default function Home() {
  const [marketCatalog, setMarketCatalog] = useState<MarketSummary[]>(FALLBACK_MARKETS);
  const [catalogVersion, setCatalogVersion] = useState("");
  const [activeMarketId, setActiveMarketId] = useState("sh000300");
  const [market, setMarket] = useState<MarketDataset>(() => ({
    symbol: "sh000300",
    name: "沪深300",
    source: "演示数据",
    volumeUnit: "亿",
    mode: "demo",
    candles: createMarketData(),
  }));
  const data = market.candles;
  const [draftStart, setDraftStart] = useState(0);
  const [draftEnd, setDraftEnd] = useState(10);
  const [range, setRange] = useState({ start: 0, end: 10 });
  const [filterMode, setFilterMode] = useState<"closed" | "editing" | "active">("closed");
  const [viewKey, setViewKey] = useState("1年");
  const [visibleCount, setVisibleCount] = useState(Math.min(VIEW_COUNTS["1年"], data.length));
  const [viewportEnd, setViewportEnd] = useState(data.length - 1);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date(2026, 7, 1));

  useEffect(() => {
    let cancelled = false;
    loadMarketCatalog().then(({ markets, version }) => {
      if (cancelled) return;
      setMarketCatalog(markets);
      setCatalogVersion(version);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const activeMarket = marketCatalog.find((item) => item.id === activeMarketId)
    ?? marketCatalog[0]
    ?? FALLBACK_MARKETS[0];

  useEffect(() => {
    let cancelled = false;
    loadMarketDataset(activeMarket.file, activeMarket.id === "sh000300", catalogVersion).then((dataset) => {
      if (!cancelled) setMarket(dataset);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [activeMarket.file, activeMarket.id, catalogVersion]);

  useEffect(() => {
    setViewKey("1年");
    setVisibleCount(Math.min(VIEW_COUNTS["1年"], data.length));
    setViewportEnd(data.length - 1);
    setSelectedIndex(null);
    const latestDate = data[data.length - 1]?.date;
    if (latestDate) setCalendarMonth(new Date(latestDate.getFullYear(), latestDate.getMonth(), 1));
  }, [data]);

  const filterEnabled = filterMode === "active";
  const segments = useMemo(
    () => filterEnabled ? buildSegments(data, range.start, range.end) : [],
    [data, filterEnabled, range],
  );
  const currentSegment = segments.findIndex((segment) => viewportEnd >= segment.start && viewportEnd <= segment.end + visibleCount / 2);
  const latest = data[data.length - 1];
  const previous = data[data.length - 2];
  const change = (latest.close / previous.close - 1) * 100;

  const navigateSegment = (direction: number) => {
    if (segments.length === 0) return;
    const base = currentSegment >= 0 ? currentSegment : segments.length - 1;
    const next = (base + direction + segments.length) % segments.length;
    const segment = segments[next];
    setViewportEnd(Math.min(data.length - 1, segment.end + Math.floor(visibleCount * 0.45)));
    setSelectedIndex(segment.start);
  };

  const selectView = (key: string) => {
    setViewKey(key);
    setVisibleCount(Math.min(VIEW_COUNTS[key], data.length));
    setViewportEnd(data.length - 1);
    setSelectedIndex(null);
  };

  const pickCalendarDate = (date: Date) => {
    let nearest = 0;
    let distance = Number.POSITIVE_INFINITY;
    data.forEach((item, index) => {
      const currentDistance = Math.abs(item.date.getTime() - date.getTime());
      if (currentDistance < distance) {
        distance = currentDistance;
        nearest = index;
      }
    });
    setSelectedIndex(nearest);
    setViewportEnd(Math.min(data.length - 1, nearest + Math.floor(visibleCount * 0.62)));
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">历</div>
          <div><strong>节律研究所</strong><span>传统历法量化研究台</span></div>
        </div>
        <nav aria-label="主导航">
          <button className="nav-active">行情研究</button>
          <button disabled>策略回测 <em>即将上线</em></button>
          <button disabled>因子库</button>
        </nav>
        <div className="top-actions">
          <span className="developer-credit">Developed by <strong>Yylynn</strong></span>
          <button className="icon-button" aria-label="通知">○</button>
          <button className="avatar">研</button>
        </div>
      </header>

      <section className="workspace">
        <aside className="watchlist">
          <div className="watch-head"><span>自选行情</span><button>＋</button></div>
          <label className="market-search"><span>⌕</span><input aria-label="搜索标的" placeholder="代码 / 名称" /></label>
          <div className="watch-tabs"><button className="active">指数</button><button>股票</button><button>期货</button></div>
          {marketCatalog.map((item) => (
            <button
              className={`watch-item ${item.id === activeMarketId ? "selected" : ""}`}
              key={item.id}
              onClick={() => setActiveMarketId(item.id)}
              aria-pressed={item.id === activeMarketId}
            >
              <span><strong>{item.name}</strong><small>{item.displayCode}</small></span>
              <span className={item.changePct >= 0 ? "quote-up" : "quote-down"}><strong>{Number(item.latestClose).toFixed(2)}</strong><small>{item.changePct >= 0 ? "+" : ""}{Number(item.changePct).toFixed(2)}%</small></span>
            </button>
          ))}
          <div className="watch-note"><span>●</span><p>当前数据源：{market.source}<br />{market.mode === "live" ? "本机研究接口" : market.mode === "static" ? "每日静态行情" : "行情尚未导入"}</p></div>
        </aside>

        <section className="main-panel">
          <div className="instrument-row">
            <div className="instrument-title"><span className="market-badge">{activeMarket.badge}</span><div><h1>{market.name} <small>{activeMarket.displayCode}</small></h1><p>日线 · {market.mode === "live" ? "本机实时同步" : market.mode === "static" ? "每日更新" : "演示行情"} · {market.source}</p></div></div>
            <div className="headline-quote"><strong className={change >= 0 ? "quote-up" : "quote-down"}>{latest.close.toFixed(2)}</strong><span className={change >= 0 ? "quote-up" : "quote-down"}>{change >= 0 ? "+" : ""}{change.toFixed(2)}%</span></div>
            <div className="ohlc"><span>开 <strong>{latest.open.toFixed(2)}</strong></span><span>高 <strong>{latest.high.toFixed(2)}</strong></span><span>低 <strong>{latest.low.toFixed(2)}</strong></span><span>量 <strong>{latest.volume.toFixed(1)}{market.volumeUnit}</strong></span></div>
          </div>

          <div className={`filter-bar ${filterMode === "closed" ? "collapsed" : ""}`}>
            <div className="filter-title"><span className={`pulse ${filterEnabled ? "" : "inactive"}`} />日柱区间</div>
            {filterMode === "closed" && (
              <button className="filter-launch" onClick={() => setFilterMode("editing")}>＋ 选择日柱区间</button>
            )}
            {filterMode === "editing" && (
              <div className="select-group">
                <label>起点<select value={draftStart} onChange={(event) => setDraftStart(Number(event.target.value))}>{GANZHI.map((item, index) => <option value={index} key={item}>{item}</option>)}</select></label>
                <span className="range-arrow">→</span>
                <label>终点<select value={draftEnd} onChange={(event) => setDraftEnd(Number(event.target.value))}>{GANZHI.map((item, index) => <option value={index} key={item}>{item}</option>)}</select></label>
                <button className="apply-button" onClick={() => { setRange({ start: draftStart, end: draftEnd }); setFilterMode("active"); }}>应用筛选</button>
                <button className="filter-cancel" onClick={() => setFilterMode("closed")}>取消</button>
              </div>
            )}
            {filterMode === "active" && (
              <>
                <div className="match-summary"><strong>{GANZHI[range.start]} → {GANZHI[range.end]}</strong><span>命中 {segments.length} 段</span></div>
                <div className="segment-nav"><button onClick={() => navigateSegment(-1)} aria-label="上一段">‹</button><button onClick={() => navigateSegment(1)} aria-label="下一段">›</button></div>
                <button className="filter-edit" onClick={() => setFilterMode("editing")}>修改</button>
                <button className="filter-close" onClick={() => { setFilterMode("closed"); setSelectedIndex(null); }} aria-label="关闭日柱筛选">×</button>
              </>
            )}
          </div>

          <div className="chart-toolbar">
            <div><button className="tool-active">K线</button><button>分时</button><span className="divider" /><button>MA</button><button>VOL</button></div>
            <div className="view-switch">{Object.keys(VIEW_COUNTS).map((key) => <button className={viewKey === key ? "active" : ""} onClick={() => selectView(key)} key={key}>{key}</button>)}</div>
          </div>

          <MarketChart
            data={data}
            startGanzhi={range.start}
            endGanzhi={range.end}
            filterEnabled={filterEnabled}
            viewCount={visibleCount}
            viewportEnd={viewportEnd}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onViewportChange={(count, end) => {
              setViewKey("");
              setVisibleCount(count);
              setViewportEnd(end);
            }}
            onResetView={() => selectView("1年")}
          />
          <div className="chart-status">
            <span>{filterEnabled ? <><i className="status-box" />荧光描边：{GANZHI[range.start]}日至{GANZHI[range.end]}日柱区间</> : "尚未启用日柱筛选"}</span>
            <span>滚轮缩放 · 拖拽平移 · 双击复位</span>
          </div>
        </section>

        <aside className="right-panel">
          <section className="today-card">
            <div className="today-head"><span className="eyebrow">今日历法</span><span>{toIso(latest.date)}</span></div>
            <div className="pillar-display"><strong>{GANZHI[latest.ganzhiIndex]}</strong><span>日柱</span></div>
            <div className="today-grid"><span>农历<strong>{lunarText(latest.date)}</strong></span><span>节气<strong>{solarTerm(latest.date)}</strong></span><span>年柱<strong>{yearGanzhi(latest.date)}</strong></span><span>日主<strong>{elementForStem(GANZHI[latest.ganzhiIndex][0])}</strong></span></div>
          </section>
          <MiniCalendar
            month={calendarMonth}
            selected={selectedIndex === null ? null : data[selectedIndex].date}
            startGanzhi={range.start}
            endGanzhi={range.end}
            filterEnabled={filterEnabled}
            onChangeMonth={(offset) => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + offset, 1))}
            onPick={pickCalendarDate}
          />
          <section className="saved-card"><div><span className="eyebrow">研究入口</span><h3>保存为研究条件</h3></div><p>组合筛选、统计分析与策略回测将在后续版本开放。</p><button disabled>保存条件</button></section>
        </aside>
      </section>
    </main>
  );
}
