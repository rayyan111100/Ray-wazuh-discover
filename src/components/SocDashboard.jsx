import React, { useState, useEffect, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts'
import { motion } from 'framer-motion'
import { api } from '../api'
import { useApp } from '../context/AppContext'
import { parseDateStr, formatPretty } from '../utils'

const SEV_LABELS = { Critical: { color: '#ef4444', min: 15 }, High: { color: '#f97316', min: 12 }, Medium: { color: '#eab308', min: 7 }, Low: { color: '#22c55e', min: 1 }, Info: { color: '#3b82f6', min: 0 } }
const SEV_ORDER = ['Critical', 'High', 'Medium', 'Low', 'Info']
const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#22c55e', '#eab308', '#f97316']

const QUICK_TIMES = [
  { label: '1h', value: 'now-1h' },
  { label: '6h', value: 'now-6h' },
  { label: '24h', value: 'now-24h' },
  { label: '7d', value: 'now-7d' },
  { label: '30d', value: 'now-30d' },
  { label: '90d', value: 'now-90d' }
]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0f1117]/95 border border-[#2d3140] rounded-lg px-3 py-2 text-xs shadow-2xl backdrop-blur-sm">
      <p className="text-[#6b7280] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <span className="font-semibold text-white">{p.value?.toLocaleString() || p.value}</span></p>
      ))}
    </div>
  )
}

function FilterBtn({ field, value, label }) {
  const { addFilter, setTab } = useApp()
  const handle = (e) => { e.stopPropagation(); addFilter(field, value, false); setTab('discover') }
  return (
    <button onClick={handle} className="ml-auto p-1 rounded-md hover:bg-[#3b82f6]/20 text-[#4b5563] hover:text-[#3b82f6] transition-all shrink-0 opacity-0 group-hover:opacity-100" title={'Filter by ' + label}>
      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M8 7h3.5a.5.5 0 1 1 0 1H8v3.5a.5.5 0 1 1-1 0V8H3.5a.5.5 0 0 1 0-1H7V3.5a.5.5 0 0 1 1 0V7Z"/></svg>
    </button>
  )
}

function Card({ children, className = '' }) {
  return <div className={'bg-[#16181f]/90 backdrop-blur-sm border border-[#2d3140] rounded-xl ' + className}>{children}</div>
}

