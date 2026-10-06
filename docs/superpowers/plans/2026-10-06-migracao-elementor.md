# Migração para Elementor — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Converter 9 páginas de `public/` em blocos autocontidos para colar no widget HTML do Elementor, com CSS isolado e camada de animação.

**Architecture:** Um conversor em Python lê uma página de `public/`, embute o CSS e o JS de que ela depende, reescreve caminhos para URLs absolutas do Cloudflare, prefixa todo o CSS com o id do wrapper, remove GTM e metadados de `<head>`, injeta a camada de animação e grava `dist/elementor/<pagina>.html`. Um verificador em Node renderiza cada saída dentro de um simulador de WordPress e roda checagens automáticas.

**Tech Stack:** Python 3 (stdlib + pytest 8.2), Node + Playwright (WebKit e Chromium), sem dependências novas no runtime das páginas.

**Spec:** `docs/superpowers/specs/2026-10-06-migracao-elementor-design.md`

## Global Constraints

- Nenhum arquivo em `public/` é modificado. O conversor só lê.
- Toda URL de recurso na saída é absoluta em `https://ev.nathmonari.com.br/...`, ou `data:`.
- Nenhuma saída contém `<html>`, `<head>`, `<body>`, GTM (`GTM-56FFC826`), `<title>`, `canonical` ou `og:*`.
- Nenhuma biblioteca externa nas páginas. Animação com CSS e `IntersectionObserver`.
- `@media (prefers-reduced-motion: reduce)` desliga todo o movimento e deixa o conteúdo visível.
- Toda substituição confere a contagem de ocorrências antes de aplicar; contagem inesperada aborta a conversão sem gravar arquivo.
- O conversor é idempotente: mesma entrada produz byte a byte a mesma saída.
- Mensagens de commit e nomes de função em português, como o resto do projeto.

## Review Focus

Cinco modos de falha que a spec implica e que nenhuma tarefa exercitaria sozinha. Cada um recebe teste na tarefa indicada:

1. **`url()` relativo dentro do CSS embutido** — `styles.css` tem `url("../images/x.webp")`, relativo ao arquivo CSS; embutido na página, resolve contra a URL do WordPress e some o fundo do hero. (Tarefa 1)
2. **`:root` vira o `<html>` do WordPress** — as variáveis CSS vazam para o site inteiro e podem sobrescrever o tema. (Tarefa 1)
3. **Fontes com `url()` sem pasta** — `fonts-min.css` referencia `url(abc.woff2)`, relativo a `/fonts/`; sem reescrita a página carrega com fonte do sistema. (Tarefa 1)
4. **`position: fixed` dentro de container com `transform`** — o Elementor aplica `transform` em containers; elemento fixo passa a se posicionar pelo container. Existe 1 ocorrência em `vendas-evoluto-v3`. (Tarefa 4, como aviso no relatório)
5. **Âncoras internas (`href="#oferta"`)** — precisam continuar funcionando depois da prefixação e da mudança de contexto de rolagem. (Tarefa 7)

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `scripts/elementor/escopo_css.py` | Prefixar e isolar CSS. Funções puras, sem I/O. |
| `scripts/elementor/paginas.py` | Registro das 9 páginas: origem, wrapper, dependências. |
| `scripts/elementor/conversor.py` | Orquestra extração, embutir, reescrever, limpar, injetar, gravar. |
| `scripts/elementor/animacao.css` | Camada de animação (CSS). |
| `scripts/elementor/animacao.js` | Camada de animação (JS). |
| `scripts/elementor/simulador.html` | Página que imita tema WordPress + container Elementor. |
| `scripts/elementor/verificar.mjs` | Checagens automáticas com Playwright. |
| `tests/elementor/test_escopo_css.py` | Testes do isolamento de CSS. |
| `tests/elementor/test_conversor.py` | Testes da conversão ponta a ponta. |
| `dist/elementor/*.html` | Saída: um bloco por página. |
| `dist/elementor/README.md` | Instruções de colagem. |

---

### Task 1: Isolamento de CSS

**Files:**
- Create: `scripts/elementor/escopo_css.py`
- Test: `tests/elementor/test_escopo_css.py`

**Interfaces:**
- Produces: `escopar(css: str, wrapper: str, base_url: str) -> tuple[str, list[str]]` — devolve o CSS isolado e a lista de avisos. `wrapper` é o id sem `#` (ex.: `nm-vendas-rc-v3`). `base_url` é a pasta do arquivo CSS original no site (ex.: `https://ev.nathmonari.com.br/css/`), usada para resolver `url()`.

- [ ] **Step 1: Escrever os testes que falham**

