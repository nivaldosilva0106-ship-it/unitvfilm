const EXTERNAL_API_BASE_URL = "https://unitviptvs.vercel.app/api/external/v1";
const EXTERNAL_API_KEY = "utv_9b82afa7d2e989968b4342b04ccb16c89c89be838a149374";

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
  tmdb_id?: string;
}

/**
 * Creates a new trial client via the internal proxy
 */
export const createExternalIPTVClient = async (data: ExternalClientData) => {
  try {
    const response = await fetch("/api/external-proxy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        endpoint: "clients",
        data: data
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || result.error || "Erro ao criar cliente externo");
    }

    return result;
  } catch (error: any) {
    console.error("Proxy API Error (createClient):", error);
    throw error;
  }
};

/**
 * Syncs content via the internal proxy
 */
export const syncContentToExternal = async (data: ExternalLinkData) => {
  try {
    const response = await fetch("/api/external-proxy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        endpoint: "links",
        data: data
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || result.error || "Erro ao sincronizar conteúdo externo");
    }

    return result;
  } catch (error: any) {
    console.error("Proxy API Error (syncContent):", error);
    throw error;
  }
};
