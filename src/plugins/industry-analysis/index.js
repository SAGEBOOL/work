// 专业功能 · 行业数据分析：选行业 → 按月录入关键指标 → 自动算利润/利润率/客单价/环比 → 趋势图。
import { el, clear, toast } from '../../core/ui.js'
import { lineChart } from '../../core/charts.js'

const INDUSTRIES = ['餐饮', '零售', '电商', '知识付费', '咨询服务', 'SaaS', '制造业', '其他']
const KEY = 'opwb:ia:v1'

const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null } }
const save = (s) => localStorage.setItem(KEY, JSON.stringify(s))

function industryHint(ind) {
  const H = {
    '餐饮': '关注翻台率、客单价、食材成本率；建议每月录入营收/成本/客户数。',
    '零售': '关注坪效、毛利率、库存周转；客户数可记会员数。',
    '电商': '关注 GMV、获客成本、复购率；客户数可记活跃买家。',
    '知识付费': '关注课程/专栏营收、投放成本、付费用户数。',
    '咨询服务': '关注项目营收、人力成本、客户数。',
    'SaaS': '关注 MRR、Churn、客户数（账号数）。',
    '制造业': '关注产能利用率、毛利、客户/订单数。',
    '其他': '按月录入营收/成本/客户数，系统自动生成趋势与利润率。'
  }
  return H[ind] || H['其他']
}

export const industryAnalysisPlugin = {
  id: 'industry-analysis',
  name: '行业数据分析',
  icon: '📊',
  group: '专业功能',
  mount(root) {
    const s = load() || { industry: INDUSTRIES[0], rows: [] }
    if (!Array.isArray(s.rows)) s.rows = []

    const indSel = el('select', {}, INDUSTRIES.map(i => el('option', { value: i }, [i])))
    indSel.value = s.industry
    indSel.onchange = () => { s.industry = indSel.value; save(s); hint.textContent = industryHint(s.industry) }

    const hint = el('p', { class: 'hint' }, [industryHint(s.industry)])
    const table = el('div', { class: 'kv-table kv-5' })
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
        el('span', {}, ['月份']), el('span', {}, ['营收(元)']), el('span', {}, ['成本(元)']),
        el('span', {}, ['客户数']), el('span', {}, [''])
      ]))
      s.rows.forEach((r, idx) => {
        const m = el('input', { type: 'month', value: r.month || '' })
        const rev = el('input', { type: 'number', value: r.revenue || 0, min: 0, step: 100 })
        const cost = el('input', { type: 'number', value: r.cost || 0, min: 0, step: 100 })
        const cus = el('input', { type: 'number', value: r.customers || 0, min: 0, step: 1 })
        const commit = () => {
          r.month = m.value; r.revenue = +rev.value || 0; r.cost = +cost.value || 0; r.customers = +cus.value || 0
          save(s); render()
        }
        m.onchange = commit; rev.onchange = commit; cost.onchange = commit; cus.onchange = commit
        const del = el('button', { class: 'mini', title: '删除' }, ['✕'])
        del.onclick = () => { s.rows.splice(idx, 1); save(s); render() }
        table.append(el('div', { class: 'kv-r' }, [m, rev, cost, cus, del]))
      })

      const totRev = s.rows.reduce((a, r) => a + (+r.revenue || 0), 0)
      const totCost = s.rows.reduce((a, r) => a + (+r.cost || 0), 0)
      const totProfit = totRev - totCost
      const avgMargin = totRev > 0 ? (totProfit / totRev * 100) : 0
      const lastCus = s.rows.length ? (+s.rows[s.rows.length - 1].customers || 0) : 0
      const avgPrice = lastCus > 0 ? (totRev / lastCus) : 0
      clear(summary)
      summary.append(
        stat('总营收', '¥' + totRev.toLocaleString()),
        stat('总成本', '¥' + totCost.toLocaleString()),
        stat('总利润', '¥' + totProfit.toLocaleString(), totProfit < 0 ? 'err' : ''),
        stat('平均利润率', avgMargin.toFixed(1) + '%', avgMargin < 0 ? 'err' : '')
      )

      clear(chartWrap)
      chartWrap.append(
        el('div', { class: 'muted', style: 'margin:4px 0' }, ['营收趋势（最新客单价 ¥' + Math.round(avgPrice).toLocaleString() + '）']),
        lineChart(s.rows.map(r => +r.revenue || 0))
      )

      clear(detail)
      s.rows.forEach((r, i) => {
        const profit = (+r.revenue || 0) - (+r.cost || 0)
        const margin = (r.revenue > 0) ? (profit / r.revenue * 100) : 0
        const prev = i > 0 ? (+s.rows[i - 1].revenue || 0) : 0
        const mom = prev > 0 ? ((r.revenue - prev) / prev * 100) : null
        detail.append(el('div', { class: 'kv-detail' }, [
          el('b', {}, [r.month || '—']),
          el('span', {}, [`利润 ¥${profit.toLocaleString()} · 利润率 ${margin.toFixed(1)}%`]),
          el('span', { class: 'muted' }, [mom === null ? '' : `环比 ${mom >= 0 ? '+' : ''}${mom.toFixed(1)}%`])
        ]))
      })
    }

    const addBtn = el('button', { class: 'btn' }, ['＋ 添加月份'])
    addBtn.onclick = () => { s.rows.push({ month: '', revenue: 0, cost: 0, customers: 0 }); save(s); render() }

    const exportBtn = el('button', { class: 'btn ghost' }, ['导出 JSON'])
    exportBtn.onclick = () => {
      const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' })
      const a = el('a', { href: URL.createObjectURL(blob), download: `行业分析-${s.industry}.json` })
      document.body.append(a); a.click(); a.remove()
      toast('已导出', 'ok')
    }

    render()
    root.append(el('div', { class: 'page' }, [
      el('h1', {}, ['行业数据分析']),
      el('p', { class: 'sub' }, ['选择行业、按月录入关键经营指标，自动计算利润 / 利润率 / 客单价与环比趋势 · 数据存本机']),
      el('div', { class: 'card' }, [
        el('div', { class: 'field' }, [el('label', {}, ['所属行业']), indSel]),
        hint
      ]),
      el('div', { class: 'card' }, [
        el('div', { class: 'row', style: 'justify-content:space-between;align-items:center' }, [
          el('label', {}, ['月度指标']), el('div', { class: 'row' }, [addBtn, exportBtn])
        ]),
        table
      ]),
      summary,
      el('div', { class: 'card' }, [chartWrap]),
      el('div', { class: 'card' }, [el('label', {}, ['逐月明细']), detail])
    ]))
  }
}
