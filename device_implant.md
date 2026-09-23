FASE 1 — Integração com a barra responsiva

O primeiro objetivo é fazer a funcionalidade aparecer no Syntra sem modificar ainda o comportamento de navegação.

DEVICE-01 — Adicionar Devices Canvas ao seletor Responsive

Objetivo: disponibilizar o novo modo de visualização na barra de redimensionamento existente.

Prompt
Implemente o ticket DEVICE-01 do Syntra.

OBJETIVO

Adicionar uma nova opção chamada "Devices Canvas"
ao seletor Responsive existente.

CONTEXTO

O navegador já possui uma barra de redimensionamento
com um seletor Responsive e a exibição das dimensões
atuais da viewport.

Não recriar essa barra.

Localize o componente existente e adicione uma opção
para ativar o modo Devices Canvas.

COMPORTAMENTO

Ao clicar no seletor, exibir:

Responsive
Devices Canvas

Preservar todos os presets já existentes.

Ao selecionar Devices Canvas:

- atualizar o estado do modo de visualização;
- exibir um placeholder central;
- manter a toolbar funcionando;
- manter as abas funcionando;
- manter o Dev Panel funcionando.

O placeholder deve apresentar:

"Devices Canvas"

"Preview your application across multiple devices."

Botão:

"Add Device"

Neste ticket o botão ainda não precisa adicionar
um dispositivo real.

Ao selecionar Responsive novamente, restaurar
a visualização original.

IMPLEMENTAÇÃO

Reutilizar o gerenciamento de estado existente.

Se já existir uma store para viewport ou responsive
mode, estendê-la.

Evitar criar uma segunda fonte de verdade para
o modo de visualização.

CRITÉRIOS DE ACEITE

1. Devices Canvas aparece no seletor existente.

2. Responsive continua funcionando.

3. Alternar entre modos não causa crash.

4. Abas existentes continuam funcionando.

5. Dev Panel permanece acessível.

6. Nenhuma funcionalidade existente é removida.

7. A implementação não ultrapassa 500 linhas.

Pare após concluir.

Resultado esperado: você já poderá selecionar Devices Canvas na barra e entrar na nova área de trabalho, mesmo que ela ainda esteja vazia.

DEVICE-02 — Criar a estrutura visual do Canvas

Objetivo: transformar o placeholder em uma área de trabalho funcional.

Prompt
Implemente DEVICE-02.

OBJETIVO

Criar a estrutura visual da área Devices Canvas.

A funcionalidade deve ocupar somente a região
destinada à renderização da página web.

Não substituir a toolbar, tabs ou Dev Panel.

IMPLEMENTAÇÃO

Criar um componente DevicesCanvas.

A estrutura deve conter:

1. CanvasToolbar.
2. CanvasViewport.
3. EmptyState.

CanvasToolbar:

- nome "Devices Canvas";
- botão Add Device;
- indicação visual do zoom;
- botão para retornar ao modo Responsive.

CanvasViewport:

- ocupa toda a área disponível;
- background #1D2533;
- overflow controlado;
- posição relativa;
- preparado para dispositivos com posição absoluta.

EmptyState:

- ícone discreto;
- texto informativo;
- botão Add Device.

O componente deve utilizar o design system
existente.

Não implementar dispositivos neste ticket.

CRITÉRIOS DE ACEITE

- canvas aparece;
- não sobrepõe a toolbar;
- não sobrepõe o Dev Panel;
- redimensionar janela ajusta canvas;
- EmptyState aparece corretamente;
- visual segue o tema do Syntra.

Máximo de 500 linhas.

Pare após concluir.
FASE 2 — Sistema de dispositivos

Nesta fase criaremos o modelo de dados e os componentes visuais dos dispositivos.

DEVICE-03 — Modelo de dados dos dispositivos

Objetivo: criar a estrutura que representará cada dispositivo dentro do canvas.

Prompt
Implemente DEVICE-03.

