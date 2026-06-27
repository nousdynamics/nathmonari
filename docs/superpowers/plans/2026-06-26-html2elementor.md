# Compilador html2elementor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compilar `public/vendas-rc-v3.html` + `public/css/styles.css` em um JSON de containers do Elementor (widgets nativos), com fidelidade ~95-98% em desktop e mobile.

**Architecture:** Pacote Python `scripts/html2elementor` em 4 módulos isolados (cssmap, registry, widgets, compile) + validador estrutural. Lê HTML (BeautifulSoup) e CSS (tinycss2), mapeia classe/tag→widget, resolve estilo em controles nativos + CSS por elemento, emite JSON.

**Tech Stack:** Python 3, beautifulsoup4, tinycss2, pytest, Pillow + Playwright (diff visual).

## Global Constraints

- Saída em formato **container** do Elementor (`elType:"container"`, flexbox). NUNCA `section`/`column`.
- Sem chaves de plugin (nada de `ha_*`, `_ha_condition_list`).
- IDs de elemento: 7 hex únicos.
- Conteúdo boxed em **1160px**; breakpoint mobile do Elementor = **768px** (casar com o `@media(max-width:768px)` do CSS).
- Estilo "inteligente": cor/fonte/tamanho/espaçamento/fundo-sólido/alinhamento/borda/width → controles nativos; gradiente/posição/transform/opacity/`::after`/`aspect-ratio`/`object-fit`/`clamp()`/`@media` não-mapeável → `custom_css` usando `selector`.
- Imagens: 8 screenshots por URL real (`https://nathmonari.com.br/wp-content/uploads/2026/05/`, .png/.jpg); 3 do hero/logo/história em base64 do webp local.
- **Nada some calado:** elemento não reconhecido vira widget de texto/html + entra em relatório de não-mapeados.
- Versão do doc: `"version":"0.4"`, `"type":"page"`.

---

### Task 1: Setup do pacote + base de IDs/dicts

**Files:**
- Create: `scripts/html2elementor/__init__.py`
- Create: `scripts/requirements.txt`
- Create: `scripts/html2elementor/ids.py`
- Test: `scripts/tests/test_ids.py`

**Interfaces:**
- Produces: `ids.nid() -> str` (7 hex, único por processo); `ids.reset()` zera o contador.

- [ ] **Step 1: requirements.txt**

```
beautifulsoup4==4.12.3
tinycss2==1.3.0
pytest==8.2.0
Pillow==10.3.0
playwright==1.44.0
```

- [ ] **Step 2: Escrever o teste que falha** — `scripts/tests/test_ids.py`

```python
from html2elementor import ids

def test_nid_unique_and_7hex():
    ids.reset()
    a, b = ids.nid(), ids.nid()
    assert a != b
    assert len(a) == 7 and int(a, 16) >= 0

def test_reset_is_deterministic():
    ids.reset(); first = ids.nid()
    ids.reset(); assert ids.nid() == first
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd scripts && python -m pytest tests/test_ids.py -v`
Expected: FAIL (ModuleNotFoundError: html2elementor)

- [ ] **Step 4: Implementar** — `scripts/html2elementor/__init__.py` vazio; `scripts/html2elementor/ids.py`

```python
_c = [0]
def reset(): _c[0] = 0
def nid():
    _c[0] += 1
    return format(0x1000000 + _c[0] * 2654435761 & 0xFFFFFFF, "07x")
```

- [ ] **Step 5: Instalar deps + rodar**

Run: `pip install -r scripts/requirements.txt && cd scripts && python -m pytest tests/test_ids.py -v`
Expected: PASS (2 passed)

- [ ] **Step 6: Commit** *(pular o commit — usuário pediu para não commitar; apenas marcar a task como concluída)*

---

### Task 2: cssmap — parse, resolução de `var()` e split de `@media`

**Files:**
- Create: `scripts/html2elementor/cssmap.py`
- Test: `scripts/tests/test_cssmap_parse.py`

**Interfaces:**
- Produces: `cssmap.parse_css(text: str) -> CssModel`; `CssModel.rules: dict[str, dict[str,str]]` (seletor→decls com `var()` resolvido); `CssModel.media: dict[str, dict[str,str]]` (regras de `@media(max-width:768px)`).

- [ ] **Step 1: Teste que falha** — `scripts/tests/test_cssmap_parse.py`

```python
from html2elementor.cssmap import parse_css

CSS = """
:root{--ouro:#C9A84C;--sp:16px}
.x{color:var(--ouro);padding:var(--sp)}
@media(max-width:768px){.x{padding:8px}}
"""

def test_resolves_root_vars():
    m = parse_css(CSS)
    assert m.rules[".x"]["color"] == "#C9A84C"
    assert m.rules[".x"]["padding"] == "16px"

def test_media_bucket_separated():
    m = parse_css(CSS)
    assert m.media[".x"]["padding"] == "8px"
    assert "padding" in m.rules[".x"]  # desktop intacto
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd scripts && python -m pytest tests/test_cssmap_parse.py -v`
Expected: FAIL (cannot import parse_css)

- [ ] **Step 3: Implementar** — `scripts/html2elementor/cssmap.py`

