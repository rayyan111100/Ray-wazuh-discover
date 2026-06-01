export const STORAGE_KEY = 'soc_rules'
export const GROUPS_KEY = 'soc_rule_groups'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const d = JSON.parse(raw)
    return Array.isArray(d) ? d : (d.rules || [])
  } catch {
    return []
  }
}

function save(rules) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
}

function loadGroups() {
  try {
    const raw = localStorage.getItem(GROUPS_KEY)
    if (!raw) return []
    const d = JSON.parse(raw)
    return Array.isArray(d) ? d : []
  } catch {
    return []
  }
}

function saveGroups(groups) {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups))
}

export function createId() {
  return 'rule_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
}

export function createGroupId() {
  return 'grp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
}

export function getAllGroups() {
  return loadGroups()
}

export function getGroup(id) {
  return loadGroups().find(g => g.id === id)
}

export function createGroup(defaults = {}) {
  const groups = loadGroups()
  const g = {
    id: createGroupId(),
    name: defaults.name || 'New Group',
    description: defaults.description || '',
    color: defaults.color || '#3b82f6',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  groups.push(g)
  saveGroups(groups)
  return g
}

export function updateGroup(id, patch) {
  const groups = loadGroups()
  const g = groups.find(x => x.id === id)
  if (!g) return null
  Object.assign(g, patch, { updatedAt: new Date().toISOString() })
  saveGroups(groups)
  return g
}

export function deleteGroup(id) {
  const groups = loadGroups().filter(g => g.id !== id)
  saveGroups(groups)
  const rules = load().map(r => ({
    ...r,
    groupIds: (r.groupIds || []).filter(gid => gid !== id)
  }))
  save(rules)
}

export function getAllRules() {
  return load()
}

export function getRule(id) {
  return load().find(r => r.id === id)
}

export function createRule(defaults = {}) {
  const rules = load()
  const r = {
    id: createId(),
    name: defaults.name || 'New Rule',
    enabled: true,
    overwrite: true,
    conditionLogic: 'AND',
    actions: [{ type: 'alert', params: { severity: 'high', message: '' } }],
    conditions: [],
    groupIds: defaults.groupIds || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  rules.push(r)
  save(rules)
  return r
}

export function updateRule(id, patch) {
  const rules = load()
  const r = rules.find(x => x.id === id)
  if (!r) return null
  Object.assign(r, patch, { updatedAt: new Date().toISOString() })
  save(rules)
  return r
}

export function deleteRule(id) {
  save(load().filter(r => r.id !== id))
}

export function toggleRuleEnabled(id) {
  const rules = load()
  const r = rules.find(x => x.id === id)
  if (!r) return null
  r.enabled = !r.enabled
  r.updatedAt = new Date().toISOString()
  save(rules)
  return r
}