OBJETIVO

Criar o modelo de dados e gerenciamento de estado
para os dispositivos virtuais.

MODELO SUGERIDO

VirtualDevice:

id
name
type
viewportWidth
viewportHeight
x
y
orientation
url
environmentId
isSelected

TIPOS

mobile
tablet
custom

ORIENTATION

portrait
landscape

IMPLEMENTAÇÃO

Criar uma store ou estender a store existente.

Operações:

addDevice
removeDevice
selectDevice
updateDevice
updatePosition
clearDevices

Não criar WebContentsView neste ticket.

Não implementar drag and drop.

DADOS

Cada dispositivo deve possuir ID único.

Posições devem ser armazenadas em coordenadas
do mundo do canvas, e não em coordenadas do zoom
da interface.

CRITÉRIOS DE ACEITE

- adicionar dispositivo ao estado;
- remover dispositivo;
- selecionar dispositivo;
- atualizar posição;
- IDs são únicos;
- TypeScript strict funciona.

Máximo de 500 linhas.

Pare após concluir.
DEVICE-04 — Presets de celulares e tablets

Objetivo: criar um catálogo inicial de dispositivos.

Prompt
Implemente DEVICE-04.

OBJETIVO

Criar o catálogo de presets utilizados pelo
Devices Canvas.

CATEGORIAS

Mobile
Tablet
Custom

PRESETS INICIAIS

iPhone
iPhone Pro
Galaxy
iPad Mini
iPad Pro

IMPORTANTE

Não inventar especificações técnicas.

Consultar fontes oficiais ou dados verificáveis
antes de associar dimensões reais a modelos
comerciais específicos.

Se não houver informação confiável, utilizar
nomes genéricos:

Small Phone
Large Phone
Small Tablet
Large Tablet

Cada preset deve conter:

id
name
type
viewportWidth
viewportHeight
deviceScaleFactor
userAgent opcional

Neste ticket, deviceScaleFactor e userAgent podem
ser apenas metadados, sem aplicação real.

IMPLEMENTAÇÃO

Criar catálogo tipado.

Criar função para instanciar um dispositivo
a partir de um preset.

Não implementar emulação Chromium ainda.

CRITÉRIOS DE ACEITE

- catálogo disponível;
- presets possuem dimensões válidas;
- dispositivos personalizados são permitidos;
- nenhum preset possui dimensões negativas;
- nomes correspondem às configurações cadastradas.

Máximo de 500 linhas.

Pare após concluir.
DEVICE-05 — Adicionar e remover dispositivos

Objetivo: permitir que o usuário adicione diversos dispositivos à área de trabalho.

Prompt
Implemente DEVICE-05.

OBJETIVO

Conectar o botão Add Device à store de dispositivos.

IMPLEMENTAÇÃO

Ao clicar em Add Device, abrir um popover.

Mostrar categorias:

Mobile
Tablet
Custom

Permitir selecionar um preset.

Ao selecionar:

- criar dispositivo;
- adicionar à store;
- posicionar no canvas;
- fechar popover.

Criar componente visual temporário representando
o dispositivo.

O dispositivo ainda não precisa carregar
uma página Chromium.

Adicionar botão de remoção.

REGRAS

Dispositivos novos não devem aparecer sempre
na mesma posição.

Utilizar um deslocamento progressivo simples.

Não implementar algoritmo avançado de organização.

CRITÉRIOS DE ACEITE

- Add Device funciona;
- vários dispositivos podem ser adicionados;
- dispositivos aparecem no canvas;
- remover dispositivo funciona;
- EmptyState desaparece quando existem dispositivos;
- ao remover todos, EmptyState retorna.

Máximo de 500 linhas.

Pare após concluir.
DEVICE-06 — Molduras visuais dos dispositivos

Objetivo: criar os componentes que representam celulares e tablets.

Prompt
Implemente DEVICE-06.

OBJETIVO

Criar molduras minimalistas para os dispositivos.