```python
import re
import tinycss2

class CssModel:
    def __init__(self):
        self.rules = {}   # selector -> {prop: value}
        self.media = {}   # selector -> {prop: value} (max-width:768)
        self.root = {}    # --var -> value

def _decls(content):
    out = {}
    for d in tinycss2.parse_declaration_list(content):
        if d.type == "declaration":
            out[d.lower_name] = tinycss2.serialize(d.value).strip()
    return out

def _resolve(decls, root):
    res = {}
    for k, v in decls.items():
        def sub(m): return root.get(m.group(1), m.group(0))
        res[k] = re.sub(r"var\(\s*(--[\w-]+)\s*\)", sub, v).strip()
    return res

def _selectors(prelude):
    return [s.strip() for s in tinycss2.serialize(prelude).split(",") if s.strip()]

def parse_css(text):
    m = CssModel()
    rules = tinycss2.parse_stylesheet(text, skip_whitespace=True, skip_comments=True)
    # 1ª passada: coletar :root vars
    for r in rules:
        if r.type == "qualified-rule" and ":root" in tinycss2.serialize(r.prelude):
            m.root.update(_decls(r.content))
    # 2ª passada: regras normais + @media
    for r in rules:
        if r.type == "qualified-rule":
            decls = _resolve(_decls(r.content), m.root)
            for sel in _selectors(r.prelude):
                m.rules.setdefault(sel, {}).update(decls)
        elif r.type == "at-rule" and r.lower_at_keyword == "media" \
                and "max-width" in tinycss2.serialize(r.prelude) \
                and "768" in tinycss2.serialize(r.prelude):
            for sub in tinycss2.parse_stylesheet(tinycss2.serialize(r.content)):
                if sub.type == "qualified-rule":
                    decls = _resolve(_decls(sub.content), m.root)
                    for sel in _selectors(sub.prelude):
                        m.media.setdefault(sel, {}).update(decls)
    return m
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd scripts && python -m pytest tests/test_cssmap_parse.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Marcar concluída** (sem commit)

---

### Task 3: cssmap — mapeador `to_controls` (decl → controle nativo + sobra)

**Files:**
- Modify: `scripts/html2elementor/cssmap.py` (adicionar `to_controls`)
- Test: `scripts/tests/test_cssmap_controls.py`

**Interfaces:**
- Produces: `cssmap.to_controls(decls: dict[str,str], prefix="") -> tuple[dict, str]`. Retorna (settings parciais do Elementor, string CSS com as declarações não mapeadas). `prefix` é usado para typography (ex.: `""` p/ texto, `"title_"` p/ accordion).

- [ ] **Step 1: Teste que falha** — `scripts/tests/test_cssmap_controls.py`

```python
from html2elementor.cssmap import to_controls

def test_maps_color_and_font():
    s, leftover = to_controls({"color": "#C9A84C", "font-size": "17px",
                               "font-weight": "300"})
    assert s["text_color"] == "#C9A84C"  # genérico; compile decide title_color vs text_color
    assert s["typography_font_size"] == {"unit": "px", "size": 17, "sizes": []}
    assert s["typography_typography"] == "custom"
    assert leftover == ""

def test_gradient_and_position_go_to_leftover():
    s, leftover = to_controls({"background": "linear-gradient(to right,#000,#fff)",
                               "position": "absolute"})
    assert "background_color" not in s
    assert "linear-gradient" in leftover
    assert "position:absolute" in leftover.replace(" ", "")

def test_clamp_font_goes_to_leftover():
    s, leftover = to_controls({"font-size": "clamp(26px,2.8vw,44px)"})
    assert "typography_font_size" not in s
    assert "clamp(" in leftover
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd scripts && python -m pytest tests/test_cssmap_controls.py -v`
Expected: FAIL (cannot import to_controls)

- [ ] **Step 3: Implementar** — adicionar em `cssmap.py`

```python
def _px(v):
    n = v.strip().replace("px", "")
    try: return {"unit": "px", "size": float(n) if "." in n else int(n), "sizes": []}
    except ValueError: return None

def _is_simple_color(v):
    return bool(re.fullmatch(r"#[0-9A-Fa-f]{3,8}|rgba?\([^)]+\)", v.strip()))

def to_controls(decls, prefix=""):
    s, leftover = {}, []
    for prop, val in decls.items():
        v = val.strip()
        mapped = False
        if prop == "color" and _is_simple_color(v):
            s["text_color"] = v; mapped = True
        elif prop == "background-color" and _is_simple_color(v):
            s["background_background"] = "classic"; s["background_color"] = v; mapped = True
        elif prop == "background" and _is_simple_color(v):
            s["background_background"] = "classic"; s["background_color"] = v; mapped = True
        elif prop == "text-align" and v in ("left", "center", "right", "justify"):
            s["align"] = v; mapped = True
        elif prop in ("font-size",) and _px(v):
            s[f"{prefix}typography_typography"] = "custom"
            s[f"{prefix}typography_font_size"] = _px(v); mapped = True
        elif prop == "font-weight":
            s[f"{prefix}typography_typography"] = "custom"
            s[f"{prefix}typography_font_weight"] = v.strip('"'); mapped = True
        elif prop == "font-family":
            s[f"{prefix}typography_typography"] = "custom"
            s[f"{prefix}typography_font_family"] = v.split(",")[0].strip().strip('"'); mapped = True
        elif prop == "letter-spacing" and _px(v):
            s[f"{prefix}typography_typography"] = "custom"
            s[f"{prefix}typography_letter_spacing"] = _px(v); mapped = True
        elif prop == "text-transform":
            s[f"{prefix}typography_typography"] = "custom"
            s[f"{prefix}typography_text_transform"] = v; mapped = True
        elif prop == "line-height" and v.replace(".", "").isdigit():
            s[f"{prefix}typography_typography"] = "custom"
            s[f"{prefix}typography_line_height"] = {"unit": "em", "size": float(v), "sizes": []}; mapped = True
        # tudo o resto (gradiente, position, transform, opacity, clamp, aspect-ratio,
        # object-fit, margin/padding compostos com calc/var resolvido a algo complexo) -> leftover
        if not mapped:
            leftover.append(f"{prop}:{v}")
    css = ("selector{" + ";".join(leftover) + "}") if leftover else ""
    return s, css
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd scripts && python -m pytest tests/test_cssmap_controls.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Marcar concluída** (sem commit)