```python
# tests/elementor/test_escopo_css.py
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "scripts" / "elementor"))
from escopo_css import escopar

BASE = "https://ev.nathmonari.com.br/css/"

def test_prefixa_classe():
    css, _ = escopar(".btn{color:red}", "nm-x", BASE)
    assert css == "#nm-x .btn{color:red}"

def test_root_vira_wrapper():
    css, _ = escopar(":root{--ouro:#C9A84C}", "nm-x", BASE)
    assert css == "#nm-x{--ouro:#C9A84C}"

def test_body_vira_wrapper():
    css, _ = escopar("body{font-size:16px}", "nm-x", BASE)
    assert css == "#nm-x{font-size:16px}"

def test_asterisco_fica_descendente():
    css, _ = escopar("*,*::before{box-sizing:border-box}", "nm-x", BASE)
    assert css == "#nm-x *,#nm-x *::before{box-sizing:border-box}"

def test_url_relativa_com_pasta_pai():
    css, _ = escopar('.h{background:url("../images/a.webp")}', "nm-x", BASE)
    assert "https://ev.nathmonari.com.br/images/a.webp" in css

def test_url_relativa_simples():
    css, _ = escopar("@font-face{src:url(a.woff2)}", "nm-x", "https://ev.nathmonari.com.br/fonts/")
    assert "https://ev.nathmonari.com.br/fonts/a.woff2" in css

def test_url_absoluta_e_data_nao_mudam():
    css, _ = escopar('.a{background:url(/images/b.webp)}.c{background:url(data:image/png;base64,AAA)}', "nm-x", BASE)
    assert "https://ev.nathmonari.com.br/images/b.webp" in css
    assert "url(data:image/png;base64,AAA)" in css

def test_media_prefixa_regras_internas():
    css, _ = escopar("@media(max-width:768px){.btn{color:red}}", "nm-x", BASE)
    assert css == "@media(max-width:768px){#nm-x .btn{color:red}}"

def test_keyframes_recebe_prefixo_e_e_referenciado():
    css, _ = escopar("@keyframes girar{from{opacity:0}}.a{animation:girar 1s}", "nm-x", BASE)
    assert "@keyframes nm-x-girar{" in css
    assert "animation:nm-x-girar 1s" in css

def test_id_proprio_existente_e_substituido_sem_duplicar():
    css, _ = escopar("#evoluto-page .a{color:red}", "nm-x", BASE, id_origem="evoluto-page")
    assert css == "#nm-x .a{color:red}"

def test_position_fixed_vira_aviso():
    _, avisos = escopar(".topo{position:fixed;top:0}", "nm-x", BASE)
    assert any("fixed" in a for a in avisos)

def test_reset_defensivo_cobre_o_que_o_tema_injeta():
    from escopo_css import reset_defensivo
    css = reset_defensivo("nm-x")
    for alvo in ("h1", "h2", "h3", "p", "ul", "li", "a", "button", "img"):
        assert f"#nm-x {alvo}" in css.replace("\n", " ")
    assert "margin:0" in css and "text-decoration:none" in css
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python -m pytest tests/elementor/test_escopo_css.py -v`
Expected: FAIL com `ModuleNotFoundError: No module named 'escopo_css'`

- [ ] **Step 3: Implementar**

```python
# scripts/elementor/escopo_css.py
"""Isola um CSS dentro de um wrapper, para colar em widget HTML do Elementor."""
import re
from urllib.parse import urljoin

SITE = "https://ev.nathmonari.com.br"
# tags que nao existem dentro do widget: viram o proprio wrapper
TAGS_RAIZ = {"html", "body", ":root", "html,body", "body,html"}


def _resolver_url(valor: str, base_url: str) -> str:
    bruto = valor.strip().strip("'\"")
    if bruto.startswith(("data:", "http://", "https://", "//")):
        return valor
    destino = urljoin(base_url, bruto) if not bruto.startswith("/") else SITE + bruto
    return valor.replace(bruto, destino)


def _reescrever_urls(css: str, base_url: str) -> str:
    return re.sub(r"url\(([^)]+)\)", lambda m: "url(" + _resolver_url(m.group(1), base_url) + ")", css)


def _prefixar_seletor(seletor: str, wrapper: str, id_origem: str | None) -> str:
    partes = []
    for bruto in seletor.split(","):
        s = bruto.strip()
        if not s:
            continue
        if id_origem and (s == f"#{id_origem}" or s.startswith(f"#{id_origem} ") or s.startswith(f"#{id_origem}.")):
            partes.append(s.replace(f"#{id_origem}", f"#{wrapper}", 1))
        elif s in TAGS_RAIZ:
            partes.append(f"#{wrapper}")
        elif s.startswith("*"):
            partes.append(f"#{wrapper} {s}")
        else:
            partes.append(f"#{wrapper} {s}")
    return ",".join(partes)


def reset_defensivo(wrapper: str) -> str:
    """Neutraliza o que o tema do WordPress e o Elementor injetam dentro do widget."""
    w = f"#{wrapper}"
    return (
        f"{w},{w} *{{box-sizing:border-box}}"
        f"{w} h1,{w} h2,{w} h3,{w} h4,{w} h5,{w} h6,{w} p,{w} ul,{w} ol,{w} li,{w} figure,{w} blockquote"
        "{margin:0;padding:0;font:inherit;color:inherit;letter-spacing:inherit}"
        f"{w} ul,{w} ol{{list-style:none}}"
        f"{w} a{{color:inherit;text-decoration:none}}"
        f"{w} img,{w} svg,{w} iframe{{max-width:100%;display:block;border:0}}"
        f"{w} button,{w} input,{w} select{{font:inherit;color:inherit;margin:0}}"
    )


def escopar(css: str, wrapper: str, base_url: str, id_origem: str | None = None) -> tuple[str, list[str]]:
    avisos: list[str] = []
    css = _reescrever_urls(css, base_url)

    nomes_keyframes = set(re.findall(r"@keyframes\s+([\w-]+)", css))
    for nome in nomes_keyframes:
        css = re.sub(rf"@keyframes\s+{re.escape(nome)}\b", f"@keyframes {wrapper}-{nome}", css)
        css = re.sub(rf"(animation(?:-name)?\s*:[^;}}]*?)\b{re.escape(nome)}\b", rf"\1{wrapper}-{nome}", css)

    saida, i = [], 0
    for m in re.finditer(r"(@[\w-]+[^{]*\{)|([^{}]+)\{([^{}]*)\}|(\})", css):
        bloco = m.group(0)
        if m.group(1):  # abre at-rule
            saida.append(bloco)
        elif m.group(4):  # fecha at-rule
            saida.append(bloco)
        else:
            seletor, corpo = m.group(2), m.group(3)
            if seletor.strip().startswith("@"):  # @font-face e afins: nao prefixa
                saida.append(bloco)
            else:
                if re.search(r"position\s*:\s*fixed", corpo):
                    avisos.append(f"position:fixed em '{seletor.strip()[:60]}' — dentro de container do Elementor com transform, o elemento se posiciona pelo container")
                saida.append(_prefixar_seletor(seletor, wrapper, id_origem) + "{" + corpo + "}")
    return "".join(saida), avisos
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python -m pytest tests/elementor/test_escopo_css.py -v`
Expected: PASS nos 11 testes. Ajuste a implementação até passar — o parser por regex precisa lidar com `@media` aninhado e `@font-face` sem prefixo.

