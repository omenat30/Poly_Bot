"""Utilidades: HTTP con reintentos, límite de ritmo, saneado de texto."""
import json
import re
import threading
import time
import urllib.error
import urllib.request

_KEY_RE = re.compile(r"((?:api[-_]?key|key|token)=)[^&\s\"']+", re.I)
_CTRL_RE = re.compile(r"[\x00-\x1f\x7f<>]")


def redact(s):
    """Quita claves de API de cualquier texto antes de registrarlo."""
    return _KEY_RE.sub(r"\1***", str(s))


def clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def sanitize_text(s, n=40):
    """Nombres y símbolos de tokens son datos no fiables: sin control ni HTML."""
    return _CTRL_RE.sub("", str(s or ""))[:n]


class RateLimiter:
    def __init__(self, per_second):
        self.gap = 1.0 / max(per_second, 0.1)
        self._next = 0.0
        self._lock = threading.Lock()

    def wait(self):
        with self._lock:
            now = time.monotonic()
            delay = max(0.0, self._next - now)
            self._next = max(now, self._next) + self.gap
        if delay:
            time.sleep(delay)


class HttpError(Exception):
    pass


def http_json(url, *, body=None, headers=None, timeout=15, retries=2, limiter=None):
    data = json.dumps(body).encode() if body is not None else None
    h = {"User-Agent": "memecoin-migration-radar/0.1", "Accept": "application/json"}
    if data:
        h["Content-Type"] = "application/json"
    h.update(headers or {})
    last = None
    for i in range(retries + 1):
        if limiter:
            limiter.wait()
        try:
            req = urllib.request.Request(url, data=data, headers=h)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            last = HttpError(f"HTTP {e.code} en {redact(url)}")
            last.code = e.code
            if e.code == 429:
                time.sleep(1.5 * (i + 1))
            elif 400 <= e.code < 500:
                break
        except Exception as e:  # red, JSON, timeout
            last = HttpError(f"{type(e).__name__} en {redact(url)}: {redact(e)}")
            last.code = None
            time.sleep(0.5 * (i + 1))
    raise last


def median(xs):
    xs = sorted(xs)
    n = len(xs)
    if not n:
        return None
    return xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2