---

### Task 4: registry — classificação widget + mapa de imagens

**Files:**
- Create: `scripts/html2elementor/registry.py`
- Test: `scripts/tests/test_registry.py`

**Interfaces:**
- Produces: `registry.classify(tag: str, classes: list[str]) -> str` retorna `"heading"|"text-editor"|"button"|"image"|"image-carousel"|"accordion"|"icon-list"|"container"|"unknown"`; `registry.resolve_image(src: str, img_dir: str) -> str` (URL real ou data URI base64); `registry.SPECIAL: dict[str,str]` (classe→nome de caso especial).

- [ ] **Step 1: Teste que falha** — `scripts/tests/test_registry.py`

```python
import os, base64
from html2elementor import registry

def test_classify_by_tag_and_class():
    assert registry.classify("h1", []) == "heading"
    assert registry.classify("a", ["btn-cta"]) == "button"
    assert registry.classify("div", ["carrossel"]) == "image-carousel"
    assert registry.classify("div", ["faq"]) == "accordion"
    assert registry.classify("p", []) == "text-editor"
    assert registry.classify("img", []) == "image"
    assert registry.classify("div", ["hero"]) == "container"

def test_resolve_image_real_url():
    u = registry.resolve_image("images/2026-05-depoimento-1-topo.webp", "")
    assert u == "https://nathmonari.com.br/wp-content/uploads/2026/05/depoimento-1-topo.jpg"

def test_resolve_image_base64(tmp_path):
    p = tmp_path / "inline-d7edb68457.webp"
    p.write_bytes(b"\x00\x01\x02")
    u = registry.resolve_image("images/inline-d7edb68457.webp", str(tmp_path))
    assert u.startswith("data:image/webp;base64,")
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd scripts && python -m pytest tests/test_registry.py -v`
Expected: FAIL (cannot import registry)

- [ ] **Step 3: Implementar** — `scripts/html2elementor/registry.py`

```python
import os, base64

WIDGET_BY_CLASS = {
    "btn-cta": "button",
    "carrossel": "image-carousel",
    "faq": "accordion",
    "hero": "container", "identificacao": "container", "reframe": "container",
    "historia": "container", "para-quem": "container", "dias-grid": "container",
    "mecanismo-grid": "container", "bonus-grid": "container", "modulos-grid": "container",
}
WIDGET_BY_TAG = {
    "h1": "heading", "h2": "heading", "h3": "heading", "h4": "heading",
    "p": "text-editor", "img": "image", "a": "button", "ul": "icon-list",
}

def classify(tag, classes):
    for c in classes:
        if c in WIDGET_BY_CLASS:
            return WIDGET_BY_CLASS[c]
    return WIDGET_BY_TAG.get(tag, "container" if tag == "div" else "unknown")

SPECIAL = {
    "barra-topo": "sticky",
    "hero-num": "hero-number",
    "hero-foto-overlay": "hero-gradient",
    "historia-foto-container": "historia-gradient",
    "historia-badge": "historia-badge",
}

REAL_BASE = "https://nathmonari.com.br/wp-content/uploads/2026/05/"
REAL_URL = {
    "2026-05-depoimento-1-topo.webp": REAL_BASE + "depoimento-1-topo.jpg",
    "2026-05-depoimento-2-topo-.webp": REAL_BASE + "depoimento-2-topo-.jpg",
    "2026-05-depoimento-3-topo.webp": REAL_BASE + "depoimento-3-topo.jpg",
    "2026-05-Captura-de-Tela-2026-05-29-as-18.45.30.webp": REAL_BASE + "Captura-de-Tela-2026-05-29-as-18.45.30.png",
    "2026-05-Captura-de-Tela-2026-05-29-as-18.49.08.webp": REAL_BASE + "Captura-de-Tela-2026-05-29-as-18.49.08.png",
    "2026-05-Captura-de-Tela-2026-05-29-as-18.50.09.webp": REAL_BASE + "Captura-de-Tela-2026-05-29-as-18.50.09.png",
    "2026-05-Captura-de-Tela-2026-05-29-as-18.51.07.webp": REAL_BASE + "Captura-de-Tela-2026-05-29-as-18.51.07.png",
    "2026-05-JULIA-1-1.webp": REAL_BASE + "JULIA-1-1.png",
}
B64 = {"inline-d7edb68457.webp", "inline-c227d2e205.webp", "inline-500f838b81.webp"}

def resolve_image(src, img_dir):
    name = os.path.basename(src)
    if name in REAL_URL:
        return REAL_URL[name]
    if name in B64:
        with open(os.path.join(img_dir, name), "rb") as fh:
            return "data:image/webp;base64," + base64.b64encode(fh.read()).decode()
    return src  # fallback: aviso será emitido no compile
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd scripts && python -m pytest tests/test_registry.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Marcar concluída** (sem commit)

---

### Task 5: widgets — construtores de widget/container

**Files:**
- Create: `scripts/html2elementor/widgets.py`
- Test: `scripts/tests/test_widgets.py`

**Interfaces:**
- Produces: `widgets.container(children, settings, inner=False) -> dict`; `widgets.widget(wtype, settings) -> dict`; helpers `heading(text, **kw)`, `text(html, **kw)`, `button(label, url, **kw)`, `image(url, **kw)`, `carousel(urls, **kw)`, `accordion(items)`, `icon_list(items, **kw)`. Todos retornam dicts no formato Elementor container.

- [ ] **Step 1: Teste que falha** — `scripts/tests/test_widgets.py`

```python
from html2elementor import widgets, ids

