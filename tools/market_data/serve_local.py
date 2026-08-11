from __future__ import annotations

import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve local research market data")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8765, type=int)
    parser.add_argument(
        "--data",
        type=Path,
        default=Path("public/data/market_daily.json"),
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    data_path = args.data.resolve()

    class Handler(BaseHTTPRequestHandler):
        def _headers(self, status: int, content_type: str) -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()

        def do_GET(self) -> None:  # noqa: N802
            if self.path == "/health":
                self._headers(200, "application/json; charset=utf-8")
                self.wfile.write(b'{"status":"ok"}')
                return
            if self.path.split("?", 1)[0] != "/api/market/daily":
                self._headers(404, "application/json; charset=utf-8")
                self.wfile.write(b'{"error":"not found"}')
                return
            if not data_path.exists():
                self._headers(503, "application/json; charset=utf-8")
                self.wfile.write(b'{"error":"market data has not been imported"}')
                return
            self._headers(200, "application/json; charset=utf-8")
            self.wfile.write(data_path.read_bytes())

        def log_message(self, format: str, *values: object) -> None:
            print(f"[market-api] {format % values}")

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Market API: http://{args.host}:{args.port}/api/market/daily")
    print(f"Data file: {data_path}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
