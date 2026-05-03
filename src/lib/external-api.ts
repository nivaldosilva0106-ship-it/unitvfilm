import { getSiteSettings } from "./firebase";

export interface ExternalClientData {
  nome_usuario: string;
  login_usuario: string;
  senha_usuario: string;
}

export interface ExternalLinkData {
  tipo?: "movie" | "series" | "tv";
  nome_link: string;
  link_link: string;
  logo?: string;
  id_categoria?: string;
  categoria?: string;
  tmdb_id?: string;
}

/**
 * Fetches the IPTV credentials from Firebase site settings
 */
const getIPTVCredentials = async () => {
  const settings = await getSiteSettings();
  const apiKey = settings.iptvApiKey;
  const baseUrl = settings.iptvApiBaseUrl;

  if (!apiKey || !baseUrl) {
    throw new Error("API IPTV não configurada. Vá em Admin > Configurações e preencha a Chave API e URL Base do UniTvIPTV.");
  }

  return { apiKey, baseUrl };
};

/**
 * Creates a new trial client via the internal proxy
 */
export const createExternalIPTVClient = async (data: ExternalClientData) => {
  const { apiKey, baseUrl } = await getIPTVCredentials();

  const response = await fetch("/api/external-proxy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      endpoint: "clients",
      data,
      apiKey,
      baseUrl
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.message || result.error || "Erro ao criar cliente externo");
  }

  return result;
};

/**
 * Syncs content via the internal proxy
 */
export const syncContentToExternal = async (data: ExternalLinkData) => {
  const { apiKey, baseUrl } = await getIPTVCredentials();

  const response = await fetch("/api/external-proxy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      endpoint: "links",
      data,
      apiKey,
      baseUrl
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.message || result.error || "Erro ao sincronizar conteúdo externo");
  }

  return result;
};