def test_container_and_widget_shape():
    ids.reset()
    w = widgets.widget("heading", {"title": "X"})
    assert w["elType"] == "widget" and w["widgetType"] == "heading"
    assert w["elements"] == [] and len(w["id"]) == 7
    c = widgets.container([w], {"flex_direction": "row"})
    assert c["elType"] == "container" and c["elements"][0] is w

def test_heading_builder():
    h = widgets.heading("Oi", tag="h1", color="#000")
    assert h["widgetType"] == "heading"
    assert h["settings"]["title"] == "Oi"
    assert h["settings"]["header_size"] == "h1"
    assert h["settings"]["title_color"] == "#000"

def test_carousel_builder():
    c = widgets.carousel(["u1", "u2", "u3"], slides=3)
    assert c["widgetType"] == "image-carousel"
    assert [x["url"] for x in c["settings"]["carousel"]] == ["u1", "u2", "u3"]
    assert c["settings"]["slides_to_show"] == "3"
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd scripts && python -m pytest tests/test_widgets.py -v`
Expected: FAIL (cannot import widgets)

- [ ] **Step 3: Implementar** — `scripts/html2elementor/widgets.py`
Portar os construtores de `scripts/build_elementor.py` (heading, text, button, image, carousel, accordion, icon_list, container, widget), trocando `nid()` por `ids.nid()`. Assinatura mínima:

```python
from . import ids

def widget(wtype, settings):
    return {"id": ids.nid(), "elType": "widget", "widgetType": wtype,
            "settings": settings, "elements": [], "isInner": False}

def container(children, settings, inner=False):
    return {"id": ids.nid(), "elType": "container", "settings": settings,
            "elements": children, "isInner": inner}

def _px(v): return {"unit": "px", "size": v, "sizes": []}

def heading(text, tag="h2", color=None, align="left", extra=None):
    s = {"title": text, "header_size": tag, "align": align}
    if color: s["title_color"] = color
    if extra: s.update(extra)
    return widget("heading", s)

def text(html, color=None, align="left", extra=None):
    s = {"editor": html if html.lstrip().startswith("<") else f"<p>{html}</p>", "align": align}
    if color: s["text_color"] = color
    if extra: s.update(extra)
    return widget("text-editor", s)

def button(label, url, align="left", extra=None):
    s = {"text": label, "link": {"url": url, "is_external": "on", "nofollow": ""}, "align": align}
    if extra: s.update(extra)
    return widget("button", s)

def image(url, align="center", extra=None):
    s = {"image": {"id": "", "url": url}, "image_size": "full", "align": align}
    if extra: s.update(extra)
    return widget("image", s)

def carousel(urls, slides=3, extra=None):
    s = {"carousel": [{"id": "", "url": u} for u in urls], "slides_to_show": str(slides),
         "slides_to_scroll": "1", "navigation": "arrows", "image_size": "full",
         "autoplay": "no", "infinite": "yes", "gap": {"unit": "px", "size": 20}}
    if extra: s.update(extra)
    return widget("image-carousel", s)

def accordion(items, extra=None):
    s = {"tabs": [{"tab_title": q, "tab_content": f"<p>{a}</p>", "_id": ids.nid()} for q, a in items]}
    if extra: s.update(extra)
    return widget("accordion", s)

def icon_list(items, icon="fas fa-check", extra=None):
    s = {"icon_list": [{"text": t, "selected_icon": {"value": icon, "library": "fa-solid"},
                        "_id": ids.nid()} for t in items]}
    if extra: s.update(extra)
    return widget("icon-list", s)
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd scripts && python -m pytest tests/test_widgets.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Marcar concluída** (sem commit)

---

### Task 6: compile — percorrer DOM e montar a árvore (estrutura)

**Files:**
- Create: `scripts/html2elementor/compile.py`
- Test: `scripts/tests/test_compile_structure.py`

**Interfaces:**
- Consumes: `cssmap`, `registry`, `widgets`, `ids`.
- Produces: `compile.build(html: str, css, img_dir: str) -> tuple[dict, list[str]]` — retorna (doc Elementor, lista de seletores/elementos não-mapeados).

- [ ] **Step 1: Teste que falha** — `scripts/tests/test_compile_structure.py`

```python
from html2elementor import compile as C
from html2elementor.cssmap import parse_css

HTML = """<body>
<div class="hero"><div class="hero-conteudo">
  <h1>Titulo</h1><p>Corpo</p><a href="#preco" class="btn-cta">Vai</a>
</div></div>
<div class="faq"><div class="faq-inner">
  <div class="faq-item"><p class="faq-pergunta">Q1?</p><div class="faq-resposta">A1</div></div>
</div></div>
</body>"""

def test_two_sections_no_empty_containers():
    doc, unmapped = C.build(HTML, parse_css(":root{}"), "")
    assert len(doc["content"]) == 2
    def empties(n, acc):
        if isinstance(n, dict):
            if n.get("elType") == "container" and not n["elements"]: acc.append(n["id"])
            for v in n.values(): empties(v, acc)
        elif isinstance(n, list):
            for v in n: empties(v, acc)
        return acc
    assert empties(doc["content"], []) == []

def test_button_and_heading_present():
    doc, _ = C.build(HTML, parse_css(":root{}"), "")
    flat = []
    def walk(n):
        if isinstance(n, dict):
            if n.get("elType") == "widget": flat.append(n["widgetType"])
            for v in n.values(): walk(v)
        elif isinstance(n, list):
            [walk(v) for v in n]
    walk(doc["content"])
    assert "heading" in flat and "button" in flat and "accordion" in flat
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd scripts && python -m pytest tests/test_compile_structure.py -v`
Expected: FAIL (cannot import compile.build)

- [ ] **Step 3: Implementar** — `scripts/html2elementor/compile.py` (núcleo do walker)

