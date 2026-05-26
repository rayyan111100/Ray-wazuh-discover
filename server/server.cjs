require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const API = process.env.WAZUH_API_URL;
const WUSER = process.env.WAZUH_USER;
const WPASS = process.env.WAZUH_PASSWORD;

app.use(cors());
app.use(express.json());

// Serve built React app (dist/) in production, fallback to public/
const distPath = path.join(__dirname, '..', 'dist');
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(distPath));
app.use(express.static(publicPath));

// --- Wazuh API JWT Auth ---
let token = null;
let tokenExpiry = 0;

async function authenticate() {
  if (!WUSER || !WPASS) {
    console.warn('⚠ WAZUH_USER or WAZUH_PASSWORD not set — using no auth');
    return;
  }
  try {
    const creds = Buffer.from(`${WUSER}:${WPASS}`).toString('base64');
    const { data } = await axios.post(`${API}/security/user/authenticate`, null, {
      headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/json' }
    });
    token = data.data?.token || data.token;
    tokenExpiry = Date.now() + 300000; // 5 min, refresh before expiry
    console.log('✔ Wazuh API authenticated');
  } catch (err) {
    token = null;
    console.error('✖ Auth failed:', err.response?.data?.message || err.message);
  }
}

const api = axios.create({ baseURL: API, timeout: 120000 });

// Attach auth token to every request
api.interceptors.request.use(async config => {
  if (WUSER && WPASS) {
    if (!token || Date.now() > tokenExpiry) await authenticate();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-auth on startup
if (WUSER && WPASS) authenticate();

async function proxy(endpoint, params, res) {
  try {
    const { data } = await api.get(endpoint, { params });
    res.json(data);
  } catch (err) {
    const msg = err.response?.data || err.message;
    res.status(500).json({ error: msg });
  }
}

const ENDPOINTS = ['health', 'indices', 'index-stats', 'fields', 'search', 'count', 'scan', 'aggregate', 'geo'];
for (const ep of ENDPOINTS) {
  app.get(`/api/${ep}`, (req, res) => proxy(`/${ep}`, req.query, res));
}

app.post('/api/scan', (req, res) => proxy('/scan', req.body, res));
app.post('/api/search', (req, res) => proxy('/search', req.body, res));

// SOC Dashboard Aggregation Endpoint
app.get('/api/dashboard', async (req, res) => {
  const { index, start_date, end_date } = req.query;
  const idx = index || 'wazuh-alerts-4.x-*';
  const sd = start_date || 'now-24h';
  const ed = end_date || 'now';
  try {
    const [
      count24, count7d, count30d,
      byLevel, topRules, topAgents,
      timeline, categories, recent
    ] = await Promise.all([
      api.get('/count', { params: { index: idx, start_date: sd, end_date: ed } }).catch(() => ({ data: { count: 0 } })),
      api.get('/count', { params: { index: idx, start_date: 'now-7d', end_date: 'now' } }).catch(() => ({ data: { count: 0 } })),
      api.get('/count', { params: { index: idx, start_date: 'now-30d', end_date: 'now' } }).catch(() => ({ data: { count: 0 } })),
      api.get('/aggregate', { params: { index: idx, field: 'rule.level', type: 'terms', start_date: sd, end_date: ed, limit: 20 } }).catch(() => ({ data: { buckets: [] } })),
      api.get('/aggregate', { params: { index: idx, field: 'rule.id', type: 'terms', start_date: sd, end_date: ed, limit: 10 } }).catch(() => ({ data: { buckets: [] } })),
      api.get('/aggregate', { params: { index: idx, field: 'agent.name', type: 'terms', start_date: sd, end_date: ed, limit: 10 } }).catch(() => ({ data: { buckets: [] } })),
      api.get('/aggregate', { params: { index: idx, field: '@timestamp', type: 'date_histogram', interval: '1h', start_date: sd, end_date: ed, limit: 48 } }).catch(() => ({ data: { buckets: [] } })),
      api.get('/aggregate', { params: { index: idx, field: 'rule.category', type: 'terms', start_date: sd, end_date: ed, limit: 10 } }).catch(() => ({ data: { buckets: [] } })),
      api.get('/search', { params: { index: idx, limit: 10, sort: '@timestamp', order: 'desc', start_date: sd, end_date: ed, q: '' } }).catch(() => ({ data: { results: [], total: 0 } }))
    ]);
    res.json({
      count24: count24.data.count || 0,
      count7d: count7d.data.count || 0,
      count30d: count30d.data.count || 0,
      byLevel: byLevel.data.buckets || [],
      topRules: topRules.data.buckets || [],
      topAgents: topAgents.data.buckets || [],
      timeline: timeline.data.buckets || [],
      categories: categories.data.buckets || [],
      recent: recent.data.results || [],
      recentTotal: recent.data.total || 0
    });
  } catch (err) {
    console.error('Dashboard error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// SPA fallback: serve index.html for any non-API route
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  const publicIndex = path.join(publicPath, 'index.html');
  if (require('fs').existsSync(indexPath)) return res.sendFile(indexPath);
  if (require('fs').existsSync(publicIndex)) return res.sendFile(publicIndex);
  res.status(404).send('Not found');
});

app.use((req, res, next) => { res.setTimeout(120000); next(); });
app.listen(PORT, () => {
  console.log(`✔ Wazuh Dashboard at http://localhost:${PORT}`);
  console.log(`✔ Proxy → ${API}`);
});
