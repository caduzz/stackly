SYNTRA — Ticket: Navegação horizontal de abas com efeito Slide
Objetivo

Corrigir o comportamento atual da Tab Bar do Syntra, substituindo a movimentação visual das abas por drag and drop por uma navegação horizontal fluida, com efeito de deslizamento (slide).

Atualmente, ao arrastar a Tab Bar, a aba pode se deslocar visualmente como se estivesse sendo reorganizada ou arrastada para outra posição.

O comportamento desejado é diferente: as abas devem permanecer fixas em suas posições relativas dentro da barra, enquanto o conteúdo da Tab Bar desliza horizontalmente, permitindo navegar entre as abas abertas.

A experiência deve ser semelhante ao movimento horizontal de uma lista com rolagem por gesto, mantendo a estética minimalista do Syntra.

PROMPT PARA A IA DE DESENVOLVIMENTO
TICKET: TAB-UX-01
NOME: Horizontal Sliding Tab Bar
PROJETO: Syntra Browser

CONTEXTO

O Syntra é um navegador desktop para desenvolvedores,
construído com Electron, Chromium, React e TypeScript.

O navegador possui uma Tab Bar responsável por exibir
e gerenciar as abas abertas.

Atualmente, ao arrastar a Tab Bar horizontalmente,
a aba pode se mover visualmente como um elemento
de drag and drop.

Esse comportamento não corresponde à experiência
desejada.

O objetivo é implementar uma navegação horizontal
com efeito de slide, semelhante à rolagem de uma
lista horizontal.

A Tab Bar deve permanecer fixa em sua posição
na interface.

O conteúdo interno da Tab Bar deve deslizar
horizontalmente quando o usuário arrastar a região
das abas.

A ordem das abas não deve ser alterada.

--------------------------------------------------

1. COMPORTAMENTO DESEJADO

Quando o usuário clicar e arrastar horizontalmente
sobre uma região válida da Tab Bar:

- A lista de abas deve deslizar horizontalmente.
- O movimento deve acompanhar o deslocamento do cursor.
- As abas devem manter suas posições relativas.
- Nenhuma aba deve ser destacada visualmente da lista.
- Nenhuma aba deve receber efeito de drag and drop.
- Nenhuma aba deve ser reorganizada.
- Nenhuma aba deve ser removida da barra.
- O container externo da Tab Bar deve permanecer fixo.

O deslocamento deve acontecer exclusivamente
dentro da região horizontal de navegação das abas.

IMPORTANTE:

Arrastar a Tab Bar não deve alterar a aba ativa.

A troca de aba deve continuar acontecendo através
de um clique normal em uma aba.

--------------------------------------------------

2. DIFERENÇA ENTRE CLICK E DRAG

Implementar uma distinção clara entre clique
e arraste horizontal.

CLICK:

Quando o usuário pressionar e soltar o botão
principal do mouse sem ultrapassar o limite
de movimentação:

- A aba clicada deve ser ativada normalmente.
- O comportamento atual de seleção deve
  ser preservado.

DRAG:

Quando o usuário pressionar o botão principal
e movimentar o cursor horizontalmente além
de um limite mínimo:

- Iniciar a navegação horizontal da Tab Bar.
- Não ativar automaticamente outra aba.
- Não executar eventos de reorganização.
- Não mover a aba individualmente.

Utilizar um threshold de aproximadamente 5px
para diferenciar clique de arraste.

Após um arraste reconhecido, impedir que o evento
de click resultante ative uma aba acidentalmente.

--------------------------------------------------

3. COMPORTAMENTO VISUAL

A Tab Bar deve continuar ocupando sua posição
original na interface.

Exemplo:

ANTES:

┌──────────────────────────────────────────┐
│ Tab 1 │ Tab 2 │ Tab 3 │ Tab 4 │ Tab 5   │
└──────────────────────────────────────────┘

USUÁRIO ARRASTA PARA A ESQUERDA:

┌──────────────────────────────────────────┐
│ Tab 3 │ Tab 4 │ Tab 5 │ Tab 6 │ Tab 7   │
└──────────────────────────────────────────┘

O container permanece imóvel.

Somente o conteúdo visível muda conforme
o deslocamento horizontal.

As abas devem permanecer lado a lado,
sem alterar a ordem original.

Não aplicar transformações individuais
em cada aba.

--------------------------------------------------

4. IMPLEMENTAÇÃO TÉCNICA

Antes de programar, inspecione o componente
existente responsável pela Tab Bar.

Identifique:

- como as abas são renderizadas;
- como a seleção funciona;
- se existe drag and drop implementado;
- se existe suporte a reordenação;
- como o overflow horizontal é tratado;
- se a Tab Bar já utiliza scrollLeft.

Priorize utilizar scroll horizontal nativo
em vez de movimentar os elementos individualmente
com transform: translateX().

Estrutura conceitual:

TabBar
  └── TabScrollContainer
        ├── Tab 1
        ├── Tab 2
        ├── Tab 3
        └── Tab N

O container externo deve permanecer fixo.

O container interno deve permitir:

overflow-x: auto;
overflow-y: hidden;

Durante o arraste, atualizar scrollLeft
de acordo com o deslocamento horizontal
do cursor.

Fórmula conceitual:

scrollLeft = initialScrollLeft
             - (currentPointerX - initialPointerX)

Não aplicar essa lógica diretamente a cada aba.

Utilizar Pointer Events quando adequado,
preservando as interações normais da interface.

--------------------------------------------------

5. FLUIDEZ DO MOVIMENTO

O movimento deve acompanhar o cursor
de maneira direta e responsiva.

Durante o arraste:

- evitar animações CSS de transform;
- evitar transições artificiais no scrollLeft;
- evitar atualizações desnecessárias do estado React;
- manter a movimentação fluida.

Utilizar refs para armazenar os dados temporários
do gesto quando apropriado.

Não atualizar uma store global em cada movimento
do cursor se isso não for necessário.

Ao soltar o mouse:

- encerrar o gesto;
- preservar a posição horizontal alcançada;
- não retornar automaticamente ao início;
- não reorganizar as abas.

Não implementar efeito de inércia ou snap
obrigatório nesta etapa.

--------------------------------------------------

6. LIMITES DA ROLAGEM

O usuário deve conseguir deslizar até a
primeira e a última aba.

Ao atingir o início ou o final:

- interromper naturalmente o deslocamento;
- não permitir espaços vazios artificiais;
- não deslocar o container externo;
- não aplicar efeitos de arraste individual.

Quando todas as abas couberem na região visível,
o gesto não deve produzir deslocamento.

--------------------------------------------------

7. ELEMENTOS INTERATIVOS

Preservar o funcionamento dos controles existentes:

- selecionar aba;
- fechar aba;
- criar nova aba;
- clicar em botões;
- acessar menus contextuais;
- utilizar atalhos de teclado.

Arrastar sobre o botão de fechar uma aba
não deve fechar a aba acidentalmente.

