import type { VercelRequest, VercelResponse } from '@vercel/node';

const EXTERNAL_API_BASE_URL = "https://unitviptvs.vercel.app/api/external/v1";
const EXTERNAL_API_KEY = "utv_9b82afa7d2e989968b4342b04ccb16c89c89be838a149374";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { endpoint, data } = req.body;

  if (!endpoint || !data) {
    return res.status(400).json({ error: 'Missing endpoint or data' });
  }

  // Validate endpoint
  const validEndpoints = ['clients', 'links'];
  if (!validEndpoints.includes(endpoint)) {
    return res.status(400).json({ error: 'Invalid endpoint' });
  }

  try {
    const response = await fetch(`${EXTERNAL_API_BASE_URL}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `CHAVE API: ${EXTERNAL_API_KEY}`,
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(result);
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Proxy Error:", error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
