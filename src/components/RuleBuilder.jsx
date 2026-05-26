import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { getAllRules, createRule, updateRule, deleteRule, toggleRuleEnabled, createId } from '../services/ruleStorage'
import { evalRule, interpolateMessage } from '../services/ruleEngine'
import { resolveField } from '../utils'
import { api } from '../api'

const FIELDS = [
  'rule.description', 'rule.id', 'rule.level', 'rule.category', 'rule.groups', 'rule.firedtimes', 'rule.mail',
  'agent.name', 'agent.id', 'agent.ip',
  'decoder.name', 'decoder.parent', 'full_log', 'location', 'input.type',
  'predecoder.program_name', 'predecoder.hostname', 'predecoder.timestamp', 'manager.name',
  'data.srcip', 'data.dstip', 'data.srcport', 'data.dstport', 'data.protocol', 'data.url',
  'data.status', 'data.action', 'data.user', 'data.uid', 'data.gid',
  'data.system_name', 'data.host', 'data.file.path', 'data.file.name',
  'data.win.eventdata', 'data.ssh.method', 'data.ssh.auth',
  '@timestamp', 'timestamp', 'id', '_id', '_index'
]

const OPERATORS = ['equals', 'contains', 'regex', 'startsWith', 'endsWith', 'gt', 'lt', 'inList', 'exists']
const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info']

function cleanRule(r) {
  return {
    ...r,
    name: r.name || '',
    conditionLogic: r.conditionLogic === 'OR' ? 'OR' : 'AND',
    conditions: (r.conditions || []).map(c => ({ ...c, field: c.field || 'rule.description', operator: c.operator || 'contains', value: c.value || '', negate: !!c.negate })),
    ignoreIps: r.ignoreIps || [],
    actions: (r.actions || []).map(a => ({ ...a, params: a.params || {} })),
    priority: r.priority ?? 100,
    overwrite: !!r.overwrite,
    enabled: r.enabled !== false
  }
}

