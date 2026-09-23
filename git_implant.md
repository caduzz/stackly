stackly — Integração com GitHub
Backlog de desenvolvimento antes da implementação da IA

Antes de implementar a IA no stackly, podemos adicionar uma integração nativa com Git e GitHub. A ideia é transformar o navegador em um ambiente capaz de reconhecer o projeto em desenvolvimento, identificar a branch atual, acompanhar alterações e conectar o workspace ao repositório correspondente.

Isso também prepara a infraestrutura para a futura IA, que poderá entender o contexto do projeto sem precisar receber essas informações manualmente.

Objetivo: permitir que o desenvolvedor gerencie seu projeto Git e interaja com o GitHub diretamente pelo stackly, mantendo o limite de aproximadamente 500 linhas de código por ticket.

1. Como funcionará a integração

O stackly terá uma seção chamada Source Control, semelhante à do VS Code, mas adaptada à interface minimalista do navegador.

Exemplo:

┌──────────────────────────────────────┐
│ stackly                           ◇   │
├──────────────────────────────────────┤
│                                      │
│ Workspace: Ecommerce                 │
│                                      │
│ Branch: feature/checkout         ⌄   │
│ Repository: ecommerce-web            │
│                                      │
├──────────────────────────────────────┤
│ SOURCE CONTROL                       │
│                                      │
│ Changes                          3   │
│                                      │
│ M  src/components/Checkout.tsx       │
│ M  src/pages/Cart.tsx                │
│ A  src/utils/payment.ts              │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ Commit message                   │ │
│ └──────────────────────────────────┘ │
│                                      │
│ [ Commit ]             [ Push ]      │
│                                      │
├──────────────────────────────────────┤
│ REMOTE                               │
│                                      │
│ GitHub                               │
│                                      │
│ Pull Requests                    2   │
│ Issues                           5   │
│ Actions                          ✓   │
│                                      │
└──────────────────────────────────────┘

A integração será dividida em duas camadas.

Git local: funciona sem conexão com o GitHub e permite consultar branches, alterações, commits e diferenças entre arquivos.

GitHub: adiciona autenticação, informações do repositório remoto, pull requests, issues e workflows do GitHub Actions.

Essa separação é importante porque o stackly não deve depender da autenticação no GitHub para funcionar com um repositório Git local.

2. Arquitetura
stackly
│
├── Browser Core
│
├── Workspace Manager
│   └── Repository Binding
│
├── Source Control
│   │
│   ├── Git Service
│   │   ├── Repository
│   │   ├── Branches
│   │   ├── Status
│   │   ├── Commits
│   │   ├── Diff
│   │   └── Staging
│   │
│   └── GitHub Service
│       ├── Authentication
│       ├── Repository Metadata
│       ├── Pull Requests
│       ├── Issues
│       └── Actions
│
└── Future AI Agent
    │
    ├── Workspace Context
    ├── Git Context
    ├── GitHub Context
    └── Browser Tools

A interface React nunca executará comandos Git diretamente.

Todas as operações com o sistema de arquivos, Git e credenciais acontecerão no processo principal do Electron, por meio de APIs IPC específicas e validadas.

3. Tecnologias e bibliotecas
Tecnologia	Finalidade	Documentação
Git	Operações locais de versionamento	Git Documentation
simple-git	Interface Node.js para operações Git	simple-git
Octokit	Cliente oficial para a API do GitHub	Octokit
GitHub REST API	Repositórios, commits, issues e PRs	GitHub REST API
GitHub GraphQL API	Consultas estruturadas, se necessárias	GitHub GraphQL
GitHub OAuth	Autenticação de usuários	OAuth Apps
GitHub Device Flow	Login sem inserir senha no aplicativo	Device Flow
Electron dialog	Seleção de diretórios locais	Dialog
Electron safeStorage	Proteção de credenciais	safeStorage
Monaco Diff Editor	Visualização das alterações de código	Monaco Editor
Zustand	Estado da interface	Zustand
Zod	Validação dos contratos IPC	Zod

Decisão arquitetural: começaremos com simple-git para operações locais e Octokit para interagir com o GitHub. Não será necessário implementar um cliente Git do zero.

Para evitar problemas de manutenção, a IA responsável pela implementação deverá verificar a documentação e a compatibilidade das versões antes de instalar cada biblioteca.

4. Prompt-base para todos os tickets

Copie o contexto abaixo antes de enviar qualquer ticket de implementação.

