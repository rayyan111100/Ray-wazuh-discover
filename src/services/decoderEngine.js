function tryJson(raw) {
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null) return { format: 'json', fields: flattenObj(parsed) }
  } catch {}
  return null
}

function trySyslog(raw) {
  const patterns = [
    { re: /^<(\d+)>(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.+)$/,
      map: ['priority', 'timestamp', 'hostname', 'appName', 'procId', 'message'] },
    { re: /^<(\d+)>(\S+\s+\d+\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(\S+?)(?:\[(\d+)\])?:\s+(.+)$/,
      map: ['priority', 'timestamp', 'hostname', 'appName', 'pid', 'message'] },
    { re: /^(\w{3}\s+\d+\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(\S+?)(?:\[(\d+)\])?:\s+(.+)$/,
      map: ['timestamp', 'hostname', 'appName', 'pid', 'message'] }
  ]
  for (const p of patterns) {
    const m = raw.match(p.re)
    if (m) {
      const fields = {}
      p.map.forEach((k, i) => { fields[k] = m[i + 1] })
      return { format: 'syslog', fields }
    }
  }
  return null
}

function tryKv(raw) {
  const pairs = raw.match(/(\w[\w._-]*)\s*=\s*("(?:[^"\\]|\\.)*"|[^\s"]+)/g)
  if (pairs && pairs.length >= 2) {
    const fields = {}
    for (const p of pairs) {
      const eq = p.indexOf('=')
      const key = p.slice(0, eq).trim()
      let val = p.slice(eq + 1).trim()
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
      fields[key] = val
    }
    return { format: 'key=value', fields }
  }
  return null
}

function tryCsv(raw) {
  const lines = raw.split('\n').filter(l => l.trim())
  if (lines.length >= 1) {
    const parts = lines[0].split(/[,\t|]/)
    if (parts.length >= 3) {
      const fields = {}
      parts.forEach((p, i) => { fields[`field${i + 1}`] = p.trim() })
      return { format: 'delimited', fields, delimiter: detectDelimiter(raw), rawParts: parts }
    }
  }
  return null
}

function detectDelimiter(raw) {
  const comma = (raw.match(/,/g) || []).length
  const tab = (raw.match(/\t/g) || []).length
  const pipe = (raw.match(/\|/g) || []).length
  if (tab > comma && tab > pipe) return 'tab'
  if (pipe > comma) return 'pipe'
  return 'comma'
}

function tryWinEvt(raw) {
  const patterns = [
    { re: /Logon\s+Type:\s*(\d+)/i, key: 'logon_type' },
    { re: /Account\s+(?:Name|For Logon):\s*"([^"]+)"/i, key: 'account' },
    { re: /Account\s+Domain:\s*"([^"]+)"/i, key: 'account_domain' },
    { re: /Source\s+(?:Network\s+)?Address:\s*"([^"]+)"/i, key: 'source_address' },
    { re: /Workstation\s+Name:\s*"([^"]+)"/i, key: 'workstation' },
    { re: /Event\s+ID:\s*(\d+)/i, key: 'event_id' },
    { re: /Task\s+Category:\s*"([^"]+)"/i, key: 'task_category' },
    { re: /Process\s+ID:\s*(\d+)/i, key: 'process_id' },
    { re: /Image(?:\s+File(?:\s+Name)?)?:\s*"([^"]+)"/i, key: 'image_path' },
    { re: /CommandLine:\s*"([^"]+)"/i, key: 'command_line' },
    { re: /User:\s*"([^"]+)"/i, key: 'user' },
    { re: /Status:\s*"([^"]+)"/i, key: 'status' },
    { re: /Type:\s*(\d+)/i, key: 'type' }
  ]
  let matched = false
  const fields = {}
  for (const p of patterns) {
    const m = raw.match(p.re)
    if (m) { fields[p.key] = m[1]; matched = true }
  }
  if (matched) return { format: 'windows_event', fields }
  return null
}