export default function RuleBuilder() {
  const [rules, setRules] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [testData, setTestData] = useState(null)
  const [testResults, setTestResults] = useState(null)
  const [testLoading, setTestLoading] = useState(false)
  const [showTest, setShowTest] = useState(false)

  const refresh = useCallback(() => setRules(getAllRules()), [])

  useEffect(() => { refresh() }, [refresh])

  function handleSelect(id) {
    if (dirty && editing) updateRule(editing.id, editing)
    setSelectedId(id)
    const r = getAllRules().find(x => x.id === id)
    setEditing(r ? cleanRule(JSON.parse(JSON.stringify(r))) : null)
    setDirty(false)
  }

  function handleNew() {
    const r = createRule({ name: 'New Rule' })
    refresh()
    setSelectedId(r.id)
    setEditing(cleanRule(JSON.parse(JSON.stringify(r))))
    setDirty(false)
  }

  function handleSave() {
    if (!editing?.id) return
    updateRule(editing.id, editing)
    setDirty(false)
    refresh()
  }

  function handleDelete() {
    if (!editing?.id) return
    deleteRule(editing.id)
    setSelectedId(null)
    setEditing(null)
    setDirty(false)
    refresh()
  }

  function patch(p) { setEditing(prev => prev ? { ...prev, ...p } : null); setDirty(true) }

  function addCondition() {
    setEditing(prev => prev ? { ...prev, conditions: [...prev.conditions, { id: 'c_' + Date.now(), field: 'rule.description', operator: 'contains', value: '', negate: false }] } : null)
    setDirty(true)
  }

  function updCondition(idx, p) {
    setEditing(prev => { if (!prev) return prev; const c = [...prev.conditions]; c[idx] = { ...c[idx], ...p }; return { ...prev, conditions: c } })
    setDirty(true)
  }

  function delCondition(idx) {
    setEditing(prev => prev ? { ...prev, conditions: prev.conditions.filter((_, i) => i !== idx) } : null)
    setDirty(true)
  }

  function addAction() {
    setEditing(prev => prev ? { ...prev, actions: [...prev.actions, { type: 'alert', params: { severity: 'high', level: null, message: '' } }] } : null)
    setDirty(true)
  }

  function updAction(idx, p) {
    setEditing(prev => { if (!prev) return prev; const a = [...prev.actions]; a[idx] = { ...a[idx], ...p }; return { ...prev, actions: a } })
    setDirty(true)
  }

  function delAction(idx) {
    setEditing(prev => prev ? { ...prev, actions: prev.actions.filter((_, i) => i !== idx) } : null)
    setDirty(true)
  }

  function addIgnoreIp(ip) {
    if (!editing || !ip.trim()) return
    setEditing(prev => ({ ...prev, ignoreIps: [...(prev?.ignoreIps || []), ip.trim()] }))
    setDirty(true)
  }

  function removeIgnoreIp(idx) {
    setEditing(prev => ({ ...prev, ignoreIps: (prev?.ignoreIps || []).filter((_, i) => i !== idx) }))
    setDirty(true)
  }

  function computeSeverity(act, doc) {
    const lvl = parseInt(resolveField(doc, 'rule.level'))
    if (isNaN(lvl)) return act.params?.severity || 'high'
    if (lvl >= 12) return 'critical'
    if (lvl >= 8) return 'high'
    if (lvl >= 5) return 'medium'
    if (lvl >= 3) return 'low'
    return 'info'
  }

  async function runTest() {
    if (!editing) return
    setTestLoading(true); setTestResults(null)
    try {
      const d = await api('search', { limit: 50, sort: '@timestamp', order: 'desc' })
      setTestData(d.results || [])
      const results = (d.results || []).map(doc => {
        const result = evalRule(editing, doc)
        const actions = result.matched ? (editing.actions || []).map(a => ({
          ...a,
          computedSeverity: a.type === 'alert' ? computeSeverity(a, doc) : null,
          interpolated: a.type === 'alert' ? interpolateMessage(a.params?.message || '', doc) : null
        })) : []
        return { timestamp: resolveField(doc, '@timestamp'), ruleDesc: resolveField(doc, 'rule.description'), ruleLevel: resolveField(doc, 'rule.level'), agentName: resolveField(doc, 'agent.name'), ...result, actions }
      })
      setTestResults(results)
      setShowTest(true)
    } catch (e) { setTestResults({ error: e.message }) }
    setTestLoading(false)
  }

  const allRules = getAllRules()

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-3 py-2 text-xs border-b border-[#e5e7eb] dark:border-[#2d3140]">
        <span className="font-semibold text-soc-stext dark:text-soc-darkstext">{'\u2699'} Rules Engine</span>
        <span className="text-[#9ca3af] dark:text-[#6b7280]">{allRules.length} rules, {allRules.filter(r => r.enabled).length} enabled</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 shrink-0 border-r border-[#e5e7eb] dark:border-[#2d3140] overflow-y-auto">
          <div className="p-2 border-b border-[#e5e7eb] dark:border-[#2d3140]">
            <button onClick={handleNew} className="gbtn text-xs w-full text-center">+ New Rule</button>
          </div>
          <div className="py-1">
            {allRules.length === 0 && <div className="text-[#9ca3af] text-xs text-center py-6">No rules yet</div>}
            {allRules.map(r => (
              <button key={r.id} onClick={() => handleSelect(r.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${
                  selectedId === r.id ? 'bg-soc-blue/10 dark:bg-blue-500/10 text-soc-blue dark:text-blue-400' : 'text-soc-stext dark:text-soc-darkstext hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140]'
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.enabled ? 'bg-green-500' : 'bg-[#9ca3af]'}`} />
                <span className="flex-1 truncate">{r.name}</span>
                {r.overwrite && <span className="text-[9px] text-amber-500 font-bold">OV</span>}
                {r.conditions?.length > 0 && <span className="text-[10px] text-[#9ca3af]">{r.conditions.length}c</span>}
              </button>
            ))}
          </div>
        </aside>

        <div className="flex-1 overflow-y-auto p-4">
          {!editing ? (
            <div className="flex items-center justify-center h-full text-sm text-[#9ca3af] dark:text-[#6b7280]">
              Select a rule or create a new one
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-5">
              <div className="flex items-center justify-between">
                <input className="ginput text-base font-semibold flex-1 mr-3" value={editing.name} onChange={e => patch({ name: e.target.value })} placeholder="Rule name" />
                <label className="flex items-center gap-1.5 text-xs cursor-pointer shrink-0">
                  <input type="checkbox" checked={editing.enabled} onChange={e => patch({ enabled: e.target.checked })} className="accent-soc-blue" />
                  Enabled
                </label>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div><label className="block text-[10px] uppercase font-semibold text-[#9ca3af] mb-1">Priority</label>
                  <input type="number" className="ginput w-full" value={editing.priority} onChange={e => patch({ priority: parseInt(e.target.value) || 0 })} /></div>
                <div><label className="block text-[10px] uppercase font-semibold text-[#9ca3af] mb-1">Logic</label>
                  <select className="ginput w-full" value={editing.conditionLogic} onChange={e => patch({ conditionLogic: e.target.value })}>
                    <option value="AND">AND</option><option value="OR">OR</option>
                  </select></div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="checkbox" checked={editing.overwrite} onChange={e => patch({ overwrite: e.target.checked })} className="accent-amber-500" />
                    <span className="text-amber-600 dark:text-amber-400 font-semibold text-xs">Overwrite</span>
                  </label>
                </div>
              </div>

              <div className="gcard p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-semibold text-[#9ca3af] dark:text-[#6b7280]">Conditions</span>
                  <button onClick={addCondition} className="gbtn text-xs">+ Add</button>
                </div>
                {editing.conditions.length === 0 && <div className="text-xs text-[#9ca3af] py-4 text-center">No conditions — matches all events</div>}
                <div className="space-y-1.5">
                  {editing.conditions.map((cond, idx) => (
                    <div key={cond.id} className="flex items-center gap-2 text-xs">
                      {idx > 0 && <span className="text-[10px] font-bold text-soc-blue w-10 shrink-0 text-center">{editing.conditionLogic}</span>}
                      {idx === 0 && <span className="w-10 shrink-0" />}
                      <input className="ginput flex-1 min-w-0" list="flist" value={cond.field} onChange={e => updCondition(idx, { field: e.target.value })} placeholder="field.name" />
                      <select className="ginput w-24 shrink-0" value={cond.operator} onChange={e => updCondition(idx, { operator: e.target.value })}>
                        {OPERATORS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <input className="ginput flex-1 min-w-0" placeholder="value" value={cond.value} onChange={e => updCondition(idx, { value: e.target.value })} />
                      <label className="flex items-center gap-1 cursor-pointer shrink-0" title="NOT">
                        <input type="checkbox" checked={cond.negate} onChange={e => updCondition(idx, { negate: e.target.checked })} className="accent-soc-blue" />
                        <span className={`text-[10px] font-semibold ${cond.negate ? 'text-red-500' : 'text-[#9ca3af]'}`}>NOT</span>
                      </label>
                      <button onClick={() => delCondition(idx)} className="p-1 text-[#9ca3af] hover:text-red-500 shrink-0">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
                <datalist id="flist">{FIELDS.map(f => <option key={f} value={f} />)}</datalist>
              </div>

              <div className="gcard p-3">
                <span className="text-[10px] uppercase font-semibold text-[#9ca3af] dark:text-[#6b7280] mb-2 block">Ignore IPs</span>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {editing.ignoreIps.map((ip, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full bg-[#f3f4f6] dark:bg-[#2d3140] text-soc-stext dark:text-soc-darkstext">
                      {ip}
                      <button onClick={() => removeIgnoreIp(idx)} className="text-[#9ca3af] hover:text-red-500"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                    </span>
                  ))}
                </div>
                <input className="ginput w-full text-xs" placeholder="IP or CIDR (e.g. 10.0.0.0/8) + Enter" onKeyDown={e => { if (e.key === 'Enter') { addIgnoreIp(e.target.value); e.target.value = '' } }} />
              </div>

              <div className="gcard p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-semibold text-[#9ca3af] dark:text-[#6b7280]">Actions</span>
                  <button onClick={addAction} className="gbtn text-xs">+ Add</button>
                </div>
                <div className="space-y-2">
                  {editing.actions.map((act, idx) => (
                    <div key={idx} className="flex items-start gap-3 bg-[#f9fafb] dark:bg-[#1a1c23] p-2.5 rounded-lg">
                      <div className="flex items-center gap-2 text-xs flex-1 flex-wrap">
                        <select className="ginput w-20" value={act.type} onChange={e => {
                          if (e.target.value === 'alert') updAction(idx, { type: 'alert', params: { severity: 'high', level: null, message: '' } })
                          else if (e.target.value === 'ignore') updAction(idx, { type: 'ignore', params: {} })
                        }}>
                          <option value="alert">alert</option>
                          <option value="ignore">ignore</option>
                        </select>
                        {act.type === 'alert' && (
                          <>
                            <select className="ginput w-24" value={act.params?.severity || 'high'} onChange={e => updAction(idx, { params: { ...act.params, severity: e.target.value } })}>
                              {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <input type="number" className="ginput w-16" placeholder="Lvl" min="0" max="15" value={act.params?.level ?? ''} onChange={e => updAction(idx, { params: { ...act.params, level: e.target.value ? parseInt(e.target.value) : null } })} title="Override level 0-15" />
                            <input className="ginput flex-1 min-w-0" placeholder='Message ({{field}} for value)' value={act.params?.message || ''} onChange={e => updAction(idx, { params: { ...act.params, message: e.target.value } })} />
                          </>
                        )}
                        {act.type === 'ignore' && <span className="text-[#9ca3af] text-[11px]">Silently ignore matching events</span>}
                      </div>
                      {editing.actions.length > 1 && (
                        <button onClick={() => delAction(idx)} className="p-1 text-[#9ca3af] hover:text-red-500 mt-0.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="gcard p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-semibold text-[#9ca3af] dark:text-[#6b7280]">Test</span>
                  <button onClick={runTest} disabled={testLoading} className="gbtn text-xs">{testLoading ? 'Testing...' : '\u25B6 Run'}</button>
                </div>
                {showTest && testResults && !Array.isArray(testResults) && <div className="text-xs text-red-500">{testResults.error || 'Failed'}</div>}
                {showTest && testResults && Array.isArray(testResults) && (
                  <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
                    <div className="text-[10px] text-[#9ca3af] mb-1">{testResults.filter(r => r.matched).length} / {testResults.length} matched</div>
                    {testResults.slice(0, 20).map((r, idx) => (
                      <div key={idx} className={`flex items-start gap-2 p-1.5 rounded ${r.matched ? 'bg-green-50 dark:bg-green-900/10' : 'bg-transparent'}`}>
                        <span className={`mt-0.5 text-[10px] font-bold shrink-0 ${r.matched ? 'text-green-600' : 'text-[#9ca3af]'}`}>{r.matched ? '\u2713' : '\u2717'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-[#9ca3af]">{r.timestamp ? String(r.timestamp).slice(0, 19).replace('T', ' ') : ''}</span>
                            <span className={`badge ${r.ruleLevel > 10 ? 'badge-critical' : r.ruleLevel > 7 ? 'badge-high' : r.ruleLevel > 4 ? 'badge-medium' : 'badge-low'}`}>{r.ruleLevel}</span>
                          </div>
                          <div className="truncate text-soc-stext dark:text-soc-darkstext">{r.ruleDesc}</div>
                          {r.matched && r.actions.length > 0 && r.actions.map((a, ai) => (
                            <div key={ai} className="flex items-center gap-1.5 mt-0.5">
                              <span className={`badge ${a.type === 'alert' ? (a.computedSeverity || 'badge-high') : 'badge-info'} text-[9px]`}>{a.type.toUpperCase()}</span>
                              <span className="text-[10px] text-soc-stext dark:text-soc-darkstext truncate">
                                {a.type === 'alert' ? (a.computedSeverity || a.params?.severity || '') + (a.interpolated ? ': ' + a.interpolated : '') : a.type === 'ignore' ? 'silent' : ''}
                              </span>
                            </div>
                          ))}
                          {!r.matched && r.details && r.details.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {r.details.map((d, di) => (
                                <span key={di} className={`text-[9px] px-1 py-0.5 rounded ${d.matched ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-300'}`}>
                                  {d.condition.negate ? 'NOT ' : ''}{d.condition.field} {d.condition.operator} "{d.condition.value}" → {d.matched ? 'OK' : 'FAIL'}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-[#e5e7eb] dark:border-[#2d3140]">
                <button onClick={handleSave} className="gbtn-primary text-xs">Save Rule</button>
                <button onClick={() => { toggleRuleEnabled(editing.id); patch({ enabled: !editing.enabled }) }} className="gbtn text-xs">{editing.enabled ? 'Disable' : 'Enable'}</button>
                <button onClick={handleDelete} className="gbtn text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">Delete</button>
                {dirty && <span className="text-[10px] text-amber-500 font-medium">Unsaved changes</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
