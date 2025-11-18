# Guia do Sistema de Gerenciamento de Anúncios - UniTvFilm

## Visão Geral

O sistema de anúncios do UniTvFilm permite que você monetize seu site de streaming através da integração com múltiplas redes de anúncios como Google AdSense, AdMob e outras plataformas personalizadas.

## Acesso ao Painel de Anúncios

1. Faça login como administrador
2. Acesse o Painel Administrativo
3. Clique em "Gerenciar Anúncios"

## Posições de Anúncios Disponíveis

### 1. Cabeçalho (Header)
- **Localização:** Logo abaixo do menu principal
- **Visibilidade:** Todas as páginas do site
- **Recomendação:** Banner horizontal 728x90 ou responsivo
- **Impacto:** Alto - primeira coisa que o usuário vê

### 2. Rodapé (Footer)
- **Localização:** Final da página, antes dos termos de uso
- **Visibilidade:** Todas as páginas
- **Recomendação:** Banner horizontal ou quadrado
- **Impacto:** Médio - usuários que rolam até o final

### 3. Barra Lateral (Sidebar)
- **Localização:** Lateral das páginas de conteúdo (apenas desktop)
- **Visibilidade:** Páginas de detalhes e busca
- **Recomendação:** Banner vertical 300x600 ou 160x600
- **Impacto:** Médio - visível durante navegação

### 4. Topo do Conteúdo (Content Top)
- **Localização:** Início da página de detalhes de filmes/séries
- **Visibilidade:** Páginas de detalhes
- **Recomendação:** Banner horizontal ou native ads
- **Impacto:** Alto - contexto relevante

### 5. Final do Conteúdo (Content Bottom)
- **Localização:** Após descrição do filme/série
- **Visibilidade:** Páginas de detalhes
- **Recomendação:** Banner ou native ads
- **Impacto:** Médio - final da leitura

### 6. Entre Conteúdos (Between Content)
- **Localização:** Entre as linhas de filmes/séries na página inicial
- **Visibilidade:** Página inicial
- **Recomendação:** Banner horizontal ou native ads
- **Impacto:** Alto - durante navegação

### 7. Player de Vídeo (Player)
- **Localização:** Antes/durante reprodução de vídeo
- **Visibilidade:** Modal do player
- **Recomendação:** Vídeo pre-roll, banner overlay
- **Impacto:** Muito Alto - momento de engajamento
- **⚠️ Cuidado:** Não abuse para não prejudicar experiência

### 8. Mobile (Inferior) (Mobile Bottom)
- **Localização:** Fixo na parte inferior em dispositivos móveis
- **Visibilidade:** Apenas mobile, todas as páginas
- **Recomendação:** Banner responsivo móvel
- **Impacto:** Alto - sempre visível em mobile

### 9. Native Ads
- **Localização:** Integrado naturalmente com o conteúdo
- **Visibilidade:** Entre cards de filmes/séries
- **Recomendação:** Formato que combina com cards de conteúdo
- **Impacto:** Alto - parece conteúdo nativo

## Redes de Anúncios Suportadas

### Google AdSense
**Melhor para:** Sites com muito tráfego, conteúdo original

**Como configurar:**
1. Crie conta em https://adsense.google.com
2. Navegue até Anúncios → Visão geral
3. Clique em "Por unidade de anúncio"
4. Crie uma nova unidade de anúncio
5. Copie o código HTML/JavaScript gerado
6. Cole no sistema

**Formatos recomendados:**
- Display responsivo
- In-feed (para native ads)
- In-article (para entre conteúdos)
- Multiplex (para listas de conteúdo)

### Google AdMob
**Melhor para:** Versões mobile do site, apps PWA

**Como configurar:**
1. Acesse https://admob.google.com
2. Vá em Apps → Unidades de anúncio
3. Crie nova unidade para Web
4. Copie o código fornecido
5. Cole no sistema

**Formatos recomendados:**
- Banner
- Intersticial (para transições)
- Vídeo recompensado

### Personalizado / Outros
Para outras redes de anúncios ou códigos personalizados, simplesmente cole o código HTML/JavaScript fornecido pela plataforma.

## Tipos de Anúncios

### Banner
Anúncios estáticos ou animados em formato retangular. Ideais para cabeçalho, rodapé e laterais.

### Intersticial
Anúncios de tela cheia que aparecem em transições. Use com moderação para não atrapalhar a experiência.

### Vídeo
Anúncios em formato de vídeo, geralmente pre-roll antes do conteúdo principal.

### Native
Anúncios que se misturam naturalmente com o conteúdo do site, aparentando ser parte da interface.

## Boas Práticas

### ✅ Faça

1. **Teste diferentes posições:** Experimente várias combinações para encontrar o melhor resultado
2. **Monitore métricas:** Acompanhe impressões e cliques (quando disponível)
3. **Respeite o usuário:** Não exagere na quantidade de anúncios
4. **Use anúncios responsivos:** Garantem boa visualização em todos os dispositivos
5. **Siga as políticas:** Respeite as diretrizes das plataformas de anúncios
6. **Teste antes de ativar:** Visualize como o anúncio aparece antes de publicar