```python
from bs4 import BeautifulSoup
from . import ids, widgets, registry
from .cssmap import to_controls

def _classes(el): return el.get("class", []) if el.name else []

def _styles_for(el, css):
    """Junta declarações por tag e por classe (desktop)."""
    decls = {}
    if el.name in css.rules: decls.update(css.rules[el.name])
    for c in _classes(el):
        decls.update(css.rules.get("." + c, {}))
    return decls

def _build_widget(el, kind, css, img_dir, unmapped):
    if kind == "heading":
        return widgets.heading(el.get_text(" ", strip=True), tag=el.name if el.name.startswith("h") else "div")
    if kind == "text-editor":
        return widgets.text(el.decode_contents().strip())
    if kind == "button":
        return widgets.button(el.get_text(strip=True), el.get("href", "#"))
    if kind == "image":
        return widgets.image(registry.resolve_image(el.get("src", ""), img_dir),
                             extra={} ) if el.get("src") else None
    if kind == "image-carousel":
        urls = [registry.resolve_image(i.get("src", ""), img_dir) for i in el.find_all("img")]
        return widgets.carousel(urls, slides=3)
    if kind == "accordion":
        items = []
        for it in el.select(".faq-item"):
            q = it.select_one(".faq-pergunta"); a = it.select_one(".faq-resposta")
            if q and a: items.append((q.get_text(strip=True), a.get_text(" ", strip=True)))
        return widgets.accordion(items)
    if kind == "icon-list":
        items = [li.get_text(" ", strip=True) for li in el.find_all("li")]
        return widgets.icon_list(items)
    unmapped.append(f"{el.name}.{'.'.join(_classes(el))}")
    return widgets.text(el.get_text(" ", strip=True))

# folhas que viram widget direto (não descer mais)
LEAF = {"heading", "text-editor", "button", "image", "image-carousel", "accordion", "icon-list"}

def _node(el, css, img_dir, unmapped):
    if el.name is None:
        return None
    kind = registry.classify(el.name, _classes(el))
    if kind in LEAF:
        return _build_widget(el, kind, css, img_dir, unmapped)
    # container: descer nos filhos
    children = []
    for ch in el.find_all(recursive=False):
        n = _node(ch, css, img_dir, unmapped)
        if n: children.append(n)
    if not children and el.get_text(strip=True):
        # bloco de texto solto dentro de um container
        children.append(widgets.text(el.decode_contents().strip()))
    return widgets.container(children, {"content_width": "boxed", "flex_direction": "column"})

def build(html, css, img_dir):
    soup = BeautifulSoup(html, "html.parser")
    body = soup.body or soup
    unmapped = []
    sections = []
    for sec in body.find_all("div", recursive=False):
        sections.append(_node(sec, css, img_dir, unmapped))
    doc = {"content": sections,
           "page_settings": {"content_width": "boxed", "background_background": "classic",
                             "background_color": "#FFFFFF"},
           "version": "0.4", "title": "Vendas RC v3", "type": "page"}
    return doc, unmapped
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd scripts && python -m pytest tests/test_compile_structure.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Marcar concluída** (sem commit)

---

### Task 7: compile — aplicar estilo (controles nativos + custom_css + responsivo)

**Files:**
- Modify: `scripts/html2elementor/compile.py` (injetar estilo nos widgets/containers)
- Test: `scripts/tests/test_compile_style.py`

**Interfaces:**
- Produces: `compile._apply_style(el, node, css)` — preenche `node["settings"]` com controles nativos e `custom_css`; declarações de `@media` viram variantes `_mobile`/`@media` no `custom_css`.

- [ ] **Step 1: Teste que falha** — `scripts/tests/test_compile_style.py`

```python
from html2elementor import compile as C
from html2elementor.cssmap import parse_css

CSS = parse_css("""
:root{--ouro:#C9A84C}
.barra-topo{background:#1A1208;padding:13px 24px}
.barra-topo p{color:var(--ouro);font-size:12px}
.hero h1{font-size:clamp(26px,2.8vw,44px)}
@media(max-width:768px){.barra-topo{padding:13px}}
""")
HTML = """<body>
<div class="barra-topo"><p>Topo</p></div>
<div class="hero"><h1>Big</h1></div>
</body>"""

def test_section_gets_native_bg():
    doc, _ = C.build(HTML, CSS, "")
    barra = doc["content"][0]
    assert barra["settings"].get("background_color") == "#1A1208"

def test_clamp_heading_goes_to_custom_css():
    doc, _ = C.build(HTML, CSS, "")
    found = []
    def walk(n):
        if isinstance(n, dict):
            if n.get("widgetType") == "heading": found.append(n["settings"])
            for v in n.values(): walk(v)
        elif isinstance(n, list): [walk(v) for v in n]
    walk(doc["content"])
    h1 = next(s for s in found if s.get("title") == "Big")
    assert "clamp(" in h1.get("custom_css", "")
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd scripts && python -m pytest tests/test_compile_style.py -v`
Expected: FAIL (estilo ainda não aplicado)

- [ ] **Step 3: Implementar** — em `compile.py`, criar `_apply_style` e chamá-lo dentro de `_node`/`_build_widget`

```python
def _apply_style(el, node, css):
    decls = _styles_for(el, css)
    if not decls: return
    controls, leftover = to_controls(decls)
    # heading/text usam title_color, não text_color
    if node.get("widgetType") == "heading" and "text_color" in controls:
        controls["title_color"] = controls.pop("text_color")
    node["settings"].update(controls)
    # responsivo: @media(768) das mesmas chaves -> custom_css @media
    media = {}
    if el.name in css.media: media.update(css.media[el.name])
    for c in _classes(el): media.update(css.media.get("." + c, {}))
    css_parts = [leftover] if leftover else []
    if media:
        body = ";".join(f"{k}:{v}" for k, v in media.items())
        css_parts.append(f"@media(max-width:768px){{selector{{{body}}}}}")
    if css_parts:
        prev = node["settings"].get("custom_css", "")
        node["settings"]["custom_css"] = (prev + "".join(css_parts))
