"""Avisos: texto explicado y correo SOLO al destinatario configurado.

Nada de aquí ejecuta operaciones. El correo sale únicamente del texto que produce
`explain`; no hay correos de prueba ni de relleno (usa `python -m radar check-mail`
solo si lo pides tú, y entonces el asunto lo dice).
"""
import smtplib
import ssl
import time
from email.message import EmailMessage

from .util import redact, sanitize_text


def explain(res, name, symbol):
    c = res["criteria"]
    lines = [f"{symbol or '?'} ({name or '?'}) · puntuación {res['score']:.0f}/100",
             f"Curva {res['progress']:.0f}% · capitalización {res['mcap']:,.0f} USD · precio {res['price']:.8f} USD",
             ""]
    for k in ("curve", "volume", "wallets", "history", "manipulation"):
        x = c[k]
        lines.append(f"- {x['label']}: {x['score']:.0f}/100 (peso {x['weight']}) — {x['note']}")
    sec = res["security"]
    lines.append(f"- Seguridad: {'superada' if sec['ok'] else 'FALLA'}"
                 + (" — " + "; ".join(sec["fails"]) if sec["fails"] else ""))
    return "\n".join(lines)


def build_email(res, name, symbol, cfg):
    mint = res["mint"]
    body = (explain(res, name, symbol) + "\n\n"
            f"Token: {mint}\nhttps://pump.fun/coin/{mint}\nhttps://dexscreener.com/solana/{mint}\n"
            f"Hora UTC: {time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime(res['ts']))}\n\n"
            "Solo aviso. Nada se ejecuta. La mayoría de memecoins va a cero y al llegar por aviso "
            "entras después que los bots. Si no tienes un plan de salida, no entres.\n")
    m = EmailMessage()
    m["Subject"] = sanitize_text(f"ALERTA memecoin {symbol}: curva {res['progress']:.0f}% · puntuación {res['score']:.0f}", 120)
    m["To"] = cfg["email"]["to"]
    m["From"] = cfg["keys"]["smtp_user"]
    m.set_content(body)
    return m


def send_email(res, name, symbol, cfg):
    """Devuelve (ok, nota). Un único destinatario, el configurado."""
    e = cfg["email"]
    if not e["enabled"]:
        return False, "correo desactivado en config"
    to = e["to"]
    if "," in to or ";" in to or " " in to or to.count("@") != 1:
        return False, "destinatario inválido: debe ser una sola dirección"
    if not cfg["keys"]["smtp_user"] or not cfg["keys"]["smtp_password"]:
        return False, "faltan SMTP_USER / SMTP_PASSWORD"
    try:
        msg = build_email(res, name, symbol, cfg)
        with smtplib.SMTP_SSL(e["smtp_host"], e["smtp_port"], context=ssl.create_default_context(), timeout=20) as s:
            s.login(cfg["keys"]["smtp_user"], cfg["keys"]["smtp_password"])
            s.send_message(msg)
        return True, "enviado"
    except Exception as ex:
        return False, redact(f"{type(ex).__name__}: {ex}")
