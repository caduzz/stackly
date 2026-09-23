TICKET: FEATURE-33
NOME: Suporte experimental a DRM/Widevine no Stackly

CONTEXTO

O Stackly é um navegador para desenvolvedores construído
com Electron, Chromium, React e TypeScript.

Atualmente, algumas páginas utilizam <webview> para
navegação e o navegador possui abas, workspaces e
sessões Chromium independentes.

Quero investigar e implementar suporte a reprodução
de conteúdo protegido por DRM dentro dos webviews,
sem substituir toda a arquitetura atual do Stackly.

OBJETIVO

Avaliar a integração do Widevine CDM utilizando
o Electron for Content Security (ECS), da Castlabs,
e implementar uma versão experimental caso seja
compatível com o projeto.

IMPORTANTE

Não assumir que instalar o ECS garante reprodução
na Netflix ou em qualquer outro serviço.

Não migrar definitivamente o Stackly antes de
validar o funcionamento em uma branch experimental.

==================================================
1. ANÁLISE DO PROJETO
==================================================

Antes de modificar qualquer arquivo:

- Identificar a versão atual do Electron e Chromium.
- Verificar como o Stackly cria seus <webview>.
- Identificar como são gerenciadas as sessões
  e partições dos workspaces.
- Verificar as configurações de webPreferences.
- Analisar o processo atual de build e distribuição.
- Identificar possíveis incompatibilidades com ECS.

Documentar o resultado da análise.

==================================================
2. INTEGRAÇÃO EXPERIMENTAL COM ECS
==================================================

Consultar a documentação oficial:

https://github.com/castlabs/electron-releases

Verificar a versão do ECS compatível com a
arquitetura e as dependências atuais do Stackly.

Criar uma branch experimental para realizar os testes.

Caso a integração seja viável:

- Configurar o projeto para utilizar a distribuição
  compatível do Electron for Content Security.
- Seguir o procedimento oficial de integração
  e obtenção do Widevine CDM.
- Configurar os requisitos de assinatura e
  distribuição quando aplicáveis.
- Manter o funcionamento das APIs do Electron
  utilizadas atualmente pelo Stackly.

Não copiar componentes DRM de instalações do
Google Chrome ou de outros navegadores.

Não utilizar componentes DRM de fontes não oficiais.

==================================================
3. SUPORTE A DRM NOS WEBVIEWS
==================================================

Verificar se os <webview> existentes conseguem
utilizar o Widevine disponibilizado pela
distribuição experimental do Electron.

Garantir que a integração seja compatível com:

- Abas normais.
- Abas Device.
- Múltiplos dispositivos no Devices Canvas.
- Sessões Chromium dos workspaces.
- Navegação entre abas e workspaces.

Não recriar webviews ao alternar entre abas.

Não alterar o gerenciamento de sessões apenas
para tentar fazer o DRM funcionar.

==================================================
4. DIAGNÓSTICO DE COMPATIBILIDADE
==================================================

Criar uma ferramenta interna de diagnóstico
para verificar:

- Versão do Electron.
- Versão do Chromium.
- Disponibilidade da API EME.
- Disponibilidade do Widevine CDM.
- Suporte aos codecs de mídia necessários.
- Erros relacionados à reprodução protegida.

Utilizar navigator.requestMediaKeySystemAccess()
para testar a disponibilidade de configurações
específicas do Widevine.

Um resultado positivo não deve ser interpretado
como garantia de compatibilidade com todos
os serviços de streaming.

==================================================
5. TESTES DE REPRODUÇÃO
==================================================

Testar inicialmente com conteúdo de demonstração
DRM disponibilizado para esse propósito.

Verificar:

- Inicialização do player.
- Solicitação de licença DRM.
- Reprodução de áudio e vídeo.
- Funcionamento dos controles de mídia.
- Reprodução em segundo plano.
- Funcionamento do mute individual por guia.
- Integração com o Audio Center do Stackly.

Depois, verificar se serviços como a Netflix
funcionam, respeitando seus requisitos de
compatibilidade e condições de uso.

Registrar os erros apresentados quando um
serviço não permitir a reprodução.

==================================================
6. SEGURANÇA
==================================================

Preservar as configurações de segurança existentes:

- nodeIntegration: false
- contextIsolation: true
- sandbox: true
- webSecurity: true

Não expor APIs privilegiadas às páginas externas.

Não modificar o User-Agent para ocultar limitações
de DRM ou simular uma certificação inexistente.

Não implementar mecanismos para contornar DRM,
licenciamento ou restrições de reprodução.

==================================================
7. VALIDAÇÃO DO STACKLY
==================================================

Após a integração experimental, verificar se
continuam funcionando:

- Navegação em abas normais.
- Navegação independente por dispositivo.
- Workspaces e isolamento de sessões.
- Dev Panel.
- Console, Network, Storage e Elements.
- Histórico de navegação.
- Controle individual de áudio.
- Audio Center.
- Restauração de abas.
- Build e empacotamento do aplicativo.

Não permitir que a integração de DRM comprometa
as funcionalidades de desenvolvimento do Stackly.

==================================================
CRITÉRIOS DE ACEITE
==================================================

[ ] Compatibilidade do ECS com o projeto analisada.

[ ] Integração realizada em branch experimental,
    caso seja tecnicamente viável.

[ ] Disponibilidade do Widevine verificada.

[ ] Reprodução DRM testada em conteúdo de demonstração.

[ ] Funcionamento em <webview> validado.

[ ] Abas, devices e workspaces continuam funcionando.

[ ] Nenhuma configuração de segurança foi desabilitada.

[ ] Limitações de compatibilidade documentadas.

[ ] Caso a integração não seja viável, o projeto
    permanece utilizando o Electron atual.

IMPLEMENTAÇÃO

Dividir a implementação em etapas de até
500 linhas de código cada.

Começar pela análise da compatibilidade com ECS.

Apresentar os resultados antes de realizar
a migração experimental.

Não substituir definitivamente o Electron
nem alterar a arquitetura principal do Stackly
sem validar o protótipo.