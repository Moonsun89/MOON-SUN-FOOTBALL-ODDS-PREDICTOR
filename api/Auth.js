const SUPABASE_URL = 'https://cztjomjhqudnmdngkcoi.supabase.co';
const SUPABASE_KEY = 'sb_secret_83-uWPX4oOO4UTY11AjAGQ_CsyL3zyZ';
const TRIAL_DAYS = 60;

async function sb(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=representation',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  return { ok: res.ok, status: res.status, data };
}

function trialInfo(createdAt) {
  const created = new Date(createdAt).getTime();
  if (!createdAt || isNaN(created)) {
    return { daysUsed: 0, daysLeft: TRIAL_DAYS, trialActive: true };
  }
  const now = Date.now();
  const daysUsed = Math.max(0, Math.floor((now - created) / (1000 * 60 * 60 * 24)));
  const daysLeft = Math.max(0, TRIAL_DAYS - daysUsed);
  return { daysUsed, daysLeft, trialActive: daysLeft > 0 };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, phone, pin, business_name, shop_id } = req.body || {};

  if ((action === 'signup' || action === 'login') && (!phone || !pin)) {
    return res.status(400).json({ error: 'Namba ya simu na PIN vinahitajika.' });
  }

  try {
    if (action === 'signup') {
      const existing = await sb(`shops?phone=eq.${encodeURIComponent(phone)}`);
      if (existing.ok && existing.data && existing.data.length > 0) {
        return res.status(409).json({ error: 'Namba hii tayari imesajiliwa. Jaribu kuingia (login).' });
      }

      const created = await sb('shops', {
        method: 'POST',
        body: JSON.stringify([{ phone, pin, business_name: business_name || null }]),
      });
      if (!created.ok) {
        return res.status(500).json({ error: 'Imeshindwa kusajili akaunti.', details: created.data });
      }
      const shop = created.data[0];
      return res.status(200).json({ shop_id: shop.id, business_name: shop.business_name, ...trialInfo(shop.created_at) });
    }

    if (action === 'login') {
      const found = await sb(`shops?phone=eq.${encodeURIComponent(phone)}&pin=eq.${encodeURIComponent(pin)}`);
      if (!found.ok || !found.data || found.data.length === 0) {
        return res.status(401).json({ error: 'Namba ya simu au PIN si sahihi.' });
      }
      const shop = found.data[0];
      return res.status(200).json({ shop_id: shop.id, business_name: shop.business_name, ...trialInfo(shop.created_at) });
    }

    if (action === 'status') {
      if (!shop_id) return res.status(400).json({ error: 'shop_id inahitajika.' });
      const found = await sb(`shops?id=eq.${encodeURIComponent(shop_id)}`);
      if (!found.ok || !found.data || found.data.length === 0) {
        return res.status(404).json({ error: 'Akaunti haikupatikana.' });
      }
      const shop = found.data[0];
      return res.status(200).json({ shop_id: shop.id, business_name: shop.business_name, ...trialInfo(shop.created_at) });
    }

    return res.status(400).json({ error: 'Kitendo (action) hakieleweki.' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
