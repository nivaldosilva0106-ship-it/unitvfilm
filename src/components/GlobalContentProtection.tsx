import { useContentProtection } from '@/hooks/useContentProtection';

// Componente que aplica proteção de conteúdo globalmente em todas as páginas
const GlobalContentProtection = () => {
  // Sempre ativo - bloqueia botão direito e atalhos de inspeção em todo o site
  useContentProtection(true);
  
  return null;
};

export default GlobalContentProtection;
