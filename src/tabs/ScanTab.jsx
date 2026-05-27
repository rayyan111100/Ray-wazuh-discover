import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { api } from '../api'
import { useApp } from '../context/AppContext'
import { parseDateStr, formatPretty } from '../utils'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const QUICK_TIMES = [
  { label: '15m', value: 'now-15m' },
  { label: '1h', value: 'now-1h' },
  { label: '6h', value: 'now-6h' },
  { label: '24h', value: 'now-24h' },
  { label: '7d', value: 'now-7d' },
  { label: '30d', value: 'now-30d' }
]

const SEV_CONFIG = [
  { key: 'critical', label: 'Critical', range: 'rule.level:>=12', color: '#dc2626', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/30', text: 'text-[#dc2626] dark:text-red-400', icon: '\uD83D\uDD34', bar: '#dc2626' },
  { key: 'high', label: 'High', range: 'rule.level:[7 TO 11]', color: '#ea580c', bg: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/30', text: 'text-[#ea580c] dark:text-orange-400', icon: '\uD83D\uDFE1', bar: '#ea580c' },
  { key: 'medium', label: 'Medium', range: 'rule.level:[3 TO 6]', color: '#ca8a04', bg: 'bg-yellow-50 dark:bg-yellow-500/10', border: 'border-yellow-200 dark:border-yellow-500/30', text: 'text-[#ca8a04] dark:text-yellow-400', icon: '\uD83D\uDFE0', bar: '#ca8a04' },
  { key: 'low', label: 'Low', range: 'rule.level:[1 TO 2]', color: '#16a34a', bg: 'bg-green-50 dark:bg-green-500/10', border: 'border-green-200 dark:border-green-500/30', text: 'text-[#16a34a] dark:text-green-400', icon: '\uD83D\uDFE2', bar: '#16a34a' }
]

const WINDOWS_EVENTS = [
  { id: 4624, label: 'Successful Logon', desc: 'User logged on', severity: 'info', query: 'rule.groups:authentication_success OR data.win.system.eventID:4624' },
  { id: 4625, label: 'Failed Logon', desc: 'Failed logon attempt', severity: 'high', query: 'rule.groups:authentication_failed OR data.win.system.eventID:4625' },
  { id: 4672, label: 'Admin Logon', desc: 'Special privileges assigned', severity: 'critical', query: 'data.win.system.eventID:4672' },
  { id: 4688, label: 'Process Created', desc: 'New process created', severity: 'medium', query: 'data.win.system.eventID:4688' },
  { id: 4719, label: 'Audit Policy Changed', desc: 'System audit policy modified', severity: 'critical', query: 'data.win.system.eventID:4719' },
  { id: 4720, label: 'User Account Created', desc: 'New user account created', severity: 'critical', query: 'data.win.system.eventID:4720' },
  { id: 4728, label: 'Group Member Added', desc: 'Member added to security group', severity: 'high', query: 'data.win.system.eventID:4728' },
  { id: 4740, label: 'Account Lockout', desc: 'User account locked out', severity: 'medium', query: 'data.win.system.eventID:4740' },
  { id: 1102, label: 'Log Cleared', desc: 'Security audit log cleared', severity: 'critical', query: 'data.win.system.eventID:1102' },
  { id: 7045, label: 'Service Installed', desc: 'New service installed', severity: 'high', query: 'data.win.system.eventID:7045' }
]

const SEV_EVENT_COLORS = { critical: '#dc2626', high: '#ea580c', medium: '#ca8a04', low: '#16a34a', info: '#2563eb' }

const KPI_METRICS = [
  { key: 'alertsPerSec', label: 'Alert Rate', suffix: '/s', icon: '\u26A1', color: '#3b82f6' },
  { key: 'uniqueAgents', label: 'Active Agents', suffix: '', icon: '\uD83D\uDDC5\uFE0F', color: '#8b5cf6' },
  { key: 'uniqueRules', label: 'Triggered Rules', suffix: '', icon: '\uD83D\uDCCA', color: '#06b6d4' }
]

const MITRE_TACTICS = [
  { id: 'TA0001', label: 'Initial Access', icon: '\uD83D\uDEAA' },
  { id: 'TA0002', label: 'Execution', icon: '\u25B6\uFE0F' },
  { id: 'TA0003', label: 'Persistence', icon: '\uD83D\uDD17' },
  { id: 'TA0004', label: 'Privilege Escalation', icon: '\u2B06\uFE0F' },
  { id: 'TA0005', label: 'Defense Evasion', icon: '\uD83D\uDEE1\uFE0F' },
  { id: 'TA0006', label: 'Credential Access', icon: '\uD83D\uDD11' },
  { id: 'TA0007', label: 'Discovery', icon: '\uD83D\uDD0D' },
  { id: 'TA0008', label: 'Lateral Movement', icon: '\u2194\uFE0F' },
  { id: 'TA0009', label: 'Collection', icon: '\uD83D\uDCC1' },
  { id: 'TA0011', label: 'Command & Control', icon: '\uD83D\uDCF6' },
  { id: 'TA0010', label: 'Exfiltration', icon: '\uD83D\uDCE4' },
  { id: 'TA0040', label: 'Impact', icon: '\uD83D\uDCA5' }
]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#1a1d27] border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-[#9ca3af] dark:text-[#6b7280] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <span className="font-semibold text-[#1a1c23] dark:text-white">{p.value?.toLocaleString() || p.value}</span></p>
      ))}
    </div>
  )
}

