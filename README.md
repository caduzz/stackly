# Stackly

Stackly é um navegador desktop baseado em Chromium e orientado ao fluxo de
desenvolvimento. Ele reúne navegação, ambientes, inspeção de rede, console,
armazenamento, cliente de API e terminal em uma única interface.

> Estado atual: versão inicial funcional em desenvolvimento. Os instaladores
> ainda não são assinados para distribuição pública.

## Funcionalidades

- Abas Chromium independentes com histórico, reload e address bar
- Workspaces com sessões isoladas de cookies, cache e armazenamento
- Ambientes local, staging, production e custom com preservação de path/query
- Split View para comparar dois ambientes
- Network Inspector baseado em Chrome DevTools Protocol
- Console persistente por aba
- Inspeção e remoção de cookies e leitura de `localStorage`
- API Client com Monaco Editor e visualização JSON
- Terminal integrado com `xterm.js` e `node-pty`
- Detector restrito de serviços localhost conhecidos
- Downloads, screenshots, presets de viewport e Command Palette
- Persistência SQLite de workspaces, environments e settings

## Stack

- Electron 44 e `WebContentsView`
- electron-vite, React 19 e TypeScript strict
- Tailwind CSS, Zustand, Zod e Lucide
- Monaco Editor e xterm.js
- SQLite com better-sqlite3
- electron-builder para distribuição

## Arquitetura

```text
src/
├── main/       # janelas, views Chromium, CDP, SQLite, terminal e IPC
├── preload/    # API pública restrita via contextBridge
├── renderer/   # shell React local
└── shared/     # contratos, schemas e tipos compartilhados
```

Sites remotos são carregados exclusivamente em `WebContentsView`. O renderer
local não recebe acesso direto ao Node.js, `ipcRenderer`, filesystem, shell ou
processos filhos.

## Requisitos

- Node.js 22.12 ou superior
- npm
- Linux, macOS ou Windows

Os pacotes `better-sqlite3` e `node-pty` usam binários nativos prebuilt. O
`postinstall` verifica se há binários para o sistema e arquitetura atuais.

## Desenvolvimento

```bash
git clone git@github.com:caduzz/stackly.git
cd stackly
npm install
npm run dev
```

Comandos disponíveis:

```bash
npm run dev          # inicia electron-vite em desenvolvimento
npm run typecheck    # valida TypeScript strict
npm test             # valida a configuração de distribuição
npm run build        # gera os bundles de produção em out/
npm run package:dir  # gera aplicação descompactada para smoke test
npm run package      # gera instalador para o sistema atual
```

Scripts específicos:

```bash
npm run package:linux
npm run package:deb
npm run package:win
npm run package:mac
```

Os artefatos são gravados em `release/`. Consulte
[DISTRIBUTION.md](./DISTRIBUTION.md) para detalhes.

## Dados locais

O banco `stackly.sqlite` fica no diretório `userData` fornecido pelo Electron,
fora do código-fonte e da pasta de instalação. Cada workspace usa uma partição
Chromium persistente própria no formato `persist:workspace:<id>`.

## Segurança

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- `webSecurity: true`
- permissões sensíveis negadas por padrão
- criação arbitrária de janelas bloqueada
- argumentos IPC validados
- DevTools desabilitado no build empacotado
- CSP restritiva na shell local

As decisões e limites estão documentados em
[SECURITY_NOTES.md](./SECURITY_NOTES.md).

## Distribuição

O Linux usa AppImage como alvo padrão. O `.deb` deve ser gerado em ambiente
Debian/Ubuntu ou em CI com as bibliotecas exigidas pelo `fpm`. Windows usa NSIS
e macOS usa DMG/ZIP. Releases públicas para Windows e macOS exigem assinatura
de código; macOS também deve usar notarização.

## Débitos conhecidos

- Ausência de assinatura de código e notarização
- Build de Windows e macOS ainda precisa ser validado em runners nativos
- Bundle do Monaco ainda é grande e pode receber divisão de chunks
- Não há atualização automática
- A suíte automatizada atual cobre configuração e tipagem; faltam testes E2E
- Homepage e canais formais de suporte ainda não foram definidos

## Próximos passos recomendados

1. Criar CI em matriz para Linux, Windows e macOS.
2. Adicionar assinatura, notarização e publicação de releases.
3. Implementar atualização automática com canal estável.
4. Adicionar testes E2E dos fluxos de navegação, workspaces e DevTools.
5. Otimizar carregamento do Monaco e o tamanho dos instaladores.

## Licença

Nenhuma licença de código aberto foi definida até o momento. Adicione um
arquivo `LICENSE` antes de aceitar contribuições ou redistribuição pública.