IMPLEMENTAÇÃO

Criar DeviceFrame.

A moldura deve representar visualmente:

Mobile
Tablet

Cada dispositivo deve mostrar:

- nome;
- dimensões;
- moldura;
- viewport interna;
- indicador de seleção.

A moldura deve possuir uma região superior que
poderá ser utilizada posteriormente como drag handle.

VISUAL

Utilizar o design system do Syntra.

Background:
#343447

Border:
#57536D

Selected:
#C58FA9

Evitar molduras excessivamente detalhadas.

Não copiar elementos proprietários de aparelhos.

Criar uma representação genérica e elegante.

Neste ticket, a viewport pode exibir um placeholder.

CRITÉRIOS DE ACEITE

- mobile possui proporção correta;
- tablet possui proporção correta;
- viewport utiliza as dimensões do preset;
- seleção é visualmente perceptível;
- moldura não altera o tamanho lógico da viewport.

Máximo de 500 linhas.

Pare após concluir.
FASE 3 — Movimentação dos dispositivos

Esta fase implementará o comportamento central da sua ideia: dispositivos soltos e organizáveis.

DEVICE-07 — Drag and Drop

Objetivo: permitir arrastar os dispositivos livremente pelo canvas.

Prompt
Implemente DEVICE-07.

OBJETIVO

Permitir movimentar dispositivos dentro do
Devices Canvas.

IMPLEMENTAÇÃO

Utilizar Pointer Events ou uma biblioteca já
existente no projeto.

Não adicionar uma biblioteca de drag and drop
sem necessidade.

O usuário deve conseguir:

- clicar na moldura superior;
- arrastar o dispositivo;
- soltar na posição desejada.

Atualizar x e y na store.

REGRAS

O drag deve começar somente na moldura ou
no drag handle.

Interações dentro da viewport não podem iniciar
movimentação do dispositivo.

A posição deve ser calculada corretamente
considerando o zoom do canvas.

Não limitar artificialmente o dispositivo à
área visível da janela.

CRITÉRIOS DE ACEITE

- dispositivo pode ser arrastado;
- movimento acompanha o cursor;
- posição permanece após soltar;
- viewport não inicia drag;
- não ocorrem saltos durante movimentação.

Máximo de 500 linhas.

Pare após concluir.
DEVICE-08 — Seleção e sobreposição

Objetivo: definir como os dispositivos se comportam quando estão próximos ou sobrepostos.

Prompt
Implemente DEVICE-08.

OBJETIVO

Criar gerenciamento de seleção e ordem visual
dos dispositivos.

IMPLEMENTAÇÃO

Ao clicar em um dispositivo:

- selecionar;
- aplicar borda de destaque;
- trazer para frente.

Ao clicar no fundo do canvas:

- remover seleção.

Adicionar gerenciamento de z-index.

A ordem visual deve ser independente da posição
dos dispositivos.

Não implementar seleção múltipla ainda.

CRITÉRIOS DE ACEITE

- seleção funciona;
- dispositivo selecionado fica em destaque;
- dispositivo selecionado aparece sobre os demais;
- clicar no fundo remove seleção;
- seleção não interfere na navegação da página.

Máximo de 500 linhas.

Pare após concluir.
FASE 4 — Canvas navegável

Agora transformaremos a área de trabalho em um espaço maior que a janela.

DEVICE-09 — Zoom do Canvas

Objetivo: permitir aproximar e afastar a visualização dos dispositivos.

Prompt
Implemente DEVICE-09.

OBJETIVO

Adicionar controle de zoom ao Devices Canvas.

IMPLEMENTAÇÃO

Criar estado:

zoom

Valor inicial:

1

Permitir:

Zoom In
Zoom Out
Reset Zoom

Limites sugeridos:

0.25 até 2

Mostrar percentual na CanvasToolbar.

Exemplo:

75%

IMPORTANTE

O zoom altera somente a escala visual do canvas.