- [ ] **Step 5: Commit**

```bash
git add scripts/elementor/escopo_css.py tests/elementor/test_escopo_css.py
git commit -m "feat: isola CSS dentro de um wrapper para o widget do Elementor"
```

---

### Task 2: Registro das páginas e extração do conteúdo

**Files:**
- Create: `scripts/elementor/paginas.py`
- Modify: `tests/elementor/test_conversor.py` (criar)

**Interfaces:**
- Consumes: nada.
- Produces: `PAGINAS: list[Pagina]` onde `Pagina` tem `chave: str`, `origem: str` (caminho relativo a `public/`), `wrapper: str`, `id_origem: str | None`, `css: list[str]`, `js: list[str]`. E `extrair_conteudo(html: str, pagina: Pagina) -> str`.

- [ ] **Step 1: Escrever os testes que falham**

```python
# tests/elementor/test_conversor.py
import sys, pathlib
RAIZ = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts" / "elementor"))
from paginas import PAGINAS, por_chave, extrair_conteudo

def test_registro_tem_as_nove_paginas():
    assert len(PAGINAS) == 9
    assert {p.chave for p in PAGINAS} >= {"evoluto-day-va", "vendas-evoluto-v3", "vendas-rc-v3"}

def test_todo_arquivo_de_origem_existe():
    for p in PAGINAS:
        assert (RAIZ / "public" / p.origem).exists(), p.origem

def test_wrapper_e_unico_por_pagina():
    wrappers = [p.wrapper for p in PAGINAS]
    assert len(set(wrappers)) == len(wrappers)

def test_extrai_documento_interno_do_evoluto():
    p = por_chave("vendas-evoluto-v3")
    html = (RAIZ / "public" / p.origem).read_text(encoding="utf-8")
    conteudo = extrair_conteudo(html, p)
    assert conteudo.lstrip().startswith('<div id="evoluto-page"')
    assert "jquery" not in conteudo.lower()
    assert "elementor-frontend" not in conteudo.lower()

def test_extrai_body_das_demais():
    p = por_chave("vendas-rc-v3")
    html = (RAIZ / "public" / p.origem).read_text(encoding="utf-8")
    conteudo = extrair_conteudo(html, p)
    assert "<body" not in conteudo and "</html>" not in conteudo
    assert "hero" in conteudo
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python -m pytest tests/elementor/test_conversor.py -v`
Expected: FAIL com `ModuleNotFoundError: No module named 'paginas'`

- [ ] **Step 3: Implementar**

```python
# scripts/elementor/paginas.py
"""Registro das paginas que migram para o Elementor e extracao do conteudo."""
import re
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Pagina:
    chave: str
    origem: str
    wrapper: str
    id_origem: str | None = None
    css: tuple[str, ...] = ()
    js: tuple[str, ...] = ()


_DAY = ("css/evoluto-day.css",), ("js/utms.js", "js/evoluto-day.js")
_RC = ("fonts/fonts-min.css", "css/styles.css"), ("js/utms.js", "js/main.js")

PAGINAS: list[Pagina] = [
    *[Pagina(f"evoluto-day-{v}", f"evoluto-day-{v}/index.html", f"nm-evoluto-day-{v}", None, *_DAY)
      for v in ("va", "vb", "vc", "vd")],
    Pagina("vendas-evoluto-v1", "vendas-evoluto-v1/index.html", "nm-vendas-evoluto-v1", "evoluto-page"),
    Pagina("vendas-evoluto-2-0", "vendas-evoluto-2-0/index.html", "nm-vendas-evoluto-2-0", "evoluto-page"),
    Pagina("vendas-evoluto-v3", "vendas-evoluto-v3/index.html", "nm-vendas-evoluto-v3", "evoluto-page"),
    Pagina("vendas-rc-v3", "vendas-rc-v3.html", "nm-vendas-rc-v3", None, *_RC),
    Pagina("vendas-rc-v3-vsl", "vendas-rc-v3-vsl.html", "nm-vendas-rc-v3-vsl", None, *_RC),
]


def por_chave(chave: str) -> Pagina:
    for p in PAGINAS:
        if p.chave == chave:
            return p
    raise KeyError(chave)


def extrair_conteudo(html: str, pagina: Pagina) -> str:
    """Recorta o conteudo util. No Evoluto, o documento interno; nas demais, o body."""
    if pagina.id_origem:
        inicio = html.index(f'<div id="{pagina.id_origem}">')
        fim = html.rindex("</body>")
        return html[inicio:fim].rstrip()
    corpo = re.search(r"<body[^>]*>([\s\S]*)</body>", html).group(1)
    corpo = re.sub(r"<noscript>[\s\S]*?</noscript>", "", corpo)
    return corpo.strip()
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python -m pytest tests/elementor/test_conversor.py -v`
Expected: PASS nos 5 testes.

