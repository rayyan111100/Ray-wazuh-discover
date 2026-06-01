import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getAllGroups } from '../services/ruleStorage'
import { addRulesToGroup, removeRulesFromGroup, moveRulesToGroup } from '../services/ruleGroupManager'
import { useToast } from '../context/ToastContext'
import { addOperation } from '../services/undoManager'
import { getRule, updateRule } from '../services/ruleStorage'

function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white dark:bg-[#1a1d27] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] shadow-xl p-5 max-w-sm w-full mx-3" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-soc-stext dark:text-soc-darkstext mb-2">{title}</h3>
        <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] mb-4">{message}</p>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel} className="gbtn text-xs px-3 py-1.5 bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] transition-colors">Cancel</button>
          <button onClick={onConfirm} className={`gbtn text-xs px-3 py-1.5 transition-colors ${confirmLabel?.includes('Delete') ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'}`}>{confirmLabel || 'Confirm'}</button>
        </div>
      </div>
    </div>
  )
}

export default function GroupBulkActions({
  selectedRuleIds = [],
  visibleRuleIds = [],
  groupId,
  onSelectionChange,
  onRefresh
}) {
  const [groups, setGroups] = useState([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [openDropdown, setOpenDropdown] = useState(null)
  const [addToGroupIds, setAddToGroupIds] = useState([])

  const toast = useToast()
  const refreshGroups = useCallback(() => setGroups(getAllGroups()), [])

  useEffect(() => { refreshGroups() }, [refreshGroups])

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') { onSelectionChange([]) }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        onSelectionChange([...visibleRuleIds])
      }
      if (e.key === 'Delete' && selectedRuleIds.length > 0) {
        e.preventDefault()
        setConfirmDelete(true)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [selectedRuleIds, visibleRuleIds, onSelectionChange])

  function runBulk(operation) {
    setBusy(true)
    setOpenDropdown(null)
    setProgress({ current: 0, total: selectedRuleIds.length })
    const ids = [...selectedRuleIds]
    const total = ids.length
    const previousStates = ids.map(id => { const r = getRule(id); return r ? { id, enabled: r.enabled } : null }).filter(Boolean)

    setTimeout(() => {
      try {
        const rules = JSON.parse(localStorage.getItem('soc_rules') || '[]')
        const updated = rules.map(r => {
          if (!ids.includes(r.id)) return r
          switch (operation) {
            case 'delete': return null
            case 'enable': return { ...r, enabled: true, updatedAt: new Date().toISOString() }
            case 'disable': return { ...r, enabled: false, updatedAt: new Date().toISOString() }
            default: return r
          }
        }).filter(Boolean)
        localStorage.setItem('soc_rules', JSON.stringify(updated))
        setProgress({ current: total, total })
        if (onRefresh) onRefresh()
        if (operation === 'delete') {
          onSelectionChange([])
          toast.notifyOperation(`Deleted ${total} rules`, 'delete', () => {
            const restored = JSON.parse(localStorage.getItem('soc_rules') || '[]')
            for (const id of ids) {
              const r = previousStates.find(p => p.id === id)
              if (r && !restored.some(x => x.id === id)) restored.push(r)
            }
            localStorage.setItem('soc_rules', JSON.stringify(restored))
            if (onRefresh) onRefresh()
          })
        } else {
          const label = operation === 'enable' ? 'Enabled' : 'Disabled'
          toast.notifyOperation(`${label} ${total} rule${total !== 1 ? 's' : ''}`, operation, () => {
            for (const p of previousStates) updateRule(p.id, { enabled: p.enabled })
            if (onRefresh) onRefresh()
          })
        }
      } catch (e) {
        toast.error(`Bulk operation failed: ${e.message}`)
      }
      setBusy(false)
      setProgress({ current: 0, total: 0 })
    }, 50)
  }

  async function handleAddToGroup() {
    setBusy(true)
    setOpenDropdown(null)
    const targetIds = addToGroupIds
    if (targetIds.length === 0) { setBusy(false); return }
    const total = selectedRuleIds.length * targetIds.length
    let done = 0
    setProgress({ current: 0, total })

    const prevGroupIds = selectedRuleIds.map(id => { const r = getRule(id); return r ? { id, gids: [...(r.groupIds || [])] } : null }).filter(Boolean)

    for (const gid of targetIds) {
      addRulesToGroup(gid, selectedRuleIds)
      done += selectedRuleIds.length
      setProgress({ current: done, total })
    }
    if (onRefresh) onRefresh()
    const groupNames = targetIds.map(gid => groups.find(g => g.id === gid)?.name || gid).join(', ')
    toast.notifyOperation(`Added ${selectedRuleIds.length} rule${selectedRuleIds.length !== 1 ? 's' : ''} to ${groupNames}`, 'addToGroup', () => {
      for (const p of prevGroupIds) updateRule(p.id, { groupIds: p.gids })
      if (onRefresh) onRefresh()
    })
    setAddToGroupIds([])
    setBusy(false)
    setProgress({ current: 0, total: 0 })
  }

  async function handleMoveToGroup(targetGroupId) {
    if (!groupId || !targetGroupId) return
    setBusy(true)
    setOpenDropdown(null)
    setProgress({ current: 0, total: selectedRuleIds.length })

    const prevGroupIds = selectedRuleIds.map(id => { const r = getRule(id); return r ? { id, gids: [...(r.groupIds || [])] } : null }).filter(Boolean)
    const srcName = groups.find(g => g.id === groupId)?.name || groupId
    const tgtName = groups.find(g => g.id === targetGroupId)?.name || targetGroupId

    moveRulesToGroup(groupId, targetGroupId, selectedRuleIds)
    setProgress({ current: selectedRuleIds.length, total: selectedRuleIds.length })
    if (onRefresh) onRefresh()
    toast.notifyOperation(`Moved ${selectedRuleIds.length} rule${selectedRuleIds.length !== 1 ? 's' : ''} from ${srcName} to ${tgtName}`, 'moveToGroup', () => {
      for (const p of prevGroupIds) updateRule(p.id, { groupIds: p.gids })
      if (onRefresh) onRefresh()
    })
    setBusy(false)
    setProgress({ current: 0, total: 0 })
  }

  async function handleRemoveFromGroup() {
    if (!groupId) return
    setBusy(true)
    setOpenDropdown(null)
    setProgress({ current: 0, total: selectedRuleIds.length })

    const prevGroupIds = selectedRuleIds.map(id => { const r = getRule(id); return r ? { id, gids: [...(r.groupIds || [])] } : null }).filter(Boolean)
    const grpName = groups.find(g => g.id === groupId)?.name || groupId

    removeRulesFromGroup(groupId, selectedRuleIds)
    setProgress({ current: selectedRuleIds.length, total: selectedRuleIds.length })
    if (onRefresh) onRefresh()
    toast.notifyOperation(`Removed ${selectedRuleIds.length} rule${selectedRuleIds.length !== 1 ? 's' : ''} from ${grpName}`, 'removeFromGroup', () => {
      for (const p of prevGroupIds) updateRule(p.id, { groupIds: p.gids })
      if (onRefresh) onRefresh()
    })
    setBusy(false)
    setProgress({ current: 0, total: 0 })
  }

  function toggleAddGroup(gid) {
    setAddToGroupIds(prev => prev.includes(gid) ? prev.filter(id => id !== gid) : [...prev, gid])
  }

  function toggleSelection() {
    if (selectedRuleIds.length === visibleRuleIds.length) {
      onSelectionChange([])
    } else {
      onSelectionChange([...visibleRuleIds])
    }
  }

  const hasSelection = selectedRuleIds.length > 0
  const allSelected = visibleRuleIds.length > 0 && selectedRuleIds.length === visibleRuleIds.length

  return (
    <>
      <AnimatePresence>
        {hasSelection && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-white dark:bg-[#16181f] border border-[#e5e7eb] dark:border-[#2d3140] rounded-xl shadow-2xl px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3 text-xs"
            style={{ maxWidth: 'calc(100vw - 2rem)' }}
          >
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={toggleSelection} className="p-1 rounded hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] transition-colors" title={allSelected ? 'Deselect All' : 'Select All'}>
                <svg className="w-4 h-4 text-[#6b7280]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {allSelected
                    ? <><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></>
                    : <><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></>
                  }
                </svg>
              </button>
              <span className="font-semibold text-soc-stext dark:text-soc-darkstext whitespace-nowrap">
                <span className="text-[#3b82f6]">{selectedRuleIds.length}</span> rule{selectedRuleIds.length !== 1 ? 's' : ''} selected
              </span>
              {allSelected && selectedRuleIds.length > 1 && (
                <span className="text-[#9ca3af] text-[10px] hidden sm:inline">(all {selectedRuleIds.length})</span>
              )}
            </div>

            <div className="h-5 w-px bg-[#e5e7eb] dark:bg-[#2d3140]" />

            <div className="relative">
              <button onClick={() => setOpenDropdown(openDropdown === 'add' ? null : 'add')}
                disabled={busy}
                className={`gbtn text-xs px-2.5 py-1.5 flex items-center gap-1.5 transition-all ${openDropdown === 'add' ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] text-[#6b7280] dark:text-[#9ca3af]'} ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                <span className="hidden sm:inline">Add to Group</span>
              </button>
              {openDropdown === 'add' && (
                <div className="relative" style={{ position: 'fixed', ...(() => {
                  const btn = document.activeElement?.getBoundingClientRect()
                  return btn ? { bottom: window.innerHeight - btn.top + 8, left: Math.max(8, btn.left) } : {}
                })() }}>
                  <div className="bg-white dark:bg-[#1a1d27] border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg shadow-xl py-1 min-w-[180px] max-h-56 overflow-y-auto">
                    {groups.length === 0 && <div className="px-3 py-2 text-[10px] text-[#9ca3af] italic">No groups available</div>}
                    {groups.map(g => {
                      const checked = addToGroupIds.includes(g.id)
                      return (
                        <label key={g.id} className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-soc-stext dark:text-soc-darkstext flex items-center gap-2.5 cursor-pointer transition-colors">
                          <input type="checkbox" checked={checked} onChange={() => toggleAddGroup(g.id)}
                            className="w-3.5 h-3.5 rounded border-[#d1d5db] dark:border-[#4b5563] text-[#3b82f6] focus:ring-[#3b82f6]/30" />
                          <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                          <span className="flex-1 truncate">{g.name}</span>
                        </label>
                      )
                    })}
                    {groups.length > 0 && (
                      <div className="border-t border-[#e5e7eb] dark:border-[#2d3140] px-2 py-1.5">
                        <button onClick={handleAddToGroup}
                          disabled={addToGroupIds.length === 0 || busy}
                          className="w-full text-center text-[10px] py-1 rounded-md bg-[#3b82f6] text-white hover:bg-[#2563eb] disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium">
                          {busy ? 'Adding...' : `Add to ${addToGroupIds.length} group${addToGroupIds.length !== 1 ? 's' : ''}`}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {groupId && (
              <>
                <div className="relative">
                  <button onClick={() => setOpenDropdown(openDropdown === 'move' ? null : 'move')}
                    disabled={busy}
                    className={`gbtn text-xs px-2.5 py-1.5 flex items-center gap-1.5 transition-all ${openDropdown === 'move' ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] text-[#6b7280] dark:text-[#9ca3af]'} ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 17l4 4 4-4M8 7l4-4 4-4"/><path d="M12 3v18"/></svg>
                    <span className="hidden sm:inline">Move to Group</span>
                  </button>
                  {openDropdown === 'move' && (
                    <div className="relative" style={{ position: 'fixed', ...(() => {
                      const btn = document.activeElement?.getBoundingClientRect()
                      return btn ? { bottom: window.innerHeight - btn.top + 8, left: Math.max(8, btn.left) } : {}
                    })() }}>
                      <div className="bg-white dark:bg-[#1a1d27] border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg shadow-xl py-1 min-w-[180px] max-h-56 overflow-y-auto">
                        {groups.filter(g => g.id !== groupId).length === 0 && <div className="px-3 py-2 text-[10px] text-[#9ca3af] italic">No other groups</div>}
                        {groups.filter(g => g.id !== groupId).map(g => (
                          <button key={g.id} onClick={() => handleMoveToGroup(g.id)}
                            disabled={busy}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-soc-stext dark:text-soc-darkstext flex items-center gap-2.5 transition-colors disabled:opacity-40">
                            <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                            <span className="flex-1 truncate">{g.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button onClick={handleRemoveFromGroup} disabled={busy}
                  className={`gbtn text-xs px-2.5 py-1.5 flex items-center gap-1.5 bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] text-[#6b7280] dark:text-[#9ca3af] transition-all ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12"/></svg>
                  <span className="hidden sm:inline">Remove from Group</span>
                </button>
              </>
            )}

            <div className="h-5 w-px bg-[#e5e7eb] dark:bg-[#2d3140]" />

            <button onClick={() => runBulk('enable')} disabled={busy}
              className={`gbtn text-xs px-2.5 py-1.5 flex items-center gap-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 border border-green-200 dark:border-green-800/40 transition-all ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
              <span className="hidden sm:inline">Enable</span>
            </button>

            <button onClick={() => runBulk('disable')} disabled={busy}
              className={`gbtn text-xs px-2.5 py-1.5 flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800/40 transition-all ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 5l-7 7 7 7"/></svg>
              <span className="hidden sm:inline">Disable</span>
            </button>

            <div className="h-5 w-px bg-[#e5e7eb] dark:bg-[#2d3140]" />

            <button onClick={() => setConfirmDelete(true)} disabled={busy}
              className={`gbtn text-xs px-2.5 py-1.5 flex items-center gap-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border border-transparent hover:border-red-200 dark:hover:border-red-800/40 transition-all ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              <span className="hidden sm:inline">Delete</span>
            </button>

            {busy && progress.total > 0 && (
              <div className="w-20 sm:w-28 h-1.5 bg-[#f3f4f6] dark:bg-[#2d3140] rounded-full overflow-hidden shrink-0">
                <div className="h-full bg-[#3b82f6] rounded-full transition-all duration-200" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
              </div>
            )}

            <button onClick={() => onSelectionChange([])} disabled={busy}
              className="p-1.5 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-[#9ca3af] hover:text-[#6b7280] dark:hover:text-[#e4e6eb] transition-colors shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Rules"
        message={`Are you sure you want to delete ${selectedRuleIds.length} selected rule${selectedRuleIds.length !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmLabel={`Delete ${selectedRuleIds.length} Rule${selectedRuleIds.length !== 1 ? 's' : ''}`}
        onConfirm={() => { setConfirmDelete(false); runBulk('delete') }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