PROMPT BASE — stackly SOURCE CONTROL
Você é o engenheiro principal do stackly, um navegador desktop
minimalista para desenvolvedores, baseado em Electron e Chromium.

O stackly combina:

- navegação web;
- workspaces;
- ambientes local, staging e production;
- DevTools próprios;
- Network Inspector;
- Console;
- API Client;
- terminal integrado;
- gerenciamento de projetos.

Estamos iniciando uma nova etapa: integração nativa com Git e GitHub.

O objetivo é permitir que o desenvolvedor conecte um repositório
local ao workspace, acompanhe alterações, gerencie branches e
interaja com o GitHub diretamente pelo navegador.

Esta etapa deve preparar a arquitetura para uma futura IA, mas
NÃO deve implementar agentes de IA, modelos ou chamadas a LLMs.

STACK EXISTENTE

Electron
Chromium
React
TypeScript strict
Tailwind CSS
Zustand
Zod
Lucide
SQLite
Monaco Editor

ARQUITETURA

Main Process:
Operações Git, acesso ao filesystem, GitHub API,
credenciais e operações privilegiadas.

Preload:
Exposição controlada das APIs necessárias.

Renderer:
Interface React e apresentação de informações.

A interface nunca deve receber acesso direto a child_process,
filesystem, ipcRenderer ou credenciais.

DESIGN SYSTEM

Fundo principal: #1D2533
Fundo secundário: #252B3B
Painéis: #343447
Texto principal: #EEE8F4
Texto discreto: #ABA5BD
Destaque: #C58FA9
Seleção: #79586F
Bordas: #57536D
Sucesso: #9CBBA9
Aviso: #D1BD9B
Erro: #DF91A7

Visual inspirado nos princípios de design da Apple:

- minimalista;
- compacto;
- hierarquia clara;
- ícones discretos;
- bordas sutis;
- animações curtas;
- sem excesso de cartões.

REGRAS DE IMPLEMENTAÇÃO

1. Inspecione o estado atual do repositório antes de modificar arquivos.

2. Não suponha que funcionalidades anteriores foram implementadas
   exatamente como descritas nos tickets.

3. Preserve a arquitetura existente quando ela for tecnicamente adequada.

4. Não implemente funcionalidades de tickets futuros.

5. Cada ticket deve produzir no máximo aproximadamente 500 linhas
   novas ou substancialmente modificadas de código manual.

6. Se a implementação ultrapassar o limite, divida o ticket em
   subtickets menores antes de escrever código.

7. Não comprima código para artificialmente respeitar o limite.

8. Toda operação Git deve acontecer no processo principal.

9. Não construa comandos de shell concatenando entrada do usuário.

10. Nunca exponha tokens de autenticação ao renderer.

11. Não execute operações destrutivas sem confirmação explícita.

12. Não implemente a IA nesta etapa.

ANTES DE PROGRAMAR

Informe:

- estado atual;
- objetivo;
- arquivos que serão modificados;
- bibliotecas e APIs utilizadas;
- implicações de segurança;
- estimativa de linhas.

DEPOIS DE PROGRAMAR

Informe:

- o que foi implementado;
- arquivos alterados;
- testes executados;
- problemas conhecidos;
- critérios de aceite;
- próximo ticket.

Não afirme ter executado testes que não foram realmente executados.

Pare ao finalizar o ticket solicitado.
FASE 1 — Integração Git local

Esta fase funciona completamente sem GitHub.

O objetivo é reconhecer o repositório do workspace e permitir visualizar informações de versionamento.

GIT-01 — Estrutura do módulo Git

Objetivo: criar a arquitetura inicial do sistema Source Control.

Prompt
Implemente o ticket GIT-01 do stackly.

OBJETIVO

Criar a estrutura base para integração Git local.

Não implementar ainda operações Git reais.

ESTRUTURA SUGERIDA

src/main/git/
    git.service.ts
    repository.service.ts
    git.types.ts

src/renderer/src/features/source-control/
    components/
    stores/
    types/

src/shared/
    git.contracts.ts

Adapte a estrutura ao projeto existente.

IMPLEMENTAÇÃO

Criar contratos TypeScript para:

GitRepository
GitBranch
GitFileStatus
GitCommit

Criar GitService como ponto central de acesso
às operações Git.

Criar contratos IPC específicos para a futura
integração com o renderer.

Não expor comandos arbitrários.