Não alterar viewportWidth e viewportHeight dos
dispositivos.

Um dispositivo configurado para 390 × 844
deve continuar utilizando esse tamanho lógico
independentemente do zoom.

CRITÉRIOS DE ACEITE

- zoom funciona;
- dispositivos mantêm proporções;
- viewport lógica permanece inalterada;
- zoom não modifica posições persistidas;
- reset retorna para 100%.

Máximo de 500 linhas.

Pare após concluir.
DEVICE-10 — Pan e navegação pelo Canvas

Objetivo: permitir movimentar a área de trabalho inteira.

Prompt
Implemente DEVICE-10.

OBJETIVO

Permitir navegar pela área de trabalho quando
existirem muitos dispositivos.

IMPLEMENTAÇÃO

Adicionar estado:

panX
panY

O usuário deve conseguir movimentar o canvas
segurando Space e arrastando o fundo.

Opcionalmente:

arrastar diretamente o fundo do canvas quando
nenhuma ferramenta estiver ativa.

Não permitir que pan seja iniciado dentro da
viewport de um dispositivo.

Adicionar botão:

Reset View

CRITÉRIOS DE ACEITE

- pan funciona;
- dispositivos mantêm posições relativas;
- drag individual continua funcionando;
- zoom continua funcionando;
- pan não interfere com interações nas páginas.

Máximo de 500 linhas.

Pare após concluir.
DEVICE-11 — Fit to Screen

Objetivo: mostrar todos os dispositivos na área visível.

Prompt
Implemente DEVICE-11.

OBJETIVO

Adicionar funcionalidade Fit to Screen.

IMPLEMENTAÇÃO

Calcular bounding box dos dispositivos.

Considerar:

x
y
width
height
orientation
device frame dimensions

Calcular zoom necessário para mostrar todos os
dispositivos dentro do canvas.

Aplicar margem visual confortável.

Centralizar o conjunto.

Adicionar botão:

Fit to Screen

Quando não existirem dispositivos, restaurar
a visualização inicial.

CRITÉRIOS DE ACEITE

- todos os dispositivos ficam visíveis;
- zoom respeita limites;
- nenhum dispositivo é cortado desnecessariamente;
- funciona com dispositivos de diferentes tamanhos;
- canvas vazio não causa erro.

Máximo de 500 linhas.

Pare após concluir.
FASE 5 — Integração com Chromium

Esta é a etapa mais importante tecnicamente.

Até aqui construímos o comportamento visual e o gerenciamento dos dispositivos.

Agora cada viewport passará a renderizar uma página real utilizando Chromium.

Como o Syntra já utiliza WebContentsView, precisamos integrar as novas instâncias ao gerenciamento existente, sem criar um segundo navegador independente dentro da aplicação.

Há também uma limitação importante: uma WebContentsView não é um elemento DOM. Por isso, não basta aplicar transform: scale() ao componente React para redimensionar visualmente a página Chromium. A geometria e a escala precisam ser coordenadas entre o renderer e o processo main.

DEVICE-12 — Arquitetura de múltiplas WebContentsView

Objetivo: preparar o Browser Core para hospedar múltiplas views dentro de uma mesma aba.

Prompt
Implemente DEVICE-12.

OBJETIVO

Preparar a arquitetura de renderização para
múltiplas WebContentsView no Devices Canvas.

ANTES DE PROGRAMAR

Inspecione:

- TabManager;
- criação de WebContentsView;
- gerenciamento de sessões;
- sincronização de bounds;
- gerenciamento do ciclo de vida das abas.

Explique como as views dos dispositivos serão
associadas à aba atual.

ARQUITETURA

Cada dispositivo terá:

deviceId
tabId
WebContentsView
session
bounds
navigationState

Evitar misturar objetos Electron na store React.

Criar um DeviceViewManager ou adaptar o serviço
existente, conforme a arquitetura atual.

Neste ticket, implementar somente a estrutura
e o ciclo de vida básico.

