#!/usr/bin/env python3
"""Extrai HTML limpo das páginas WordPress e prepara assets locais."""

from __future__ import annotations

import base64
import hashlib
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "raw"
PUBLIC_IMAGES = ROOT / "public" / "images"
PAGES_DIR = ROOT / "src" / "pages"

SOURCES = {
    "vendas-rc-v3": RAW_DIR / "temp-v3.html",
    "vendas-rc-v3-vsl": RAW_DIR / "temp-vsl.html",
}


def extract_inner_html(html: str) -> str:
    marker = "<!DOCTYPE html>"
    first = html.find(marker)
    second = html.find(marker, first + 1) if first != -1 else -1
    start = second if second != -1 else first
    if start == -1:
        raise ValueError("DOCTYPE interno não encontrado")
    end = html.find("</html>", start)
    if end == -1:
        raise ValueError("Fechamento </html> não encontrado")
    return html[start : end + 7]


def save_base64_images(html: str) -> str:
    pattern = re.compile(
        r'(src=")(data:image/(?P<fmt>[^;]+);base64,(?P<data>[^"]+))(")',
        re.DOTALL,
    )
    counter = 0

    def repl(match: re.Match[str]) -> str:
        nonlocal counter
        fmt = match.group("fmt").replace("jpeg", "jpg")
        data = match.group("data")
        digest = hashlib.md5(data[:2000].encode()).hexdigest()[:10]
        filename = f"inline-{digest}.{fmt}"
        path = PUBLIC_IMAGES / filename
        if not path.exists():
            path.write_bytes(base64.b64decode(data))
        counter += 1
        return f'{match.group(1)}/images/{filename}{match.group(5)}'

    html = pattern.sub(repl, html)
    print(f"  base64 -> arquivos: {counter}")
    return html


def download_wp_images(html: str) -> str:
    urls = sorted(
        set(
            re.findall(
                r"https://nathmonari\.com\.br/wp-content/uploads/[^\s\"')]+",
                html,
            )
        )
    )
    for url in urls:
        name = url.split("/wp-content/uploads/")[-1].replace("/", "-")
        local = PUBLIC_IMAGES / name
        if not local.exists():
            print(f"  baixando {name}")
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            local.write_bytes(urllib.request.urlopen(req, timeout=60).read())
        html = html.replace(url, f"/images/{name}")
    print(f"  wp uploads: {len(urls)}")
    return html


def strip_scripts(html: str) -> str:
    """Remove scripts WordPress/UTM do wrapper externo se vazarem."""
    return re.sub(r"<script\b[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)


def add_fonts_link(html: str) -> str:
    fonts = (
        '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        '<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1'
        "&family=Libre+Baskerville:wght@400;700&family=Outfit:wght@200;300;400;500"
        '&display=swap" rel="stylesheet">\n'
    )
    if "fonts.googleapis.com/css2" not in html:
        html = html.replace("</head>", f"{fonts}</head>", 1)
    return html


def to_astro_page(html: str, slug: str) -> str:
    body_match = re.search(r"<body[^>]*>(.*)</body>", html, re.DOTALL | re.IGNORECASE)
    style_match = re.search(r"<style>(.*?)</style>", html, re.DOTALL | re.IGNORECASE)
    if not body_match or not style_match:
        raise ValueError(f"body/style não encontrados em {slug}")

    title_match = re.search(r"<title>(.*?)</title>", html, re.DOTALL | re.IGNORECASE)
    title = title_match.group(1) if title_match else "Protocolo RC — Nath Monari"
    description = (
        "Protocolo RC — 10 dias, 10 minutos por dia. "
        "Reconstrua sua autoimagem com Nath Monari."
    )

    body_html = body_match.group(1).strip()
    body_html = re.sub(
        r"<script>.*?</script>\s*$",
        "",
        body_html,
        count=1,
        flags=re.DOTALL | re.IGNORECASE,
    )

    safe_title = title.replace("\\", "\\\\").replace('"', '\\"')

    return f"""---
import LandingLayout from "../layouts/Landing.astro";
import LandingScripts from "../components/LandingScripts.astro";

const title = "{safe_title}";
const description = "{description}";
---

<LandingLayout title={{title}} description={{description}}>
  <style is:global>
{style_match.group(1).strip()}
  </style>

{body_html}

  <LandingScripts />
</LandingLayout>
"""


def main() -> None:
    PUBLIC_IMAGES.mkdir(parents=True, exist_ok=True)
    PAGES_DIR.mkdir(parents=True, exist_ok=True)

    for slug, raw_path in SOURCES.items():
        print(f"\n[{slug}]")
        html = extract_inner_html(raw_path.read_text(encoding="utf-8", errors="replace"))
        html = save_base64_images(html)
        html = download_wp_images(html)
        html = add_fonts_link(html)

        astro = to_astro_page(html, slug)
        out = PAGES_DIR / f"{slug}.astro"
        out.write_text(astro, encoding="utf-8")
        print(f"  -> {out.relative_to(ROOT)} ({len(astro):,} bytes)")


if __name__ == "__main__":
    main()