- [ ] **Step 5: Commit**

```bash
git add scripts/elementor/paginas.py tests/elementor/test_conversor.py
git commit -m "feat: registra as 9 paginas da migracao e extrai o conteudo util"
```

---

### Task 3: Embutir dependências e reescrever URLs do HTML

**Files:**
- Modify: `scripts/elementor/conversor.py` (criar)
- Modify: `tests/elementor/test_conversor.py`

**Interfaces:**
- Consumes: `paginas.Pagina`, `escopo_css.escopar`.
- Produces: `embutir_css(pagina) -> tuple[str, list[str]]`, `embutir_js(pagina) -> str`, `reescrever_urls_html(html: str, origem_dir: str) -> str`.

- [ ] **Step 1: Escrever os testes que falham**

```python
# acrescentar em tests/elementor/test_conversor.py
from conversor import embutir_css, embutir_js, reescrever_urls_html

def test_reescreve_caminho_de_raiz():
    html = '<img src="/images/a.webp"><link href="/css/x.css">'
    saida = reescrever_urls_html(html, "")
    assert 'src="https://ev.nathmonari.com.br/images/a.webp"' in saida

def test_reescreve_caminho_relativo_do_evoluto():
    html = '<script src="./assets/js/x.js"></script>'
    saida = reescrever_urls_html(html, "vendas-evoluto-v3/")
    assert 'https://ev.nathmonari.com.br/vendas-evoluto-v3/assets/js/x.js' in saida

def test_nao_toca_em_url_externa_nem_data():
    html = '<img src="data:image/png;base64,AAA"><a href="https://pay.kiwify.com.br/x">c</a>'
    assert reescrever_urls_html(html, "") == html

def test_embute_css_com_wrapper_e_url_absoluta():
    from paginas import por_chave
    css, avisos = embutir_css(por_chave("vendas-rc-v3"))
    assert "#nm-vendas-rc-v3" in css
    assert "../images/" not in css
    assert "https://ev.nathmonari.com.br/images/" in css

def test_embute_js_sem_tag_script():
    from paginas import por_chave
    js = embutir_js(por_chave("vendas-rc-v3"))
    assert "<script" not in js and "utm" in js.lower()
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python -m pytest tests/elementor/test_conversor.py -v`
Expected: FAIL com `ImportError: cannot import name 'embutir_css'`

- [ ] **Step 3: Implementar**

```python
# scripts/elementor/conversor.py
"""Converte uma pagina de public/ em um bloco colavel no widget HTML do Elementor."""
import pathlib
import re

from escopo_css import escopar, reset_defensivo, SITE
from paginas import Pagina

RAIZ = pathlib.Path(__file__).resolve().parents[2]
PUBLIC = RAIZ / "public"


def reescrever_urls_html(html: str, origem_dir: str) -> str:
    def troca(m: re.Match) -> str:
        attr, valor = m.group(1), m.group(2)
        if valor.startswith(("data:", "http://", "https://", "//", "#", "mailto:", "tel:")):
            return m.group(0)
        if valor.startswith("/"):
            destino = SITE + valor
        else:
            destino = f"{SITE}/{origem_dir}{valor.lstrip('./')}"
        return f'{attr}="{destino}"'
    return re.sub(r'\b(src|href|srcset|poster)="([^"]+)"', troca, html)


def embutir_css(pagina: Pagina) -> tuple[str, list[str]]:
    partes, avisos = [], []
    for rel in pagina.css:
        arquivo = PUBLIC / rel
        base = f"{SITE}/{rel.rsplit('/', 1)[0]}/"
        css, av = escopar(arquivo.read_text(encoding="utf-8"), pagina.wrapper, base, pagina.id_origem)
        partes.append(css)
        avisos += av
    return "\n".join(partes), avisos


def embutir_js(pagina: Pagina) -> str:
    return "\n".join((PUBLIC / rel).read_text(encoding="utf-8") for rel in pagina.js)
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python -m pytest tests/elementor/test_conversor.py -v`
Expected: PASS nos 10 testes.

- [ ] **Step 5: Commit**

```bash
git add scripts/elementor/conversor.py tests/elementor/test_conversor.py
git commit -m "feat: embute CSS e JS locais e reescreve caminhos para o Cloudflare"
```

---

### Task 4: Limpeza (GTM, metadados, invólucro) e relatório

**Files:**
- Modify: `scripts/elementor/conversor.py`
- Modify: `tests/elementor/test_conversor.py`

**Interfaces:**
- Produces: `limpar(html: str) -> tuple[str, list[str]]` e `Relatorio` com campos `chave`, `bytes_saida`, `recursos: int`, `seletores: int`, `avisos: list[str]`, `descartados: list[str]`.

- [ ] **Step 1: Escrever os testes que falham**