CRITÉRIOS DE ACEITE

- estrutura criada;
- TypeScript compila;
- contratos possuem tipos claros;
- renderer não acessa Node diretamente;
- nenhum comando Git real é executado.

LIMITE

Máximo de 500 linhas.
GIT-02 — Selecionar repositório local

Objetivo: permitir conectar uma pasta Git ao workspace atual.

Prompt
Implemente o ticket GIT-02 do stackly.

OBJETIVO

Permitir que o usuário selecione um diretório
local contendo um repositório Git.

IMPLEMENTAÇÃO

Criar ação:

Connect Repository

Abrir seletor de diretórios usando Electron dialog.

Validar se o diretório pertence a um repositório Git.

Se o diretório selecionado estiver dentro de um
repositório, identificar a raiz do repositório.

Associar o repositório ao workspace ativo.

Não inicializar novos repositórios neste ticket.

Não criar commits.

Não modificar arquivos do projeto.

SEGURANÇA

A escolha do diretório deve acontecer via
diálogo nativo.

O renderer não deve receber uma API genérica
para ler qualquer diretório.

CRITÉRIOS DE ACEITE

- usuário seleciona diretório;
- repositório válido é reconhecido;
- diretório inválido mostra erro;
- cancelamento funciona;
- raiz do repositório é identificada;
- workspace recebe referência ao repositório.

LIMITE

Máximo de 500 linhas.
GIT-03 — Persistência do repositório

Objetivo: salvar a associação entre workspace e repositório.

Prompt
Implemente o ticket GIT-03.

OBJETIVO

Persistir o repositório Git associado ao workspace.

IMPLEMENTAÇÃO

Adicionar repositoryPath ao modelo persistido
do workspace ou criar uma associação própria.

Usar a camada de persistência existente.

Ao iniciar o stackly:

- recuperar o repositório associado;
- verificar se o diretório ainda existe;
- verificar se continua sendo um repositório Git.

Se o diretório não existir:

- não causar crash;
- indicar que o repositório está indisponível;
- permitir conectar novamente.

Não modificar automaticamente arquivos ou
configurações do Git.

CRITÉRIOS DE ACEITE

- associação persiste;
- reiniciar mantém associação;
- diretório inexistente é tratado;
- workspace sem Git funciona normalmente.

LIMITE

Máximo de 500 linhas.
GIT-04 — Branch atual e status

Objetivo: exibir informações básicas do repositório.

Prompt
Implemente GIT-04.

OBJETIVO

Consultar a branch atual e o estado do repositório.

UTILIZAR

simple-git.

IMPLEMENTAÇÃO

Expor operações específicas:

getCurrentBranch()
getRepositoryStatus()

Retornar:

branch atual;
quantidade de arquivos modificados;
quantidade de arquivos adicionados;
quantidade de arquivos removidos;
quantidade de arquivos não rastreados.

Criar indicadores visuais discretos na sidebar.

Exemplo:

Source Control

feature/checkout

3 changes

Não implementar staging ou commit.

CRITÉRIOS DE ACEITE

- branch correta aparece;
- mudanças locais são detectadas;
- repositório limpo aparece corretamente;
- repositório sem commits não quebra;
- detached HEAD é tratado.

LIMITE

Máximo de 500 linhas.
GIT-05 — Lista de arquivos modificados

Objetivo: mostrar os arquivos alterados no Source Control.

Prompt
Implemente GIT-05.

OBJETIVO

Exibir os arquivos modificados do repositório.

IMPLEMENTAÇÃO

Criar GitFileStatus contendo:

path
status
staged
unstaged
untracked

Mostrar grupos:

Staged Changes
Changes
Untracked Files

Exemplo:

M Checkout.tsx
M Cart.tsx
A payment.ts

Usar ícones Lucide discretos.

Cores semânticas:

modified: warning;
added: success;
deleted: error.

Não permitir modificar arquivos neste ticket.

CRITÉRIOS DE ACEITE

- arquivos aparecem;
- status correto;
- staged e unstaged são diferenciados;
- nomes longos não quebram a interface;
- refresh funciona.

LIMITE

Máximo de 500 linhas.
GIT-06 — Visualizador de Diff

Objetivo: visualizar alterações locais.

Prompt
Implemente GIT-06.

OBJETIVO

Permitir visualizar o diff de um arquivo modificado.

UTILIZAR

simple-git;
Monaco Diff Editor.

