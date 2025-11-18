export type AdPlacement = 
  | 'header' 
  | 'footer' 
  | 'sidebar' 
  | 'content-top' 
  | 'content-bottom' 
  | 'between-content'
  | 'player' 
  | 'mobile-bottom'
  | 'native';

export type AdNetwork = 'adsense' | 'admob' | 'custom' | 'other';
export type AdType = 'banner' | 'interstitial' | 'video' | 'native';

export interface Ad {
  id: string;
  name: string;
  code: string;
  placement: AdPlacement;
  network: AdNetwork;
  adType: AdType;
  active: boolean;
  description?: string;
  impressions?: number;
  clicks?: number;
  createdAt: string;
  updatedAt?: string;
}

export const AD_PLACEMENT_LABELS: Record<AdPlacement, string> = {
  'header': 'Cabeçalho (Topo)',
  'footer': 'Rodapé',
  'sidebar': 'Barra Lateral',
  'content-top': 'Topo do Conteúdo',
  'content-bottom': 'Final do Conteúdo',
  'between-content': 'Entre Conteúdos',
  'player': 'Player de Vídeo',
  'mobile-bottom': 'Mobile (Inferior)',
  'native': 'Native Ads',
};

export const AD_NETWORK_LABELS: Record<AdNetwork, string> = {
  'adsense': 'Google AdSense',
  'admob': 'Google AdMob',
  'custom': 'Personalizado',
  'other': 'Outro',
};

export const AD_TYPE_LABELS: Record<AdType, string> = {
  'banner': 'Banner',
  'interstitial': 'Intersticial',
  'video': 'Vídeo',
  'native': 'Native',
};

export const AD_NETWORK_INSTRUCTIONS: Record<AdNetwork, string> = {
  'adsense': `
1. Acesse Google AdSense: https://adsense.google.com
2. Navegue até Anúncios → Visão geral
3. Clique em "Por unidade de anúncio"
4. Crie uma nova unidade de anúncio
5. Copie o código HTML/JavaScript gerado
6. Cole o código no campo abaixo
  `,
  'admob': `
1. Acesse Google AdMob: https://admob.google.com
2. Vá em Apps → Unidades de anúncio
3. Crie uma nova unidade de anúncio para Web
4. Copie o código fornecido
5. Cole o código no campo abaixo
  `,
  'custom': `
Cole seu código personalizado de anúncio HTML/JavaScript.
Certifique-se de que o código é seguro e confiável.
  `,
  'other': `
Cole o código fornecido pelo seu provedor de anúncios.
Verifique as políticas de privacidade e uso.
  `,
};