```python
# acrescentar em tests/elementor/test_conversor.py
from conversor import limpar

def test_remove_gtm_script_e_noscript():
    html = '<script>(function(w,d,s,l,i){})(window,document,"script","dataLayer","GTM-56FFC826");</script><p>x</p>'
    saida, descartados = limpar(html)
    assert "GTM-56FFC826" not in saida
    assert any("GTM" in d for d in descartados)

def test_remove_metadados_de_head():
    html = '<title>Vendas</title><link rel="canonical" href="/x"><meta property="og:title" content="y"><p>fica</p>'
    saida, descartados = limpar(html)
    for proibido in ("<title>", "canonical", "og:title"):
        assert proibido not in saida
    assert "<p>fica</p>" in saida
    assert len(descartados) >= 3

def test_position_fixed_aparece_no_aviso_da_v3():
    from paginas import por_chave
    from conversor import converter
    bloco, rel = converter(por_chave("vendas-evoluto-v3"), gravar=False)
    assert any("fixed" in a for a in rel.avisos)
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python -m pytest tests/elementor/test_conversor.py -v`
Expected: FAIL com `ImportError: cannot import name 'limpar'`

- [ ] **Step 3: Implementar**

```python
# acrescentar em scripts/elementor/conversor.py
from dataclasses import dataclass, field

PADROES_DESCARTE = [
    ("GTM (script)", r"<script[^>]*>[^<]*GTM-[A-Z0-9]+[\s\S]*?</script>"),
    ("GTM (noscript)", r"<noscript>[\s\S]*?googletagmanager[\s\S]*?</noscript>"),
    ("title", r"<title>[\s\S]*?</title>"),
    ("canonical", r'<link[^>]+rel="canonical"[^>]*>'),
    ("og/meta", r'<meta[^>]+(?:property="og:|name="(?:description|robots|viewport)")[^>]*>'),
]


@dataclass
class Relatorio:
    chave: str
    bytes_saida: int = 0
    recursos: int = 0
    seletores: int = 0
    avisos: list[str] = field(default_factory=list)
    descartados: list[str] = field(default_factory=list)


def limpar(html: str) -> tuple[str, list[str]]:
    descartados = []
    for nome, padrao in PADROES_DESCARTE:
        html, n = re.subn(padrao, "", html, flags=re.I)
        if n:
            descartados.append(f"{nome} x{n}")
    return html, descartados
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python -m pytest tests/elementor/test_conversor.py -v`
Expected: PASS. O terceiro teste depende de `converter()`, implementada na Tarefa 6 — marque-o com `@pytest.mark.xfail(strict=False)` até lá e remova a marca na Tarefa 6.

- [ ] **Step 5: Commit**

```bash
git add scripts/elementor/conversor.py tests/elementor/test_conversor.py
git commit -m "feat: remove GTM e metadados de head, com relatorio do que saiu"
```

---

### Task 5: Camada de animação

**Files:**
- Create: `scripts/elementor/animacao.css`, `scripts/elementor/animacao.js`
- Modify: `scripts/elementor/conversor.py`, `tests/elementor/test_conversor.py`

**Interfaces:**
- Produces: `injetar_animacao(css: str, html: str, js: str, wrapper: str) -> tuple[str, str, str]`. Detecta se a página já tem sistema `.reveal` e, nesse caso, não injeta o de entrada — só contadores, brilho de CTA e hover.

- [ ] **Step 1: Escrever os testes que falham**

```python
# acrescentar em tests/elementor/test_conversor.py
from conversor import injetar_animacao

def test_injeta_entrada_quando_pagina_nao_tem_reveal():
    css, html, js = injetar_animacao("", '<section><h2>a</h2></section>', "", "nm-x")
    assert "nm-anim-entrada" in css and "IntersectionObserver" in js

def test_nao_duplica_quando_pagina_ja_tem_reveal():
    css, html, js = injetar_animacao(".reveal{opacity:0}", '<div class="reveal">a</div>', "", "nm-x")
    assert "nm-anim-entrada" not in css
    assert "nm-anim-contador" in js  # contadores e CTA entram mesmo assim

def test_respeita_reduced_motion():
    css, _, _ = injetar_animacao("", "<p>a</p>", "", "nm-x")
    assert "prefers-reduced-motion: reduce" in css
    bloco = css[css.index("prefers-reduced-motion"):]
    assert "opacity:1" in bloco.replace(" ", "") and "none" in bloco
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python -m pytest tests/elementor/test_conversor.py -k animacao -v`
Expected: FAIL com `ImportError: cannot import name 'injetar_animacao'`

- [ ] **Step 3: Implementar**

`animacao.css` (o `__WRAPPER__` é trocado pelo id da página):

```css
#__WRAPPER__ .nm-anim-entrada{opacity:0;transform:translateY(16px);transition:opacity .7s ease,transform .7s ease}
#__WRAPPER__ .nm-anim-entrada.visivel{opacity:1;transform:none}
#__WRAPPER__ .nm-anim-cta{position:relative;overflow:hidden}
#__WRAPPER__ .nm-anim-cta::after{content:'';position:absolute;inset:0 auto 0 -40%;width:40%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.18),transparent);animation:__WRAPPER__-brilho 4.5s ease-in-out infinite}
@keyframes __WRAPPER__-brilho{0%,60%{transform:translateX(0)}100%{transform:translateX(350%)}}
@media (prefers-reduced-motion: reduce){
  #__WRAPPER__ .nm-anim-entrada{opacity:1;transform:none;transition:none}
  #__WRAPPER__ .nm-anim-cta::after{animation:none;display:none}
  #__WRAPPER__ *{animation:none!important;transition:none!important}
}
```

`animacao.js`:

