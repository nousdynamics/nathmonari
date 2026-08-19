# Autenticação do painel

O painel `/xp-pan-adm` usa **usuário + senha validados no Worker**. O Cloudflare
Access foi removido em 18/08/2026 — o One-time PIN não chegava nos e-mails do
domínio `sixsevenplataformadigital.com.br`, que está com o DNS quebrado.

## Como as senhas ficam guardadas

Em lugar nenhum, em texto. O secret `PANEL_USERS` guarda só o hash:

```
usuario:iteracoes:saltHex:hashHex;outro:iteracoes:saltHex:hashHex
```

PBKDF2-SHA256, salt de 16 bytes por usuário, hash de 32 bytes.

Isso significa que o navegador nunca recebe a senha, o HTML e o JS não a contêm,
e nem o dashboard da Cloudflare mostra o valor original. Quem obtiver o secret
tem o hash, não a senha.

> **100.000 iterações é o teto.** O Workers rejeita PBKDF2 acima disso e o
> Worker responde `error code: 1101`. Com 210.000 o login quebra em produção
> mesmo funcionando em `wrangler dev`, que não aplica o limite.

## Usuários atuais

`nous` e `six`. As senhas estão com a equipe — não ficam neste repositório.

## Adicionar ou trocar uma senha

```bash
node -e 'const c=require("crypto");
const s=c.randomBytes(16).toString("hex");const i=100000;
console.log("USUARIO:"+i+":"+s+":"+
c.pbkdf2Sync(process.argv[1],Buffer.from(s,"hex"),i,32,"sha256").toString("hex"))' "A_SENHA"
```

Junte as entradas com `;` e grave tudo de uma vez:

```bash
npx wrangler secret put PANEL_USERS
```

Atualize também o `.dev.vars` local se quiser testar com `npm run dev`.

## Sessão

Cookie `nm_painel`, assinado com HMAC-SHA256 usando `SESSION_SECRET`.
`HttpOnly`, `Secure`, `SameSite=Strict`, validade de 12 horas.

Trocar `SESSION_SECRET` derruba todas as sessões abertas:

```bash
node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'
npx wrangler secret put SESSION_SECRET
```

## Defesas ativas

| Camada | O que faz |
| --- | --- |
| PBKDF2 + salt | senha nunca guardada em texto |
| Comparação em tempo constante | não vaza acerto parcial do hash |
| PBKDF2 mesmo com usuário inexistente | não revela quais logins existem |
| Rate limit | 6 tentativas por IP a cada 15 min → HTTP 429 |
| Cookie assinado | token adulterado é rejeitado |
| CSP + `X-Frame-Options: DENY` | sem script inline, sem embed em iframe |
| `Cache-Control: private, no-store` | painel não fica em cache |
| `/api/routes` autenticado | lista de rotas exige sessão |

## Sobre o bloqueio de F12

`public/js/admin-login.js` intercepta F12, Ctrl+Shift+I/J/C, Ctrl+U e o menu de
contexto na tela de login.

**Isto não é segurança.** Devtools abre antes da página carregar, `view-source:`
não executa JS e `curl` nem roda script. É um dissuasor visual, a pedido, e
nada mais. A proteção real é a senha nunca sair do servidor — ponto acima.

Não vale replicar isso no painel em si: atrapalha depuração e não protege nada.
