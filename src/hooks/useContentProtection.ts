import { useEffect, useCallback } from 'react';

// Codifica URL de forma reversível mas ofuscada
export const encodeVideoUrl = (url: string): string => {
  try {
    const encoded = btoa(encodeURIComponent(url).split('').reverse().join(''));
    return encoded.split('').map((c, i) => 
      String.fromCharCode(c.charCodeAt(0) + (i % 5))
    ).join('');
  } catch {
    return url;
  }
};

// Decodifica URL ofuscada
export const decodeVideoUrl = (encoded: string): string => {
  try {
    const decoded = encoded.split('').map((c, i) => 
      String.fromCharCode(c.charCodeAt(0) - (i % 5))
    ).join('');
    return decodeURIComponent(atob(decoded).split('').reverse().join(''));
  } catch {
    return encoded;
  }
};

// Hook para proteção de conteúdo
export const useContentProtection = (enabled: boolean = true) => {
  // Bloquear menu de contexto (botão direito)
  const handleContextMenu = useCallback((e: MouseEvent) => {
    if (enabled) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, [enabled]);

  // Bloquear atalhos de teclado para inspecionar
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // F12 - DevTools
    if (e.key === 'F12') {
      e.preventDefault();
      return false;
    }

    // Ctrl+Shift+I - Inspecionar elemento
    if (e.ctrlKey && e.shiftKey && e.key === 'I') {
      e.preventDefault();
      return false;
    }

    // Ctrl+Shift+J - Console
    if (e.ctrlKey && e.shiftKey && e.key === 'J') {
      e.preventDefault();
      return false;
    }

    // Ctrl+Shift+C - Inspecionar elemento
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      return false;
    }

    // Ctrl+U - Ver código fonte
    if (e.ctrlKey && e.key === 'u') {
      e.preventDefault();
      return false;
    }

    // Ctrl+S - Salvar página
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      return false;
    }

    // Ctrl+Shift+K - Console (Firefox)
    if (e.ctrlKey && e.shiftKey && e.key === 'K') {
      e.preventDefault();
      return false;
    }

    // Cmd+Option+I (Mac)
    if (e.metaKey && e.altKey && e.key === 'i') {
      e.preventDefault();
      return false;
    }

    // Cmd+Option+J (Mac)
    if (e.metaKey && e.altKey && e.key === 'j') {
      e.preventDefault();
      return false;
    }

    // Cmd+Option+C (Mac)
    if (e.metaKey && e.altKey && e.key === 'c') {
      e.preventDefault();
      return false;
    }

    // Cmd+Option+U (Mac) - View Source
    if (e.metaKey && e.altKey && e.key === 'u') {
      e.preventDefault();
      return false;
    }
  }, [enabled]);

  // Detectar DevTools aberto
  const detectDevTools = useCallback(() => {
    if (!enabled) return;

    const threshold = 160;
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;

    if (widthThreshold || heightThreshold) {
      // DevTools pode estar aberto - ofuscar conteúdo sensível
      document.body.classList.add('devtools-open');
    } else {
      document.body.classList.remove('devtools-open');
    }
  }, [enabled]);

  // Bloquear arrastar elementos
  const handleDragStart = useCallback((e: DragEvent) => {
    if (enabled) {
      e.preventDefault();
      return false;
    }
  }, [enabled]);

  // Bloquear seleção de texto
  const handleSelectStart = useCallback((e: Event) => {
    const target = e.target as HTMLElement;
    // Permitir seleção em inputs e textareas
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return true;
    }
    if (enabled) {
      e.preventDefault();
      return false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    // Adicionar listeners
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('dragstart', handleDragStart, true);
    document.addEventListener('selectstart', handleSelectStart, true);

    // Verificar DevTools periodicamente
    const devToolsInterval = setInterval(detectDevTools, 1000);
    detectDevTools();

    // Desabilitar console.log em produção
    if (import.meta.env.PROD) {
      const noop = () => {};
      ['log', 'debug', 'info', 'warn'].forEach(method => {
        (console as any)[method] = noop;
      });
    }

    // Adicionar estilos de proteção
    const style = document.createElement('style');
    style.id = 'content-protection-styles';
    style.textContent = `
      .devtools-open iframe {
        opacity: 0 !important;
        pointer-events: none !important;
      }
      .devtools-open::after {
        content: 'Conteúdo protegido';
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 24px;
        color: white;
        z-index: 99999;
      }
      .protected-content {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
        -webkit-touch-callout: none !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('dragstart', handleDragStart, true);
      document.removeEventListener('selectstart', handleSelectStart, true);
      clearInterval(devToolsInterval);
      document.body.classList.remove('devtools-open');
      document.getElementById('content-protection-styles')?.remove();
    };
  }, [enabled, handleContextMenu, handleKeyDown, handleDragStart, handleSelectStart, detectDevTools]);

  return { encodeVideoUrl, decodeVideoUrl };
};
