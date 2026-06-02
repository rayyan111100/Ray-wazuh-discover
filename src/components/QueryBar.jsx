import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../context/AppContext'
import DateRangePicker from './DateRangePicker'
import RefreshInterval from './RefreshInterval'
import FilterEditor from './FilterEditor'

const COMMON = [
  { label: 'Today', start: 'now/d', end: 'now' },
  { label: 'This week', start: 'now/w', end: 'now' },
  { label: 'Last 15 min', start: 'now-15m', end: 'now' },
  { label: 'Last 30 min', start: 'now-30m', end: 'now' },
  { label: 'Last 1 hour', start: 'now-1h', end: 'now' },
  { label: 'Last 24 hours', start: 'now-24h', end: 'now' },
  { label: 'Last 7 days', start: 'now-7d', end: 'now' },
  { label: 'Last 30 days', start: 'now-30d', end: 'now' },
  { label: 'Last 90 days', start: 'now-90d', end: 'now' },
  { label: 'Last 1 year', start: 'now-1y', end: 'now' }
]

const OP_LABELS = {
  'is': ':',
  'is not': '\u2260',
  'is one of': 'in',
  'is not one of': 'not in',
  'contains': '~',
  'does not contain': '!~',
  'starts with': '^',
  'ends with': '$',
  'exists': 'exists',
  'does not exist': '!exists',
  'is greater than': '>',
  'is greater than or equal': '\u2265',
  'is less than': '<',
  'is less than or equal': '\u2264',
  'is between': 'between',
  'is not between': '!between'
}

