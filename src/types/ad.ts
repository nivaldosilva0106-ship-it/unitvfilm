export interface Ad {
  id: string;
  name: string;
  code: string;
  placement: 'header' | 'footer' | 'sidebar' | 'content-top' | 'content-bottom' | 'player';
  active: boolean;
  createdAt: string;
}