Não implementar zoom Chromium ainda.

CRITÉRIOS DE ACEITE

- arquitetura suporta múltiplas views;
- views pertencem à aba correta;
- sessões são controladas;
- renderer não recebe objetos Electron;
- nenhuma view é criada desnecessariamente.

Máximo de 500 linhas.

Pare após concluir.
DEVICE-13 — Renderização real nos dispositivos

Objetivo: carregar a aplicação dentro de cada dispositivo virtual.

Prompt
Implemente DEVICE-13.

OBJETIVO

Substituir placeholders por WebContentsView reais.

IMPLEMENTAÇÃO

Ao adicionar dispositivo:

- criar WebContentsView;
- associar à aba ativa;
- utilizar sessão apropriada;
- carregar URL atual;
- aplicar dimensões da viewport.

Cada dispositivo deve possuir sua própria
instância de navegação.

SEGURANÇA

nodeIntegration: false
contextIsolation: true
sandbox: true
webSecurity: true

Não expor APIs internas às páginas remotas.

Não utilizar iframe.

Não utilizar webview.

CRITÉRIOS DE ACEITE

- página carrega;
- vários dispositivos renderizam simultaneamente;
- cada dispositivo possui viewport independente;
- páginas são interativas;
- dispositivos pertencem à aba correta.

Máximo de 500 linhas.

Pare após concluir.
DEVICE-14 — Sincronizar posições e bounds

Objetivo: fazer as views Chromium acompanharem os movimentos dos dispositivos.

Prompt
Implemente DEVICE-14.

OBJETIVO

Sincronizar a geometria de cada WebContentsView
com a posição visual do dispositivo no canvas.

IMPLEMENTAÇÃO

Considerar:

- posição do dispositivo;
- posição do canvas;
- toolbar;
- sidebar;
- Dev Panel;
- pan;
- zoom;
- tamanho da janela.

O renderer deve fornecer a geometria necessária
ao main.

O main deve atualizar bounds das views.

Evitar atualizar bounds desnecessariamente.

Utilizar requestAnimationFrame ou mecanismo
equivalente para agrupar atualizações frequentes
quando apropriado.

IMPORTANTE

Não presumir que CSS transform será automaticamente
aplicado à WebContentsView.

Se a arquitetura existente não permitir alinhar
corretamente a view ao dispositivo durante zoom
e pan, explique a limitação e proponha adaptação.

CRITÉRIOS DE ACEITE

- arrastar dispositivo move a página junto;
- resize funciona;
- sidebar não é sobreposta;
- Dev Panel não é sobreposto;
- não existem gaps visuais significativos;
- dispositivo e viewport permanecem alinhados.

Máximo de 500 linhas.

Pare após concluir.
DEVICE-15 — Zoom e pan com Chromium

Objetivo: garantir que os dispositivos permaneçam utilizáveis quando o canvas é ampliado ou reduzido.

Prompt
Implemente DEVICE-15.

OBJETIVO

Integrar zoom e pan do canvas às views Chromium.

PROBLEMA

O canvas React usa coordenadas visuais.

WebContentsView utiliza bounds gerenciados
pelo processo principal.

Uma transformação CSS não transforma
automaticamente a view Chromium.

IMPLEMENTAÇÃO

Definir uma estratégia explícita para:

- escala visual;
- posicionamento;
- clipping;
- conversão de coordenadas;
- tamanho lógico da viewport;
- interação do usuário.

Não modificar silenciosamente as dimensões
responsivas do dispositivo ao alterar o zoom.

Se necessário, usar recursos apropriados de
emulação do Chrome DevTools Protocol.

Não utilizar captura estática de screenshot como
substituto permanente para uma viewport interativa.

CRITÉRIOS DE ACEITE

- zoom visual funciona;
- viewport lógica permanece estável;
- clique funciona em zoom diferente de 100%;
- pan mantém alinhamento;
- Dev Panel não é sobreposto;
- diferentes dispositivos funcionam simultaneamente.

