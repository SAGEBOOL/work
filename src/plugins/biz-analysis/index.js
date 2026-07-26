// 专业功能 · 业务分析：经营仪表盘。录入周期（营收/支出）→ 算利润、毛利率、环比、累计 → 汇总卡片 + 趋势图。
import { el, clear, toast } from '../../core/ui.js'
import { lineChart } from '../../core/charts.js'

const PERIODS = ['月', '周', '季']
const KEY = 'opwb:ba:v1'

const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null } }
const save = (s) => localStorage.setItem(KEY, JSON.stringify(s))

export const bizAnalysisPlugin = {
  id: 'biz-analysis',
  name: '业务分析',
  icon: '💹',
  group: '专业功能',
  mount(root) {
    const s = load() || { period: '月', rows: [] }
    if (!Array.isArray(s.rows)) s.rows = []

    const perSel = el('select', {}, PERIODS.map(p => el('option', { value: p }, [p])))
    perSel.value = s.period
    perSel.onchange = () => { s.period = perSel.value; save(s) }

    const table = el('div', { class: 'kv-table kv-4' })
    const summary = el('div', { class: 'grid cols-4' })
    const chartWrap = el('div', {})
    const detail = el('div', {})

    const stat = (label, val, cls = '') => el('div', { class: 'kpi' + (cls ? ' ' + cls : '') }, [
      el('div', { class: 'stat-v' }, [val]),
      el('div', { class: 'stat-l' }, [label])
    ])

    const render = () => {
      clear(table)
      table.append(el('div', { class: 'kv-h' }, [
        el('span', {}, [s.period + '份']), el('span', {}, ['营收(元)']), el('span', {}, ['支出(元)']), el('span', {}, [''])
      ]))
      s.rows.forEach((r, idx) => {
        const lbl = el('input', { type: 'text', value: r.label || '', placeholder: '如 2026-01' })
        const rev = el('input', { type: 'number', value: r.revenue || 0, min: 0, step: 100 })
        const exp = el('input', { type: 'number', value: r.expense || 0, min: 0, step: 100 })
        const commit = () => {
          r.label = lbl.value; r.revenue = +rev.value || 0; r.expense = +exp.value || 0
          save(s); render()
        }
        lbl.onchange = commit; rev.onchange = commit; exp.onchange = commit
        const del = el('button', { class: 'mini', title: '删除' }, ['✕'])
        del.onclick = () => { s.rows.splice(idx, 1); save(s); render() }
        table.append(el('div', { class: 'kv-r' }, [lbl, rev, exp, del]))
      })

      const totRev = s.rows.reduce((a, r) => a + (+r.revenue || 0), 0)
      const totExp = s.rows.reduce((a, r) => a + (+r.expense || 0), 0)
      const totProfit = totRev - totExp
      const avgMargin = totRev > 0 ? (totProfit / totRev * 100) : 0
      const cumProfit = s.rows.reduce((a, r) => a + ((+r.revenue || 0) - (+r.expense || 0)), 0)
      clear(summary)
      summary.append(
        stat('总营收', '¥' + totRev.toLocaleString()),
        stat('总支出', '¥' + totExp.toLocaleString()),
        stat('净利润', '¥' + totProfit.toLocaleString(), totProfit < 0 ? 'err' : ''),
        stat('平均毛利率', avgMargin.toFixed(1) + '%', avgMargin < 0 ? 'err' : '')
      )

      clear(chartWrap)
      chartWrap.append(
        el('div', { class: 'muted', style: 'margin:4px 0' }, ['营收 / 利润 趋势']),
        lineChart(s.rows.map(r => +r.revenue || 0), { color: 'var(--primary)' }),
        lineChart(s.rows.map(r => (+r.revenue || 0) - (+r.expense || 0)), { color: '#22c55e' })
      )

      clear(detail)
      let cum = 0
      s.rows.forEach((r, i) => {
        const profit = (+r.revenue || 0) - (+r.expense || 0)
        cum += profit
        const margin = (r.revenue > 0) ? (profit / r.revenue * 100) : 0
        const prev = i > 0 ? (+s.rows[i - 1].revenue || 0) : 0
        const mom = prev > 0 ? ((r.revenue - prev) / prev * 100) : null
        detail.append(el('div', { class: 'kv-detail' }, [
          el('b', {}, [r.label || '—']),
          el('span', {}, [`利润 ¥${profit.toLocaleString()} · 毛利率 ${margin.toFixed(1)}%`]),
          el('span', { class: 'muted' }, [`累计 ¥${cum.toLocaleString()}${mom === null ? '' : ` · 环比 ${mom >= 0 ? '+' : ''}${mom.toFixed(1)}%`}`])
        ]))
      })
    }

    const addBtn = el('button', { class: 'btn' }, ['＋ 添加' + s.period + '份'])
    addBtn.onclick = () => { s.rows.push({ label: '', revenue: 0, expense: 0 }); save(s); render() }

    const exportBtn = el('button', { class: 'btn ghost' }, ['导出 JSON'])
    exportBtn.onclick = () => {
      const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' })
      const a = el('a', { href: URL.createObjectURL(blob), download: `业务分析.json` })
      document.body.append(a); a.click(); a.remove()
      toast('已导出', 'ok')
    }

    render()
    root.append(el('div', { class: 'page' }, [
      el('h1', {}, ['业务分析']),
      el('p', { class: 'sub' }, ['录入各周期营收与支出，自动算净利润、毛利率、累计利润与环比 · 数据存本机']),
      el('div', { class: 'card' }, [
        el('div', { class: 'field' }, [el('label', {}, ['统计周期']), perSel])
      ]),
      el('div', { class: 'card' }, [
        el('div', { class: 'row', style: 'justify-content:space-between;align-items:center' }, [
          el('label', {}, ['经营数据']), el('div', { class: 'row' }, [addBtn, exportBtn])
        ]),
        table
      ]),
      summary,
      el('div', { class: 'card' }, [chartWrap]),
      el('div', { class: 'card' }, [el('label', {}, ['逐期明细']), detail])
    ]))
  }
}
