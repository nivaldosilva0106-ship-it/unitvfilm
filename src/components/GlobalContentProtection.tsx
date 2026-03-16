import { useContentProtection } from '@/hooks/useContentProtection';
import { useLocation } from 'react-router-dom';

// Componente que aplica proteção de conteúdo globalmente em todas as páginas
const GlobalContentProtection = () => {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  // Ativo apenas se NÃO estiver na área administrativa
  useContentProtection(!isAdmin);

  return null;
};

export default GlobalContentProtection;