Se algum requisito não puder ser atendido com
a arquitetura existente, registre o bloqueio
antes de implementar um workaround.

Máximo de 500 linhas.

Pare após concluir.
FASE 6 — Controles dos dispositivos
DEVICE-16 — Toolbar individual

Objetivo: adicionar controles próprios a cada dispositivo.

Prompt
Implemente DEVICE-16.

OBJETIVO

Criar uma barra de controles individual para
cada dispositivo.

CONTROLES

Reload
Rotate
Screenshot
Remove

Neste ticket, Screenshot pode permanecer desabilitado
caso a integração ainda não esteja preparada.

COMPORTAMENTO

Reload:
recarrega somente o dispositivo selecionado.

Rotate:
alterna entre portrait e landscape.

Remove:
remove dispositivo e libera recursos Chromium.

VISUAL

Controles compactos.

Ícones Lucide.

Toolbar discreta.

Não criar botões grandes sobre a viewport.

CRITÉRIOS DE ACEITE

- reload individual funciona;
- rotação funciona;
- remoção funciona;
- controles não atrapalham o drag;
- controles não bloqueiam interações da página.

Máximo de 500 linhas.

Pare após concluir.
DEVICE-17 — Device Settings

Objetivo: permitir personalizar dimensões e configurações dos dispositivos.

Prompt
Implemente DEVICE-17.

OBJETIVO

Permitir editar configurações de um dispositivo.

IMPLEMENTAÇÃO

Criar painel ou popover de configurações.

Campos:

Name
Viewport Width
Viewport Height
Orientation

Permitir criar dispositivo customizado.

Validar dimensões com Zod.

Não permitir valores negativos ou zero.

Definir limites razoáveis para evitar criação
acidental de views excessivamente grandes.

Aplicar alterações à WebContentsView correspondente.

CRITÉRIOS DE ACEITE

- dimensões podem ser alteradas;
- orientação funciona;
- nome pode ser alterado;
- inputs inválidos são rejeitados;
- outros dispositivos não são afetados.

Máximo de 500 linhas.

Pare após concluir.
FASE 7 — Integração com Workspace
DEVICE-18 — Persistência do Canvas

Objetivo: salvar a organização visual dos dispositivos.

Prompt
Implemente DEVICE-18.

OBJETIVO

Persistir o layout do Devices Canvas por workspace.

SALVAR

- dispositivos;
- presets;
- dimensões;
- posições;
- orientação;
- zoom;
- pan.

Utilizar a camada de persistência existente.

Não persistir objetos WebContentsView.

Ao reabrir workspace:

restaurar modelo visual e recriar views conforme
a política de restauração da aplicação.

CRITÉRIOS DE ACEITE

- posições são restauradas;
- dimensões são restauradas;
- zoom é restaurado;
- dispositivos pertencem ao workspace correto;
- workspace sem layout salvo funciona normalmente.

Máximo de 500 linhas.

Pare após concluir.
DEVICE-19 — Ambientes independentes

Objetivo: permitir comparar Local, Staging e Production dentro do mesmo canvas.

Prompt
Implemente DEVICE-19.

OBJETIVO

Permitir atribuir um ambiente a cada dispositivo.

EXEMPLO

Device A:
Local

Device B:
Staging

Device C:
Production

IMPLEMENTAÇÃO

Reutilizar EnvironmentManager existente.

Cada dispositivo deve utilizar o ambiente associado
para construir sua URL.

Preservar path, query e hash quando apropriado.

Mostrar ambiente selecionado discretamente
na moldura.

CRITÉRIOS DE ACEITE

- dispositivos podem usar ambientes diferentes;
- troca de ambiente não afeta outros dispositivos;
- path é preservado;
- ambiente Production é identificado visualmente;
- sessões seguem a política existente do workspace.

Máximo de 500 linhas.