O botão de nova aba não deve ser interpretado
como parte do gesto de arraste.

Se existirem controles fixos nas extremidades
da Tab Bar, eles devem permanecer fixos e fora
da região de rolagem.

--------------------------------------------------

8. PRESERVAR O COMPORTAMENTO DO ELECTRON

O Syntra utiliza Electron.

Verifique se a Tab Bar está localizada em uma
região configurada como draggable para
movimentação da janela.

Se existir:

-webkit-app-region: drag;

a região interativa das abas deverá utilizar:

-webkit-app-region: no-drag;

Não permitir que o gesto de navegação horizontal
mova a janela do aplicativo.

Preservar o comportamento de arrastar a janela
pelas regiões especificamente destinadas
a essa finalidade.

--------------------------------------------------

9. VISUAL E DESIGN SYSTEM

Preservar integralmente o tema atual do Syntra.

Cores:

Background principal: #1D2533
Background secundário: #252B3B
Painéis: #343447
Texto principal: #EEE8F4
Texto discreto: #ABA5BD
Accent: #C58FA9
Seleção: #79586F
Bordas: #57536D

Não modificar desnecessariamente:

- tamanho das abas;
- espaçamento;
- tipografia;
- cores;
- bordas;
- indicadores da aba ativa.

O efeito de slide deve parecer uma interação
nativa e discreta.

Durante o arraste, utilizar cursor adequado,
como grabbing, caso não prejudique os controles
internos das abas.

--------------------------------------------------

10. CRITÉRIOS DE ACEITE

[ ] A Tab Bar permanece fixa na interface.

[ ] Arrastar horizontalmente desliza a lista de abas.

[ ] Nenhuma aba se move individualmente.

[ ] A ordem das abas permanece inalterada.

[ ] Arrastar não ativa outra aba.

[ ] Clicar normalmente continua selecionando abas.

[ ] Soltar após um arraste não dispara seleção.

[ ] O movimento acompanha o cursor sem saltos.

[ ] A posição horizontal permanece após o arraste.

[ ] Os limites de rolagem funcionam corretamente.

[ ] O botão de fechar aba continua funcionando.

[ ] O botão de nova aba continua funcionando.

[ ] A janela Electron não se move durante o gesto.

[ ] O comportamento funciona com poucas e muitas abas.

[ ] A interface visual do Syntra é preservada.

--------------------------------------------------

11. TESTES OBRIGATÓRIOS

CENÁRIO 1 — POUCAS ABAS

Abrir 3 abas.

Tentar arrastar horizontalmente.

Resultado esperado:

Se todas couberem na Tab Bar, nenhuma
movimentação desnecessária deve acontecer.

CENÁRIO 2 — MUITAS ABAS

Abrir 15 abas.

Arrastar a Tab Bar para a esquerda.

Resultado esperado:

As abas seguintes aparecem através de
deslizamento horizontal.

A ordem permanece inalterada.

CENÁRIO 3 — SELEÇÃO

Selecionar uma aba.

Arrastar a Tab Bar.

Resultado esperado:

A aba ativa permanece a mesma.

CENÁRIO 4 — CLICK

Clicar normalmente em outra aba.

Resultado esperado:

A aba clicada é ativada.

CENÁRIO 5 — FECHAMENTO

Arrastar a Tab Bar e depois fechar uma aba.

Resultado esperado:

O fechamento funciona sem interferência
do mecanismo de slide.

CENÁRIO 6 — ELECTRON

Arrastar horizontalmente sobre a região
interativa da Tab Bar.

Resultado esperado:

Somente a lista de abas desliza.

A janela do Syntra permanece imóvel.

--------------------------------------------------

12. REGRAS DE DESENVOLVIMENTO

Antes de implementar:

1. Inspecione a Tab Bar existente.

2. Identifique a origem do comportamento
   atual de drag and drop.

3. Explique quais componentes precisam
   ser modificados.

4. Informe a estratégia de implementação.

5. Estime a quantidade de linhas alteradas.

Durante a implementação:

- Reutilize a arquitetura existente.
- Não recrie todo o sistema de abas.
- Não altere o TabManager desnecessariamente.
- Não modifique a lógica de navegação Chromium.
- Não implemente funcionalidades adicionais.
- Preserve o design system.

LIMITE:

Máximo de aproximadamente 500 linhas
novas ou substancialmente modificadas
de código manual.

Se ultrapassar o limite, divida o trabalho
em subtickets.

Após implementar:

- Execute os testes disponíveis.
- Informe os arquivos alterados.
- Explique o comportamento implementado.
- Apresente os resultados dos testes.
- Liste possíveis regressões.

Não avance automaticamente para outro ticket.

PARE APÓS CONCLUIR ESTA IMPLEMENTAÇÃO.
Resultado esperado

O usuário poderá posicionar o cursor sobre a região das abas, segurar o botão esquerdo e movimentar o mouse horizontalmente.

A barra do Syntra continuará imóvel, enquanto as abas deslizarão dentro dela, sem serem reorganizadas ou trocadas automaticamente.

hoje 5:32
eu quero ticktes para resolver esse bugs: stackly bugs:



Workspace: 

	- abas sendo apagado ao mudar de workspace ou seja não tem contexto próprio;

	- ao mudar de workspace com um device aberto o webview acaba bugando na tela

	- as vezes alguns contextos de navegação como a conta muda de um workspace para o outro passando acesso



Dev panel:

	- quando trocamos para o webview alguns serviços do dev panel pararam de funcionar

		- network: nada funciona não exibe nenhuma informação

		- console: também parou de funcionar não exibe nenhuma informação

		- storage: além de não exibir nada ele da um erro: Storage inspector is available for Devices Canvas targets only. 
STACKLY — Tickets de correção de bugs
Workspaces, isolamento de sessões, Devices Canvas e Dev Panel

Com base nos problemas que você identificou, vamos organizar uma etapa específica de estabilização do Stackly, antes de continuar desenvolvendo novas funcionalidades.

Os bugs relatados indicam possíveis problemas em três áreas da arquitetura:

Gerenciamento de workspaces: as abas não estão sendo preservadas individualmente e existem possíveis falhas no isolamento das sessões.
Gerenciamento de WebContentsView: a troca de workspace com um dispositivo aberto pode deixar views antigas visíveis ou causar problemas de posicionamento.
Integração do Dev Panel: Network, Console e Storage deixaram de funcionar corretamente após as alterações na arquitetura de renderização.

Essas são hipóteses técnicas que a IA deverá investigar no código. Não devemos presumir a causa exata antes de analisar a implementação existente.

Vamos separar as correções em 12 tickets de desenvolvimento e 4 tickets de validação, mantendo o limite de aproximadamente 500 linhas de código por etapa.

1. Ordem de desenvolvimento

A ordem é importante porque o Dev Panel depende de identificar corretamente qual instância Chromium está ativa.