function tryWebLog(raw) {
  const patterns = [
    { re: /^(\S+)\s+(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+"(\S+)\s+(\S+)\s+(\S+)"\s+(\d+)\s+(\d+)(?:\s+"([^"]*)"\s+"([^"]*)")?$/,
      map: ['host', 'ident', 'authuser', 'datetime', 'method', 'path', 'protocol', 'status', 'bytes', 'referer', 'user_agent'], format: 'apache' },
    { re: /^(\S+)\s+(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+"(\S+)\s+(\S+)(?:\s+(\S+))?"\s+(\d+)\s+(\d+)\s+"([^"]*)"\s+"([^"]*)"\s+(\S+)\s+(\S+)$/,
      map: ['host', 'ident', 'authuser', 'datetime', 'method', 'path', 'protocol', 'status', 'bytes', 'referer', 'user_agent', 'vhost', 'response_time'], format: 'nginx' }
  ]
  for (const p of patterns) {
    const m = raw.match(p.re)
    if (m) {
      const fields = {}
      p.map.forEach((k, i) => { fields[k] = m[i + 1] || '' })
      return { format: p.format, fields }
    }
  }
  return null
}

function tryFirewall(raw) {
  const patterns = [
    { re: /SRC=(\S+)\s+DST=(\S+)\s+PROTO=(\S+)\s+SPT=(\d+)\s+DPT=(\d+)/i,
      map: ['src', 'dst', 'proto', 'spt', 'dpt'], format: 'iptables' },
    { re: /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\.(\d+)\s+>\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\.(\d+):?\s*(.+)$/,
      map: ['src', 'spt', 'dst', 'dpt', 'info'], format: 'pfSense' },
    { re: /IN=(\S+)\s+OUT=(\S+)\s+MAC=(\S+)\s+SRC=(\S+)\s+DST=(\S+)\s+PROTO=(\S+)/i,
      map: ['in', 'out', 'mac', 'src', 'dst', 'proto'], format: 'netfilter' }
  ]
  for (const p of patterns) {
    const m = raw.match(p.re)
    if (m) {
      const fields = {}
      p.map.forEach((k, i) => { fields[k] = m[i + 1] })
      return { format: p.format, fields }
    }
  }
  return null
}

function trySshLog(raw) {
  const patterns = [
    { re: /Failed\s+password\s+for\s+(\S+)\s+from\s+(\S+)\s+port\s+(\d+)\s+(\S+)/i,
      map: ['user', 'src_ip', 'port', 'protocol'], format: 'ssh_failed' },
    { re: /Accepted\s+password\s+for\s+(\S+)\s+from\s+(\S+)\s+port\s+(\d+)\s+(\S+)/i,
      map: ['user', 'src_ip', 'port', 'protocol'], format: 'ssh_accepted' },
    { re: /Invalid\s+user\s+(\S+)\s+from\s+(\S+)\s+port\s+(\d+)/i,
      map: ['user', 'src_ip', 'port'], format: 'ssh_invalid_user' },
    { re: /Connection\s+(?:closed|reset)\s+by\s+(\S+)\s+(?:port\s+(\d+))?/i,
      map: ['host', 'port'], format: 'ssh_disconnect' }
  ]
  for (const p of patterns) {
    const m = raw.match(p.re)
    if (m) {
      const fields = {}
      p.map.forEach((k, i) => { fields[k] = m[i + 1] })
      return { format: p.format, fields }
    }
  }
  return null
}

function tryGeneric(raw) {
  const fields = {}
  const ipRe = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g
  const ips = [...raw.matchAll(ipRe)].map(m => m[1])
  if (ips.length) fields.ips = [...new Set(ips)]

  const emailRe = /\b([\w.-]+@[\w.-]+\.\w+)\b/g
  const emails = [...raw.matchAll(emailRe)].map(m => m[1])
  if (emails.length) fields.emails = [...new Set(emails)]

  const portRe = /\bport\s+(\d+)\b/i
  const portM = raw.match(portRe)
  if (portM) fields.port = portM[1]

  const userRe = /(?:user|username)\s*[:=]\s*"?([\w.\-@]+)"?\b/i
  const userM = raw.match(userRe)
  if (userM) fields.user = userM[1]

  const urlRe = /(https?:\/\/[^\s"'<>]+)/g
  const urls = [...raw.matchAll(urlRe)].map(m => m[1])
  if (urls.length) fields.urls = urls

  const statusRe = /(error|failed|success|denied|allowed|blocked|timeout)\b/i
  const statusM = raw.match(statusRe)
  if (statusM) fields.status = statusM[1].toLowerCase()

  if (Object.keys(fields).length) return { format: 'generic', fields }
  return null
}

function flattenObj(obj, prefix = '') {
  let result = {}
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      Object.assign(result, flattenObj(v, key))
    } else {
      result[key] = v
    }
  }
  return result
}

const PARSERS = [tryJson, trySyslog, tryFirewall, tryWebLog, trySshLog, tryKv, tryWinEvt, tryCsv, tryGeneric]

export function decodeLog(raw) {
  if (!raw || typeof raw !== 'string') return { format: 'unknown', fields: {}, raw }
  const trimmed = raw.trim()
  for (const parser of PARSERS) {
    const result = parser(trimmed)
    if (result) return { ...result, raw: trimmed }
  }
  return { format: 'unknown', fields: {}, raw: trimmed }
}

export function decodeBatch(logs) {
  return logs.map((log, idx) => ({ index: idx, ...decodeLog(log) }))
}