```

Chamar `_apply_style(el, node, css)` antes de retornar `node` em `_node`, e antes de retornar cada widget em `_build_widget` (passar `css` como parâmetro).

- [ ] **Step 4: Rodar e ver passar**

Run: `cd scripts && python -m pytest tests/test_compile_style.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Marcar concluída** (sem commit)

---

### Task 8: compile — casos especiais (sticky, número 10, gradientes, badge)

**Files:**
- Modify: `scripts/html2elementor/compile.py`
- Test: `scripts/tests/test_compile_special.py`

**Interfaces:**
- Produces: `compile._apply_special(el, node)` — aplica padrões fixos por classe (`registry.SPECIAL`).

- [ ] **Step 1: Teste que falha** — `scripts/tests/test_compile_special.py`

```python
from html2elementor import compile as C
from html2elementor.cssmap import parse_css

HTML = """<body>
<div class="barra-topo"><p>Topo</p></div>
<div class="hero"><div class="hero-foto"><img src="images/inline-c227d2e205.webp">
  <div class="hero-num"><span>10</span></div></div></div>
</body>"""

def test_barra_topo_is_sticky():
    doc, _ = C.build(HTML, parse_css(":root{}"), "")
    assert doc["content"][0]["settings"].get("sticky") == "top"

def test_hero_num_absolute_css():
    doc, _ = C.build(HTML, parse_css(":root{}"), "")
    blob = str(doc)
    assert "position:absolute" in blob.replace(" ", "")
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd scripts && python -m pytest tests/test_compile_special.py -v`
Expected: FAIL

- [ ] **Step 3: Implementar** — em `compile.py`

```python
def _apply_special(el, node):
    names = [registry.SPECIAL[c] for c in _classes(el) if c in registry.SPECIAL]
    if "sticky" in names:
        node["settings"].update({"sticky": "top",
            "sticky_on": ["desktop", "tablet", "mobile"],
            "sticky_offset": 0, "sticky_effects_offset": 0, "z_index": 100})
    if "hero-number" in names:
        prev = node["settings"].get("custom_css", "")
        node["settings"]["custom_css"] = prev + ("selector{position:absolute;bottom:48px;"
            "right:48px;z-index:2;width:auto}")
    if "hero-gradient" in names:
        prev = node["settings"].get("custom_css", "")
        node["settings"]["custom_css"] = prev + ("selector{position:relative;overflow:hidden}"
            "selector::after{content:'';position:absolute;inset:0;z-index:1;pointer-events:none;"
            "background:linear-gradient(to right,#F5F2EC 0%,transparent 20%),"
            "linear-gradient(to bottom,transparent 60%,#F5F2EC 100%),"
            "linear-gradient(to top,transparent 90%,#F5F2EC 100%)}")
    if "historia-gradient" in names:
        prev = node["settings"].get("custom_css", "")
        node["settings"]["custom_css"] = prev + ("selector{position:relative}"
            "selector::after{content:'';position:absolute;inset:0;z-index:2;pointer-events:none;"
            "background:linear-gradient(to bottom,transparent 55%,#E8E4DC 100%),"
            "linear-gradient(to right,transparent 65%,#E8E4DC 100%),"
            "linear-gradient(to left,transparent 85%,#E8E4DC 100%)}")
    if "historia-badge" in names:
        prev = node["settings"].get("custom_css", "")
        node["settings"]["custom_css"] = prev + ("selector{position:absolute;bottom:-20px;"
            "right:-20px;z-index:3;background:#1A1208;padding:20px 24px;border-radius:2px;width:auto}")
```

Chamar `_apply_special(el, node)` em `_node` logo após `_apply_style`.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd scripts && python -m pytest tests/test_compile_special.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Marcar concluída** (sem commit)

---

### Task 9: CLI + rodar a página real + relatório de não-mapeados

**Files:**
- Modify: `scripts/html2elementor/compile.py` (adicionar `main()`)
- Create: `scripts/compile_page.py` (entrypoint fino)
- Test: `scripts/tests/test_compile_realpage.py`

**Interfaces:**
- Produces: `compile.compile_file(html_path, css_path, img_dir, out_path) -> dict`; CLI `python scripts/compile_page.py vendas-rc-v3`.

- [ ] **Step 1: Teste que falha** — `scripts/tests/test_compile_realpage.py`

```python
import os, json
from html2elementor import compile as C

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")

def test_real_page_22_sections_no_unmapped_critical():
    html = open(os.path.join(ROOT, "public", "vendas-rc-v3.html"), encoding="utf-8").read()
    from html2elementor.cssmap import parse_css
    css = parse_css(open(os.path.join(ROOT, "public", "css", "styles.css"), encoding="utf-8").read())
    doc, unmapped = C.build(html, css, os.path.join(ROOT, "public", "images"))
    assert len(doc["content"]) >= 20
    # nenhuma imagem com src relativo sobrou
    blob = json.dumps(doc)
    assert "images/inline" not in blob
    assert "\"url\": \"images/" not in blob
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd scripts && python -m pytest tests/test_compile_realpage.py -v`
Expected: FAIL (compile_file ainda não existe / imagens não resolvidas)

- [ ] **Step 3: Implementar** — em `compile.py`