Ticket	Funcionalidade	Objetivo
BUG-01	Diagnóstico arquitetural	Identificar a origem dos problemas
BUG-02	Workspace Tab Context	Preservar as abas individualmente
BUG-03	Workspace Session Isolation	Impedir compartilhamento indevido de sessões
BUG-04	Workspace Navigation Context	Preservar corretamente a navegação
BUG-05	Devices Canvas Lifecycle	Corrigir views durante a troca de workspace
BUG-06	WebContentsView Bounds	Corrigir posicionamento e renderização
BUG-07	Active Target Manager	Identificar corretamente o alvo Chromium ativo
BUG-08	Dev Panel Target Binding	Integrar Dev Panel ao alvo selecionado
BUG-09	Network Inspector	Restaurar captura e exibição de requests
BUG-10	Console Inspector	Restaurar captura e exibição de logs
BUG-11	Storage Inspector	Restaurar inspeção de cookies e armazenamento
BUG-12	Cleanup e regressões	Corrigir recursos e listeners órfãos

Após a implementação, teremos os tickets de validação:

Ticket	Validação
VAL-01	Isolamento e persistência dos workspaces
VAL-02	Devices Canvas e WebContentsView
VAL-03	Network, Console e Storage
VAL-04	Regressão completa
2. Prompt-base para todos os tickets

Envie este contexto à IA antes de cada ticket.

O objetivo é garantir que ela entenda a arquitetura do navegador e não tente corrigir um bug criando outros.

PROMPT BASE — STACKLY BUG FIX
Você é o engenheiro principal responsável pela manutenção
e estabilização do Stackly, um navegador desktop para
desenvolvedores baseado em Electron e Chromium.

O aplicativo possui:

- navegação por abas;
- gerenciamento de workspaces;
- sessões Chromium;
- WebContentsView;
- Devices Canvas;
- Dev Panel;
- Network Inspector;
- Console Inspector;
- Storage Inspector;
- ambientes de desenvolvimento.

Estamos executando uma etapa de correção de bugs.

PROBLEMAS RELATADOS

WORKSPACES

1. Ao trocar de workspace, as abas do workspace
   anterior desaparecem ou são apagadas.

2. Ao mudar de workspace com um dispositivo aberto,
   a WebContentsView apresenta problemas de
   renderização e posicionamento.

3. Algumas sessões de navegação parecem ser
   compartilhadas entre workspaces.

   Exemplo:

   O usuário está autenticado em uma conta no
   Workspace A.

   Ao acessar o mesmo serviço no Workspace B,
   a sessão autenticada pode aparecer indevidamente.

DEV PANEL

Após alterações na implementação das WebContentsView,
algumas ferramentas pararam de funcionar:

Network:
não exibe requests.

Console:
não exibe logs.

Storage:
não exibe informações e apresenta a mensagem:

"Storage inspector is available for Devices Canvas targets only."

OBJETIVO GERAL

Restaurar o funcionamento dessas funcionalidades
sem reescrever desnecessariamente a arquitetura
existente.

REGRAS OBRIGATÓRIAS

1. Inspecione o código real antes de modificar arquivos.

2. Não presuma a causa dos problemas.

3. Identifique os componentes, serviços e stores
   responsáveis por cada comportamento.

4. Preserve funcionalidades que já estão funcionando.

5. Não implemente funcionalidades novas.

6. Não substitua WebContentsView por iframe ou
   pela tag webview como solução rápida.

7. Não compartilhe automaticamente sessões Chromium
   entre workspaces.

8. Não destrua abas de um workspace apenas porque
   o usuário selecionou outro workspace.

9. Não recrie indiscriminadamente todas as views
   durante a troca de workspace.

10. Não exponha APIs privilegiadas do Electron
    às páginas remotas.

11. Não desabilite mecanismos de segurança para
    corrigir problemas de autenticação ou storage.

12. Preserve o design system existente.

13. Cada ticket deve modificar no máximo
    aproximadamente 500 linhas de código manual.

14. Se uma correção ultrapassar esse limite,
    divida a implementação em subtickets menores.

15. Não avance automaticamente para o próximo ticket.

SEGURANÇA

Conteúdo remoto deve manter:

nodeIntegration: false
contextIsolation: true
sandbox: true
webSecurity: true

O renderer não deve possuir acesso direto a:

ipcRenderer
filesystem
child_process
credenciais
APIs privilegiadas

ANTES DE IMPLEMENTAR

Apresente:

1. Estado atual da arquitetura.

2. Componentes relacionados ao bug.

3. Causa identificada ou hipóteses que ainda
   precisam ser verificadas.

4. Plano objetivo de correção.

5. Arquivos que serão modificados.

6. Estimativa de linhas.

7. Possíveis riscos de regressão.

DEPOIS DE IMPLEMENTAR

Apresente:

1. Arquivos modificados.

2. Problema corrigido.

3. Explicação técnica da correção.

4. Testes realmente executados.

5. Critérios de aceite.

6. Problemas que continuam pendentes.

7. Instruções para validação manual.

Não afirme que um bug foi corrigido apenas porque
o código compila.

Não afirme que executou testes que não foram
realmente executados.

Pare após concluir o ticket solicitado.
FASE 1 — Diagnóstico e correção dos Workspaces
BUG-01 — Diagnóstico da arquitetura atual

Prioridade: BLOCKER

Antes de modificar o código, precisamos identificar onde o Stackly está armazenando o contexto dos workspaces, abas, sessões e views.

Prompt
TICKET: BUG-01
NOME: Workspace and WebContents Architecture Audit

OBJETIVO

Investigar a arquitetura atual do Stackly para
identificar a origem dos bugs relacionados a:

- perda de abas;
- compartilhamento de sessões;
- problemas de WebContentsView;
- Dev Panel sem dados.

NÃO IMPLEMENTE CORREÇÕES NESTE TICKET.

INVESTIGAR

1. WORKSPACE MANAGER

Identifique onde os workspaces são armazenados.

Verifique:

- como o workspace ativo é definido;
- como as abas são associadas ao workspace;
- o que acontece quando o workspace é alterado;
- se existe alguma operação de limpeza automática;
- se o estado das abas é global ou individual.

2. TAB MANAGER

Identifique:

- como abas são criadas;
- como são selecionadas;
- como são destruídas;
- como WebContentsView é associada a uma aba.

Verifique se trocar de workspace chama
indevidamente alguma rotina de fechamento ou
destruição das abas.

3. SESSION MANAGER

Identifique:

- como session.fromPartition é utilizado;
- se existem partições específicas por workspace;
- se alguma view utiliza a sessão padrão;
- se partições são compartilhadas acidentalmente.

4. DEVICES CANVAS

Verifique:

- como as views dos dispositivos são criadas;
- como são associadas ao workspace;
- como são removidas da janela;
- como os bounds são atualizados;
- como o canvas reage à troca de workspace.

5. DEV PANEL

Identifique:

- como Network coleta requests;
- como Console coleta logs;
- como Storage identifica a sessão atual;
- como as ferramentas escolhem seu webContents.

Verifique se existe dependência de APIs antigas
que deixaram de ser utilizadas após a migração
para WebContentsView.

