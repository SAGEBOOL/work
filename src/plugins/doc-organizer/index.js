// 专业功能 · 专业资料整理：本机资料库（分类/标签/搜索/导出 Markdown/JSON）。
import { el, clear, toast } from '../../core/ui.js'

const KEY = 'opwb:doc:v1'
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null } }
const save = (s) => localStorage.setItem(KEY, JSON.stringify(s))

export const docOrganizerPlugin = {
  id: 'doc-organizer',
  name: '专业资料整理',
  icon: '🗂️',
  group: '专业功能',
  mount(root) {
    const s = load() || { items: [] }
    if (!Array.isArray(s.items)) s.items = []
    let editingId = null

    const search = el('input', { type: 'text', placeholder: '搜索标题 / 标签 / 内容…' })
    const catFilter = el('select', {})
    const list = el('div', { class: 'doc-list' })

    const fTitle = el('input', { type: 'text', placeholder: '资料标题' })
    const fCat = el('input', { type: 'text', placeholder: '分类，如 行业报告 / 法规 / 竞品' })
    const fTags = el('input', { type: 'text', placeholder: '标签，逗号分隔' })
    const fLink = el('input', { type: 'text', placeholder: '相关链接（可选）' })
    const fContent = el('textarea', { placeholder: '内容 / 摘要 / 笔记…', style: 'min-height:90px' })
    const formAlert = el('div', {})

    const fillForm = (it) => {
      fTitle.value = it?.title || ''
      fCat.value = it?.category || ''
      fTags.value = (it?.tags || []).join(', ')
      fLink.value = it?.link || ''
      fContent.value = it?.content || ''
    }
    const resetForm = () => { editingId = null; fillForm(null); formAlert.textContent = '' }

    const submit = () => {
      const title = fTitle.value.trim()
      if (!title) { formAlert.className = 'alert err'; formAlert.textContent = '请填写标题'; return }
      const tags = fTags.value.split(',').map(t => t.trim()).filter(Boolean)
      const rec = { title, category: fCat.value.trim(), tags, link: fLink.value.trim(), content: fContent.value.trim(), updated: Date.now() }
      if (editingId) {
        const i = s.items.findIndex(x => x.id === editingId)
        if (i >= 0) s.items[i] = { ...s.items[i], ...rec }
      } else {
        rec.id = 'd' + Date.now()
        s.items.unshift(rec)
      }
      save(s); resetForm(); render(); toast('已保存', 'ok')
    }

    const render = () => {
      const cats = [...new Set(s.items.map(i => i.category).filter(Boolean))]
      clear(catFilter)
      catFilter.append(el('option', { value: '' }, ['全部分类']), ...cats.map(c => el('option', { value: c }, [c])))
      const q = search.value.trim().toLowerCase()
      const cf = catFilter.value
      const items = s.items.filter(it => {
        if (cf && it.category !== cf) return false
        if (q) {
          const hay = (it.title + ' ' + (it.tags || []).join(' ') + ' ' + it.content + ' ' + (it.category || '')).toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      clear(list)
      if (!items.length) list.append(el('div', { class: 'muted' }, ['暂无资料，点击「新增资料」开始整理']))
      items.forEach(it => {
        const editBtn = el('button', { class: 'mini' }, ['编辑'])
        editBtn.onclick = () => { editingId = it.id; fillForm(it); formAlert.textContent = ''; fTitle.focus() }
        const delBtn = el('button', { class: 'mini' }, ['删除'])
        delBtn.onclick = () => {
          if (confirm('确认删除「' + it.title + '」？')) { s.items = s.items.filter(x => x.id !== it.id); save(s); render() }
        }
        const linkEl = it.link ? el('a', { href: it.link, target: '_blank', rel: 'noopener', class: 'doc-link' }, ['🔗 链接']) : null
        list.append(el('div', { class: 'doc-item' }, [
          el('div', { class: 'doc-head' }, [
            el('b', {}, [it.title]),
            it.category ? el('span', { class: 'tag' }, [it.category]) : null,
            ...(it.tags || []).map(t => el('span', { class: 'tag soft' }, [t]))
          ].filter(Boolean)),
          it.content ? el('div', { class: 'doc-body' }, [it.content]) : null,
          el('div', { class: 'doc-foot' }, [linkEl, editBtn, delBtn].filter(Boolean))
        ].filter(Boolean)))
      })
    }

    search.oninput = render
    catFilter.onchange = render

    const addBtn = el('button', { class: 'btn' }, ['＋ 新增资料'])
    addBtn.onclick = () => { resetForm(); fTitle.focus() }
    const saveBtn = el('button', { class: 'btn' }, ['保存资料'])
    saveBtn.onclick = submit
    const exportMd = el('button', { class: 'btn ghost' }, ['导出 Markdown'])
    exportMd.onclick = () => {
      const md = s.items.map(it => `## ${it.title}\n` +
        (it.category ? `**分类**：${it.category}\n` : '') +
        (it.tags && it.tags.length ? `**标签**：${it.tags.join(', ')}\n` : '') +
        (it.link ? `**链接**：${it.link}\n` : '') +
        (it.content ? `\n${it.content}\n` : '')).join('\n')
      const blob = new Blob([md || '（空）'], { type: 'text/markdown' })
      const a = el('a', { href: URL.createObjectURL(blob), download: '资料库.md' })
      document.body.append(a); a.click(); a.remove(); toast('已导出', 'ok')
    }
    const exportJson = el('button', { class: 'btn ghost' }, ['导出 JSON'])
    exportJson.onclick = () => {
      const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' })
      const a = el('a', { href: URL.createObjectURL(blob), download: '资料库.json' })
      document.body.append(a); a.click(); a.remove(); toast('已导出', 'ok')
    }

    render()
    root.append(el('div', { class: 'page' }, [
      el('h1', {}, ['专业资料整理']),
      el('p', { class: 'sub' }, ['建立本机资料库：分类、标签、搜索、导出 · 数据存浏览器']),
      el('div', { class: 'card' }, [
        el('div', { class: 'row', style: 'justify-content:space-between;align-items:center' }, [
          el('label', {}, ['资料库']), el('div', { class: 'row' }, [addBtn, exportMd, exportJson])
        ]),
        el('div', { class: 'row', style: 'margin:8px 0' }, [search, catFilter]),
        el('div', { class: 'card-soft', style: 'margin-top:8px' }, [
          el('div', { class: 'field' }, [el('label', {}, ['标题']), fTitle]),
          el('div', { class: 'grid cols-2' }, [
            el('div', { class: 'field' }, [el('label', {}, ['分类']), fCat]),
            el('div', { class: 'field' }, [el('label', {}, ['标签']), fTags])
          ]),
          el('div', { class: 'field' }, [el('label', {}, ['链接']), fLink]),
          el('div', { class: 'field' }, [el('label', {}, ['内容 / 笔记']), fContent]),
          el('div', { class: 'row' }, [saveBtn]), formAlert
        ])
      ]),
      list
    ]))
  }
}