IMPLEMENTAÇÃO

Ao clicar em um arquivo modificado:

- carregar versão original;
- carregar versão modificada;
- mostrar comparação no Monaco Diff Editor.

Permitir visualizar arquivos staged e unstaged
separadamente.

Não permitir editar arquivos pelo editor neste ticket.

Tratar:

arquivos novos;
arquivos removidos;
arquivos binários;
arquivos muito grandes.

Não carregar arquivos gigantes automaticamente.

CRITÉRIOS DE ACEITE

- diff aparece;
- linhas adicionadas são identificadas;
- linhas removidas são identificadas;
- arquivos binários não causam crash;
- visualização não modifica o repositório.

LIMITE

Máximo de 500 linhas.
FASE 2 — Operações Git

Nesta fase o stackly começa a permitir operações de versionamento.

GIT-07 — Stage e Unstage
Implemente GIT-07.

OBJETIVO

Permitir adicionar e remover arquivos da staging area.

IMPLEMENTAÇÃO

Adicionar ações:

Stage File
Unstage File

Adicionar posteriormente ações:

Stage All
Unstage All

Usar operações específicas da biblioteca Git.

Nunca montar comandos de shell através de
concatenação de strings.

Validar que o arquivo pertence ao repositório ativo.

Atualizar status após cada operação.

CRITÉRIOS DE ACEITE

- stage funciona;
- unstage funciona;
- grupos são atualizados;
- caminhos inválidos são rejeitados;
- alterações não são descartadas.

LIMITE

Máximo de 500 linhas.
GIT-08 — Commit
Implemente GIT-08.

OBJETIVO

Permitir criar commits no repositório.

INTERFACE

Campo:

Commit message

Botão:

Commit

IMPLEMENTAÇÃO

Criar commit somente com alterações staged.

Validar mensagem não vazia.

Antes de executar:

verificar existência de alterações staged.

Não executar git add automaticamente.

Não fazer push automaticamente.

Exibir resultado da operação.

CRITÉRIOS DE ACEITE

- commit é criado;
- mensagem é preservada;
- arquivos unstaged não entram no commit;
- erro de identidade Git é tratado;
- commit vazio não é criado por acidente.

LIMITE

Máximo de 500 linhas.
GIT-09 — Branch Manager
Implemente GIT-09.

OBJETIVO

Criar interface para gerenciamento de branches.

IMPLEMENTAÇÃO

Listar branches locais.

Mostrar branch atual.

Permitir:

Create Branch
Switch Branch

Não implementar exclusão de branches neste ticket.

Antes de trocar de branch, verificar se existem
alterações locais que possam impedir a operação.

Não descartar alterações automaticamente.

CRITÉRIOS DE ACEITE

- branches aparecem;
- criar branch funciona;
- trocar branch funciona;
- branch atual é atualizada;
- conflitos são tratados sem perda de dados.

LIMITE

Máximo de 500 linhas.
GIT-10 — Histórico de commits
Implemente GIT-10.

OBJETIVO

Exibir histórico do repositório.

IMPLEMENTAÇÃO

Consultar últimos 50 commits.

Exibir:

hash abreviado;
mensagem;
autor;
data.

Ao selecionar um commit:

mostrar detalhes básicos.

Adicionar paginação ou carregamento incremental
se necessário.

Não implementar reset ou revert.

CRITÉRIOS DE ACEITE

- histórico aparece;
- commit mais recente aparece primeiro;
- repositório vazio é tratado;
- seleção não modifica o Git.

LIMITE

Máximo de 500 linhas.
FASE 3 — Autenticação GitHub

Aqui começamos a integração com a conta do usuário.

O stackly não precisa cobrar por acesso ao GitHub. O desenvolvedor autentica sua própria conta, e o aplicativo utiliza as permissões concedidas por ele.

GH-01 — Estrutura do GitHub Provider
Implemente GH-01.

OBJETIVO

Criar a arquitetura do provider GitHub.

UTILIZAR

Octokit.

IMPLEMENTAÇÃO

Criar:

GitHubProvider
GitHubAuthService
GitHubRepositoryService

Definir estados:

disconnected
connecting
connected
error

Não implementar autenticação ainda.

Criar contratos tipados entre main e renderer.

CRITÉRIOS DE ACEITE

- provider desacoplado do GitService;
- contratos tipados;
- nenhuma credencial exposta;
- TypeScript compila.

LIMITE