ENTREGA

Criar um relatório contendo:

- mapa da arquitetura atual;
- fluxo de troca de workspace;
- fluxo de criação e destruição de views;
- fluxo de identificação do alvo Chromium;
- causas confirmadas;
- hipóteses ainda não verificadas;
- arquivos envolvidos;
- ordem recomendada de correção.

Não modificar funcionalidades.

Não avançar para BUG-02 automaticamente.

Resultado esperado: um diagnóstico técnico baseado no código, para evitar correções superficiais.

BUG-02 — Preservar as abas de cada workspace

Prioridade: BLOCKER

Problema atual

Ao trocar de workspace, as abas estão sendo apagadas.

O comportamento desejado é que cada workspace possua seu próprio conjunto de abas e que a troca entre workspaces não destrua seu estado de navegação.

Comportamento esperado
WORKSPACE A

Tab 1 — localhost:3000
Tab 2 — github.com
Tab 3 — localhost:5173
WORKSPACE B

Tab 1 — localhost:8080
Tab 2 — example.com

Ao selecionar o Workspace B, a Tab Bar deve apresentar somente suas abas.

Ao voltar para o Workspace A, suas três abas devem reaparecer.

As abas do Workspace A não devem ser destruídas simplesmente porque ele ficou inativo.

Prompt
TICKET: BUG-02
NOME: Workspace Tab Context Isolation

OBJETIVO

Corrigir a perda de abas durante a troca de workspace.

PROBLEMA

Atualmente, ao mudar de workspace, as abas
do workspace anterior podem desaparecer ou
ser destruídas.

COMPORTAMENTO ESPERADO

Cada workspace deve possuir seu próprio
contexto de abas.

O usuário deve conseguir alternar entre
workspaces sem perder:

- abas abertas;
- URL atual;
- título;
- histórico de navegação;
- aba selecionada.

INVESTIGAÇÃO

Localize:

WorkspaceManager
TabManager
TabStore
WorkspaceStore

ou os componentes equivalentes existentes.

Verifique se o estado das abas está sendo
substituído globalmente durante a troca.

Verifique se alguma rotina de cleanup
está destruindo abas de um workspace inativo.

IMPLEMENTAÇÃO

Garantir associação explícita entre:

workspaceId
tabId

O contexto de abas deve pertencer ao workspace.

Ao trocar de workspace:

1. Preservar as abas do workspace anterior.

2. Ocultar ou desanexar suas views da janela,
   conforme a arquitetura existente.

3. Carregar o estado das abas do novo workspace.

4. Restaurar sua aba anteriormente selecionada.

5. Exibir somente as abas do workspace ativo.

NÃO executar closeTab ou destroyWebContents
apenas porque o workspace foi alterado.

IMPORTANTE

Não duplicar desnecessariamente o estado das
abas entre diferentes stores.

Preserve uma fonte de verdade clara para
a relação workspace → tabs.

CRITÉRIOS DE ACEITE

[ ] Workspace A mantém suas abas.

[ ] Workspace B mantém suas abas.

[ ] Trocar workspace não fecha abas.

[ ] URL atual é preservada.

[ ] Histórico de navegação é preservado.

[ ] Aba ativa de cada workspace é preservada.

[ ] Fechar uma aba afeta somente o workspace
    ao qual ela pertence.

[ ] Fechar explicitamente um workspace executa
    a política de limpeza apropriada.

[ ] O comportamento atual do navegador é mantido.

LIMITE

Máximo de aproximadamente 500 linhas.

Pare após concluir.
BUG-03 — Isolamento de sessões entre workspaces

Prioridade: CRÍTICA — SEGURANÇA

Este bug precisa de atenção especial.

Você relatou que, em determinadas situações, a autenticação de um workspace aparece em outro.

Isso pode indicar compartilhamento involuntário de cookies ou outros dados de sessão.

Não podemos corrigir isso apenas limpando cookies durante a troca de workspace. O correto é garantir isolamento na criação e utilização das sessões Chromium.

Prompt
TICKET: BUG-03
NOME: Workspace Chromium Session Isolation

OBJETIVO

Corrigir o compartilhamento indevido de contextos
de autenticação entre workspaces.

PROBLEMA

Ao acessar um mesmo serviço em workspaces
diferentes, algumas informações de sessão
podem ser compartilhadas indevidamente.

Exemplo:

Workspace A:
usuário autenticado na Conta A.

Workspace B:
deve possuir contexto de autenticação próprio.

O Workspace B não deve herdar automaticamente
cookies ou autenticação do Workspace A.

INVESTIGAÇÃO

Localize todas as chamadas relacionadas a:

session.fromPartition

webPreferences.session

webPreferences.partition

session.defaultSession

Criação de WebContentsView.

Criação de dispositivos virtuais.

Criação de novas abas.

Verifique se todas as views pertencentes ao
mesmo workspace utilizam a sessão correta.

Verifique se alguma view está utilizando
session.defaultSession inadvertidamente.

IMPLEMENTAÇÃO

Estabelecer uma regra consistente:

Cada workspace possui uma partição Chromium
persistente e exclusiva.

Formato conceitual:

persist:workspace:<workspaceId>

A partição deve ser derivada de um ID
estável do workspace.

Não utilizar somente o nome do workspace.

Todas as abas e dispositivos pertencentes
ao workspace devem utilizar sua sessão.

A sessão deve ser atribuída na criação do
webContents correspondente.

Não tentar alterar a sessão de uma view
já criada como substituto para recriá-la
corretamente.

IMPORTANTE

Não limpar automaticamente cookies de
outros workspaces.

Não compartilhar a mesma session entre
workspaces sem autorização explícita.

Não desabilitar webSecurity.

Não expor cookies ou tokens ao renderer.

CRITÉRIOS DE ACEITE

[ ] Cada workspace possui partition exclusiva.

[ ] Todas as tabs do workspace usam a partition correta.

[ ] Todos os devices do workspace usam a partition correta.

[ ] Workspace A não herda autenticação do Workspace B.

[ ] Workspace B não modifica cookies do Workspace A.

[ ] Alterar o workspace não limpa a sessão anterior.

[ ] Reiniciar o navegador mantém as sessões persistentes
    quando essa for a configuração definida.

[ ] Nenhuma view utiliza defaultSession indevidamente.

[ ] APIs privilegiadas não são expostas às páginas remotas.

TESTE OBRIGATÓRIO

Utilizar uma aplicação local de teste com
autenticação baseada em cookies.

Criar dois workspaces.

Autenticar contas diferentes no mesmo domínio.

Verificar que cada workspace mantém sua
própria sessão.

Não utilizar contas reais de usuários durante
os testes automatizados.

LIMITE

Máximo de aproximadamente 500 linhas.

Pare após concluir.

Observação: sessões Chromium isoladas não isolam automaticamente todos os recursos externos. Se um site compartilhar autenticação por um serviço fora do navegador ou por links de login, isso precisa ser investigado separadamente. O teste deve verificar especificamente cookies, armazenamento e sessões efetivamente utilizadas pelas views.

