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


def test_keyframes_com_nomes_prefixo_um_do_outro_sao_deterministicos():
    entrada = (
        "@keyframes girar{from{opacity:0}}"
        "@keyframes girar-lento{from{opacity:0}}"
        "@keyframes girar-rapido{from{opacity:0}}"
        ".a{animation:girar 1s,girar-lento 2s,girar-rapido 3s}"
    )
    css, _ = escopar(entrada, "nm-x", BASE)
    assert "@keyframes nm-x-girar{" in css
    assert "@keyframes nm-x-girar-lento{" in css
    assert "@keyframes nm-x-girar-rapido{" in css
    assert "animation:nm-x-girar 1s,nm-x-girar-lento 2s,nm-x-girar-rapido 3s" in css
    assert "nm-x-nm-x" not in css
    assert escopar(entrada, "nm-x", BASE)[0] == css


def test_keyframes_com_prefixo_de_fabricante():
    entrada = (
        "@-webkit-keyframes pulsar{from{opacity:0}}@keyframes pulsar{from{opacity:0}}"
        ".a{-webkit-animation:pulsar 1s;animation:pulsar 1s}"
    )
    css, _ = escopar(entrada, "nm-x", BASE)
    assert "@-webkit-keyframes nm-x-pulsar{" in css
    assert "@keyframes nm-x-pulsar{" in css
    assert "-webkit-animation:nm-x-pulsar 1s" in css
    assert "animation:nm-x-pulsar 1s" in css


def test_keyframes_nao_prefixa_from_to_percentual():
    css, _ = escopar("@keyframes g{from{opacity:0}50%{opacity:.5}to{opacity:1}}", "nm-x", BASE)
    assert css == "@keyframes nm-x-g{from{opacity:0}50%{opacity:.5}to{opacity:1}}"


def test_font_face_sai_intacto():
    css, _ = escopar("@font-face{font-family:X;src:url(a.woff2)}", "nm-x", "https://ev.nathmonari.com.br/fonts/")
    assert css == "@font-face{font-family:X;src:url(https://ev.nathmonari.com.br/fonts/a.woff2)}"


def test_media_com_duas_regras_prefixa_as_duas():
    css, _ = escopar("@media(max-width:768px){.a{color:red}.b{color:blue}}", "nm-x", BASE)
    assert css == "@media(max-width:768px){#nm-x .a{color:red}#nm-x .b{color:blue}}"
