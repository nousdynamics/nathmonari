# Blocos para colar no Elementor

9 páginas convertidas de `public/` para blocos autocontidos de HTML + CSS + JS.
Cada arquivo é colado inteiro em **um único widget HTML** do Elementor.

Gerado por `python scripts/elementor/conversor.py`. Não edite estes arquivos à
mão: a próxima geração sobrescreve. Mudou algo? Mude a origem em `public/` ou o
conversor, e gere de novo.

## Onde está cada página

```text
dist/elementor/
├── evoluto-day/          Evoluto Day — as 4 variantes de teste
│   ├── va.html           65 KB
│   ├── vb.html           65 KB
│   ├── vc.html           65 KB
│   └── vd.html           62 KB
├── evoluto/              Evoluto — página de vendas, 3 versões
│   ├── v1.html          205 KB
│   ├── v2.html          205 KB   (era "vendas-evoluto-2-0")
│   └── v3.html          176 KB   (a da copy reescrita)
├── reconstrua-se/        Reconstrua-se — página de vendas
│   ├── sem-vsl.html      88 KB
│   └── com-vsl.html      92 KB
└── _screens/             screenshots da verificação (fora do git)
```

| Arquivo | Origem em `public/` | URL sugerida no WordPress |
| --- | --- | --- |
| `evoluto-day/va.html` | `evoluto-day-va/index.html` | `/evoluto-day-va` |
| `evoluto-day/vb.html` | `evoluto-day-vb/index.html` | `/evoluto-day-vb` |
| `evoluto-day/vc.html` | `evoluto-day-vc/index.html` | `/evoluto-day-vc` |
| `evoluto-day/vd.html` | `evoluto-day-vd/index.html` | `/evoluto-day-vd` |
| `evoluto/v1.html` | `vendas-evoluto-v1/index.html` | `/vendas-evoluto-v1` |
| `evoluto/v2.html` | `vendas-evoluto-2-0/index.html` | `/vendas-evoluto-2-0` |
| `evoluto/v3.html` | `vendas-evoluto-v3/index.html` | `/vendas-evoluto-v3` |
| `reconstrua-se/sem-vsl.html` | `vendas-rc-v3.html` | `/reconstrua-se` |
| `reconstrua-se/com-vsl.html` | `vendas-rc-v3-vsl.html` | `/reconstrua-se/vsl` |

## Como colar, em cada página

1. Crie a página no WordPress e abra no Elementor.
2. **Configurações da página** (engrenagem no canto inferior esquerdo):
   - Layout: **Elementor Largura Total** (*Elementor Full Width*)
   - **Ocultar título da página**: sim
3. Arraste **um** widget **HTML** para a página.
4. Cole o conteúdo do arquivo inteiro dentro dele.
5. No container que recebeu o widget: padding e margin em **0**, largura
   **full width**.
6. Publique e confira no celular.

## O que já está resolvido dentro do bloco

- **CSS isolado.** Todo o estilo está preso ao `<div id="nm-...">` do bloco. O
  CSS da página não vaza para o tema, e o tema não vence dentro do bloco.
- **Imagens e fontes** apontam para `https://ev.nathmonari.com.br/...`.
- **GTM removido.** O container do site já carrega; incluir de novo contaria
  cada evento duas vezes.
- **UTMs preservadas**: o `utms.js` continua embutido e propaga os parâmetros
  para os links de checkout do Kiwify.

## O que você precisa configurar no WordPress

- **SEO da página** (título, descrição, canonical, Open Graph). Esses dados
  foram removidos do bloco: dentro de um widget HTML eles não têm efeito, e
  quem manda é o plugin de SEO do site.
- **Favicon**, se ainda não estiver no tema.

## Dependência que permanece

As imagens e fontes continuam servidas pelo Cloudflare
(`ev.nathmonari.com.br`). Se esse endereço sair do ar, as páginas no WordPress
perdem imagens e fontes. Para cortar essa dependência, suba os arquivos na
biblioteca de mídia e troque o domínio no conversor.

## Verificação

```bash
python -m http.server 8810 --bind 127.0.0.1    # na raiz do projeto
node scripts/elementor/verificar.mjs .
```

Checa, nas 9 páginas: recursos quebrados, rolagem horizontal em 390px e 320px,
vazamento de CSS para fora do bloco, tema vencendo dentro do bloco, âncoras sem
destino e erros de JS. Também grava screenshots em `_screens/`.
