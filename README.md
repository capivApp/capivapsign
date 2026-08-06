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
- **Cobrança recorrente via Stripe**, com planos, portal do cliente e faturas.

## Stack

- [TypeScript](https://www.typescriptlang.org/) — linguagem
- [React Router](https://reactrouter.com/) — framework
- [Prisma](https://www.prisma.io/) — ORM
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) — UI
- [react-email](https://react.email/) — templates de e-mail
- [tRPC](https://trpc.io/) — API
- [React-PDF](https://github.com/wojtekmaj/react-pdf) / [PDF-Lib](https://github.com/Hopding/pdf-lib) — PDF
- [Stripe](https://stripe.com/) — pagamentos
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

### Cobrança recorrente (Stripe)

1. `NEXT_PUBLIC_FEATURE_BILLING_ENABLED=true`
2. `NEXT_PRIVATE_STRIPE_API_KEY` — chave secreta (`sk_live_...` em produção).
3. Para cada plano, crie um **Product** com um **Price recorrente** no Stripe e
   marque os metadados:
   - Product: `claimId` = `free` | `individual` | `team` | `platform` | `enterprise` | `earlyAdopter`
   - Product: `isSeatBased` = `true` (somente planos por assento)
   - Price: `visibleInApp` = `true` (para aparecer na página de planos)

   Um price sem `claimId` é ignorado — é a causa mais comum de um plano não
   aparecer no app.
4. Crie um webhook apontando para `https://<seu-host>/api/stripe/webhook`
   inscrito em `customer.subscription.created/updated/deleted`,
   `checkout.session.completed`, `invoice.payment_succeeded` e
   `invoice.payment_failed`, e coloque o signing secret em
   `NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET`.

Localmente: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

O servidor **recusa subir** se a cobrança estiver habilitada sem a chave da
Stripe — a falha aparece no deploy, não na frente do primeiro cliente.

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