BUG-04 — Preservar contexto de navegação

Prioridade: HIGH

Este ticket trata de um problema diferente do isolamento de cookies.

Mesmo com as sessões separadas, cada workspace também precisa preservar corretamente sua navegação.

Prompt
TICKET: BUG-04
NOME: Workspace Navigation Context

OBJETIVO

Garantir que cada workspace preserve seu
próprio contexto de navegação.

PROBLEMA

Ao alternar entre workspaces, o navegador
não deve reutilizar indevidamente o estado
de navegação do workspace anterior.

IMPLEMENTAÇÃO

Verificar como são armazenados:

activeWorkspaceId
activeTabId
currentUrl
navigationHistory
canGoBack
canGoForward
isLoading

Garantir que eventos provenientes de abas
inativas não sobrescrevam o estado visível
do workspace ativo.

Ao receber evento de navegação:

1. Identificar a aba de origem.

2. Identificar o workspace ao qual pertence.

3. Atualizar o estado daquela aba.

4. Atualizar a interface visível somente
   quando o evento corresponder ao alvo
   atualmente selecionado.

Não utilizar uma variável global de URL
como fonte exclusiva de navegação para
todos os workspaces.

CRITÉRIOS DE ACEITE

[ ] Cada workspace mantém sua URL.

[ ] Cada aba mantém seu histórico.

[ ] Back e Forward utilizam a aba correta.

[ ] Eventos de abas inativas não alteram
    a address bar do workspace ativo.

[ ] Loading de uma aba não altera
    indevidamente outra aba.

[ ] Trocas rápidas de workspace não
    produzem estado inconsistente.

LIMITE

Máximo de aproximadamente 500 linhas.

Pare após concluir.
FASE 2 — Correção do Devices Canvas
BUG-05 — Corrigir o ciclo de vida das views dos dispositivos

Prioridade: BLOCKER

Problema atual

Quando você muda de workspace com um dispositivo aberto, a WebContentsView apresenta problemas na tela.

Isso pode estar relacionado ao ciclo de vida da view durante a troca de workspace, mas precisamos verificar o comportamento real.

Prompt
TICKET: BUG-05
NOME: Devices Canvas Workspace Lifecycle

OBJETIVO

Corrigir problemas visuais e de ciclo de vida
ao trocar de workspace com Devices Canvas ativo.

PROBLEMA

Quando um workspace possui dispositivos
abertos e o usuário troca para outro
workspace, a WebContentsView pode apresentar
problemas de renderização.

INVESTIGAÇÃO

Identifique como Devices Canvas:

- cria WebContentsView;
- associa devices a abas;
- associa devices a workspaces;
- adiciona views à janela;
- remove views da janela;
- atualiza bounds;
- destrói views.

Verifique se views pertencentes ao workspace
anterior permanecem anexadas à janela.

Verifique se eventos de layout antigos
continuam atualizando views após a troca.

IMPLEMENTAÇÃO

Ao mudar de workspace:

1. Identificar todas as views pertencentes
   ao workspace anterior.

2. Desanexar ou ocultar as views que
   não devem permanecer visíveis.

3. Preservar o estado de dispositivos
   do workspace anterior.

4. Identificar os dispositivos pertencentes
   ao novo workspace.

5. Anexar somente as views necessárias
   ao workspace ativo.

6. Atualizar os bounds após o layout
   do novo workspace estar disponível.

7. Garantir que callbacks assíncronos antigos
   não reativem views do workspace anterior.

IMPORTANTE

Trocar workspace não deve destruir
automaticamente os dispositivos anteriores.

Remover explicitamente um dispositivo
deve executar a limpeza apropriada.

CRITÉRIOS DE ACEITE

[ ] Devices Canvas funciona no Workspace A.

[ ] Trocar para Workspace B não deixa views antigas visíveis.

[ ] Voltar ao Workspace A restaura seus dispositivos.

[ ] Dispositivos não aparecem sobre toolbar ou Dev Panel.

[ ] Nenhuma view fica visualmente órfã.

[ ] Não existem callbacks antigos reposicionando
    views de workspaces inativos.

[ ] Abas normais continuam funcionando.

LIMITE

Máximo de aproximadamente 500 linhas.

Pare após concluir.
BUG-06 — Corrigir bounds e posicionamento das WebContentsView

Prioridade: HIGH

Este ticket garante que a interface React e as views Chromium estejam sincronizadas após a troca de workspace.

Prompt
TICKET: BUG-06
NOME: WebContentsView Bounds Synchronization

OBJETIVO

Corrigir erros de posicionamento e renderização
das WebContentsView após alterações de workspace,
aba ou modo de visualização.

INVESTIGAÇÃO

Localize o mecanismo responsável por calcular
e atualizar os bounds das views.

Verifique:

- ResizeObserver;
- eventos de resize;
- mudanças de workspace;
- mudanças de aba;
- mudanças de Device Canvas;
- abertura e fechamento do Dev Panel;
- zoom e pan do canvas.

IMPLEMENTAÇÃO

Garantir que o cálculo dos bounds corresponda
ao layout atualmente visível.

Ao trocar de workspace ou aba:

- invalidar medições antigas;
- obter geometria da região ativa;
- atualizar somente views pertencentes
  ao contexto ativo.

Evitar aplicar bounds de elementos desmontados
ou pertencentes ao workspace anterior.

Se necessário, utilizar identificador de geração
ou mecanismo equivalente para descartar
atualizações assíncronas obsoletas.

Garantir que views inativas não permaneçam
sobre regiões da interface.

CRITÉRIOS DE ACEITE

[ ] Trocar workspace mantém layout correto.

[ ] Trocar aba mantém layout correto.

[ ] Alternar Responsive e Devices Canvas funciona.

[ ] Abrir Dev Panel recalcula bounds.

[ ] Fechar Dev Panel recalcula bounds.

[ ] Redimensionar janela funciona.

[ ] Views inativas não sobrepõem a interface.

[ ] Não existem atualizações obsoletas de bounds.

LIMITE

Máximo de aproximadamente 500 linhas.

Pare após concluir.
FASE 3 — Restaurar o Dev Panel

Antes de corrigir Network, Console e Storage separadamente, precisamos estabelecer uma forma confiável de identificar qual webContents está sendo inspecionado.

O Dev Panel não deve depender de uma view específica de Devices Canvas.

Ele deve conseguir inspecionar tanto uma aba normal quanto um dispositivo virtual.

BUG-07 — Criar ou corrigir o Active Target Manager

Prioridade: BLOCKER

Objetivo

Unificar a identificação do alvo Chromium utilizado pelas ferramentas de desenvolvimento.

Um alvo pode ser:

a aba normal do navegador;
um dispositivo dentro do Devices Canvas.
Prompt
TICKET: BUG-07
NOME: Active Chromium Target Resolution

OBJETIVO

Corrigir a identificação do webContents
utilizado pelas ferramentas de desenvolvimento.

