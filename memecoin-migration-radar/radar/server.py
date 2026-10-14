"""Servidor local del panel. Solo lectura. Escucha en 127.0.0.1 por defecto."""
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from .state import build_state

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def wrap_page(fragment):
    """El panel se escribe como fragmento (así lo pide el artefacto); en local se envuelve aquí."""
    return ("<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\">"
            "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">"
            "<style>:root{color-scheme:light}body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style>"
            "</head><body>" + fragment + "</body></html>")


def make_handler(store, cfg, mode):
    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def _send(self, code, ctype, body):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            path = self.path.split("?")[0]
            if path in ("/", "/index.html"):
                with open(os.path.join(ROOT, "dashboard", "index.html"), encoding="utf-8") as f:
                    return self._send(200, "text/html; charset=utf-8", wrap_page(f.read()).encode("utf-8"))
            if path == "/api/state":
                return self._send(200, "application/json", json.dumps(build_state(store, cfg, mode=mode)).encode())
            if path == "/favicon.ico":
                return self._send(204, "image/x-icon", b"")
            self._send(404, "text/plain", b"no existe")

        do_POST = do_PUT = do_DELETE = lambda self: self._send(405, "text/plain", b"solo lectura")

    return H


def serve(store, cfg, mode="live", block=True):
    s = cfg["server"]
    srv = ThreadingHTTPServer((s["host"], s["port"]), make_handler(store, cfg, mode))
    print(f"Panel en http://{s['host']}:{s['port']}")
    if block:
        srv.serve_forever()
    return srv