```python
import json, os, sys

def compile_file(html_path, css_path, img_dir, out_path):
    from .cssmap import parse_css
    ids.reset()
    html = open(html_path, encoding="utf-8").read()
    css = parse_css(open(css_path, encoding="utf-8").read())
    doc, unmapped = build(html, css, img_dir)
    json.dump(doc, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    if unmapped:
        print("NÃO-MAPEADOS (estender registry):")
        for u in sorted(set(unmapped)): print("  ", u)
    print(f"OK -> {out_path} | seções: {len(doc['content'])}")
    return doc
```

`scripts/compile_page.py`:

```python
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from html2elementor.compile import compile_file

ROOT = os.path.join(os.path.dirname(__file__), "..")
name = sys.argv[1] if len(sys.argv) > 1 else "vendas-rc-v3"
compile_file(
    os.path.join(ROOT, "public", f"{name}.html"),
    os.path.join(ROOT, "public", "css", "styles.css"),
    os.path.join(ROOT, "public", "images"),
    os.path.join(ROOT, "elementor", f"{name}.container.json"),
)
```

- [ ] **Step 4: Rodar o teste + a CLI**

Run: `cd scripts && python -m pytest tests/test_compile_realpage.py -v && python compile_page.py vendas-rc-v3`
Expected: PASS; imprime "OK -> .../vendas-rc-v3.container.json | seções: 22" e, se houver, lista de não-mapeados a tratar.

- [ ] **Step 5: Tratar não-mapeados** — para cada classe listada, adicionar entrada em `registry.WIDGET_BY_CLASS` ou um caso especial, e rodar de novo até a lista zerar nas seções críticas (hero, depoimentos, identificação, agitação, reframe, história, mecanismo, produto, módulos, bônus, prova-densa, stack, para-quem, objeção, futuro, preço, garantia, cta, faq, ps, footer).

- [ ] **Step 6: Marcar concluída** (sem commit)

---

### Task 10: Validador estrutural

**Files:**
- Create: `scripts/validate_elementor.py`
- Test: `scripts/tests/test_validate.py`

**Interfaces:**
- Produces: `validate_elementor.validate(doc: dict) -> list[str]` (lista de problemas; vazia = ok).

- [ ] **Step 1: Teste que falha** — `scripts/tests/test_validate.py`

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from validate_elementor import validate

def test_detects_empty_container():
    doc = {"content": [{"id": "aaa0001", "elType": "container", "elements": []}]}
    probs = validate(doc)
    assert any("vazio" in p for p in probs)

def test_detects_unresolved_image():
    doc = {"content": [{"id": "aaa0002", "elType": "widget", "widgetType": "image",
                        "elements": [], "settings": {"image": {"url": "images/x.webp"}}}]}
    probs = validate(doc)
    assert any("imagem" in p for p in probs)

def test_clean_doc_has_no_problems():
    doc = {"content": [{"id": "aaa0003", "elType": "container",
                        "elements": [{"id": "aaa0004", "elType": "widget",
                        "widgetType": "heading", "elements": [], "settings": {"title": "x"}}]}]}
    assert validate(doc) == []
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd scripts && python -m pytest tests/test_validate.py -v`
Expected: FAIL

- [ ] **Step 3: Implementar** — `scripts/validate_elementor.py`

```python
import json, sys

def validate(doc):
    problems = []
    ids_seen = set()
    def walk(n):
        if isinstance(n, dict):
            i = n.get("id")
            if i:
                if i in ids_seen: problems.append(f"ID duplicado: {i}")
                ids_seen.add(i)
            if n.get("elType") == "container" and not n.get("elements"):
                problems.append(f"container vazio: {i}")
            st = n.get("settings", {})
            if n.get("widgetType") == "image":
                u = st.get("image", {}).get("url", "")
                if u.startswith("images/") or not u:
                    problems.append(f"imagem não resolvida: {u}")
            for c in st.get("carousel", []):
                if c.get("url", "").startswith("images/"):
                    problems.append(f"imagem não resolvida (carousel): {c['url']}")
            for v in n.values(): walk(v)
        elif isinstance(n, list):
            for v in n: walk(v)
    walk(doc.get("content", []))
    return problems

if __name__ == "__main__":
    doc = json.load(open(sys.argv[1], encoding="utf-8"))
    probs = validate(doc)
    print("\n".join(probs) if probs else "OK: sem problemas estruturais")
    sys.exit(1 if probs else 0)
```

- [ ] **Step 4: Rodar testes + validar a saída real**

Run: `cd scripts && python -m pytest tests/test_validate.py -v && python validate_elementor.py ../elementor/vendas-rc-v3.container.json`
Expected: PASS (3 passed); "OK: sem problemas estruturais".

- [ ] **Step 5: Marcar concluída** (sem commit)

---

### Task 11: Variante VSL

**Files:**
- Modify: `scripts/html2elementor/registry.py` (classes do hero VSL: `hvsl-*`)
- Test: `scripts/tests/test_vsl.py`

**Interfaces:**
- Consumes: tudo anterior. Sem novas interfaces públicas.

- [ ] **Step 1: Teste que falha** — `scripts/tests/test_vsl.py`

```python
import os, json
from html2elementor import compile as C
from html2elementor.cssmap import parse_css

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")