PROBLEMA

Após alterações na arquitetura de WebContentsView,
algumas ferramentas do Dev Panel deixaram de
identificar corretamente a página ativa.

IMPLEMENTAÇÃO

Inspecione como o projeto atualmente identifica
o alvo Chromium ativo.

Se já existir um TargetManager ou mecanismo
equivalente, reutilize-o.

Não crie uma segunda fonte de verdade.

O alvo precisa identificar:

workspaceId
tabId
deviceId opcional
webContentsId
session

Não exponha o objeto Electron webContents
diretamente ao renderer.

CRIAR OU CORRIGIR

resolveActiveTarget()

O serviço deve resolver o alvo correto
considerando:

1. Workspace ativo.

2. Aba ativa.

3. Modo de visualização.

4. Dispositivo selecionado, quando aplicável.

REGRAS

Em modo Responsive:

o alvo é a WebContentsView da aba ativa.

Em Devices Canvas:

o alvo é a WebContentsView do dispositivo
selecionado.

Se nenhum dispositivo estiver selecionado,
utilizar um estado explícito de ausência de alvo
ou a política já definida pelo projeto.

Não utilizar arbitrariamente a primeira view
disponível.

Não utilizar uma view pertencente a outro workspace.

CRITÉRIOS DE ACEITE

[ ] Aba normal possui target válido.

[ ] Device selecionado possui target válido.

[ ] Trocar aba atualiza target.

[ ] Trocar workspace atualiza target.

[ ] Remover device invalida target antigo.

[ ] Fechar aba invalida target antigo.

[ ] Nenhum target pertence ao workspace errado.

[ ] Renderer recebe somente identificadores
    e dados serializáveis.

LIMITE

Máximo de aproximadamente 500 linhas.

Pare após concluir.
BUG-08 — Vincular o Dev Panel ao alvo Chromium ativo

Prioridade: BLOCKER

Problema

Mesmo que o Target Manager esteja correto, o Dev Panel precisa reagir às mudanças de aba, workspace e dispositivo.

Prompt
TICKET: BUG-08
NOME: Dev Panel Target Binding

OBJETIVO

Garantir que todas as ferramentas do Dev Panel
utilizem o alvo Chromium correto.

IMPLEMENTAÇÃO

Inspecione como Network, Console e Storage
recebem ou descobrem o webContents atual.

Identifique dependências antigas de:

activeTabId
currentWebContents
deviceId
selectedDevice

Corrija a integração para que todas
as ferramentas utilizem o mecanismo
de resolução de alvo validado no BUG-07.

Ao trocar de target:

1. Identificar o alvo anterior.

2. Desvincular subscriptions específicas
   que não devem continuar associadas a ele.

3. Vincular o novo alvo.

4. Atualizar a interface do Dev Panel.

5. Impedir que eventos atrasados do alvo anterior
   contaminem o painel atual.

Não apagar automaticamente históricos de
outros targets se o projeto possui opção
de Preserve Log.

CRITÉRIOS DE ACEITE

[ ] Dev Panel identifica aba normal.

[ ] Dev Panel identifica device selecionado.

[ ] Trocar workspace atualiza target.

[ ] Trocar aba atualiza target.

[ ] Trocar device atualiza target.

[ ] Eventos de targets anteriores não aparecem
    incorretamente no painel atual.

[ ] Não existem subscriptions duplicadas.

LIMITE

Máximo de aproximadamente 500 linhas.

Pare após concluir.
BUG-09 — Restaurar Network Inspector

Prioridade: BLOCKER

Problema atual

O Network Inspector não apresenta informações após a migração para WebContentsView.

Prompt
TICKET: BUG-09
NOME: Network Inspector WebContentsView Integration

OBJETIVO

Restaurar a captura e exibição de requests
no Network Inspector do Stackly.

PROBLEMA

Após alterações na renderização Chromium,
o painel Network deixou de apresentar requests.

INVESTIGAÇÃO

Identifique o serviço atual de captura de rede.

Verifique se utiliza:

webContents.debugger

Chrome DevTools Protocol

Network.enable

Network.requestWillBeSent

Network.responseReceived

Network.loadingFinished

Network.loadingFailed

Verifique qual webContents recebe o
debugger atualmente.

Verifique se o collector ainda está associado
a uma instância antiga de navegação.

IMPLEMENTAÇÃO

Utilizar o Active Target Manager ou serviço
equivalente para identificar o webContents correto.

Garantir que o Network Collector consiga
capturar requests da aba normal e do
dispositivo selecionado.

Preservar o comportamento existente de:

- filtros;
- seleção;
- status;
- duração;
- headers;
- detalhes da request;
- Preserve Log, quando disponível.

Não reimplementar desnecessariamente
a interface Network.

LIFECYCLE

Garantir que listeners sejam registrados
apenas quando apropriado.

Não criar attachments duplicados do debugger.

Tratar detach e destruição do target.

Ao trocar de target, a interface deve
apresentar os dados associados ao novo alvo.

CRITÉRIOS DE ACEITE

[ ] Network funciona em aba normal.

[ ] Network funciona em Devices Canvas.

[ ] Requests aparecem em tempo real.

[ ] Status HTTP aparece corretamente.

[ ] Filtros existentes funcionam.

[ ] Selecionar request mostra detalhes.

[ ] Trocar aba atualiza Network.

[ ] Trocar workspace atualiza Network.

[ ] Requests não se misturam entre targets.

[ ] Reload continua capturando requests.

LIMITE

Máximo de aproximadamente 500 linhas.

Pare após concluir.
BUG-10 — Restaurar Console Inspector

Prioridade: BLOCKER

Problema atual

O Console não apresenta logs após as mudanças de WebContentsView.

Prompt
TICKET: BUG-10
NOME: Console Inspector WebContentsView Integration

OBJETIVO

Restaurar o funcionamento do Console
para abas normais e Devices Canvas.

INVESTIGAÇÃO

Identifique como o Console coleta mensagens.

Verifique utilização de:

Chrome DevTools Protocol Runtime

Runtime.enable

Runtime.consoleAPICalled

Runtime.exceptionThrown

ou mecanismos equivalentes existentes.

Verifique se os eventos estão sendo
capturados do webContents correto.

IMPLEMENTAÇÃO

Vincular Console Collector ao alvo Chromium
resolvido pelo Active Target Manager.

Garantir que logs sejam associados
explicitamente ao target de origem.

Preservar:

- níveis de log;
- timestamps;
- filtros;
- pesquisa;
- Clear;
- Preserve Log, quando disponível.

Não recriar a interface Console
desnecessariamente.

TESTE FUNCIONAL

Executar em uma página local de teste:

console.log("test-log")

console.warn("test-warning")

console.error("test-error")

throw new Error("test-exception")

Verificar se cada evento aparece
no painel correspondente.

CRITÉRIOS DE ACEITE

[ ] console.log aparece.

[ ] console.warn aparece.

[ ] console.error aparece.

