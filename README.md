# CapivaSign

**CapivaSign** é a plataforma de assinatura eletrônica e digital da
[CapivApp](https://capivapp.com.br), com suporte a **certificados ICP-Brasil**
(A1/A3, PAdES-LTA, carimbo de tempo RFC 3161) através de um assinador local.

<div align="center">
  <img src="./packages/assets/logo.png" alt="CapivaSign" width="480" />
</div>

---

> ## Créditos e licença
>
> CapivaSign é um fork do [**Documenso**](https://github.com/documenso/documenso),
> a alternativa open source ao DocuSign. Todo o fluxo de documentos, o pipeline
> de assinatura e a fundação PAdES/CSC sobre a qual o suporte ICP-Brasil foi
> construído são trabalho do Documenso e de seus contribuidores. Nosso muito
> obrigado ao time do Documenso. ❤️
>
> Este projeto é distribuído sob a **GNU Affero General Public License v3.0
> (AGPL-3.0)**, a mesma licença do Documenso (veja [`LICENSE`](./LICENSE)). Em
> conformidade com a AGPL, mantemos este aviso e a atribuição ao projeto
> original, publicamos nosso código-fonte e licenciamos nossas modificações sob
> os mesmos termos. "Documenso" é marca de seus respectivos titulares; este fork
> não é endossado por eles.

---

## O que o CapivaSign faz

- **Assinatura eletrônica** completa: envelopes, campos, ordem de assinatura,
  lembretes, trilha de auditoria e certificado de assinatura em PDF.
- **Assinatura digital ICP-Brasil** (A1 e A3) via assinador local — a chave
  privada nunca sai da máquina do signatário.
- **PAdES-LTA** com carimbo de tempo RFC 3161 e validação de longo prazo.
- **Distribuição por e-mail e WhatsApp**, com domínios de e-mail próprios.
- **API e webhooks** para integração, além de assinatura incorporada (embed).
- **Cobrança mensal via Asaas** (Pix, boleto ou cartão): uma fatura por mês com a
  mensalidade do plano e o uso, detalhada item a item.

## Stack

- [TypeScript](https://www.typescriptlang.org/) — linguagem
- [React Router](https://reactrouter.com/) — framework
- [Prisma](https://www.prisma.io/) — ORM
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) — UI
- [react-email](https://react.email/) — templates de e-mail
- [tRPC](https://trpc.io/) — API
- [React-PDF](https://github.com/wojtekmaj/react-pdf) / [PDF-Lib](https://github.com/Hopding/pdf-lib) — PDF
- [Asaas](https://www.asaas.com/) — pagamentos
- Java 17+ — assinador ICP-Brasil (`apps/desktop/java-helper`)

## Desenvolvimento local

### Requisitos

- Node.js 22+
- PostgreSQL
- Docker (opcional, para o quickstart)
- JDK 17+ (apenas se for mexer no assinador ICP)

### Quickstart

```sh
git clone https://github.com/capivapp/capiva-sign
cd capiva-sign
cp .env.example .env
npm run dx     # sobe Postgres + Inbucket + MinIO e roda as migrations
npm run dev
```

Ou, em um comando só: `npm run d`.

#### Endereços

| Serviço              | URL                    |
| -------------------- | ---------------------- |
| Aplicação            | http://localhost:3000  |
| E-mails (Inbucket)   | http://localhost:9000  |
| Storage S3 (MinIO)   | http://localhost:9001  |
| Banco de dados       | porta `54320`          |

## Configuração

Todas as variáveis estão documentadas em [`.env.example`](./.env.example). Os
blocos que mais importam:

### Cobrança (Asaas)

1. `NEXT_PUBLIC_FEATURE_BILLING_ENABLED=true`
2. `NEXT_PRIVATE_ASAAS_API_KEY`: chave de API do Asaas.
3. `NEXT_PRIVATE_ASAAS_ENVIRONMENT=production` em produção. Qualquer outro valor
   usa o sandbox.
4. No Asaas, crie um webhook para `https://<seu-host>/api/asaas/webhook` com os
   eventos de cobrança (`PAYMENT_*`) e um token de autenticação próprio (nunca a
   chave de API). Coloque o token em `NEXT_PRIVATE_ASAAS_WEBHOOK_TOKEN`.

Como funciona:

- **Planos** vêm do admin (Admin > Claims). Um plano com mensalidade
  (`pricing.monthlyPriceCents`) aparece para o cliente escolher; planos sem preço
  (enterprise, internos) só são atribuídos pelo admin.
- **Plano pago** exige os dados de cobrança da organização (nome ou razão social,
  CPF/CNPJ, inclusive o CNPJ alfanumérico, e e-mail financeiro), que viram o
  cliente no Asaas. Subir de plano vale na hora; descer ou voltar ao gratuito vale
  no dia 1º.
- **Dia 1º às 03:00 UTC** o job `internal.charge-monthly-usage-sweep` emite, por
  organização, **uma** cobrança no Asaas (Pix, boleto ou cartão, vencimento em 5
  dias) com a mensalidade e o uso do mês anterior. Cada item vai na descrição da
  cobrança e num PDF "Demonstrativo" anexado, e aparece em Configurações >
  Cobrança.
- **Fatura vencida** coloca a organização nos limites do plano gratuito até o
  pagamento; o webhook libera assim que o Asaas confirma.
- **Liberar plano** (Admin > Organização): aplica qualquer plano na hora com um
  desconto fixo. Com 100% a fatura do mês continua sendo emitida, para o cliente
  acompanhar os valores, mas fica "Sem cobrança" e não vai para o Asaas.
- Se um webhook se perder, "Sincronizar com o Asaas" na página da organização no
  admin relê as cobranças em aberto.

O servidor **recusa subir** com a cobrança habilitada e sem a chave do Asaas, e
avisa no log quando falta o token do webhook ou quando produção aponta para o
sandbox.

### Licenciamento

`NEXT_PRIVATE_LICENSE_MODE` decide como as permissões de recursos são resolvidas:

| Modo     | Comportamento                                                              |
| -------- | -------------------------------------------------------------------------- |
| `self`   | Padrão. A própria instância concede seus recursos — sem chamada externa.     |
| `server` | Valida a chave contra `NEXT_PRIVATE_LICENSE_SERVER_URL`.                    |
| `none`   | Licenciamento desligado; todo recurso restrito permanece fechado.            |

### Identidade visual

`NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_BRAND_URL` e
`NEXT_PUBLIC_BRAND_SOCIAL_HANDLE` permitem que uma instância self-hosted
apresente a própria marca sem rebuild.

## Assinador ICP-Brasil

O assinador local vive em [`apps/desktop/java-helper`](./apps/desktop/java-helper)
e é o que dá acesso ao certificado A1/A3 do signatário.

```sh
cd apps/desktop/java-helper
./build.sh                                    # gera build/icp-helper.jar
java -jar build/icp-helper.jar serve --no-gui # agente na bandeja, porta 3231
```

No Windows, `windows/build-installer.bat` gera um instalador único que embute
uma JRE, registra o deep link `capivasign-icp://` e inicia o agente na bandeja
do sistema a cada logon — **sem janela de console**. Detalhes em
[`apps/desktop/java-helper/README.md`](./apps/desktop/java-helper/README.md).

Diagnóstico: o agente grava log em `%LOCALAPPDATA%\CapivaSign\agent.log`
(`~/.local/state/capivasign/agent.log` no Linux), acessível pelo menu da bandeja.

## Docker e self-hosting

Imagens são publicadas em `ghcr.io/capivapp/capiva-sign`. Os composes de
desenvolvimento, teste e produção estão em [`docker/`](./docker).

```sh
docker compose -f docker/production/compose.yml up -d
```

### Servidor sem Docker (systemd)

Com o repositório clonado no servidor e o `.env` preenchido na raiz:

```sh
./scripts/build.sh   # npm ci, cliente Prisma e build do app
./scripts/start.sh   # aplica as migrations e sobe o servidor (porta $PORT, padrão 3000)
```

Para rodar como serviço, ajuste `User` e os caminhos em
[`scripts/capivasign.service`](./scripts/capivasign.service) e instale:

```sh
sudo cp scripts/capivasign.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now capivasign
journalctl -u capivasign -f
```

A cada atualização: `git pull && ./scripts/build.sh && sudo systemctl restart capivasign`.

## Testes

```sh
npm run lint                      # Biome
npm run --workspace @documenso/lib test   # unitários
npx turbo run test:e2e            # Playwright (requer app rodando)
```

## Solução de problemas

**Não recebo e-mails no ambiente local.** O quickstart sobe um
[Inbucket](https://inbucket.org/) que captura tudo: UI em http://localhost:9000,
SMTP em `localhost:2500`.

**Variáveis de ambiente não aparecem nos scripts.** Envolva o comando com
`with:env`:

```sh
npm run with:env -- npm run meu-script
```

## Contribuindo

Veja o [guia de contribuição](./CONTRIBUTING.md) e o
[código de conduta](./CODE_OF_CONDUCT.md).

## Segurança

Para reportar uma vulnerabilidade, escreva para **security@capivapp.com.br**.
Veja [`.well-known/security.txt`](./.well-known/security.txt).