```javascript
(function () {
  var raiz = document.getElementById('__WRAPPER__');
  if (!raiz) return;
  var parado = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var obs = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('visivel');
      if (e.target.dataset.nmContador) nmContador(e.target);
      obs.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -10% 0px' });

  if (!parado) {
    raiz.querySelectorAll('.nm-anim-entrada').forEach(function (el, i) {
      el.style.transitionDelay = (i % 6) * 70 + 'ms';
      obs.observe(el);
    });
  } else {
    raiz.querySelectorAll('.nm-anim-entrada').forEach(function (el) { el.classList.add('visivel'); });
  }

  function nmContador(el) {  // nm-anim-contador
    var alvo = parseFloat(el.dataset.nmContador), ini = performance.now(), dur = 900;
    if (parado) { el.textContent = el.dataset.nmFormato.replace('#', alvo); return; }
    (function passo(t) {
      var p = Math.min(1, (t - ini) / dur);
      el.textContent = el.dataset.nmFormato.replace('#', (alvo * (1 - Math.pow(1 - p, 3))).toFixed(el.dataset.nmCasas || 0));
      if (p < 1) requestAnimationFrame(passo);
    })(ini);
  }
})();
```

No `conversor.py`:

```python
def injetar_animacao(css: str, html: str, js: str, wrapper: str) -> tuple[str, str, str]:
    base = pathlib.Path(__file__).parent
    anim_css = (base / "animacao.css").read_text(encoding="utf-8").replace("__WRAPPER__", wrapper)
    anim_js = (base / "animacao.js").read_text(encoding="utf-8").replace("__WRAPPER__", wrapper)
    ja_tem_reveal = ".reveal" in css or 'class="reveal' in html
    if ja_tem_reveal:  # nao duplica o sistema de entrada da propria pagina
        anim_css = "\n".join(l for l in anim_css.splitlines() if "nm-anim-entrada" not in l)
        anim_js = anim_js.replace(".nm-anim-entrada", ".nm-anim-nenhum")
    else:
        html = re.sub(r"<(section|article)\b", r'<\1 class="nm-anim-entrada"', html)
    return css + "\n" + anim_css, html, js + "\n" + anim_js
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python -m pytest tests/elementor/test_conversor.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/elementor/animacao.css scripts/elementor/animacao.js scripts/elementor/conversor.py tests/elementor/test_conversor.py
git commit -m "feat: camada de animacao com entrada, contador e brilho de CTA"
```

---

### Task 6: CLI, geração das 9 saídas e README

**Files:**
- Modify: `scripts/elementor/conversor.py`
- Create: `dist/elementor/README.md` (gerado)
- Modify: `tests/elementor/test_conversor.py`

**Interfaces:**
- Produces: `converter(pagina, gravar=True) -> tuple[str, Relatorio]` e `main(argv)`. Uso: `python scripts/elementor/conversor.py` (todas) ou `... --pagina vendas-rc-v3`.

- [ ] **Step 1: Escrever os testes que falham**

```python
# acrescentar em tests/elementor/test_conversor.py
from conversor import converter

def test_bloco_nao_tem_documento_nem_gtm():
    from paginas import por_chave
    bloco, rel = converter(por_chave("evoluto-day-va"), gravar=False)
    for proibido in ("<html", "<head", "<body", "GTM-56FFC826", "<title>"):
        assert proibido not in bloco
    assert bloco.lstrip().startswith("<style>")
    assert f'<div id="{por_chave("evoluto-day-va").wrapper}"' in bloco

def test_todos_os_recursos_sao_absolutos():
    from paginas import por_chave
    import re as _re
    bloco, _ = converter(por_chave("vendas-rc-v3"), gravar=False)
    for valor in _re.findall(r'(?:src|href)="([^"]+)"', bloco):
        assert valor.startswith(("https://", "data:", "#")), valor

def test_bloco_comeca_pelo_reset_defensivo():
    from paginas import por_chave
    bloco, _ = converter(por_chave("evoluto-day-va"), gravar=False)
    cabeca = bloco[:1200]
    assert "#nm-evoluto-day-va h1" in cabeca and "margin:0" in cabeca

def test_conversao_e_idempotente():
    from paginas import por_chave
    a, _ = converter(por_chave("vendas-rc-v3"), gravar=False)
    b, _ = converter(por_chave("vendas-rc-v3"), gravar=False)
    assert a == b

def test_gera_as_nove_saidas(tmp_path):
    from paginas import PAGINAS
    for p in PAGINAS:
        bloco, rel = converter(p, gravar=False)
        assert rel.bytes_saida > 1000
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python -m pytest tests/elementor/test_conversor.py -v`
Expected: FAIL com `ImportError: cannot import name 'converter'`

- [ ] **Step 3: Implementar**