Máximo de 500 linhas.
GH-02 — Login com GitHub

Objetivo: permitir que o usuário conecte sua conta.

Para um aplicativo desktop, podemos usar o fluxo de autorização de dispositivos, desde que a OAuth App esteja configurada corretamente e esse fluxo esteja habilitado. O usuário autoriza o stackly no GitHub sem fornecer sua senha diretamente ao aplicativo.

Documentação: GitHub OAuth Device Flow.

Prompt
Implemente GH-02.

OBJETIVO

Permitir login do usuário usando GitHub OAuth.

UTILIZAR

GitHub Device Authorization Flow.

IMPLEMENTAÇÃO

Criar botão:

Connect GitHub

Iniciar fluxo de autenticação.

Mostrar:

código de autorização;
link oficial de autorização;
estado da conexão.

Permitir cancelar o fluxo.

Após autorização:

obter token de acesso;
armazenar no processo privilegiado;
consultar informações básicas do usuário.

SEGURANÇA

Nunca pedir senha do GitHub.

Nunca expor token no renderer.

Nunca armazenar token em localStorage.

Não registrar token em logs.

Não enviar token para o navegador remoto.

CRITÉRIOS DE ACEITE

- usuário consegue autenticar;
- cancelamento funciona;
- token permanece fora do renderer;
- erro de autorização é tratado;
- usuário conectado é identificado.

LIMITE

Máximo de 500 linhas.

Observação: o stackly precisará ter uma aplicação OAuth registrada no GitHub. O identificador público da aplicação pode fazer parte da distribuição, mas qualquer segredo confidencial não deve ser embutido no executável desktop.

GH-03 — Armazenamento seguro de credenciais
Implemente GH-03.

OBJETIVO

Persistir credenciais do GitHub com segurança.

IMPLEMENTAÇÃO

Usar mecanismo seguro do sistema operacional.

Avaliar Electron safeStorage e suas limitações
na plataforma atual.

Não salvar tokens diretamente em SQLite.

No banco persistir apenas metadados da conexão.

Implementar:

saveCredential
getCredential
deleteCredential

Essas operações devem ser privadas ao main process.

CRITÉRIOS DE ACEITE

- token não aparece no renderer;
- token não aparece em logs;
- reiniciar preserva conexão quando suportado;
- desconectar remove credencial;
- indisponibilidade do armazenamento seguro é tratada.

LIMITE

Máximo de 500 linhas.
GH-04 — Perfil GitHub
Implemente GH-04.

OBJETIVO

Exibir a conta GitHub conectada.

IMPLEMENTAÇÃO

Consultar usuário autenticado via Octokit.

Mostrar:

avatar;
username;
nome;
link do perfil.

Criar botão:

Disconnect GitHub

Exibir estado desconectado adequadamente.

CRITÉRIOS DE ACEITE

- perfil correto aparece;
- imagem carrega;
- erros da API são tratados;
- logout funciona;
- nenhuma credencial aparece na interface.

LIMITE

Máximo de 500 linhas.
FASE 4 — Repositório remoto
GH-05 — Identificação do remote
Implemente GH-05.

OBJETIVO

Identificar se o repositório local possui
um remote hospedado no GitHub.

IMPLEMENTAÇÃO

Consultar remotes do repositório.

Reconhecer URLs HTTPS e SSH.

Exemplos:

https://github.com/owner/repository.git

git@github.com:owner/repository.git

Extrair:

owner
repository

Não assumir que todo remote é GitHub.

Tratar repositórios sem remote.

CRITÉRIOS DE ACEITE

- remote HTTPS reconhecido;
- remote SSH reconhecido;
- repositório sem remote funciona;
- GitLab e outros hosts não são classificados como GitHub;
- URL inválida não causa crash.

LIMITE

Máximo de 500 linhas.
GH-06 — Informações do repositório remoto
Implemente GH-06.

OBJETIVO

Exibir informações do repositório GitHub
conectado ao workspace.

UTILIZAR

Octokit.

IMPLEMENTAÇÃO

Consultar:

nome;
owner;
descrição;
visibilidade;
default branch;
URL;
última atualização.

Mostrar informações no painel Source Control.

Não implementar edição do repositório.

CRITÉRIOS DE ACEITE

- dados corretos;
- repositório privado funciona quando autorizado;
- repositório inacessível mostra erro;
- rate limit é tratado;
- ausência de remote é tratada.

LIMITE