[ ] Exceptions aparecem.

[ ] Console funciona em aba normal.

[ ] Console funciona em device selecionado.

[ ] Trocar aba atualiza Console.

[ ] Trocar workspace atualiza Console.

[ ] Logs não se misturam entre targets.

[ ] Não existem listeners duplicados.

LIMITE

Máximo de aproximadamente 500 linhas.

Pare após concluir.
BUG-11 — Restaurar Storage Inspector

Prioridade: BLOCKER

Problema atual

O Storage Inspector apresenta:

Storage inspector is available for Devices Canvas targets only.

Isso indica que a implementação atual está restringindo a inspeção de Storage aos dispositivos virtuais.

O comportamento desejado é permitir inspecionar armazenamento tanto de abas normais quanto de dispositivos do canvas.

Prompt
TICKET: BUG-11
NOME: Storage Inspector Target Compatibility

OBJETIVO

Restaurar o Storage Inspector para todas
as páginas Chromium suportadas pelo Stackly.

PROBLEMA

Atualmente o painel apresenta:

"Storage inspector is available for Devices Canvas targets only."

Essa restrição não corresponde ao
comportamento desejado.

O Storage Inspector deve funcionar em:

- abas normais;
- dispositivos do Devices Canvas.

INVESTIGAÇÃO

Localize a origem exata da mensagem de erro.

Identifique a condição responsável por restringir
a inspeção aos devices.

Verifique como o painel obtém:

webContents
session
origin
cookies
localStorage

Determine se o código atual depende de
deviceId para localizar o target.

IMPLEMENTAÇÃO

Utilizar o mecanismo de resolução de alvo
validado no BUG-07.

O Storage Inspector deve identificar:

1. webContents correto.

2. sessão Chromium correta.

3. origem atual da página.

4. tipo de armazenamento solicitado.

COOKIES

Consultar cookies da sessão associada
ao target correto.

Não utilizar session.defaultSession
indiscriminadamente.

Garantir que o Workspace A não consiga
inspecionar ou modificar acidentalmente
cookies do Workspace B.

LOCALSTORAGE

Utilizar uma abordagem apropriada para
consultar o armazenamento da origem atual.

Não executar JavaScript arbitrário recebido
do renderer.

Não desabilitar webSecurity.

Não remover a validação de origem.

IMPORTANTE

Não corrigir o problema simplesmente removendo
a mensagem de erro.

A funcionalidade precisa realmente operar
sobre o webContents correto.

CRITÉRIOS DE ACEITE

[ ] Storage funciona em aba normal.

[ ] Storage funciona em Devices Canvas.

[ ] Cookies aparecem corretamente.

[ ] localStorage funciona, se já implementado.

[ ] Trocar aba atualiza Storage.

[ ] Trocar workspace atualiza Storage.

[ ] Trocar device atualiza Storage.

[ ] Sessões de workspaces permanecem isoladas.

[ ] A mensagem de erro antiga não aparece
    indevidamente em abas normais.

[ ] Nenhuma API privilegiada é exposta
    à página remota.

LIMITE

Máximo de aproximadamente 500 linhas.

Pare após concluir.
FASE 4 — Limpeza e prevenção de regressões
BUG-12 — Cleanup de views, collectors e listeners

Prioridade: HIGH

Depois de corrigir o gerenciamento de contextos, precisamos garantir que as operações de troca de workspace não deixem recursos antigos ativos.

Prompt
TICKET: BUG-12
NOME: Chromium Target Lifecycle Cleanup

OBJETIVO

Revisar e corrigir o ciclo de vida dos recursos
associados às abas e dispositivos Chromium.

INVESTIGAÇÃO

Inspecionar:

TabManager
WorkspaceManager
DeviceViewManager
NetworkCollector
ConsoleCollector
StorageInspector
ActiveTargetManager

ou os componentes equivalentes existentes.

VERIFICAR

- WebContentsView destruídas;
- webContents órfãos;
- listeners duplicados;
- subscriptions antigas;
- debugger attachments;
- referências a targets inexistentes;
- eventos de workspaces inativos;
- callbacks assíncronos obsoletos.

IMPLEMENTAÇÃO

Garantir que:

Trocar workspace:
preserva recursos que devem continuar vivos,
mas deixa de exibi-los ou inspecioná-los
quando inativos.

Fechar aba:
executa cleanup dos recursos pertencentes
àquela aba.

Remover device:
executa cleanup da view correspondente.

Fechar workspace:
executa a política de descarte definida
para seus recursos.

Fechar aplicação:
libera os recursos gerenciados.

IMPORTANTE

Não destruir todos os webContents durante
qualquer mudança de estado.

Diferenciar claramente:

hide
detach
dispose
destroy

Não criar gerenciamento duplicado de lifecycle.

CRITÉRIOS DE ACEITE

[ ] Trocar workspace não destrói abas.

[ ] Fechar aba destrói seus recursos.

[ ] Remover device destrói seus recursos.

[ ] Listeners são removidos corretamente.

[ ] Não existem attachments duplicados.

[ ] Eventos de targets destruídos são ignorados.

[ ] Network e Console continuam funcionando
    após várias trocas de workspace.

[ ] Nenhuma view permanece visualmente órfã.

LIMITE

Máximo de aproximadamente 500 linhas.

Pare após concluir.
FASE 5 — Tickets de validação

Esses tickets devem ser executados após as correções.

A IA não deve implementar funcionalidades novas durante a validação.

Ela deve testar, registrar evidências e identificar possíveis regressões.

VAL-01 — Validação de Workspaces
TICKET: VAL-01
NOME: Workspace Isolation and Persistence Validation

OBJETIVO

Validar que cada workspace possui contexto próprio
de abas, navegação e sessão Chromium.

TESTE 1 — ABAS

Criar Workspace A.

Abrir:

localhost:3000
example.com
github.com

Criar Workspace B.

Abrir:

localhost:5173
example.org

Alternar entre os workspaces 20 vezes.

VERIFICAR

- abas preservadas;
- abas não se misturam;
- aba ativa preservada;
- URLs preservadas;
- histórico preservado.

TESTE 2 — SESSÕES

Utilizar aplicação local de teste com
autenticação por cookies.

Autenticar Conta A no Workspace A.

Autenticar Conta B no Workspace B.

Alternar entre ambos.

VERIFICAR

- Conta A permanece no Workspace A;
- Conta B permanece no Workspace B;
- cookies não são compartilhados;
- nenhuma sessão é apagada indevidamente.

TESTE 3 — REINICIALIZAÇÃO

Fechar e reabrir o Stackly.

Verificar que o estado persistido é restaurado
conforme as configurações existentes.

RESULTADO

PASS
PASS COM RESSALVAS
FAIL

Registrar logs e evidências.

Não implementar correções automaticamente.
VAL-02 — Validação do Devices Canvas
TICKET: VAL-02
NOME: Devices Canvas Workspace Switching Validation

OBJETIVO

Validar que dispositivos continuam funcionando
após trocas de workspace.

