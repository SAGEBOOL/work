// 专业功能 · 客户跟踪：客户 CRUD + 阶段统计 + 跟进记录 + 导出 CSV。
import { el, clear, toast } from '../../core/ui.js'
import { barChart } from '../../core/charts.js'

const STAGES = ['潜在', '接触中', '报价', '成交', '流失']
const STAGE_COLOR = { '潜在': '#94a3b8', '接触中': '#3b82f6', '报价': '#a855f7', '成交': '#22c55e', '流失': '#ef4444' }
const KEY = 'opwb:crm:v1'
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null } }
const save = (s) => localStorage.setItem(KEY, JSON.stringify(s))

export const crmPlugin = {
  id: 'crm',
  name: '客户跟踪',
  icon: '🤝',
  group: '专业功能',
  mount(root) {
    const s = load() || { customers: [] }
    if (!Array.isArray(s.customers)) s.customers = []

    const statsWrap = el('div', { class: 'card' })
    const list = el('div', { class: 'crm-list' })

    const fCompany = el('input', { type: 'text', placeholder: '公司 / 客户名' })
    const fContact = el('input', { type: 'text', placeholder: '联系人' })
    const fPhone = el('input', { type: 'text', placeholder: '电话' })
    const fEmail = el('input', { type: 'text', placeholder: '邮箱' })
    const fStage = el('select', {}, STAGES.map(st => el('option', { value: st }, [st])))
    const fAmount = el('input', { type: 'number', placeholder: '金额(元)', min: 0, step: 100 })
    const fFirst = el('textarea', { placeholder: '首条跟进记录（可选）', style: 'min-height:54px' })
    const formAlert = el('div', {})
    let editingId = null

    const fillForm = (c) => {
      fCompany.value = c?.company || ''
      fContact.value = c?.contact || ''
      fPhone.value = c?.phone || ''
      fEmail.value = c?.email || ''
      fStage.value = c?.stage || '潜在'
      fAmount.value = c?.amount || 0
      fFirst.value = ''
    }
    const resetForm = () => { editingId = null; fillForm(null); formAlert.textContent = '' }

    const submit = () => {
      const company = fCompany.value.trim()
      if (!company) { formAlert.className = 'alert err'; formAlert.textContent = '请填写公司/客户名'; return }
      const rec = {
        company, contact: fContact.value.trim(), phone: fPhone.value.trim(),
        email: fEmail.value.trim(), stage: fStage.value, amount: +fAmount.value || 0, updated: Date.now()
      }
      if (editingId) {
        const i = s.customers.findIndex(x => x.id === editingId)
        if (i >= 0) s.customers[i] = { ...s.customers[i], ...rec }
      } else {
        rec.id = 'c' + Date.now(); rec.notes = []
        if (fFirst.value.trim()) rec.notes.push({ time: Date.now(), text: fFirst.value.trim() })
        s.customers.unshift(rec)
      }
      save(s); resetForm(); render(); toast('已保存', 'ok')
    }

    const renderStats = () => {
      clear(statsWrap)
      const byStage = STAGES.map(st => {
        const arr = s.customers.filter(c => c.stage === st)
        const amt = arr.reduce((a, c) => a + (+c.amount || 0), 0)
        return { st, n: arr.length, amt }
      })
      const totalAmt = s.customers.reduce((a, c) => a + (+c.amount || 0), 0)
      statsWrap.append(
        el('div', { class: 'row', style: 'justify-content:space-between;align-items:center' }, [
          el('label', {}, ['客户阶段统计']),
          el('span', { class: 'muted' }, ['客户 ' + s.customers.length + ' · 总金额 ¥' + totalAmt.toLocaleString()])
        ]),
        el('div', { class: 'grid cols-5', style: 'margin-top:8px' }, byStage.map(x => el('div', { class: 'kpi' }, [
          el('div', { class: 'stat-v', style: `color:${STAGE_COLOR[x.st]}` }, [String(x.n)]),
          el('div', { class: 'stat-l' }, [x.st + ' · ¥' + x.amt.toLocaleString()])
        ]))),
        barChart(byStage.map(x => ({ label: x.st, value: x.n, color: STAGE_COLOR[x.st] })))
      )
    }

    const render = () => {
      renderStats()
      clear(list)
      if (!s.customers.length) list.append(el('div', { class: 'muted' }, ['暂无客户，点击「新增客户」开始跟踪']))
      s.customers.forEach(c => {
        const noteInput = el('input', { type: 'text', placeholder: '追加跟进记录…' })
        noteInput.onchange = () => {
          const t = noteInput.value.trim(); if (!t) return
          c.notes = c.notes || []; c.notes.unshift({ time: Date.now(), text: t }); c.updated = Date.now()
          save(s); render()
        }
        const editBtn = el('button', { class: 'mini' }, ['编辑'])
        editBtn.onclick = () => { editingId = c.id; fillForm(c); formAlert.textContent = ''; fCompany.focus() }
        const delBtn = el('button', { class: 'mini' }, ['删除'])
        delBtn.onclick = () => {
          if (confirm('确认删除「' + c.company + '」？')) { s.customers = s.customers.filter(x => x.id !== c.id); save(s); render() }
        }
        list.append(el('div', { class: 'crm-item' }, [
          el('div', { class: 'crm-head' }, [
            el('b', {}, [c.company]),
            el('span', { class: 'tag', style: `background:${STAGE_COLOR[c.stage]}22;color:${STAGE_COLOR[c.stage]}` }, [c.stage]),
            c.amount ? el('span', { class: 'muted' }, ['¥' + (+c.amount).toLocaleString()]) : null
          ].filter(Boolean)),
          el('div', { class: 'crm-sub' }, [
            c.contact ? el('span', {}, ['👤 ' + c.contact]) : null,
            c.phone ? el('span', {}, ['📞 ' + c.phone]) : null,
            c.email ? el('span', {}, ['✉️ ' + c.email]) : null
          ].filter(Boolean)),
          (c.notes && c.notes.length) ? el('div', { class: 'crm-notes' }, c.notes.slice(0, 4).map(n => el('div', { class: 'crm-note' }, [
            el('span', { class: 'muted', style: 'font-size:12px' }, [new Date(n.time).toLocaleString()]),
            el('span', {}, [n.text])
          ]))) : null,
          el('div', { class: 'crm-foot' }, [noteInput, editBtn, delBtn].filter(Boolean))
        ].filter(Boolean)))
      })
    }

    const addBtn = el('button', { class: 'btn' }, ['＋ 新增客户'])
    addBtn.onclick = () => { resetForm(); fCompany.focus() }
    const saveBtn = el('button', { class: 'btn' }, ['保存客户'])
    saveBtn.onclick = submit
    const exportCsv = el('button', { class: 'btn ghost' }, ['导出 CSV'])
    exportCsv.onclick = () => {
      const head = ['公司', '联系人', '电话', '邮箱', '阶段', '金额', '跟进记录']
      const rows = s.customers.map(c => [c.company, c.contact, c.phone, c.email, c.stage, c.amount, (c.notes || []).map(n => n.text).join(' | ')])
      const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'
      const csv = [head, ...rows].map(r => r.map(esc).join(',')).join('\n')
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv' })
      const a = el('a', { href: URL.createObjectURL(blob), download: '客户跟踪.csv' })
      document.body.append(a); a.click(); a.remove(); toast('已导出', 'ok')
    }

    render()
    root.append(el('div', { class: 'page' }, [
      el('h1', {}, ['客户跟踪']),
      el('p', { class: 'sub' }, ['管理客户阶段与跟进记录，自动统计各阶段数量 / 金额 · 数据存本机']),
      statsWrap,
      el('div', { class: 'card' }, [
        el('div', { class: 'row', style: 'justify-content:space-between;align-items:center' }, [
          el('label', {}, ['客户信息']), el('div', { class: 'row' }, [addBtn, exportCsv])
        ]),
        el('div', { class: 'grid cols-2', style: 'margin-top:8px' }, [
          el('div', { class: 'field' }, [el('label', {}, ['公司/客户名']), fCompany]),
          el('div', { class: 'field' }, [el('label', {}, ['阶段']), fStage])
        ]),
        el('div', { class: 'grid cols-3' }, [
          el('div', { class: 'field' }, [el('label', {}, ['联系人']), fContact]),
          el('div', { class: 'field' }, [el('label', {}, ['电话']), fPhone]),
          el('div', { class: 'field' }, [el('label', {}, ['邮箱']), fEmail])
        ]),
        el('div', { class: 'grid cols-2' }, [
          el('div', { class: 'field' }, [el('label', {}, ['金额(元)']), fAmount]),
          el('div', { class: 'field' }, [el('label', {}, ['首条跟进']), fFirst])
        ]),
        el('div', { class: 'row' }, [saveBtn]), formAlert
      ]),
      list
    ]))
  }
}
