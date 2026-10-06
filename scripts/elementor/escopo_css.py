"""Isola um CSS dentro de um wrapper, para colar em widget HTML do Elementor."""
import re
from urllib.parse import urljoin

SITE = "https://ev.nathmonari.com.br"
# at-rules cujo corpo contem regras normais (recursao); as demais ficam intactas
AT_ANINHADAS = {"media", "supports", "layer", "container", "document"}
RAIZ = re.compile(r"^(html|body|:root)(?=$|[\s>+~.:\[#])")


def _resolver_url(valor: str, base_url: str) -> str:
    bruto = valor.strip().strip("'\"")
    if not bruto or bruto.startswith(("data:", "http://", "https://", "//", "#")):
        return valor
    destino = SITE + bruto if bruto.startswith("/") else urljoin(base_url, bruto)
    return valor.replace(bruto, destino, 1)


def _reescrever_urls(css: str, base_url: str) -> str:
    return re.sub(r"url\(([^)]+)\)", lambda m: "url(" + _resolver_url(m.group(1), base_url) + ")", css)


def _separar_virgulas(seletor: str) -> list[str]:
    """Divide por virgula ignorando as que estao dentro de (), [] ou aspas."""
    partes, atual, prof, aspas = [], [], 0, None
    for c in seletor:
        if aspas:
            if c == aspas:
                aspas = None
        elif c in "\"'":
            aspas = c
        elif c in "([":
            prof += 1
        elif c in ")]":
            prof -= 1
        elif c == "," and prof == 0:
            partes.append("".join(atual))
            atual = []
            continue
        atual.append(c)
    partes.append("".join(atual))
    return partes


def _prefixar_seletor(seletor: str, wrapper: str, id_origem: str | None) -> str:
    saida = []
    for bruto in _separar_virgulas(seletor):
        s = bruto.strip()
        if not s:
            continue
        if id_origem and re.match(rf"^#{re.escape(id_origem)}(?![\w-])", s):
            saida.append(re.sub(rf"^#{re.escape(id_origem)}", f"#{wrapper}", s, count=1))
        elif RAIZ.match(s):
            saida.append(RAIZ.sub(f"#{wrapper}", s, count=1))
        else:
            saida.append(f"#{wrapper} {s}")
    return ",".join(saida)


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


def _fim_do_bloco(css: str, abre: int) -> int:
    """Indice da '}' que fecha a '{' em `abre`, respeitando aninhamento e aspas."""
    prof, aspas, i = 0, None, abre
    while i < len(css):
        c = css[i]
        if aspas:
            if c == "\\":
                i += 1
            elif c == aspas:
                aspas = None
        elif c in "\"'":
            aspas = c
        elif c == "{":
            prof += 1
        elif c == "}":
            prof -= 1
            if prof == 0:
                return i
        i += 1
    raise ValueError("CSS com chaves desbalanceadas")


def _processar(css: str, wrapper: str, id_origem: str | None, avisos: list[str]) -> str:
    saida, i = [], 0
    while i < len(css):
        if css[i].isspace():
            i += 1
            continue
        pos = i
        while pos < len(css) and css[pos] not in "{;":
            pos += 1
        if pos >= len(css):
            saida.append(css[i:])  # resto sem bloco
            break
        prelude = css[i:pos].strip()
        if css[pos] == ";":  # @import, @charset...
            saida.append(css[i:pos + 1])
            i = pos + 1
            continue
        fim = _fim_do_bloco(css, pos)
        corpo = css[pos + 1:fim]
        if prelude.startswith("@"):
            nome = re.match(r"@([\w-]+)", prelude).group(1).lower()
            if nome in AT_ANINHADAS:
                corpo = _processar(corpo, wrapper, id_origem, avisos)
            saida.append(f"{prelude}{{{corpo}}}")
        else:
            if re.search(r"position\s*:\s*fixed", corpo):
                avisos.append(
                    f"position:fixed em '{prelude[:60]}' — dentro de container do Elementor "
                    "com transform, o elemento se posiciona pelo container"
                )
            saida.append(_prefixar_seletor(prelude, wrapper, id_origem) + "{" + corpo + "}")
        i = fim + 1
    return "".join(saida)


def escopar(css: str, wrapper: str, base_url: str, id_origem: str | None = None) -> tuple[str, list[str]]:
    avisos: list[str] = []
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    css = _reescrever_urls(css, base_url)

    nomes = sorted(set(re.findall(r"@(?:-webkit-|-moz-)?keyframes\s+([\w-]+)", css)), key=lambda n: (-len(n), n))
    if nomes:
        alt = "|".join(re.escape(n) for n in nomes)
        padrao = rf"(?<![\w-])({alt})(?![\w-])"
        troca = lambda m: f"{wrapper}-{m.group(1)}"
        css = re.sub(
            rf"(@(?:-webkit-|-moz-)?keyframes\s+)({alt})(?![\w-])",
            lambda m: m.group(1) + wrapper + "-" + m.group(2),
            css,
        )
        css = re.sub(
            r"(animation(?:-name)?\s*:)([^;}]*)",
            lambda m: m.group(1) + re.sub(padrao, troca, m.group(2)),
            css,
        )
    return _processar(css, wrapper, id_origem, avisos), avisos
