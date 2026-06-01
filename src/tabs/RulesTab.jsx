import React, { useState } from 'react'
import { motion } from 'framer-motion'
import RuleBuilder from '../components/RuleBuilder'
import { getAllGroups } from '../services/ruleStorage'

export default function RulesTab() {
  const [filterGroupIds, setFilterGroupIds] = useState([])
  const groups = getAllGroups()

  function toggleGroupFilter(id) {
    setFilterGroupIds(prev =>
      prev.includes(id) ? prev.filter(gid => gid !== id) : [...prev, id]
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.12 }}
      className="h-full flex flex-col"
    >
      {groups.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 sm:px-4 py-2 border-b border-[#e5e7eb] dark:border-[#2d3140] bg-white dark:bg-[#16181f] shrink-0 overflow-x-auto">
          <span className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mr-1 shrink-0">Groups:</span>
          {groups.map(g => {
            const active = filterGroupIds.includes(g.id)
            return (
              <button key={g.id} onClick={() => toggleGroupFilter(g.id)}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium transition-all whitespace-nowrap ${
                  active
                    ? 'text-white shadow-sm'
                    : 'bg-[#f3f4f6] dark:bg-[#2d3140] text-[#6b7280] dark:text-[#9ca3af] hover:bg-[#e5e7eb] dark:hover:bg-[#374151]'
                }`}
                style={active ? { backgroundColor: g.color } : {}}>
                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: active ? 'white' : g.color }} />
                {g.name}
              </button>
            )
          })}
          {filterGroupIds.length > 0 && (
            <button onClick={() => setFilterGroupIds([])}
              className="text-[10px] text-[#9ca3af] hover:text-[#6b7280] dark:hover:text-[#e4e6eb] ml-1 shrink-0">
              Clear
            </button>
          )}
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <RuleBuilder filterGroupIds={filterGroupIds} onGroupFilterChange={setFilterGroupIds} />
      </div>
    </motion.div>
  )
}
