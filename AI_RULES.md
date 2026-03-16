# Regras do Editor AI para o Projeto UniTvFilm

Este documento descreve as principais tecnologias e diretrizes específicas de uso de bibliotecas para manter a consistência e a qualidade no aplicativo UniTvFilm.

## 1. Resumo da Pilha de Tecnologia (Tech Stack)

1.  **Frontend Framework:** React (TypeScript).
2.  **Build Tool:** Vite.
3.  **Roteamento:** React Router DOM (v6).
4.  **Estilização:** Tailwind CSS, utilizando um tema escuro customizado e classes utilitárias como `glow-effect`. Todos os designs devem ser responsivos.
5.  **Componentes UI:** shadcn/ui (baseado em Radix UI).
6.  **Gerenciamento de Estado/Dados:** React Query (`@tanstack/react-query`) para gerenciamento de estado assíncrono e cache.
7.  **Backend/Database/Auth:** Firebase (Authentication e Realtime Database).
8.  **Notificações:** Sonner (para toasts modernos e feedback ao usuário).
9.  **Ícones:** Lucide React.
10. **UX/Navegação:** Implementação de um hook customizado (`useKeyboardNavigation`) para navegação otimizada por teclado/controle remoto.

## 2. Diretrizes de Uso de Bibliotecas

| Funcionalidade | Biblioteca/Ferramenta Recomendada | Notas |
| :--- | :--- | :--- |
| **Componentes UI** | shadcn/ui (Radix UI) | Use componentes pré-construídos. Se for necessária customização, crie um novo componente em `src/components/` em vez de modificar os arquivos em `src/components/ui/`. |
| **Estilização** | Tailwind CSS | Utilize classes utilitárias extensivamente. Garanta a responsividade. |
| **Roteamento** | `react-router-dom` | Use `useNavigate`, `Link`, `Routes`, e `Route`. Mantenha as rotas principais em `src/App.tsx`. |
| **Notificações** | `sonner` | Use a função `toast` do `sonner` para todas as notificações de feedback ao usuário. |
| **Ícones** | `lucide-react` | Use para todos os ícones visuais. |
| **Backend/Dados** | Firebase SDK | Use as funções definidas em `src/lib/firebase.ts` para todas as interações de banco de dados e autenticação. |
| **APIs Externas** | `src/lib/tmdb.ts` | Use as funções utilitárias do TMDB para buscar metadados de conteúdo. |