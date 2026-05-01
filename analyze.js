export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image, mime, symptoms } = req.body;
  if (!image) return res.status(400).json({ error: 'No image provided' });

  const symptomsText = symptoms || 'No description — analyze from image only.';

  const prompt = `You are DermBot, a skincare education assistant for South Asian users.

FIRST — check if the image shows human skin (face, neck, back, chest, arms etc.).
If NOT skin (book, food, object, animal, text), respond ONLY with:
{"not_skin":true,"message":"This doesn't look like a skin photo. Please upload a clear photo of the skin area."}

If IS skin, respond ONLY with this JSON — no markdown, no extra text:
{"condition":"Short name e.g. Mild inflammatory acne","severity":"mild or moderate or severe","explanation":"2-3 sentences starting with Your skin shows signs of...","triggers":"2-3 sentences about likely causes","routine_am":["Step 1: ...","Step 2: ...","Step 3: ..."],"routine_pm":["Step 1: ...","Step 2: ...","Step 3: ..."],"use":["ingredient 1","ingredient 2","ingredient 3"],"avoid":["ingredient 1","ingredient 2"],"doctor":"One sentence: see a dermatologist if..."}

Only OTC-safe ingredients. Never prescriptions. Consider South Asian hyperpigmentation.
User description: "${symptomsText}"`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mime};base64,${image}`, detail: 'high' } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });

    let raw = data.choices[0].message.content.trim().replace(/```json|```/g, '');
    const result = JSON.parse(raw);
    return res.status(200).json(result);

  } catch (e) {
    return res.status(500).json({ error: 'AI error. Please try again.' });
  }
}
