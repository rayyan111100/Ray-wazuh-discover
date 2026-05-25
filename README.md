# Wazuh SOC Dashboard

A custom Security Operations Center (SOC) dashboard that connects to Wazuh API and displays security events with Discover (search/explore), Scan, Analytics, Geo, and Health tabs.

![Dashboard Screenshot](output/Screenshot%202026-05-25%20142122.png)

---

## Project History

### What was built

- **Single-page dashboard** (`public/index.html`) with 6 tabs: Discover, Scan, Analytics, Geo, Health
- **Node.js/Express backend** (`server/server.js`) that serves static files and proxies all API calls to Wazuh
- **Wazuh API helper** (`server/wazuhApi.js`)
- **Dark/Light/System theme** toggle with CSS variables
- **Discover tab**: field sidebar, DQL search input, time range & limit selectors, histogram, results table with row expansion (`<pre>` JSON view), toggle columns, field stats on click
- **Scan tab**: scroll/scan queries with results table
- **Analytics tab**: top rules, top agents, severity distribution bar charts
- **Geo tab**: geo-location cards by source IP
- **Health tab**: Wazuh cluster health, indices list, index stats

### Changes made

| Date | Change |
|------|--------|
| Initial | Created project structure, server, proxy endpoints, single-page HTML dashboard |
| Reverted | Removed OpenSearch Dashboards-style query bar, filter bar, Table/JSON doc tabs, field action buttons, type icons — restored original simple `disc-top` bar + `<pre>` JSON expand |
| Git init | Initialized git repo and pushed to GitHub |
| Screenshot | Added dashboard screenshot (`output/Screenshot 2026-05-25 142122.png`) |

---

## Setup

### Prerequisites

- Node.js (v18+)
- Wazuh API endpoint (default: `http://192.168.1.77:9999`)

### Environment

Create `.env` in project root:

```
WAZUH_API_URL=http://192.168.1.77:9999
PORT=3000
```

### Install & Run

```bash
npm install
npm start
```

Dashboard at **http://localhost:3000**

### Dev mode (auto-restart on changes)

```bash
npm run dev
```

---

## API Endpoints Proxied

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Wazuh cluster health |
| `/api/indices` | GET | List indices |
| `/api/index-stats` | GET | Index statistics |
| `/api/fields` | GET | Index field mappings |
| `/api/search` | GET/POST | Search documents |
| `/api/count` | GET | Document count |
| `/api/scan` | GET/POST | Scroll scan |
| `/api/aggregate` | GET | Aggregations |
| `/api/geo` | GET | Geo-location data |

---

## GitHub

Repository: https://github.com/Gopal-DevSecOps/wazuh-discover.git
