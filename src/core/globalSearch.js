// 全站本地数据搜索：跨插件索引本机数据，供命令面板「本机数据」结果组使用。
// 只读取各插件约定的 localStorage 键，不做任何网络请求。

function pushMatch(out, lower, pluginId, title, sub, extra) {
  const t = (title || '').toLowerCase()
  const s = (sub || '').toLowerCase()
  if (t.includes(lower) || s.includes(lower)) {
    out.push({ pluginId, title: title || '（无标题）', sub: sub || '', extra: extra || {} })
  }
}

export function searchData(q) {
  const out = []
  const lower = (q || '').trim().toLowerCase()
  if (!lower) return out
  try {
    const crm = JSON.parse(localStorage.getItem('opwb:crm:v1') || 'null')
    ;(crm?.customers || []).forEach((c) => {
      pushMatch(out, lower, 'crm', c.company, [c.contact, c.phone, c.email, c.stage].filter(Boolean).join(' · '), { id: c.id })
    })
  } catch { /* ignore */ }
  try {
    const doc = JSON.parse(localStorage.getItem('opwb:doc:v1') || 'null')
    ;(doc?.docs || []).forEach((d) => {
      const tags = Array.isArray(d.tags) ? d.tags.join(' ') : ''
      pushMatch(out, lower, 'doc-organizer', d.title || d.name || '资料', (tags + ' ' + (d.note || '')).trim(), { id: d.id })
    })
  } catch { /* ignore */ }
  try {
    const cal = JSON.parse(localStorage.getItem('opwb:notes:calendar') || '{}')
    Object.entries(cal).forEach(([date, text]) => {
      pushMatch(out, lower, 'leisure', date + ' 日历备注', String(text || ''), { date })
    })
  } catch { /* ignore */ }
  try {
    const memo = localStorage.getItem('opwb:notes:memo') || ''
    if (memo.trim()) pushMatch(out, lower, 'leisure', '便签', memo.slice(0, 120), {})
  } catch { /* ignore */ }
  try {
    const ba = JSON.parse(localStorage.getItem('opwb:ba:v1') || 'null')
    ;(ba?.rows || []).forEach((r) => {
      pushMatch(out, lower, 'biz-analysis', r.name || '收支记录', '营收 ' + (r.revenue || 0) + ' / 成本 ' + (r.cost || 0), { id: r.id })
    })
  } catch { /* ignore */ }
  try {
    const ir = JSON.parse(localStorage.getItem('opwb:ir:v1') || 'null')
    ;(ir?.datasets || []).forEach((d) => {
      pushMatch(out, lower, 'industry-research', d.name || '数据集', (d.desc || ''), { id: d.id })
    })
  } catch { /* ignore */ }
  return out.slice(0, 24)
}