function CardHeader({ title, subtitle, badge }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d3140]/60">
      <div className="flex items-center gap-2 min-w-0">
        <h3 className="text-xs font-semibold text-[#e4e6eb] truncate">{title}</h3>
        {badge && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#2d3140] text-[#6b7280] font-medium">{badge}</span>}
      </div>
      {subtitle && <span className="text-[9px] text-[#6b7280] hidden sm:inline">{subtitle}</span>}
    </div>
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

function toSeverity(level) {
  const n = parseInt(level) || 0
  for (const s of SEV_ORDER) if (n >= SEV_LABELS[s].min) return s
  return 'Info'
}

const SEV_RANGES = {
  Critical: 'rule.level:>=15',
  High: 'rule.level:[12 TO 14]',
  Medium: 'rule.level:[7 TO 11]',
  Low: 'rule.level:[1 TO 6]',
  Info: 'rule.level:[0 TO 0]'
}

export default function SocDashboard() {
  const { addFilter, setTab } = useApp()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [timeRange, setTimeRange] = useState('now-24h')
  const timerRef = useRef(null)

  const navToDiscover = (field, value) => { addFilter(field, value, false); setTab('discover') }

  const fetchDashboard = () => {
    const sd = parseDateStr(timeRange).toISOString()
    const ed = parseDateStr('now').toISOString()
    api('dashboard', { index: 'wazuh-alerts-4.x-*', start_date: sd, end_date: ed })
      .then(d => { setData(d); setError(null) })
      .catch(e => setError(e.message))
      .finally(() => { setLoading(false); setLastUpdated(new Date()) })
  }

  useEffect(() => {
    setLoading(true)
    fetchDashboard()
    timerRef.current = setInterval(fetchDashboard, 60000)
    return () => clearInterval(timerRef.current)
  }, [timeRange])

  if (loading) return (
    <div className="space-y-3">
      <div className="flex gap-1.5 flex-wrap">{QUICK_TIMES.map(qt => <div key={qt.value} className="h-7 w-10 bg-[#2d3140] rounded-lg animate-pulse" />)}</div>
      <div className="grid grid-cols-5 gap-2.5">{[1,2,3,4,5].map(i => <div key={i} className="h-24 bg-[#1e2030] rounded-xl animate-pulse" />)}</div>
      <div className="grid grid-cols-3 gap-3">{[1,2,3].map(i => <div key={i} className="h-52 bg-[#1e2030] rounded-xl animate-pulse" />)}</div>
    </div>
  )
  if (error) return (
    <div className="bg-[#16181f] border border-red-500/25 rounded-xl p-6 text-center">
      <div className="text-2xl mb-2">{'\u26A0\uFE0F'}</div>
      <div className="text-xs text-red-400 mb-3">{error}</div>
      <button onClick={fetchDashboard} className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#3b82f6] text-white hover:bg-[#2563eb] transition-all">Retry</button>
    </div>
  )
  if (!data) return null

  const { count24, count7d, count30d, byLevel, topRules, topAgents, timeline, categories, recent, recentTotal } = data

  const sevMap = {}
  for (const b of byLevel) { const s = toSeverity(b.key); sevMap[s] = (sevMap[s] || 0) + b.doc_count }
  const sevData = SEV_ORDER.filter(s => sevMap[s]).map(s => ({ name: s, value: sevMap[s], color: SEV_LABELS[s].color }))
  const sevTotal = sevData.reduce((a, b) => a + b.value, 0)

  const timelineData = (timeline || []).slice(-24).map(b => ({ time: new Date(b.key).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), alerts: b.doc_count }))

  const topRulesData = (topRules || []).slice(0, 8).map((b, i) => ({ name: b.key || `Rule ${i+1}`, count: b.doc_count }))
  const topAgentsData = (topAgents || []).slice(0, 8).map(b => ({ name: b.key || 'Unknown', count: b.doc_count }))
  const catData = (categories || []).slice(0, 6).map((b, i) => ({ name: (b.key || 'Other').slice(0, 20), value: b.doc_count, color: CHART_COLORS[i % CHART_COLORS.length] }))
  const maxRule = Math.max(1, ...topRulesData.map(r => r.count))
  const maxAgent = Math.max(1, ...topAgentsData.map(a => a.count))

  return (
    <div className="space-y-3">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between bg-[#16181f]/90 backdrop-blur-sm border border-[#2d3140] rounded-xl px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <PulseDot />
          <span className="text-sm font-bold text-[#e4e6eb]">{'\uD83D\uDCCA'} Security Overview</span>
          <span className="text-[10px] text-[#6b7280] bg-[#1e2030] px-2 py-0.5 rounded-full border border-[#2d3140]">
            {(count24 || 0).toLocaleString()} alerts
          </span>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {QUICK_TIMES.map(qt => (
            <button key={qt.value} onClick={() => setTimeRange(qt.value)}
              className={'px-2 py-1 text-[10px] font-medium rounded-lg transition-all ' + (timeRange === qt.value ? 'bg-[#3b82f6] text-white shadow-sm shadow-[#3b82f6]/20' : 'bg-[#1e2030] text-[#6b7280] hover:text-[#9ca3af] hover:bg-[#2d3140] border border-[#2d3140]')}>
              {qt.label}
            </button>
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-5 gap-2.5">
        {[
          { label: 'Total Alerts', value: count24, prev: count7d / 7, field: '*', val: '*', color: '#3b82f6' },
          { label: 'Last 7 Days', value: count7d, prev: count30d / 4, field: '*', val: '*', color: '#8b5cf6' },
          { label: 'Last 30 Days', value: count30d, prev: null, field: '*', val: '*', color: '#06b6d4' },
          { label: 'Alert Rate', value: Math.round(count24 / 24), prev: null, suffix: '/hr', field: '*', val: '*', color: '#22c55e' },
          { label: 'Recent', value: recentTotal, prev: null, field: '*', val: '*', color: '#eab308' }
        ].map((item, i) => {
          const pct = item.prev ? Math.round(((item.value - item.prev) / item.prev) * 100) : 0
          const isUp = pct > 0
          return (
            <motion.button key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              onClick={() => item.field === '*' ? setTab('discover') : navToDiscover(item.field, item.val)}
              className="bg-[#16181f]/90 backdrop-blur-sm border border-[#2d3140] rounded-xl p-3.5 text-left hover:border-[#3b82f6]/30 transition-all hover:shadow-lg group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] uppercase tracking-wider text-[#6b7280] font-semibold">{item.label}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#4b5563] opacity-0 group-hover:opacity-100 transition-opacity"><path d="M9 5l7 7-7 7"/></svg>
              </div>
              <div className="text-2xl font-bold text-[#e4e6eb]">{(item.value || 0).toLocaleString()}{item.suffix || ''}</div>
              {item.prev && pct !== 0 && (
                <div className={'text-[10px] font-medium mt-0.5 flex items-center gap-0.5 ' + (isUp ? 'text-red-400' : 'text-green-400')}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className={isUp ? '' : 'rotate-180'}><path d="M12 5l7 7-1.41 1.41L13 9.83V21h-2V9.83l-4.59 4.58L5 12l7-7z"/></svg>
                  {Math.abs(pct)}%
                </div>
              )}
            </motion.button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[#e4e6eb]">Alert Severity</h3>
            <span className="text-[9px] text-[#6b7280]">{(sevTotal || 0).toLocaleString()} total</span>
          </div>
          <div className="space-y-2.5">
            {sevData.map(s => {
              const pct = sevTotal ? Math.round((s.value / sevTotal) * 100) : 0
              return (
                <button key={s.name} onClick={() => navToDiscover('rule.level', SEV_RANGES[s.name])}
                  className="w-full text-left group">
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="flex items-center gap-1.5 text-[#d1d5db]">
                      <span>{s.name === 'Critical' ? '\uD83D\uDD34' : s.name === 'High' ? '\uD83D\uDFE1' : s.name === 'Medium' ? '\uD83D\uDFE0' : s.name === 'Low' ? '\uD83D\uDFE2' : '\uD83D\uDD35'}</span>
                      <span className="font-medium">{s.name}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="font-semibold" style={{ color: s.color }}>{s.value.toLocaleString()}</span>
                      <span className="text-[#4b5563] text-[10px]">({pct}%)</span>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#4b5563] opacity-0 group-hover:opacity-100 transition-opacity ml-0.5"><path d="M9 5l7 7-7 7"/></svg>
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#2d3140] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: pct + '%', backgroundColor: s.color }} />
                  </div>
                </button>
              )
            })}
            {sevData.length === 0 && <div className="text-xs text-[#6b7280] py-4 text-center">No data</div>}
          </div>
        </Card>

        <Card className="lg:col-span-2 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-[#e4e6eb]">Alert Timeline</h3>
            <span className="text-[9px] text-[#6b7280]">{formatPretty(timeRange, 'now')}</span>
          </div>
          <div className="h-44">
            {timelineData.length === 0 ? (
              <div className="text-xs text-[#6b7280] h-full flex items-center justify-center">No timeline data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#4b5563' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: '#4b5563' }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="alerts" stroke="#3b82f6" strokeWidth={2} fill="url(#tg)" dot={false} activeDot={{ r: 4, fill: '#3b82f6', stroke: '#16181f', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <div className="px-4 py-3 border-b border-[#2d3140]/60">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-[#e4e6eb]">Top Alert Rules</h3>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#2d3140] text-[#6b7280] font-medium">{topRulesData.length}</span>
            </div>
          </div>
          {topRulesData.length === 0 ? (
            <div className="text-xs text-[#6b7280] py-8 text-center">No data</div>
          ) : (
            <div className="p-3 space-y-1.5">
              {topRulesData.map((r, i) => (
                <button key={i} onClick={() => navToDiscover('rule.id', r.name)}
                  className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-[#1e2030] transition-colors group">
                  <span className="w-4 text-center text-[#4b5563] text-[10px] font-mono shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] text-[#d1d5db] truncate">{r.name}</span>
                      <span className="shrink-0 ml-2 text-[11px] font-semibold text-[#3b82f6]">{r.count.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-1 bg-[#2d3140] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[#3b82f6] transition-all duration-700" style={{ width: (r.count / maxRule) * 100 + '%' }} />
                    </div>
                  </div>
                  <FilterBtn field="rule.id" value={r.name} label={r.name} />
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="px-4 py-3 border-b border-[#2d3140]/60">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-[#e4e6eb]">Top Agents</h3>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#2d3140] text-[#6b7280] font-medium">{topAgentsData.length}</span>
            </div>
          </div>
          {topAgentsData.length === 0 ? (
            <div className="text-xs text-[#6b7280] py-8 text-center">No data</div>
          ) : (
            <div className="p-3 space-y-1.5">
              {topAgentsData.map((a, i) => (
                <button key={i} onClick={() => navToDiscover('agent.name', a.name)}
                  className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-[#1e2030] transition-colors group">
                  <span className="w-4 text-center text-[#4b5563] text-[10px] font-mono shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] text-[#d1d5db] truncate">{a.name}</span>
                      <span className="shrink-0 ml-2 text-[11px] font-semibold text-[#8b5cf6]">{a.count.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-1 bg-[#2d3140] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[#8b5cf6] transition-all duration-700" style={{ width: (a.count / maxAgent) * 100 + '%' }} />
                    </div>
                  </div>
                  <FilterBtn field="agent.name" value={a.name} label={a.name} />
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[#e4e6eb]">Alert Categories</h3>
            <span className="text-[9px] text-[#6b7280]">{catData.length}</span>
          </div>
          <div className="h-44 flex items-center justify-center">
            {catData.length === 0 ? (
              <div className="text-xs text-[#6b7280]">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={catData} cx="50%" cy="50%" innerRadius={42} outerRadius={68} dataKey="value" paddingAngle={2} style={{ cursor: 'pointer' }}>
                    {catData.map((e, i) => (
                      <Cell key={i} fill={e.color} stroke="#16181f" strokeWidth={2}
                        onClick={() => navToDiscover('rule.groups', e.name)} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 justify-center">
            {catData.map((c, i) => (
              <button key={i} onClick={() => navToDiscover('rule.groups', c.name)}
                className="inline-flex items-center gap-1 text-[10px] text-[#6b7280] hover:text-[#9ca3af] transition-colors">
                <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: c.color }} />
                <span className="truncate max-w-[80px]">{c.name}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="px-4 py-3 border-b border-[#2d3140]/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-[#e4e6eb]">Recent Alerts</h3>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#2d3140] text-[#6b7280] font-medium">{recent?.length || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <PulseDot color="#3b82f6" />
                <span className="text-[9px] text-[#6b7280]">60s refresh</span>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-[#4b5563] text-[9px] uppercase tracking-wider border-b border-[#2d3140]/50">
                  <th className="text-left py-2.5 px-4 font-medium w-20">Time</th>
                  <th className="text-left py-2.5 px-3 font-medium w-10">Lvl</th>
                  <th className="text-left py-2.5 px-3 font-medium">Rule</th>
                  <th className="text-left py-2.5 px-3 font-medium hidden sm:table-cell">Agent</th>
                  <th className="text-left py-2.5 px-3 font-medium hidden md:table-cell">Description</th>
                  <th className="text-right py-2.5 px-4 font-medium w-8"></th>
                </tr>
              </thead>
              <tbody>
                {(recent || []).slice(0, 6).map((r, i) => {
                  const lv = r.rule?.level || 0
                  const lvCls = lv >= 15 ? 'bg-red-500/15 text-red-400' : lv >= 12 ? 'bg-orange-500/15 text-orange-400' : lv >= 7 ? 'bg-yellow-500/15 text-yellow-400' : lv >= 1 ? 'bg-green-500/15 text-green-400' : 'bg-blue-500/15 text-blue-400'
                  return (
                    <tr key={i} className={'border-b border-[#2d3140]/30 hover:bg-[#1e2030]/50 transition-colors group ' + (i % 2 === 0 ? '' : 'bg-[#16181f]/30')}>
                      <td className="py-2.5 px-4 whitespace-nowrap font-mono">
                        <button onClick={() => navToDiscover('@timestamp', r['@timestamp'])} className="text-[#6b7280] hover:text-[#3b82f6] transition-colors text-[10px]">
                          {r['@timestamp'] ? new Date(r['@timestamp']).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                        </button>
                      </td>
                      <td className="py-2.5 px-3">
                        <button onClick={() => navToDiscover('rule.level', r.rule?.level)} className={'px-1.5 py-0.5 rounded text-[10px] font-bold ' + lvCls + ' hover:opacity-80 transition-opacity'}>
                          {lv || '--'}
                        </button>
                      </td>
                      <td className="py-2.5 px-3">
                        <button onClick={() => navToDiscover('rule.id', r.rule?.id)} className="text-[#9ca3af] hover:text-[#3b82f6] transition-colors truncate max-w-[100px] block">
                          {r.rule?.id || '--'}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 hidden sm:table-cell">
                        <button onClick={() => navToDiscover('agent.name', r.agent?.name)} className="text-[#6b7280] hover:text-[#3b82f6] transition-colors truncate max-w-[100px] block">
                          {r.agent?.name || '--'}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 hidden md:table-cell">
                        <span className="text-[#4b5563] truncate max-w-[160px] block text-[10px]">{r.rule?.description || '--'}</span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <FilterBtn field="_id" value={r._id} label={'alert ' + (i + 1)} />
                      </td>
                    </tr>
                  )
                })}
                {recent.length === 0 && (
                  <tr><td colSpan={6} className="py-10 text-center text-[#6b7280] text-xs">{'\uD83D\uDCC4'} No recent alerts</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="flex items-center justify-between text-[9px] text-[#4b5563] pt-1">
        <div className="flex items-center gap-3">
          <span>{'\uD83D\uDCCA'} Dashboard &middot; Auto-refresh 60s</span>
          <span className="hidden sm:inline">Last: {lastUpdated.toLocaleTimeString()}</span>
        </div>
        <button onClick={fetchDashboard} className="flex items-center gap-1 px-2.5 py-1 rounded-md hover:bg-[#1e2030] transition-colors">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 4v6h6M23 20v-6h-6" /><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
          </svg>
          Refresh
        </button>
      </div>
    </div>
  )
}
