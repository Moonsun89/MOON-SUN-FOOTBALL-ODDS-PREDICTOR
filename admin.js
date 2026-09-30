const SUPABASE_URL = 'https://cztjomjhqudnmdngkcoi.supabase.co';
const SUPABASE_KEY = 'sb_secret_83-uWPX4oOO4UTY11AjAGQ_CsyL3zyZ';
const TRIAL_DAYS = 60;
const ADMIN_PASSWORD = 'MoonSun2026!';

async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  const data = await res.json().catch(()=>[]);
  return { ok: res.ok, data };
}

function trialInfo(createdAt) {
  const created = new Date(createdAt).getTime();
  if (!createdAt || isNaN(created)) {
    return { daysLeft: TRIAL_DAYS, trialActive: true };
  }
  const daysUsed = Math.max(0, Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24)));
  const daysLeft = Math.max(0, TRIAL_DAYS - daysUsed);
  return { daysLeft, trialActive: daysLeft > 0 };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Password si sahihi.' });
  }

  try {
    const shopsRes = await sb('shops?select=*&order=created_at.desc');
    const shops = (shopsRes.data || []).map(s => ({ ...s, ...trialInfo(s.created_at) }));

    const msgsRes = await sb('support_messages?select=*&order=ts.desc&limit=100');
    const shopMap = {};
    shops.forEach(s => shopMap[s.id] = s);
    const messages = (msgsRes.data || []).map(m => ({
      ...m,
      phone: shopMap[m.shop_id] ? shopMap[m.shop_id].phone : '?',
      business_name: shopMap[m.shop_id] ? shopMap[m.shop_id].business_name : null,
    }));

    return res.status(200).json({ shops, messages });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