Pare após concluir.
DEVICE-20 — Sincronização de navegação

Objetivo: permitir que todos os dispositivos acompanhem a mesma rota.

Prompt
Implemente DEVICE-20.

OBJETIVO

Adicionar sincronização opcional de navegação.

MODOS

Independent

Sync Navigation

Independent:
cada dispositivo navega individualmente.

Sync Navigation:
quando a rota de um dispositivo muda,
os demais acompanham a rota correspondente.

IMPLEMENTAÇÃO

Preservar o ambiente individual de cada dispositivo.

Sincronizar:

pathname
query
hash

Evitar loops de navegação entre dispositivos.

Não sincronizar automaticamente:

cookies;
formulários;
scroll;
cliques.

CRITÉRIOS DE ACEITE

- navegação independente funciona;
- sincronização funciona;
- não ocorrem loops;
- ambientes diferentes preservam seus domínios;
- usuários podem desabilitar sincronização.

Máximo de 500 linhas.

Pare após concluir.
FASE 8 — Integração com DevTools
DEVICE-21 — Seleção de dispositivo no Dev Panel

Objetivo: fazer as ferramentas existentes entenderem qual dispositivo está selecionado.

Prompt
Implemente DEVICE-21.

OBJETIVO

Integrar Devices Canvas ao Dev Panel do Syntra.

IMPLEMENTAÇÃO

Ao selecionar dispositivo:

Network deve apresentar requests daquele dispositivo.

Console deve apresentar logs daquele dispositivo.

Storage deve utilizar a sessão e origem
correspondentes.

API Client deve continuar funcionando segundo
sua política atual de ambiente e sessão.

Mostrar dispositivo ativo no cabeçalho do Dev Panel.

Não duplicar os componentes existentes.

Reutilizar collectors e serviços atuais.

CRITÉRIOS DE ACEITE

- Network mostra dispositivo correto;
- Console mostra dispositivo correto;
- trocar seleção atualiza Dev Panel;
- requests não se misturam;
- abas normais continuam funcionando.

Máximo de 500 linhas.

Pare após concluir.
DEVICE-22 — Screenshot por dispositivo

Objetivo: permitir capturar a tela de cada dispositivo individualmente.

Prompt
Implemente DEVICE-22.

OBJETIVO

Permitir captura de screenshot de um dispositivo.

IMPLEMENTAÇÃO

Adicionar ação Capture Screenshot na toolbar
individual.

Utilizar API Chromium apropriada.

A imagem deve representar a viewport selecionada.

Não capturar a tela inteira do Syntra.

Permitir salvar arquivo através de diálogo seguro.

CRITÉRIOS DE ACEITE

- screenshot pertence ao dispositivo correto;
- dimensões da imagem são coerentes;
- arquivo pode ser salvo;
- cancelar não causa erro;
- outros dispositivos não são afetados.

Máximo de 500 linhas.

Pare após concluir.
FASE 9 — Validação

Agora precisamos verificar que a nova funcionalidade não compromete o comportamento do navegador.

VAL-DEVICE-01 — Integração visual
Execute VAL-DEVICE-01.

OBJETIVO

Validar integração do Devices Canvas com
a interface existente do Syntra.

TESTAR

1. Abrir uma aba normal.

2. Entrar no modo Devices Canvas através
   do seletor Responsive.

3. Adicionar dois dispositivos.

4. Voltar para Responsive.

5. Retornar ao Devices Canvas.

6. Abrir Dev Panel.

7. Fechar Dev Panel.

8. Redimensionar janela.

VERIFICAR

- toolbar continua funcionando;
- abas continuam funcionando;
- Dev Panel permanece acessível;
- Devices Canvas ocupa somente a região correta;
- modo Responsive original não sofreu regressões.

Registrar problemas.

Não implementar correções automaticamente.
VAL-DEVICE-02 — Drag, zoom e pan
Execute VAL-DEVICE-02.

OBJETIVO

Validar comportamento espacial do canvas.

