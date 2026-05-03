import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { endpoint, data, apiKey, baseUrl } = req.body;

  if (!endpoint || !data) {
    return res.status(400).json({ error: 'Missing endpoint or data' });
  }

  if (!apiKey || !baseUrl) {
    return res.status(400).json({ error: 'Missing API credentials. Configure them in Admin > Settings.' });
  }

  // Validate endpoint
  const validEndpoints = ['clients', 'links'];
  if (!validEndpoints.includes(endpoint)) {
    return res.status(400).json({ error: 'Invalid endpoint' });
  }

  try {
    const url = `${baseUrl.replace(/\/+$/, '')}/${endpoint}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(data),
    });

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      return res.status(response.status).json({ 
        error: `External API returned non-JSON response (${response.status})`,
        body: text.substring(0, 500)
      });
    }
    
    if (!response.ok) {
      return res.status(response.status).json(result);
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Proxy Error:", error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