Máximo de 500 linhas.
GH-07 — Fetch e Pull
Implemente GH-07.

OBJETIVO

Permitir atualizar o repositório local.

IMPLEMENTAÇÃO

Adicionar:

Fetch

Pull

Fetch pode ser executado mediante ação do usuário.

Pull exige ação explícita.

Não executar pull automaticamente ao abrir workspace.

Antes do pull:

verificar estado do repositório.

Tratar:

divergência;
conflitos;
ausência de upstream;
erro de autenticação.

Não descartar alterações locais.

CRITÉRIOS DE ACEITE

- fetch funciona;
- pull funciona em cenário sem conflitos;
- ausência de upstream é tratada;
- conflitos não causam perda de dados;
- status é atualizado após operação.

LIMITE

Máximo de 500 linhas.
GH-08 — Push
Implemente GH-08.

OBJETIVO

Permitir enviar commits ao remote.

IMPLEMENTAÇÃO

Adicionar botão:

Push

Mostrar:

branch local;
remote;
branch de destino.

Exigir confirmação quando o destino não estiver
claramente configurado.

Não implementar force push.

Não executar push automaticamente após commit.

Tratar:

erro de autenticação;
rejected push;
branch sem upstream;
remote indisponível.

CRITÉRIOS DE ACEITE

- push funciona;
- usuário entende destino;
- erro não causa crash;
- não existe force push;
- aplicação não envia commits sem ação explícita.

LIMITE

Máximo de 500 linhas.
FASE 5 — Pull Requests

Essa fase permitirá acompanhar revisões de código diretamente pelo navegador.

GH-09 — Listar Pull Requests
Implemente GH-09.

OBJETIVO

Listar pull requests do repositório atual.

UTILIZAR

GitHub REST API via Octokit.

IMPLEMENTAÇÃO

Criar seção:

Pull Requests

Exibir:

número;
título;
autor;
branch de origem;
branch de destino;
estado.

Adicionar filtros:

Open
Closed

Implementar paginação.

CRITÉRIOS DE ACEITE

- PRs aparecem;
- dados corretos;
- paginação funciona;
- repositório sem PR não quebra;
- erros de permissão são tratados.

LIMITE

Máximo de 500 linhas.
GH-10 — Detalhes de Pull Request
Implemente GH-10.

OBJETIVO

Exibir detalhes de um pull request.

IMPLEMENTAÇÃO

Ao selecionar PR:

mostrar:

título;
descrição;
autor;
branches;
commits;
arquivos alterados;
estado dos checks quando disponível.

Adicionar ação:

Open on GitHub

Não implementar merge neste ticket.

CRITÉRIOS DE ACEITE

- detalhes aparecem;
- arquivos alterados são listados;
- link externo é validado;
- PR privado funciona com permissão adequada;
- UI não bloqueia enquanto carrega.

LIMITE

Máximo de 500 linhas.
GH-11 — Criar Pull Request
Implemente GH-11.

OBJETIVO

Permitir criar um pull request a partir da
branch atual.

IMPLEMENTAÇÃO

Criar formulário:

Title
Description
Base Branch
Head Branch

Mostrar repositório e destino antes de criar.

Não criar PR automaticamente após push.

Exigir confirmação explícita.

Tratar branch sem commits novos e erros da API.

CRITÉRIOS DE ACEITE

- formulário funciona;
- branches corretas;
- PR é criado somente após confirmação;
- erro de permissão é tratado;
- PR criado pode ser aberto no GitHub.

LIMITE

Máximo de 500 linhas.
FASE 6 — Issues e GitHub Actions
GH-12 — Listar Issues
Implemente GH-12.

OBJETIVO

Permitir acompanhar issues do projeto.

IMPLEMENTAÇÃO

Listar issues do repositório.

Exibir:

número;
título;
estado;
labels;
assignee.

Adicionar:

Open on GitHub

Não implementar edição de issues inicialmente.

Não misturar pull requests com issues na listagem,
mesmo que a API utilizada retorne ambos.

CRITÉRIOS DE ACEITE

- issues aparecem;
- filtros funcionam;
- labels aparecem;
- link externo funciona;
- repositório sem issues é tratado.

LIMITE

Máximo de 500 linhas.
GH-13 — GitHub Actions
Implemente GH-13.

OBJETIVO

Exibir o estado dos workflows do repositório.

IMPLEMENTAÇÃO

Consultar execuções recentes do GitHub Actions.