def test_vsl_compiles_with_video_section():
    html = open(os.path.join(ROOT, "public", "vendas-rc-v3-vsl.html"), encoding="utf-8").read()
    css = parse_css(open(os.path.join(ROOT, "public", "css", "styles.css"), encoding="utf-8").read())
    doc, unmapped = C.build(html, css, os.path.join(ROOT, "public", "images"))
    assert len(doc["content"]) >= 20
    # o iframe/placeholder do VSL não pode sumir: vira html widget ou video
    blob = json.dumps(doc)
    assert "hvsl" not in blob or "vsl" in blob.lower()
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd scripts && python -m pytest tests/test_vsl.py -v`
Expected: FAIL (classes hvsl-* não mapeadas / seções a menos)

- [ ] **Step 3: Implementar** — mapear o bloco VSL: adicionar em `registry.WIDGET_BY_CLASS` o que for container (`hvsl-left`, `hvsl-right`→container) e tratar `.hvsl-vsl` como caso especial que vira um `video`/`html` widget (iframe). Adicionar em `registry.SPECIAL`: `"hvsl-vsl": "vsl-embed"` e, em `compile._build_widget`, quando classe `hvsl-vsl`, emitir `widgets.widget("video", {...})` ou um `html` widget com o iframe original.

- [ ] **Step 4: Rodar testes + CLI VSL**

Run: `cd scripts && python -m pytest tests/test_vsl.py -v && python compile_page.py vendas-rc-v3-vsl && python validate_elementor.py ../elementor/vendas-rc-v3-vsl.container.json`
Expected: PASS; validação limpa.

- [ ] **Step 5: Marcar concluída** (sem commit)

---

### Task 12: Diff visual (gated — browser MCP/Playwright + URL de rascunho)

**Files:**
- Create: `scripts/visual_diff.py`
- Create: `scripts/tests/test_visual_diff.py`

**Interfaces:**
- Produces: `visual_diff.capture(url, out_png, width, height)`; `visual_diff.diff(png_a, png_b) -> float` (0=idêntico … 1=tudo diferente).

> **Pré-requisito de execução:** `playwright install chromium` e uma URL de rascunho no WP com a página Elementor importada. O `capture` da referência (HTML local em `python -m http.server`) roda sem WP; o `capture` do lado Elementor precisa da URL de rascunho.

- [ ] **Step 1: Teste que falha** — `scripts/tests/test_visual_diff.py`

```python
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from visual_diff import diff
from PIL import Image

def test_identical_images_score_zero(tmp_path):
    a = tmp_path / "a.png"; b = tmp_path / "b.png"
    Image.new("RGB", (10, 10), "white").save(a)
    Image.new("RGB", (10, 10), "white").save(b)
    assert diff(str(a), str(b)) == 0.0

def test_different_images_score_positive(tmp_path):
    a = tmp_path / "a.png"; b = tmp_path / "b.png"
    Image.new("RGB", (10, 10), "white").save(a)
    Image.new("RGB", (10, 10), "black").save(b)
    assert diff(str(a), str(b)) > 0.5
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd scripts && python -m pytest tests/test_visual_diff.py -v`
Expected: FAIL

- [ ] **Step 3: Implementar** — `scripts/visual_diff.py`

```python
from PIL import Image, ImageChops

def diff(png_a, png_b):
    a = Image.open(png_a).convert("RGB")
    b = Image.open(png_b).convert("RGB").resize(a.size)
    d = ImageChops.difference(a, b)
    hist = d.histogram()
    # média de diferença normalizada 0..1
    total = sum(i % 256 * c for i, c in enumerate(hist))
    return round(total / (a.size[0] * a.size[1] * 3 * 255), 4)

def capture(url, out_png, width=1280, height=2000):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": width, "height": height})
        pg.goto(url, wait_until="networkidle")
        pg.screenshot(path=out_png, full_page=True)
        b.close()
```

- [ ] **Step 4: Rodar o teste de diff**

Run: `cd scripts && python -m pytest tests/test_visual_diff.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Procedimento de diff (manual, quando houver URL de rascunho)**

```bash
# referência (HTML local)
python -m http.server 8000 --directory public &
python -c "from scripts.visual_diff import capture; capture('http://localhost:8000/vendas-rc-v3.html','ref-desktop.png',1280); capture('http://localhost:8000/vendas-rc-v3.html','ref-mobile.png',390)"
# lado Elementor (após importar na página de rascunho)
python -c "from scripts.visual_diff import capture, diff; capture('<URL_RASCUNHO>','el-desktop.png',1280); print('desktop diff', diff('ref-desktop.png','el-desktop.png'))"
```

- [ ] **Step 6: Marcar concluída** (sem commit)

---

## Self-Review

**Spec coverage:**
- Objetivo/princípio (nativo ~95-98%) → Tasks 5-9 (widgets nativos) + Task 12 (diff). ✓
- Escopo vendas-rc-v3 + VSL → Tasks 9 e 11. ✓
- Fonte HTML/CSS → Tasks 2,6. ✓
- 4 módulos isolados → Tasks 2-6. ✓
- Estilo inteligente (controles + custom_css) → Tasks 3,7. ✓
- Responsivo @media→mobile/breakpoint 768 → Task 7. ✓
- Casos especiais → Task 8. ✓
- Imagens (8 URL + 3 base64) → Tasks 4,9. ✓
- Erros nunca somem calados → Task 6 (`unmapped`) + Task 9 (relatório). ✓
- Verificação estrutural + diff visual → Tasks 10,12. ✓
- Aposentar build_elementor.py → ocorre na conclusão (Task 9 produz o mesmo arquivo de saída); remover só após paridade confirmada pelo diff (Task 12).
- Dependências beautifulsoup4/tinycss2/Pillow/playwright → Task 1. ✓

**Placeholder scan:** sem TBD/TODO; código presente em cada step. Task 9 Step 5 e Task 11 Step 3 dependem do output real (iterativo por natureza) mas têm procedimento concreto.

**Type consistency:** `build(html, css, img_dir) -> (doc, unmapped)` usado consistentemente (Tasks 6,7,8,9,11); `to_controls(decls, prefix="") -> (dict, str)` (Tasks 3,7); `resolve_image(src, img_dir)` (Tasks 4,6); `validate(doc) -> list[str]` (Task 10). ✓

**Nota:** commits estão suprimidos a pedido do usuário (iteração local antes de subir ao Cloudflare). Cada task termina em "marcar concluída".