```python
# acrescentar em scripts/elementor/conversor.py
import argparse
import sys
from paginas import PAGINAS, por_chave, extrair_conteudo

SAIDA = RAIZ / "dist" / "elementor"


def converter(pagina: Pagina, gravar: bool = True) -> tuple[str, Relatorio]:
    rel = Relatorio(pagina.chave)
    html_bruto = (PUBLIC / pagina.origem).read_text(encoding="utf-8")

    conteudo = extrair_conteudo(html_bruto, pagina)
    conteudo, rel.descartados = limpar(conteudo)

    css_embutido, rel.avisos = embutir_css(pagina)
    if not pagina.css:  # Evoluto: o CSS mora na propria pagina
        interno = "\n".join(re.findall(r"<style[^>]*>([\s\S]*?)</style>", html_bruto))
        base = f"{SITE}/{pagina.origem.rsplit('/', 1)[0]}/"
        css_embutido, rel.avisos = escopar(interno, pagina.wrapper, base, pagina.id_origem)
        conteudo = re.sub(r"<style[^>]*>[\s\S]*?</style>", "", conteudo)

    js_embutido = embutir_js(pagina) + "\n" + "\n".join(
        s for s in re.findall(r"<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)</script>", conteudo)
    )
    conteudo = re.sub(r"<script[\s\S]*?</script>", "", conteudo)

    origem_dir = pagina.origem.rsplit("/", 1)[0] + "/" if "/" in pagina.origem else ""
    conteudo = reescrever_urls_html(conteudo, origem_dir)

    # o reset vem antes do CSS da pagina: neutraliza o tema sem vencer os estilos proprios
    css_embutido = reset_defensivo(pagina.wrapper) + "\n" + css_embutido
    css_embutido, conteudo, js_embutido = injetar_animacao(css_embutido, conteudo, js_embutido, pagina.wrapper)

    bloco = (
        f"<style>\n{css_embutido}\n</style>\n"
        f'<div id="{pagina.wrapper}" class="nm-bloco">\n{conteudo}\n</div>\n'
        f"<script>\n{js_embutido}\n</script>\n"
    )
    rel.bytes_saida = len(bloco.encode("utf-8"))
    rel.recursos = len(set(re.findall(r'(?:src|href)="(https://[^"]+)"', bloco)))
    rel.seletores = css_embutido.count(f"#{pagina.wrapper}")

    if gravar:
        SAIDA.mkdir(parents=True, exist_ok=True)
        (SAIDA / f"{pagina.chave}.html").write_text(bloco, encoding="utf-8", newline="\n")
    return bloco, rel


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Converte paginas para o widget HTML do Elementor")
    ap.add_argument("--pagina", help="chave de uma pagina; sem isso, converte todas")
    args = ap.parse_args(argv)
    alvos = [por_chave(args.pagina)] if args.pagina else PAGINAS
    print(f"{'pagina':24} {'KB':>6} {'recursos':>9} {'avisos':>7}")
    for p in alvos:
        _, rel = converter(p)
        print(f"{rel.chave:24} {rel.bytes_saida/1024:6.0f} {rel.recursos:9} {len(rel.avisos):7}")
        for a in rel.avisos:
            print(f"    aviso: {a}")
        if rel.descartados:
            print(f"    descartado: {', '.join(rel.descartados)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Rodar, ver passar e gerar as 9**

Run: `python -m pytest tests/elementor/test_conversor.py -v && python scripts/elementor/conversor.py`
Expected: PASS em todos os testes; 9 arquivos em `dist/elementor/`. Remova o `xfail` do teste de `position:fixed` da Tarefa 4.

- [ ] **Step 5: Escrever o README de colagem**

Criar `dist/elementor/README.md` com: para cada página, o arquivo a colar, a URL de destino sugerida, e os 3 ajustes no Elementor (layout em largura total, padding do container em 0, título da página oculto).

- [ ] **Step 6: Commit**

```bash
git add scripts/elementor/conversor.py tests/elementor/test_conversor.py dist/elementor
git commit -m "feat: gera os 9 blocos para o Elementor e documenta a colagem"
```

---

### Task 7: Simulador de WordPress e verificação automática

**Files:**
- Create: `scripts/elementor/simulador.html`, `scripts/elementor/verificar.mjs`
- Modify: `package.json` (script `verificar:elementor`, devDependency `playwright`)

**Interfaces:**
- Consumes: `dist/elementor/*.html`.
- Produces: relatório no terminal e screenshots em `dist/elementor/_screens/`.

- [ ] **Step 1: Criar o simulador**

```html
<!-- scripts/elementor/simulador.html -->
<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  /* imita o que um tema de WordPress injeta em tudo */
  body{margin:0;font-family:Georgia,serif;font-size:17px;color:#333;background:#fff;line-height:1.8}
  h1,h2,h3,h4,h5,h6{margin:.67em 0;font-family:Georgia,serif;color:#111;line-height:1.3}
  p,ul,ol{margin:1em 0} li{margin:.5em 0;list-style:disc outside}
  a{color:#0073aa;text-decoration:underline} img{max-width:100%;height:auto}
  button,input{font-family:inherit;font-size:inherit}
  /* container do Elementor: transform cria contexto de posicionamento */
  .e-con{transform:translateZ(0);max-width:100%;padding:0;margin:0 auto}
</style></head>
<body>
  <h2 class="sonda">Sonda de titulo fora do bloco</h2>
  <p class="sonda">Sonda de paragrafo fora do bloco</p>
  <div class="e-con"><div id="alvo"></div></div>
  <script>
    const pagina = new URLSearchParams(location.search).get('pagina');
    fetch(`../../dist/elementor/${pagina}.html`).then(r => r.text()).then(html => {
      const alvo = document.getElementById('alvo');
      alvo.innerHTML = html;
      // innerHTML nao executa <script>: reinsere para rodar
      alvo.querySelectorAll('script').forEach(velho => {
        const novo = document.createElement('script');
        novo.textContent = velho.textContent;
        velho.replaceWith(novo);
      });
      document.body.dataset.pronto = '1';
    });
  </script>
</body></html>
```

- [ ] **Step 2: Escrever o verificador**

```javascript
// scripts/elementor/verificar.mjs
import { webkit, chromium, devices } from 'playwright';
import { readdirSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '../..');
const SIM = pathToFileURL(path.join(RAIZ, 'scripts/elementor/simulador.html')).href;
const SAIDA = path.join(RAIZ, 'dist/elementor/_screens');
mkdirSync(SAIDA, { recursive: true });

const paginas = readdirSync(path.join(RAIZ, 'dist/elementor'))
  .filter(f => f.endsWith('.html')).map(f => f.replace('.html', ''));

let falhas = 0;
const falhar = (pagina, msg) => { console.log(`  FALHA  ${pagina}: ${msg}`); falhas++; };

const wk = await webkit.launch(), cr = await chromium.launch();
for (const pagina of paginas) {
  console.log(`\n${pagina}`);
  const ctx = await wk.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();

  const quebrados = [];
  p.on('response', r => { if (r.status() >= 400) quebrados.push(`${r.status()} ${r.url().slice(0, 80)}`); });

  await p.goto(`${SIM}?pagina=${pagina}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('body[data-pronto="1"]');
  await p.waitForTimeout(1200);

  // (a) recursos
  if (quebrados.length) falhar(pagina, `recursos quebrados: ${quebrados.slice(0, 3).join(', ')}`);

  // (b) rolagem horizontal em 390 e 320
  for (const largura of [390, 320]) {
    await p.setViewportSize({ width: largura, height: 800 });
    await p.waitForTimeout(300);
    const estoura = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    if (estoura) falhar(pagina, `rolagem horizontal em ${largura}px`);
  }

  // (c) o bloco nao pode alterar as sondas fora dele
  const sondas = await p.evaluate(() => {
    const h = getComputedStyle(document.querySelector('h2.sonda'));
    const a = getComputedStyle(document.querySelector('p.sonda'));
    return { h: h.fontFamily + '|' + h.margin, a: a.fontFamily + '|' + a.margin };
  });
  if (!sondas.h.includes('Georgia') || sondas.h.endsWith('|0px')) falhar(pagina, `CSS vazou para fora do bloco: ${sondas.h}`);

  // (d) o tema nao pode vencer dentro do bloco
  const interno = await p.evaluate(() => {
    const el = document.querySelector('#alvo h1, #alvo h2');
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { fonte: cs.fontFamily, sublinhado: getComputedStyle(document.querySelector('#alvo a') || el).textDecorationLine };
  });
  if (interno && interno.fonte.includes('Georgia')) falhar(pagina, 'tema venceu dentro do bloco (fonte Georgia)');
  if (interno && interno.sublinhado === 'underline') falhar(pagina, 'links herdaram sublinhado do tema');

  // (e) ancoras internas apontam para ids que existem
  const orfas = await p.evaluate(() => [...document.querySelectorAll('#alvo a[href^="#"]')]
    .map(a => a.getAttribute('href')).filter(h => h.length > 1 && !document.querySelector('#alvo ' + h)));
  if (orfas.length) falhar(pagina, `ancora sem destino: ${orfas.join(', ')}`);

  // (f) screenshots
  await p.setViewportSize({ width: 390, height: 844 });
  await p.screenshot({ path: path.join(SAIDA, `${pagina}-iphone.png`), fullPage: true });
  await ctx.close();

  const ctxD = await cr.newContext({ viewport: { width: 1440, height: 900 } });
  const pd = await ctxD.newPage();
  await pd.goto(`${SIM}?pagina=${pagina}`, { waitUntil: 'networkidle' });
  await pd.waitForSelector('body[data-pronto="1"]');
  await pd.waitForTimeout(1200);
  await pd.screenshot({ path: path.join(SAIDA, `${pagina}-desktop.png`), fullPage: true });
  await ctxD.close();

  if (!falhas) console.log('  ok');
}
await wk.close(); await cr.close();
console.log(falhas ? `\n${falhas} falha(s)` : `\n${paginas.length} paginas, 0 falhas`);
process.exit(falhas ? 1 : 0);
```

Em `package.json`, acrescentar `"verificar:elementor": "node scripts/elementor/verificar.mjs"` e `playwright` em `devDependencies`. Instalar os navegadores uma vez: `npx playwright install webkit chromium`.

- [ ] **Step 3: Rodar contra as 9 páginas**

Run: `npm run verificar:elementor`
Expected: 9 páginas, 0 falhas. Toda falha é corrigida no conversor, não no arquivo gerado.

- [ ] **Step 4: Commit**

```bash
git add scripts/elementor/simulador.html scripts/elementor/verificar.mjs package.json
git commit -m "feat: simulador de WordPress e verificacao automatica dos blocos"
```

---

### Task 8: Revisão página a página e entrega

**Files:**
- Modify: `dist/elementor/*.html` (via conversor), `dist/elementor/README.md`

- [ ] **Step 1: Comparar cada bloco com a página no ar**

Para as 9, screenshot do simulador ao lado do screenshot de `https://ev.nathmonari.com.br/<rota>`. Diferença esperada: só a animação. Qualquer outra diferença vira correção no conversor.

- [ ] **Step 2: Conferir os avisos do relatório**

Tratar o `position: fixed` da `vendas-evoluto-v3` e qualquer aviso novo.

- [ ] **Step 3: Colar a primeira página no WordPress**

Começar por `evoluto-day-vd` (a menor). Validar no ar: layout, animação, link de checkout com UTM, e que o GTM dispara uma vez só.

- [ ] **Step 4: Commit final**

```bash
git add dist/elementor
git commit -m "chore: regenera os blocos do Elementor apos a revisao visual"
```
