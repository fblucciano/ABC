#!/usr/bin/env python3
"""Serve the Venus HTML apps over HTTP so they can be tested in a browser.

Opening the files as file:// can break PDF.js, Tesseract OCR, and PDF export.
Run this script, then use the printed URLs.

Usage:
    python3 serve.py
    python3 serve.py --port 8080
    python3 serve.py --no-browser
"""
from __future__ import annotations

import argparse
import functools
import http.server
import os
import socketserver
import sys
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))


def main() -> int:
    parser = argparse.ArgumentParser(description="Serve Venus LATAM apps locally.")
    parser.add_argument("--port", type=int, default=8080, help="Local port (default: 8080)")
    parser.add_argument("--no-browser", action="store_true", help="Do not open a browser window")
    args = parser.parse_args()

    os.chdir(ROOT)
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)

    class ReuseTCPServer(socketserver.TCPServer):
        allow_reuse_address = True

    try:
        httpd = ReuseTCPServer(("127.0.0.1", args.port), handler)
    except OSError as exc:
        print(f"Could not bind to port {args.port}: {exc}", file=sys.stderr)
        print("Try another port, for example: python3 serve.py --port 8081", file=sys.stderr)
        return 1
    latam = f"http://127.0.0.1:{args.port}/index.html"
    sizing = f"http://127.0.0.1:{args.port}/vitae-sizing.html"
    print("Venus local test server", flush=True)
    print(f"  LATAM Intelligence OS : {latam}", flush=True)
    print(f"  Venus Vitae Sizing    : {sizing}", flush=True)
    print("Press Ctrl+C to stop.", flush=True)

    if not args.no_browser:
        webbrowser.open(sizing)

    try:
        with httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