TESTAR

Adicionar:

2 celulares
2 tablets

Arrastar cada dispositivo.

Sobrepor dispositivos.

Selecionar dispositivos.

Aplicar zoom:

25%
50%
75%
100%
150%
200%

Executar pan.

Executar Fit to Screen.

VERIFICAR

- dispositivos acompanham cursor;
- posições permanecem corretas;
- zoom mantém proporções;
- viewport lógica não muda indevidamente;
- pan funciona;
- seleção funciona;
- nenhum dispositivo apresenta saltos.

Registrar problemas e evidências.
VAL-DEVICE-03 — Chromium e interação
Execute VAL-DEVICE-03.

OBJETIVO

Validar que dispositivos são instâncias Chromium
realmente interativas.

TESTAR

1. Abrir página em três dispositivos.

2. Clicar em botões.

3. Preencher formulários.

4. Navegar entre páginas.

5. Recarregar somente um dispositivo.

6. Rotacionar um dispositivo.

7. Redimensionar o canvas.

8. Alterar zoom enquanto dispositivos estão ativos.

VERIFICAR

- interação funciona;
- dispositivos são independentes;
- viewport não sai da moldura;
- clique funciona com zoom;
- dispositivos não sobrepõem áreas do Syntra;
- recursos são liberados ao remover dispositivo.

Registrar problemas.

Não implementar correções automaticamente.
VAL-DEVICE-04 — Workspaces e ambientes
Execute VAL-DEVICE-04.

OBJETIVO

Validar integração com workspaces e environments.

TESTAR

Workspace A:
3 dispositivos.

Workspace B:
2 dispositivos.

Alternar entre workspaces.

Configurar:

Local
Staging
Production

Ativar Sync Navigation.

VERIFICAR

- layouts permanecem independentes;
- sessões seguem a política do workspace;
- dispositivos não se misturam;
- navegação sincronizada funciona;
- ambientes mantêm suas URLs;
- Production é identificado visualmente.

Registrar problemas.
VAL-DEVICE-05 — Performance e ciclo de vida
Execute VAL-DEVICE-05.

OBJETIVO

Verificar impacto de múltiplas instâncias Chromium.

TESTAR

1 dispositivo.
3 dispositivos.
5 dispositivos.
10 dispositivos.

Registrar:

memória;
CPU;
tempo de carregamento;
responsividade;
tempo de troca entre modos.

Adicionar e remover dispositivos repetidamente.

Alternar entre abas.

Fechar workspace.

Fechar aplicação.

VERIFICAR

- não existem processos Chromium órfãos;
- listeners são removidos;
- views são destruídas;
- aplicação não apresenta crescimento
  contínuo injustificado de memória;
- browser permanece utilizável.

Não definir limites arbitrários de consumo.

Registrar baseline e problemas encontrados.
Ordem recomendada de execução
Marco	Tickets	Resultado
1 — Integração	DEVICE-01 a 02	Novo modo na barra Responsive
2 — Dispositivos	DEVICE-03 a 06	Celulares e tablets visuais
3 — Interação	DEVICE-07 a 08	Arrastar, selecionar e organizar
4 — Canvas	DEVICE-09 a 11	Zoom, pan e Fit to Screen
5 — Chromium	DEVICE-12 a 15	Dispositivos reais e interativos
6 — Controles	DEVICE-16 a 17	Rotação, reload e configurações
7 — Workspace	DEVICE-18 a 20	Persistência, ambientes e sincronização
8 — DevTools	DEVICE-21 a 22	Network, Console e screenshots
9 — Validação	VAL-DEVICE-01 a 05	Testes de integração e desempenho

Comece pelo DEVICE-01. Ele deve apenas adicionar Devices Canvas ao seletor Responsive que aparece nas suas imagens, preservando integralmente o comportamento atual do Syntra. Depois de validar essa integração, avançamos para construir o canvas e os dispositivos propriamente ditos.