### ❌ Evite

1. **Sobrecarga de anúncios:** Máximo de 1-2 anúncios por área
2. **Anúncios intrusivos:** Evite popups automáticos
3. **Conflito com conteúdo adulto:** Verifique políticas das redes
4. **Anúncios não testados:** Sempre visualize antes de ativar
5. **Anúncios no player sem controle:** Pode causar frustração
6. **Códigos maliciosos:** Use apenas códigos de fontes confiáveis

## Processo de Configuração

### Passo 1: Criar Anúncio
1. Acesse "Gerenciar Anúncios"
2. Clique em "Adicionar" ou preencha o formulário
3. Preencha os campos obrigatórios:
   - Nome do anúncio (identificação interna)
   - Rede de anúncios (AdSense, AdMob, etc.)
   - Tipo de anúncio (Banner, Vídeo, etc.)
   - Posição no site
   - Código do anúncio

### Passo 2: Obter Código do Anúncio
Siga as instruções específicas para cada rede de anúncios exibidas no formulário.

### Passo 3: Configurar e Testar
1. Cole o código no campo apropriado
2. Adicione uma descrição (opcional)
3. Mantenha o anúncio ativo
4. Clique em "Adicionar"

### Passo 4: Verificar no Site
1. Abra o site em modo anônimo/privado
2. Navegue até a página onde o anúncio deve aparecer
3. Verifique se está sendo exibido corretamente
4. Teste em diferentes dispositivos (desktop, mobile, tablet)

### Passo 5: Monitorar e Ajustar
1. Acompanhe as métricas de impressões e cliques
2. Ajuste posições e formatos conforme necessário
3. Teste A/B com diferentes configurações
4. Otimize baseado nos resultados

## Gerenciamento de Anúncios

### Editar Anúncio
1. Localize o anúncio na lista
2. Clique no ícone de editar (lápis)
3. Modifique os campos desejados
4. Clique em "Atualizar"

### Ativar/Desativar Anúncio
Use o switch "Anúncio Ativo" para controlar se o anúncio está sendo exibido sem precisar deletá-lo.

### Excluir Anúncio
1. Localize o anúncio na lista
2. Clique no ícone de excluir (lixeira)
3. Confirme a exclusão

**⚠️ Atenção:** Anúncios excluídos não podem ser recuperados.

## Dicas de Monetização

### Para Iniciantes
- Comece com Google AdSense (mais fácil de configurar)
- Use posições menos intrusivas (rodapé, entre conteúdos)
- Foque em crescer o tráfego antes de adicionar muitos anúncios

### Para Intermediários
- Adicione anúncios no cabeçalho e laterais
- Experimente native ads entre os cards de conteúdo
- Configure anúncios mobile específicos

### Para Avançados
- Use múltiplas redes de anúncios
- Configure anúncios no player (com moderação)
- Implemente intersticial em momentos estratégicos
- Teste diferentes formatos e posições
- Monitore métricas avançadas via plataformas

## Resolução de Problemas

### Anúncio não aparece
- Verifique se está marcado como "Ativo"
- Confirme se o código está correto
- Limpe o cache do navegador
- Verifique se não há bloqueadores de anúncios
- Aguarde alguns minutos após adicionar (processamento)

### Anúncio quebra o layout
- Ajuste o tamanho do anúncio na plataforma
- Use formatos responsivos
- Teste em diferentes dispositivos
- Adicione CSS personalizado se necessário

### Baixo desempenho
- Mude a posição do anúncio
- Experimente diferentes formatos
- Verifique se o conteúdo é adequado para a rede de anúncios
- Aumente o tráfego do site

## Conformidade e Políticas

### Google AdSense
- Não clique em seus próprios anúncios
- Conteúdo deve seguir políticas do Google
- Não incentive cliques
- Respeite privacidade dos usuários (GDPR, LGPD)

### Google AdMob
- Configure adequadamente para web
- Respeite limites de frequência
- Não force usuários a assistir anúncios

### Geral
- Sempre tenha política de privacidade
- Informe sobre uso de cookies
- Respeite leis locais de publicidade
- Declare uso de anúncios nos termos de uso

## Suporte

Para problemas técnicos com o sistema de anúncios do UniTvFilm:
- Acesse a documentação técnica
- Entre em contato com o desenvolvedor

Para problemas com as plataformas de anúncios:
- Google AdSense: https://support.google.com/adsense
- Google AdMob: https://support.google.com/admob
- Consulte a documentação da plataforma específica

## Atualizações Futuras

O sistema será atualizado com:
- [ ] Estatísticas detalhadas de impressões e cliques
- [ ] Relatórios de receita integrados
- [ ] Preview visual de posições
- [ ] Testes A/B automatizados
- [ ] Integração com mais redes de anúncios
- [ ] Otimização automática de posições

---

**Última atualização:** 2025-11-18
**Versão:** 1.0