TESTE

Criar Workspace A.

Abrir Devices Canvas.

Adicionar:

1 celular;
1 tablet.

Abrir Workspace B.

Adicionar:

2 celulares.

Alternar entre os workspaces 20 vezes.

VERIFICAR

- views corretas aparecem;
- views antigas desaparecem;
- dispositivos mantêm posições;
- páginas continuam interativas;
- nenhum dispositivo sobrepõe a toolbar;
- nenhum dispositivo sobrepõe o Dev Panel.

TESTE ADICIONAL

Com Devices Canvas aberto:

- abrir Dev Panel;
- fechar Dev Panel;
- redimensionar janela;
- alternar para Responsive;
- retornar ao Devices Canvas;
- trocar workspace.

Verificar se as views continuam corretamente
posicionadas.

Registrar problemas encontrados.

Não implementar correções automaticamente.
VAL-03 — Validação do Dev Panel
TICKET: VAL-03
NOME: Dev Panel Chromium Integration Validation

OBJETIVO

Confirmar que Network, Console e Storage
funcionam com abas normais e dispositivos.

TESTE 1 — ABA NORMAL

Abrir uma página local de teste.

Gerar:

- request 200;
- request 404;
- request 500;
- console.log;
- console.warn;
- console.error;
- cookie de teste;
- localStorage de teste.

VERIFICAR

Network:
requests aparecem.

Console:
logs aparecem.

Storage:
cookies e localStorage aparecem.

TESTE 2 — DEVICES CANVAS

Abrir a mesma página em dois devices.

Selecionar Device A.

Verificar Network, Console e Storage.

Selecionar Device B.

Repetir verificação.

TESTE 3 — TROCA DE WORKSPACE

Com Dev Panel aberto:

alternar entre Workspace A e Workspace B.

Verificar que as ferramentas exibem dados
do workspace correto.

TESTE 4 — RELOAD

Recarregar páginas normais e dispositivos.

Verificar captura após reload.

CRITÉRIOS

- nenhuma ferramenta apresenta dados de
  target incorreto;

- Network continua capturando requests;

- Console continua capturando logs;

- Storage utiliza sessão correta;

- não existem erros indevidos de
  "Devices Canvas targets only".

RESULTADO

PASS
PASS COM RESSALVAS
FAIL

Registrar problemas e evidências.

Não implementar correções automaticamente.
VAL-04 — Regressão completa
TICKET: VAL-04
NOME: Workspace and DevTools Regression Test

OBJETIVO

Executar validação final de integração.

CENÁRIO

1. Abrir Stackly.

2. Criar Workspace A.

3. Abrir três abas.

4. Abrir Network.

5. Navegar entre páginas.

6. Abrir Console.

7. Gerar logs.

8. Abrir Storage.

9. Criar Workspace B.

10. Abrir duas abas.

11. Abrir Devices Canvas.

12. Adicionar dois dispositivos.

13. Trocar para Workspace A.

14. Voltar para Workspace B.

15. Selecionar um dispositivo.

16. Abrir Network.

17. Abrir Console.

18. Abrir Storage.

19. Alternar para Responsive.

20. Fechar uma aba.

21. Voltar ao Workspace A.

22. Verificar suas abas.

23. Fechar aplicação.

24. Reabrir aplicação.

25. Validar restauração conforme configuração.

VERIFICAR

- nenhuma aba perdida;
- nenhuma sessão compartilhada;
- nenhuma view órfã;
- nenhum Dev Panel quebrado;
- nenhuma navegação incorreta;
- nenhum crash.

RESULTADO FINAL

READY

READY WITH KNOWN ISSUES

NOT READY

Liste todos os problemas identificados.

Não implemente correções automaticamente.
3. Arquitetura esperada após as correções

O resultado que buscamos é uma estrutura na qual cada recurso pertence explicitamente ao workspace correto.

STACKLY
│
├── Workspace Manager
│   │
│   ├── Workspace A
│   │   │
│   │   ├── Chromium Session A
│   │   │
│   │   ├── Tab 1
│   │   │   └── WebContentsView
│   │   │
│   │   ├── Tab 2
│   │   │   └── WebContentsView
│   │   │
│   │   └── Devices Canvas
│   │       ├── Device 1 → WebContentsView
│   │       └── Device 2 → WebContentsView
│   │
│   └── Workspace B
│       │
│       ├── Chromium Session B
│       │
│       ├── Tab 3
│       │   └── WebContentsView
│       │
│       └── Devices Canvas
│           └── Device 3 → WebContentsView
│
└── Active Target Manager
    │
    └── Active Chromium Target
        │
        ├── Network Inspector
        ├── Console Inspector
        └── Storage Inspector

A regra principal é que a troca de workspace modifica o contexto ativo, não destrói o contexto anterior.

O Dev Panel, por sua vez, deve trabalhar sobre o webContents efetivamente selecionado, independentemente de ele pertencer a uma aba normal ou a um dispositivo do canvas.

4. Links técnicos para a implementação

Estas são as principais referências que a IA deve consultar durante as correções.

API	[Documentação](https://www.electronjs.org/docs/latest/api/web-contents-view)	Utilização
Electron WebContentsView	[Documentação](https://www.electronjs.org/docs/latest/api/web-contents)	Gerenciamento das views Chromium
Electron WebContents	[Documentação](https://www.electronjs.org/docs/latest/api/session)	Navegação, eventos e ciclo de vida
Electron Session	[Documentação](https://www.electronjs.org/docs/latest/api/cookies)	Isolamento entre workspaces
Electron Cookies	[Documentação](https://www.electronjs.org/docs/latest/api/debugger)	Gerenciamento de cookies
Electron Debugger	[Documentação](https://www.electronjs.org/docs/latest/api/base-window)	Integração com CDP
Electron BaseWindow	[Documentação](https://www.electronjs.org/docs/latest/api/base-window)	Adição e remoção de views
CDP Network	[Documentação](https://chromedevtools.github.io/devtools-protocol/#/Network)	Captura de requests
CDP Runtime	[Documentação](https://chromedevtools.github.io/devtools-protocol/#/Runtime)	Console e execução JavaScript
CDP Storage	[Documentação](https://chromedevtools.github.io/devtools-protocol/#/Storage)	Inspeção de armazenamento
Electron Security [Documentação](https://www.electronjs.org/docs/latest/tutorial/security)	Segurança das páginas remotas
Por onde começar

Execute primeiro o BUG-01, depois BUG-02, BUG-03 e BUG-04.

Somente depois de estabilizar os workspaces e o isolamento das sessões devemos corrigir o gerenciamento das WebContentsView e restaurar o Dev Panel.

O BUG-03 merece prioridade de segurança: enquanto o compartilhamento indevido de autenticação não estiver resolvido, evite usar contas sensíveis em workspaces que deveriam estar isolados.

Quando chegarmos ao BUG-07, teremos uma base consistente para corrigir Network, Console e Storage sem criar soluções específicas para cada tipo de view.