Mostrar:

workflow;
branch;
commit;
status;
conclusão;
data.

Estados:

queued;
in_progress;
completed.

Conclusões:

success;
failure;
cancelled;
skipped.

Adicionar ação:

View on GitHub

Não permitir disparar workflows neste ticket.

CRITÉRIOS DE ACEITE

- execuções aparecem;
- status correto;
- repositório sem Actions é tratado;
- falta de permissão é tratada;
- links externos são validados.

LIMITE

Máximo de 500 linhas.
FASE 7 — Preparação para a IA

Nesta etapa ainda não conectaremos GPT, Claude ou modelos locais.

O objetivo é disponibilizar informações estruturadas para que, futuramente, qualquer provedor de IA consiga compreender o workspace.

GH-14 — Git Context Service
Implemente GH-14.

OBJETIVO

Criar serviço de contexto Git para a futura IA.

NÃO IMPLEMENTAR IA.

IMPLEMENTAÇÃO

Criar GitContextService.

O serviço deve retornar:

workspaceId;
repositoryName;
repositoryPath;
currentBranch;
isDirty;
modifiedFiles;
stagedFiles;
recentCommits;
remoteRepository.

Não incluir automaticamente:

conteúdo de arquivos;
credenciais;
variáveis de ambiente;
tokens;
chaves privadas.

O serviço deve ser independente de OpenAI,
Anthropic e outros provedores.

CRITÉRIOS DE ACEITE

- contexto estruturado;
- dados corretos;
- nenhuma credencial incluída;
- workspace sem Git é tratado;
- testes para o serviço.

LIMITE

Máximo de 500 linhas.
GH-15 — Source Code Reader
Implemente GH-15.

OBJETIVO

Criar uma API controlada para leitura de arquivos
do repositório associado ao workspace.

Esta API poderá ser utilizada futuramente pela IA.

NÃO IMPLEMENTAR IA.

IMPLEMENTAÇÃO

Criar:

listProjectFiles()
readProjectFile(path)

Restringir leitura ao diretório autorizado.

Resolver caminhos canônicos antes de acessar arquivos.

Impedir path traversal.

Impedir acesso externo por symlinks.

Aplicar limite de tamanho de arquivo.

Não permitir leitura automática de:

.env;
arquivos de credenciais;
chaves privadas;
diretórios de secrets.

Permitir ampliar permissões futuramente mediante
autorização explícita do usuário.

CRITÉRIOS DE ACEITE

- arquivo permitido é lido;
- path traversal é bloqueado;
- symlink externo é bloqueado;
- arquivo muito grande é rejeitado;
- dados sensíveis são protegidos;
- renderer não recebe acesso irrestrito ao filesystem.

LIMITE

Máximo de 500 linhas.
GH-16 — GitHub Context Service
Implemente GH-16.

OBJETIVO

Criar serviço que reúne informações do GitHub
relevantes ao workspace.

NÃO IMPLEMENTAR IA.

IMPLEMENTAÇÃO

Criar GitHubContextService.

Retornar:

repository;
currentBranch;
openPullRequests;
recentIssues;
latestWorkflowRuns.

Limitar quantidade de itens retornados.

Não incluir:

tokens;
credenciais;
dados de autenticação.

O serviço deve continuar funcionando quando o
GitHub não estiver conectado, retornando estado
apropriado de indisponibilidade.

CRITÉRIOS DE ACEITE

- contexto estruturado;
- dados corretos;
- resposta limitada;
- erros tratados;
- nenhuma credencial exposta.

LIMITE

Máximo de 500 linhas.
FASE 8 — Validação

Os tickets anteriores constroem as funcionalidades. Estes verificam se elas realmente funcionam.

VAL-GIT-01 — Repositório e isolamento
Execute a validação VAL-GIT-01.

Não implemente novas funcionalidades.

TESTAR

1. Conectar repositório Git válido.

2. Conectar diretório sem Git.

3. Conectar subdiretório de um repositório.

4. Criar dois workspaces com repositórios diferentes.

5. Alternar entre workspaces.

6. Reiniciar o stackly.

7. Remover temporariamente acesso ao diretório
   de um dos repositórios.

VERIFICAR

- identificação correta;
- persistência;
- isolamento;
- tratamento de erros;
- nenhum acesso indevido ao filesystem.

RESULTADO

PASS
PASS COM RESSALVAS
FAIL