function FilterBtn({ field, value, label }) {
  const { addFilter, setTab } = useApp()
  const handle = (e) => { e.stopPropagation(); addFilter(field, value, false); setTab('discover') }
  return (
    <button onClick={handle} className="ml-auto p-1 rounded hover:bg-[#3b82f6]/20 text-[#9ca3af] dark:text-[#6b7280] hover:text-[#3b82f6] dark:hover:text-[#60a5fa] transition-all shrink-0 opacity-0 group-hover:opacity-100" title={'Filter by ' + label}>
      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M8 7h3.5a.5.5 0 1 1 0 1H8v3.5a.5.5 0 1 1-1 0V8H3.5a.5.5 0 0 1 0-1H7V3.5a.5.5 0 0 1 1 0V7Z"/></svg>
    </button>
  )
}

function PulseDot({ color = '#22c55e' }) {
  return (
    <span className="relative inline-flex w-1.5 h-1.5">
      <span className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ background: color }} />
      <span className="absolute inset-0 rounded-full" style={{ background: color }} />
    </span>
  )
}

export default function SecurityDashboard() {
  const { addFilter, setTab } = useApp()
  const [timeRange, setTimeRange] = useState('now-24h')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const intervalRef = useRef(null)
  const [scanTarget, setScanTarget] = useState('')
  const [scanResults, setScanResults] = useState(null)
  const [scanLoading, setScanLoading] = useState(false)

  const runScan = async () => {
    if (!scanTarget.trim()) return
    setScanLoading(true)
    try {
      const { apiPost } = await import('../api')
      const d = await apiPost('scan', { target: scanTarget.trim() })
      setScanResults(d)
    } catch (e) { setScanResults({ error: e.message }) }
    finally { setScanLoading(false) }
  }

  const timeParams = useCallback(() => {
    const sd = parseDateStr(timeRange).toISOString()
    const ed = parseDateStr('now').toISOString()
    return { start_date: sd, end_date: ed }
  }, [timeRange])

  const fetchData = useCallback(async () => {
    try {
      const tp = timeParams()
      const base = { start_date: tp.start_date, end_date: tp.end_date }
      const safe = (p) => p.catch(() => null)

      const [totalRes, timelineRes, agentsRes, rulesRes, descRes, recentRes, mitreRes, ...sevRes] = await Promise.all([
        safe(api('search', { ...base, size: 0, q: '*' })),
        safe(api('aggregate', { ...base, field: '@timestamp', type: 'date_histogram', interval: '1h', limit: 48 })),
        safe(api('search', { ...base, size: 0, q: '*', aggs: JSON.stringify({ agents: { terms: { field: 'agent.name.keyword', size: 10 } } }) })),
        safe(api('search', { ...base, size: 0, q: '*', aggs: JSON.stringify({ rules: { terms: { field: 'rule.level', size: 10 } } }) })),
        safe(api('search', { ...base, size: 0, q: '*', aggs: JSON.stringify({ desc: { terms: { field: 'rule.description.keyword', size: 8 } } }) })),
        safe(api('search', { ...base, size: 20, sort: '@timestamp:desc' })),
        safe(api('search', { ...base, size: 0, q: '*', aggs: JSON.stringify({ mitre: { terms: { field: 'rule.mitre.tactic.keyword', size: 12 } } }) })),
        ...SEV_CONFIG.map(s => safe(api('search', { ...base, size: 0, q: s.range })))
      ])

      const eventResults = await Promise.all(
        WINDOWS_EVENTS.map(e => safe(api('search', { ...base, size: 0, q: e.query })))
      )
      const eventCounts = {}
      WINDOWS_EVENTS.forEach((e, i) => { eventCounts[e.id] = eventResults[i]?.total || 0 })

      let agents = []
      if (agentsRes) {
        try {
          const a = typeof agentsRes.aggregations === 'string' ? JSON.parse(agentsRes.aggregations) : agentsRes.aggregations
          agents = (a?.agents?.buckets || []).slice(0, 8)
        } catch { agents = [] }
      }

      let rules = []
      if (rulesRes) {
        try {
          const r = typeof rulesRes.aggregations === 'string' ? JSON.parse(rulesRes.aggregations) : rulesRes.aggregations
          rules = (r?.rules?.buckets || []).slice(0, 8)
        } catch { rules = [] }
      }

      let descriptions = []
      if (descRes) {
        try {
          const d = typeof descRes.aggregations === 'string' ? JSON.parse(descRes.aggregations) : descRes.aggregations
          descriptions = (d?.desc?.buckets || []).slice(0, 8)
        } catch { descriptions = [] }
      }

      let mitreTactics = []
      if (mitreRes) {
        try {
          const m = typeof mitreRes.aggregations === 'string' ? JSON.parse(mitreRes.aggregations) : mitreRes.aggregations
          mitreTactics = (m?.mitre?.buckets || []).slice(0, 12)
        } catch { mitreTactics = [] }
      }

      const timeline = timelineRes?.buckets ? timelineRes.buckets.map(b => ({
        time: new Date(b.key).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        alerts: b.doc_count || 0
      })) : []

      const sevCounts = {}
      SEV_CONFIG.forEach((s, i) => { sevCounts[s.key] = sevRes[i]?.total || 0 })

      const total = totalRes?.total || 0
      const dur = parseDateStr('now').diff(parseDateStr(timeRange), 'second') || 1
      const alertsPerSec = total / dur
      const uniqueAgents = agents.length
      const uniqueRulesCount = rules.reduce((s, r) => s + r.doc_count, 0)

      setData({
        total,
        severity: sevCounts,
        timeline,
        agents,
        rules,
        descriptions,
        events: eventCounts,
        recent: (recentRes?.results || []).slice(0, 20),
        mitre: mitreTactics,
        kpi: { alertsPerSec, uniqueAgents, uniqueRules: uniqueRulesCount }
      })
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [timeParams])

  useEffect(() => {
    setLoading(true)
    fetchData()
    intervalRef.current = setInterval(fetchData, 30000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchData])

  const navToDiscover = (field, value) => { addFilter(field, value, false); setTab('discover') }
  const navToDiscoverQ = (q) => { addFilter('_dql', q, false); setTab('discover') }

  const severityPie = data ? Object.entries(data.severity).map(([k, v]) => {
    const cfg = SEV_CONFIG.find(s => s.key === k)
    return { name: cfg.label, value: v, color: cfg.color }
  }).filter(d => d.value > 0) : []

  const maxAgentCount = data?.agents?.length ? Math.max(...data.agents.map(a => a.doc_count)) : 1
  const maxDescCount = data?.descriptions?.length ? Math.max(...data.descriptions.map(d => d.doc_count)) : 1

  return (
    <div className="space-y-3 pb-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="gcard px-4 py-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <PulseDot />
            <span className="text-sm font-semibold text-[#1a1c23] dark:text-[#e4e6eb] whitespace-nowrap">{'\uD83D\uDEE1\uFE0F'} SOC Security</span>
          </div>
          <div className="h-4 w-px bg-[#e5e7eb] dark:bg-[#2d3140] hidden sm:block" />
          <div className="flex items-center gap-2 flex-1">
            <input type="text" value={scanTarget} onChange={e => setScanTarget(e.target.value)} placeholder="IP / Hostname / URL to scan..." className="ginput flex-1 min-w-0 py-1.5" onKeyDown={e => e.key === 'Enter' && runScan()} />
            <button onClick={runScan} disabled={scanLoading} className="gbtn-primary whitespace-nowrap">
              {scanLoading ? '\u23F3' : '\uD83D\uDD0D'} Scan
            </button>
          </div>
          {scanResults && (
            <button onClick={() => setScanResults(null)} className="text-[9px] text-[#9ca3af] dark:text-[#6b7280] hover:text-[#1a1c23] dark:hover:text-[#e4e6eb] shrink-0">\u2716</button>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {QUICK_TIMES.map(qt => (
            <button key={qt.value} onClick={() => setTimeRange(qt.value)}
              className={'gbtn text-[10px] px-2 py-1 ' + (timeRange === qt.value ? 'gbtn-primary' : 'gbtn-ghost')}>
              {qt.label}
            </button>
          ))}
        </div>
      </motion.div>

      {scanResults && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="gcard p-3 overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-[#9ca3af] dark:text-[#6b7280] uppercase tracking-wider">Scan Results: {scanTarget}</span>
            <span className="text-[9px] text-[#9ca3af] dark:text-[#6b7280]">{scanResults.error ? 'Error' : 'Success'}</span>
          </div>
          <pre className="text-[10px] text-[#6b7280] dark:text-[#9ca3af] leading-relaxed max-h-32 overflow-auto bg-[#f9fafb] dark:bg-[#0f1117] rounded p-2">{JSON.stringify(scanResults, null, 2)}</pre>
        </motion.div>
      )}

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[#fef2f2] dark:bg-red-500/10 border border-[#fecaca] dark:border-red-500/25 rounded-lg px-4 py-2.5 text-xs text-[#dc2626] dark:text-red-400 flex items-center gap-2">
          <span>{'\u26A0\uFE0F'}</span>
          <span>{error}</span>
        </motion.div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2.5">
        <div className="xl:col-span-1 flex items-stretch">
          <StatCard label="Total Alerts" value={data?.total} color="#3b82f6" bg="bg-blue-50 dark:bg-blue-500/10" border="border-blue-200 dark:border-blue-500/30" text="text-[#2563eb] dark:text-blue-400" icon={'\uD83D\uDD35'} onClick={() => navToDiscover('*', '*')} loading={loading} />
        </div>
        {SEV_CONFIG.map(s => (
          <StatCard key={s.key} label={s.label} value={data?.severity?.[s.key]} color={s.color} bg={s.bg} border={s.border} text={s.text} icon={s.icon} onClick={() => navToDiscover('rule.level', s.range)} loading={loading} />
        ))}
        <div className="hidden xl:flex xl:col-span-2 items-stretch">
          <div className="grid grid-cols-1 gap-2 w-full">
            {KPI_METRICS.map(k => (
              <KPICard key={k.key} label={k.label} value={data?.kpi?.[k.key]} suffix={k.suffix} icon={k.icon} color={k.color} loading={loading} />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <div className="gcard">
            <div className="px-4 py-3 border-b border-[#e5e7eb] dark:border-[#2d3140]/60">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">Alert Timeline</h3>
                <span className="gchip text-[9px]">{data?.timeline?.length || 0} points</span>
              </div>
            </div>
            {loading ? (
              <div className="h-52 m-4 bg-[#f3f4f6] dark:bg-[#2d3140] rounded-lg animate-pulse" />
            ) : (
              <div className="h-52 px-2 pt-2 pb-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data?.timeline || []} margin={{ top: 8, right: 12, bottom: 4, left: -20 }}>
                    <defs>
                      <linearGradient id="colorAlerts" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="alerts" stroke="#3b82f6" strokeWidth={2} fill="url(#colorAlerts)" dot={false} activeDot={{ r: 5, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="gcard h-full flex flex-col">
            <div className="px-4 py-3 border-b border-[#e5e7eb] dark:border-[#2d3140]/60">
              <h3 className="text-xs font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">Severity Distribution</h3>
            </div>
            {loading ? (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="w-36 h-36 rounded-full bg-[#f3f4f6] dark:bg-[#2d3140] animate-pulse" />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center px-4 py-3">
                {severityPie.length > 0 ? (
                  <div className="w-full max-w-[180px]">
                    <ResponsiveContainer width="100%" height={140}>
                      <PieChart>
                        <Pie data={severityPie} cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={3} dataKey="value" style={{ cursor: 'pointer' }}>
                          {severityPie.map((entry, i) => (
                            <Cell key={i} fill={entry.color} stroke="#fff" strokeWidth={2}
                              onClick={() => { const c = SEV_CONFIG.find(s => s.label === entry.name); if (c) navToDiscover('rule.level', c.range) }} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : <span className="text-xs text-[#9ca3af] dark:text-[#6b7280]">No data</span>}
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
                  {severityPie.map(d => {
                    const pct = data?.total ? ((d.value / data.total) * 100).toFixed(1) : 0
                    return (
                      <button key={d.name} onClick={() => { const c = SEV_CONFIG.find(s => s.label === d.name); if (c) navToDiscover('rule.level', c.range) }}
                        className="flex items-center gap-1 text-[10px] text-[#6b7280] dark:text-[#9ca3af] hover:text-[#1a1c23] dark:hover:text-[#e4e6eb] transition-colors">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: d.color }} />
                        {d.name} <span className="font-semibold">{pct}%</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">
        <div className="xl:col-span-3">
          <div className="gcard">
            <div className="px-4 py-3 border-b border-[#e5e7eb] dark:border-[#2d3140]/60">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">Critical Windows Security Events</h3>
                <span className="gchip text-[9px]">{Object.values(data?.events || {}).reduce((a, b) => a + b, 0).toLocaleString()}</span>
              </div>
            </div>
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 p-4">
                {Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-16 bg-[#f3f4f6] dark:bg-[#2d3140] rounded-lg animate-pulse" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 p-4">
                {WINDOWS_EVENTS.map(ev => {
                  const cnt = data?.events?.[ev.id] || 0
                  const sevColor = SEV_EVENT_COLORS[ev.severity] || '#6b7280'
                  return (
                    <button key={ev.id} onClick={() => navToDiscoverQ(ev.query)}
                      className="group relative flex flex-col items-start p-3 rounded-lg border border-[#e5e7eb] dark:border-[#2d3140] bg-white dark:bg-[#1a1d27] hover:bg-[#f9fafb] dark:hover:bg-[#2d3140]/50 hover:border-[#3b82f6]/40 dark:hover:border-[#60a5fa]/40 transition-all text-left hover:shadow-sm">
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-[11px] font-mono font-bold" style={{ color: sevColor }}>{ev.id}</span>
                        <FilterBtn field="data.win.system.eventID" value={ev.id} label={'Event ' + ev.id} />
                      </div>
                      <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af] leading-tight line-clamp-1 mb-1.5">{ev.label}</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-bold" style={{ color: sevColor }}>{cnt.toLocaleString()}</span>
                        <span className="text-[9px] text-[#9ca3af] dark:text-[#6b7280]">events</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-2">
          <div className="gcard h-full flex flex-col">
            <div className="px-4 py-3 border-b border-[#e5e7eb] dark:border-[#2d3140]/60">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">MITRE ATT&CK Tactics</h3>
                <span className="gchip text-[9px]">{(data?.mitre?.length || 0)}</span>
              </div>
            </div>
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-6 bg-[#f3f4f6] dark:bg-[#2d3140] rounded animate-pulse" />)}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {(data?.mitre?.length > 0 ? data.mitre : []).map((m, i) => {
                  const tactic = MITRE_TACTICS.find(t => m.key?.toLowerCase().includes(t.id.toLowerCase()) || t.label.toLowerCase().includes((m.key || '').toLowerCase()))
                  return (
                    <button key={m.key || i} onClick={() => navToDiscover('rule.mitre.tactic', m.key)}
                      className="flex items-center gap-2.5 w-full p-2 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140]/50 transition-colors text-left group">
                      <span className="text-sm">{tactic?.icon || '\uD83D\uDD35'}</span>
                      <span className="flex-1 text-xs text-[#1a1c23] dark:text-[#e4e6eb] truncate">{m.key || 'Unknown'}</span>
                      <span className="text-[10px] font-semibold text-[#6b7280] dark:text-[#9ca3af]">{m.doc_count}</span>
                      <FilterBtn field="rule.mitre.tactic" value={m.key} label={m.key} />
                    </button>
                  )
                })}
                {(!data?.mitre || data.mitre.length === 0) && (
                  <div className="text-center py-6"><span className="text-xs text-[#9ca3af] dark:text-[#6b7280]">No MITRE data available</span></div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="gcard">
          <div className="px-4 py-3 border-b border-[#e5e7eb] dark:border-[#2d3140]/60">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">Top Agents</h3>
              <span className="gchip text-[9px]">{(data?.agents?.length || 0)}</span>
            </div>
          </div>
          {loading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-7 bg-[#f3f4f6] dark:bg-[#2d3140] rounded animate-pulse" />)}</div>
          ) : (
            <div className="p-3 space-y-1">
              {(data?.agents?.length > 0 ? data.agents : []).map((a, i) => (
                <button key={a.key || i} onClick={() => navToDiscover('agent.name', a.key)}
                  className="flex items-center gap-2.5 w-full p-2 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140]/50 transition-colors text-left group">
                  <span className="text-[9px] font-mono text-[#9ca3af] dark:text-[#6b7280] w-3.5 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-[#1a1c23] dark:text-[#e4e6eb] truncate">{a.key}</span>
                      <span className="text-[10px] font-semibold text-[#6b7280] dark:text-[#9ca3af] ml-2">{a.doc_count}</span>
                    </div>
                    <div className="w-full h-1 bg-[#f3f4f6] dark:bg-[#2d3140] rounded-full overflow-hidden">
                      <div className="h-full bg-[#3b82f6] dark:bg-[#60a5fa] rounded-full transition-all duration-700" style={{ width: (a.doc_count / maxAgentCount) * 100 + '%' }} />
                    </div>
                  </div>
                  <FilterBtn field="agent.name" value={a.key} label={a.key} />
                </button>
              ))}
              {(!data?.agents || data.agents.length === 0) && (
                <div className="text-center py-6"><span className="text-xs text-[#9ca3af] dark:text-[#6b7280]">No agent data</span></div>
              )}
            </div>
          )}
        </div>

        <div className="gcard">
          <div className="px-4 py-3 border-b border-[#e5e7eb] dark:border-[#2d3140]/60">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">Top Rules by Description</h3>
              <span className="gchip text-[9px]">{(data?.descriptions?.length || 0)}</span>
            </div>
          </div>
          {loading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-7 bg-[#f3f4f6] dark:bg-[#2d3140] rounded animate-pulse" />)}</div>
          ) : (
            <div className="p-3 space-y-1">
              {(data?.descriptions?.length > 0 ? data.descriptions : []).map((d, i) => (
                <button key={d.key || i} onClick={() => navToDiscover('rule.description', d.key)}
                  className="flex items-center gap-2.5 w-full p-2 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140]/50 transition-colors text-left group">
                  <span className="text-[9px] font-mono text-[#9ca3af] dark:text-[#6b7280] w-3.5 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-[#1a1c23] dark:text-[#e4e6eb] truncate">{d.key || 'Unknown'}</span>
                      <span className="text-[10px] font-semibold text-[#6b7280] dark:text-[#9ca3af] ml-2">{d.doc_count}</span>
                    </div>
                    <div className="w-full h-1 bg-[#f3f4f6] dark:bg-[#2d3140] rounded-full overflow-hidden">
                      <div className="h-full bg-[#8b5cf6] rounded-full transition-all duration-700" style={{ width: (d.doc_count / maxDescCount) * 100 + '%' }} />
                    </div>
                  </div>
                  <FilterBtn field="rule.description" value={d.key} label={d.key} />
                </button>
              ))}
              {(!data?.descriptions || data.descriptions.length === 0) && (
                <div className="text-center py-6"><span className="text-xs text-[#9ca3af] dark:text-[#6b7280]">No rule description data</span></div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="gcard">
        <div className="px-4 py-3 border-b border-[#e5e7eb] dark:border-[#2d3140]/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">Recent Alerts</h3>
              <span className="gchip text-[9px]">{data?.recent?.length || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <PulseDot color="#3b82f6" />
              <span className="text-[9px] text-[#9ca3af] dark:text-[#6b7280]">30s refresh</span>
            </div>
          </div>
        </div>
        {loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-7 bg-[#f3f4f6] dark:bg-[#2d3140] rounded animate-pulse" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider text-[#9ca3af] dark:text-[#6b7280] border-b border-[#e5e7eb] dark:border-[#2d3140]/50">
                  <th className="text-left py-2.5 px-4 font-medium w-20">Time</th>
                  <th className="text-left py-2.5 px-3 font-medium w-12">Lvl</th>
                  <th className="text-left py-2.5 px-3 font-medium">Rule</th>
                  <th className="text-left py-2.5 px-3 font-medium hidden sm:table-cell">Agent</th>
                  <th className="text-left py-2.5 px-3 font-medium hidden md:table-cell">Description</th>
                  <th className="text-right py-2.5 px-4 font-medium w-8"></th>
                </tr>
              </thead>
              <tbody>
                {(data?.recent || []).map((r, i) => {
                  const lv = parseInt(r?.rule?.level) || 0
                  const badgeCls = lv >= 15 ? 'badge-critical' : lv >= 12 ? 'badge-high' : lv >= 7 ? 'badge-medium' : lv >= 1 ? 'badge-low' : 'badge-info'
                  return (
                    <tr key={r._id || i} className={'border-b border-[#e5e7eb]/50 dark:border-[#2d3140]/30 hover:bg-[#f9fafb]/50 dark:hover:bg-[#2d3140]/30 transition-colors group ' + (i % 2 === 0 ? '' : 'bg-[#f9fafb]/30 dark:bg-[#0f1117]/30')}>
                      <td className="py-2.5 px-4 whitespace-nowrap font-mono">
                        <button onClick={() => navToDiscover('@timestamp', r['@timestamp'])} className="text-[#6b7280] dark:text-[#9ca3af] hover:text-[#3b82f6] dark:hover:text-[#60a5fa] transition-colors text-[10px]">
                          {r['@timestamp'] ? new Date(r['@timestamp']).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '\u2014'}
                        </button>
                      </td>
                      <td className="py-2.5 px-3">
                        <button onClick={() => navToDiscover('rule.level', r?.rule?.level)} className={'text-[10px] badge ' + badgeCls + ' hover:opacity-80 transition-opacity'}>
                          {lv || '\u2014'}
                        </button>
                      </td>
                      <td className="py-2.5 px-3">
                        <button onClick={() => navToDiscover('rule.id', r?.rule?.id)} className="text-[#3b82f6] dark:text-[#60a5fa] hover:underline truncate max-w-[120px] block">
                          {(r?.rule?.id || '').toString()}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 hidden sm:table-cell">
                        <button onClick={() => navToDiscover('agent.name', r?.agent?.name)} className="text-[#1a1c23] dark:text-[#e4e6eb] hover:text-[#3b82f6] dark:hover:text-[#60a5fa] transition-colors truncate max-w-[100px] block">
                          {r?.agent?.name || '\u2014'}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 hidden md:table-cell">
                        <span className="text-[#6b7280] dark:text-[#9ca3af] truncate max-w-[200px] block text-[10px]">{r?.rule?.description || r?.rule?.groups?.[0] || ''}</span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <FilterBtn field="_id" value={r._id} label={'alert ' + (i + 1)} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {(!data?.recent || data.recent.length === 0) && (
              <div className="text-center py-10"><span className="text-xs text-[#9ca3af] dark:text-[#6b7280]">{'\uD83D\uDCC4'} No recent alerts found for this time range</span></div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] text-[#9ca3af] dark:text-[#6b7280] pt-1">
        <div className="flex items-center gap-3">
          <span>{'\uD83D\uDEE1\uFE0F'} SOC Dashboard &middot; Auto-refresh 30s</span>
          {data && <span className="hidden sm:inline">Last updated {new Date().toLocaleTimeString()}</span>}
        </div>
        <button onClick={fetchData} className="gbtn-ghost gap-1 inline-flex items-center">
          <svg className={'w-3 h-3 ' + (loading ? 'animate-spin' : '')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 4v6h6M23 20v-6h-6" /><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
          </svg>
          Refresh
        </button>
      </div>
    </div>
  )
}

function StatCard({ label, value, color, bg, border, text, icon, onClick, loading }) {
  return (
    <button onClick={onClick} disabled={!onClick} className={'relative overflow-hidden rounded-lg border text-left transition-all duration-200 p-3.5 ' + (onClick ? 'cursor-pointer hover:shadow-md active:scale-[0.98]' : '') + ' ' + bg + ' ' + border}>
      {loading ? (
        <div className="space-y-2">
          <div className="h-3 w-16 bg-[#e5e7eb] dark:bg-[#2d3140] rounded animate-pulse" />
          <div className="h-7 w-20 bg-[#e5e7eb] dark:bg-[#2d3140] rounded animate-pulse" />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[11px]">{icon}</span>
            <span className={'text-[10px] font-semibold uppercase tracking-wider ' + text}>{label}</span>
          </div>
          <div className={'text-2xl font-bold tracking-tight ' + text}>{typeof value === 'number' ? value.toLocaleString() : value || '\u2014'}</div>
        </>
      )}
    </button>
  )
}

function KPICard({ label, value, suffix, icon, color, loading }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-[#f9fafb] dark:bg-[#0f1117] border border-[#e5e7eb] dark:border-[#2d3140]/50">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: color + '15' }}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[9px] text-[#9ca3af] dark:text-[#6b7280] uppercase tracking-wider font-medium">{label}</div>
        {loading ? (
          <div className="h-4 w-14 bg-[#e5e7eb] dark:bg-[#2d3140] rounded mt-0.5 animate-pulse" />
        ) : (
          <div className="text-sm font-bold" style={{ color }}>{(value || 0).toLocaleString()}{suffix}</div>
        )}
      </div>
    </div>
  )
}