function FilterChip({ filter, onEdit, onRemove }) {
  const opLabel = OP_LABELS[filter.operator] || ':'
  const isNeg = filter.negate
  const isExists = filter.operator === 'exists' || filter.operator === 'does not exist'
  const isRange = filter.operator === 'is between' || filter.operator === 'is not between'
  const isList = filter.operator === 'is one of' || filter.operator === 'is not one of'

  let displayVal = filter.value
  if (isExists) displayVal = ''
  else if (isRange) {
    const to = filter.secondValue?.to || filter.params?.to || ''
    displayVal = `${filter.value} to ${to}`
  }
  else if (isList) displayVal = filter.value

  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-xxs font-medium border cursor-pointer group transition-colors ${
        isNeg
          ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30'
          : 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30'
      }`}
      onClick={() => onEdit?.(filter)}
      title={`${isNeg ? 'NOT ' : ''}${filter.field} ${opLabel} ${displayVal || ''}`}
    >
      {isNeg && <span className="font-bold text-[9px] uppercase mr-0.5">NOT</span>}
      <span className="max-w-[90px] truncate">{filter.field}</span>
      <span className="opacity-60 mx-0.5">{opLabel}</span>
      {displayVal && <span className="max-w-[80px] truncate">{displayVal}</span>}
      <button
        onClick={e => { e.stopPropagation(); onRemove(filter.id) }}
        className="ml-0.5 w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10 font-bold leading-none text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
      >&times;</button>
    </motion.span>
  )
}

export default function QueryBar() {
  const { dql, setDql, filters, removeFilter, addFilter, editFilter, doSearch, loading, fields, index, setIndex, limit, setLimit, startDate, setStartDate, endDate, setEndDate, isDark } = useApp()
  const [showAddFilter, setShowAddFilter] = useState(false)
  const [showQuick, setShowQuick] = useState(false)
  const [editingFilter, setEditingFilter] = useState(null)

  const handleKeyDown = e => { if (e.key === 'Enter') doSearch() }

  const handleEdit = (filter) => {
    setEditingFilter(filter)
    setShowAddFilter(true)
  }

  const handleEditorSave = (updated) => {
    editFilter(updated.id, updated)
    doSearch()
  }

  const handleEditorClose = () => {
    setShowAddFilter(false)
    setEditingFilter(null)
  }

  const applyQuick = (c) => {
    setStartDate(c.start); setEndDate(c.end); setShowQuick(false); doSearch()
  }

  const bg = isDark ? 'bg-soc-darkpanel border-soc-darkborder' : 'bg-white border-soc-border'

  return (
    <div className="space-y-1.5">
      <div className={`flex items-center gap-1.5 px-2 py-1 border rounded ${bg}`}>
        <button className="text-xs text-soc-stext dark:text-soc-darkstext p-0.5 hover:opacity-70 shrink-0" title="Saved queries">{'\uD83D\uDCC2'}</button>
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <input
            type="text"
            value={dql}
            onChange={e => setDql(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search — rule.level:>=12 OR agent.name:*"
            className="flex-1 min-w-[60px] px-1.5 py-1 text-xs border-none outline-none rounded ginput"
          />
          <span className="text-[10px] font-semibold text-soc-stext dark:text-soc-darkstext uppercase px-1.5 py-0.5 rounded border border-soc-border dark:border-soc-darkborder shrink-0">DQL</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowQuick(!showQuick) }}
              className="px-1 py-1 text-xs rounded text-soc-stext dark:text-soc-darkstext hover:bg-soc-border/30 dark:hover:bg-soc-darkborder/30"
              title="Quick date select"
            >{'\uD83D\uDCC5'}</button>
            <AnimatePresence>
              {showQuick && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className={'gcard absolute top-full right-0 mt-1 z-30 w-48 p-2 shadow-lg'}
                >
                  <div className="text-xs font-medium text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wide mb-1">Commonly used</div>
                  {COMMON.map((c, i) => (
                    <button key={i} onClick={() => applyQuick(c)}
                      className="block w-full text-left px-2 py-1 text-xs rounded text-[#1a73e8] dark:text-[#8ab4f8] hover:bg-soc-border/30 dark:hover:bg-soc-darkborder/30"
                    >{c.label}</button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <DateRangePicker />
          <RefreshInterval />
          <select value={limit} onChange={e => setLimit(parseInt(e.target.value))} className={'ginput px-1.5 py-1 text-xs w-12'}>
            <option>20</option><option>50</option><option>100</option><option>200</option><option>500</option>
          </select>
          <select value={index} onChange={e => setIndex(e.target.value)} className={'ginput px-1.5 py-1 text-xs max-w-[120px] hidden md:block'} title="Index pattern">
            <option value="wazuh-alerts-4.x-*">wazuh-alerts-4.x-*</option>
            <option value="wazuh-alerts-*">wazuh-alerts-*</option>
            <option value="*">* (all)</option>
          </select>
          <button
            onClick={() => doSearch()}
            disabled={loading}
            className={`px-2 py-1 text-xs font-semibold rounded transition-all whitespace-nowrap ${
              loading ? 'bg-soc-stext/30 text-white cursor-not-allowed' : 'gbtn-primary'
            }`}
          >{loading ? '\u23F3' : '\u27F3'}</button>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        <div className="relative">
          <button
            onClick={() => { setShowAddFilter(!showAddFilter); setEditingFilter(null) }}
            className={`px-1.5 py-0.5 text-[10px] border rounded ${bg} ${isDark ? 'text-soc-darkstext' : 'text-soc-stext'}`}
            title="Add filter"
          >{'\uD83D\uDD3D'}</button>
          <AnimatePresence>
            {showAddFilter && (
              <FilterEditor
                filter={editingFilter}
                onClose={handleEditorClose}
                onSave={editingFilter ? handleEditorSave : undefined}
                anchorEl={null}
              />
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {filters.map(f => (
            <FilterChip
              key={f.id}
              filter={f}
              onEdit={handleEdit}
              onRemove={(id) => { removeFilter(id); doSearch() }}
            />
          ))}
        </AnimatePresence>
        <button onClick={() => { setShowAddFilter(true); setEditingFilter(null) }} className="text-[10px] text-[#1a73e8] dark:text-[#8ab4f8] hover:underline px-1">+ Add filter</button>
      </div>
    </div>
  )
}