Registrar evidências e problemas encontrados.
VAL-GIT-02 — Operações Git
Execute VAL-GIT-02.

Criar repositório descartável para testes.

Não utilizar repositórios reais do usuário para
executar operações potencialmente destrutivas.

TESTAR

- detectar branch;
- modificar arquivo;
- criar arquivo;
- stage;
- unstage;
- commit;
- criar branch;
- trocar branch;
- visualizar histórico;
- visualizar diff.

Verificar integridade dos arquivos após cada operação.

Não implementar correções neste ticket.

Registrar resultados e bugs.
VAL-GH-01 — Autenticação e segurança
Execute VAL-GH-01.

OBJETIVO

Validar integração e autenticação GitHub.

TESTAR

- login;
- cancelamento;
- login inválido;
- autenticação expirada;
- reinício da aplicação;
- logout;
- ausência de conexão.

VERIFICAR

- token não aparece nos logs;
- token não aparece no renderer;
- token não aparece no SQLite em texto puro;
- token não é disponibilizado a páginas remotas;
- permissões solicitadas são justificadas;
- desconectar remove credenciais persistidas.

Classificar vulnerabilidades significativas como HIGH
ou BLOCKER.

Não implementar correções automaticamente.
VAL-GH-02 — Repositório remoto
Execute VAL-GH-02.

OBJETIVO

Validar integração entre Git local e GitHub.

Utilizar repositório de teste autorizado.

TESTAR

- identificar remote;
- consultar metadata;
- fetch;
- pull;
- push;
- ausência de upstream;
- remote inacessível;
- erro de autenticação;
- push rejeitado.

VERIFICAR

Nenhuma operação destrutiva deve ser executada
automaticamente.

Nenhum push deve acontecer sem intenção explícita.

Registrar problemas e evidências.
VAL-GH-03 — Pull Requests, Issues e Actions
Execute VAL-GH-03.

OBJETIVO

Validar funcionalidades GitHub.

TESTAR

- listagem de PRs;
- detalhes de PR;
- criação de PR em repositório de teste;
- listagem de issues;
- listagem de workflows;
- workflows concluídos;
- workflows em execução;
- repositório sem PRs;
- repositório sem Actions;
- ausência de permissões.

VERIFICAR

- dados corretos;
- paginação;
- estados;
- erros;
- links externos.

Não implementar correções automaticamente.
VAL-GH-04 — Preparação para IA
Execute VAL-GH-04.

OBJETIVO

Validar os serviços de contexto que serão utilizados
pela futura IA do stackly.

TESTAR

GitContextService

GitHubContextService

SourceCodeReader

VERIFICAR

- contexto corresponde ao workspace ativo;
- branches corretas;
- arquivos modificados corretos;
- PRs corretos;
- nenhuma credencial exposta;
- dados sensíveis não são retornados automaticamente;
- path traversal bloqueado;
- symlink externo bloqueado;
- limites de tamanho respeitados.

Não implementar IA neste ticket.

Registrar problemas encontrados.
Resultado esperado após todos os tickets

Ao concluir essa etapa, o stackly terá:

Funcionalidade	Resultado
Repositório local	Conectar ao workspace
Git status	Visualizar alterações
Branches	Criar e alternar
Diff	Comparar alterações
Stage/Unstage	Preparar commits
Commits	Criar e consultar histórico
GitHub Login	Conectar conta do usuário
GitHub Repository	Consultar repositório remoto
Fetch/Pull/Push	Sincronizar alterações
Pull Requests	Listar, consultar e criar
Issues	Consultar issues
GitHub Actions	Acompanhar workflows
Git Context	Disponibilizar contexto estruturado
Source Code Reader	Ler código com permissões controladas
GitHub Context	Disponibilizar contexto remoto estruturado
Como isso prepara o stackly AI

Posteriormente, quando implementarmos a IA, ela poderá responder perguntas como:

"Por que meu checkout está quebrando?"

O agente poderá combinar as informações do navegador com o contexto do repositório:

stackly AI
    │
    ├── Browser
    │   ├── Página atual
    │   ├── Console
    │   └── Network
    │
    ├── Workspace
    │   ├── Projeto atual
    │   └── Ambiente atual
    │
    ├── Git
    │   ├── Branch atual
    │   ├── Arquivos modificados
    │   ├── Diff
    │   └── Commits recentes
    │
    └── GitHub
        ├── Pull Requests
        ├── Issues
        └── GitHub Actions