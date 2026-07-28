// 翻译：示范 AI 网关 + 技能包(skill pack) 模式。
// 源语言支持「自动检测」，目标语言支持「中文」。提示词根据设置中心的行业标签自动调整。
// 2026-07-28 新增：翻译历史与收藏（存本机）。
import { el, clear, toast } from '../../core/ui.js'
import { getSettings } from '../../core/store.js'
import { callChat, getProvider } from '../../core/aiGateway.js'

const SOURCES = ['自动检测', '中文', '英语', '日语', '韩语', '法语', '德语', '西班牙语', '俄语']
const TARGETS = ['中文', '英语', '日语', '韩语', '法语', '德语', '西班牙语', '俄语']

const HKEY = 'opwb:translate:history'
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
const loadH = () => { try { return JSON.parse(localStorage.getItem(HKEY)) || [] } catch { return [] } }
const saveH = (a) => { try { localStorage.setItem(HKEY, JSON.stringify(a.slice(0, 300))) } catch {} }

export const translatePlugin = {
  id: 'translate',
  name: 'AI 翻译',
  icon: '🌐',
  group: '基础办公',
  mount(root) {
    const s = getSettings()
    const provider = getProvider(s.defaultProvider)
    const modelName = provider?.isLocal
      ? (s.providerConfig?.ollama?.model || '本地模型')
      : (provider?.isCustom ? (provider.model || s.defaultProvider) : (s.defaultModel || s.defaultProvider))
    const provName = (provider?.name || s.defaultProvider) + ' · ' + modelName

    // —— 历史收藏：从收藏夹载入到翻译框的待填值 ——
    let pendingLoad = null

    const view = el('div', {})
    const seg = el('div', { class: 'seg' })
    const tabTranslate = el('button', { class: 'seg-btn', onclick: () => setView('translate') }, ['🌐 翻译'])
    const tabHistory = el('button', { class: 'seg-btn', onclick: () => setView('history') }, ['📜 历史收藏'])
    seg.append(tabTranslate, tabHistory)

    const renderTranslate = () => {
      const input = el('textarea', { placeholder: '输入要翻译的文本…', style: 'min-height:120px' })
      const srcSelect = el('select', {}, SOURCES.map((l) => el('option', { value: l }, [l])))
      const tgtSelect = el('select', {}, TARGETS.map((l) => el('option', { value: l }, [l])))
      const out = el('div', { class: 'trans-output', style: 'min-height:120px;white-space:pre-wrap' }, ['译文将显示在这里…'])
      const copyBtn = el('button', { class: 'mini copy-btn', title: '拷贝译文' }, ['拷贝'])
      const btn = el('button', { class: 'btn' }, ['翻译'])
      const alert = el('div', {})

      // 若从历史收藏「载入」，回填
      if (pendingLoad) {
        input.value = pendingLoad.input || ''
        srcSelect.value = pendingLoad.src || '自动检测'
        tgtSelect.value = pendingLoad.tgt || '中文'
        pendingLoad = null
      }

      const buildMessages = (text, source, target) => {
        const st = getSettings()
        const industries = st.industry.join('、') || '通用'
        const srcDesc = source === '自动检测' ? '自动检测原文语言' : `从${source}`
        const sys = `你是一名专业翻译。用户行业背景：${industries}。
请将用户文本${srcDesc}准确、自然地翻译成${target}，保留专有名词与语气，只输出译文本身，不要解释。`
        return [
          { role: 'system', content: sys },
          { role: 'user', content: text }
        ]
      }

      const recordHistory = (text, source, target, output) => {
        const arr = loadH()
        arr.unshift({ id: uid(), src: source, tgt: target, input: text, output, time: Date.now(), fav: false })
        saveH(arr)
        toast('已记入历史', 'ok')
      }

      btn.onclick = async () => {
        const text = input.value.trim()
        if (!text) { alert.className = 'alert err'; alert.textContent = '请先输入文本'; return }
        const st = getSettings()
        const prov = getProvider(st.defaultProvider)
        if (!prov) { alert.className = 'alert err'; alert.textContent = '未知默认供应商，请到「设置」检查。'; return }
        const hasKey = prov.isLocal ? true : (prov.isCustom ? !!prov.apiKey : !!st.apiKeys[prov.id])
        if (!hasKey) { alert.className = 'alert err'; alert.textContent = '未配置默认 AI Key，请到「设置」填写后重试。'; return }
        if (srcSelect.value !== '自动检测' && srcSelect.value === tgtSelect.value) {
          alert.className = 'alert err'; alert.textContent = '源语言与目标语言相同，请调整后再翻译。'; return
        }
        btn.disabled = true; copyBtn.disabled = true
        clear(out); out.textContent = '翻译中…'; alert.textContent = ''
        let acc = ''
        try {
          await callChat({
            messages: buildMessages(text, srcSelect.value, tgtSelect.value),
            stream: true,
            onToken: (d) => { if (!acc) { acc = ''; clear(out) } acc += d; out.textContent = acc }
          })
          copyBtn.disabled = false
          recordHistory(text, srcSelect.value, tgtSelect.value, acc)
          toast('翻译完成', 'ok')
        } catch (err) {
          clear(out); out.textContent = '译文将显示在这里…'; copyBtn.disabled = true
          alert.className = 'alert err'; alert.textContent = '✗ ' + err.message
          toast('翻译失败：' + err.message, 'err')
        } finally { btn.disabled = false }
      }

      copyBtn.onclick = async () => {
        const text = out.textContent.trim()
        if (!text || text === '译文将显示在这里…' || text === '翻译中…') { toast('没有可拷贝的译文', 'err'); return }
        try { await navigator.clipboard.writeText(text); toast('译文已拷贝', 'ok') } catch { toast('拷贝失败，请手动复制', 'err') }
      }

      view.append(
        el('div', { class: 'card' }, [
          el('div', { class: 'field' }, [el('label', {}, ['原文']), input]),
          el('div', { class: 'row' }, [
            el('div', { class: 'field', style: 'flex:1' }, [el('label', {}, ['源语言']), srcSelect]),
            el('div', { class: 'field', style: 'flex:1' }, [el('label', {}, ['目标语言']), tgtSelect])
          ]),
          btn, alert
        ]),
        el('div', { class: 'card', style: 'margin-top:16px' }, [
          el('div', { class: 'trans-header' }, [el('label', {}, ['译文']), copyBtn]),
          out
        ])
      )
    }

    const renderHistory = () => {
      const arr = loadH()
      const filterSel = el('select', {}, [
        el('option', { value: 'all' }, ['全部']),
        el('option', { value: 'fav' }, ['★ 仅收藏'])
      ])
      const searchI = el('input', { type: 'text', placeholder: '🔍 搜索原文/译文', style: 'flex:1;min-width:160px' })
      const listBox = el('div', { class: 'kv-table' })
      const fmtTime = (t) => new Date(t).toLocaleString()

      const draw = () => {
        clear(listBox)
        const q = searchI.value.trim().toLowerCase()
        const favOnly = filterSel.value === 'fav'
        const items = arr.filter((r) =>
          (!favOnly || r.fav) &&
          (!q || (r.input + ' ' + r.output).toLowerCase().includes(q))
        )
        listBox.append(el('div', { class: 'kv-h' }, [el('span', {}, ['原文 → 译文']), el('span', {}, ['语言']), el('span', {}, ['']), el('span', {}, ['']), el('span', {}, [''])]))
        if (!items.length) {
          listBox.append(el('div', { class: 'kv-r', style: 'grid-template-columns:1fr' }, [el('span', { class: 'muted' }, ['（暂无记录。在「翻译」页完成翻译会自动保存到这里）'])]))
          return
        }
        items.forEach((r) => {
          const star = el('button', { class: 'mini', title: r.fav ? '取消收藏' : '收藏' }, [r.fav ? '★' : '☆'])
          star.onclick = () => {
            const a = loadH(); const t = a.find((x) => x.id === r.id); if (t) { t.fav = !t.fav; saveH(a); draw() }
          }
          const loadBtn = el('button', { class: 'mini', title: '载入到翻译框' }, ['载入'])
          loadBtn.onclick = () => { pendingLoad = { input: r.input, src: r.src, tgt: r.tgt }; setView('translate'); toast('已载入到翻译框', 'ok') }
          const copyBtn = el('button', { class: 'mini', title: '复制译文' }, ['复制'])
          copyBtn.onclick = async () => {
            try { await navigator.clipboard.writeText(r.output); toast('已复制译文', 'ok') } catch { toast('复制失败', 'err') }
          }
          const del = el('button', { class: 'mini', title: '删除' }, ['✕'])
          del.onclick = () => {
            if (!confirm('确认删除这条记录？')) return
            saveH(loadH().filter((x) => x.id !== r.id)); draw()
          }
          listBox.append(el('div', { class: 'kv-r', style: 'grid-template-columns:3fr 1.4fr 44px 44px 44px 44px' }, [
            el('div', {}, [
              el('div', { style: 'font-weight:600;word-break:break-all' }, [(r.input || '').slice(0, 80) + (r.input && r.input.length > 80 ? '…' : '')]),
              el('div', { class: 'muted', style: 'font-size:12px;margin-top:2px;word-break:break-all' }, [(r.output || '').slice(0, 100) + (r.output && r.output.length > 100 ? '…' : '')]),
              el('div', { class: 'muted', style: 'font-size:11px;margin-top:2px' }, [fmtTime(r.time)])
            ]),
            el('span', { class: 'muted', style: 'font-size:12px' }, [r.src + '→' + r.tgt]),
            star, copyBtn, loadBtn, del
          ]))
        })
      }
      filterSel.onchange = draw
      searchI.oninput = draw
      draw()

      const clearAll = el('button', { class: 'btn ghost' }, ['清空全部'])
      clearAll.onclick = () => { if (confirm('确认清空全部翻译历史？此操作不可恢复。')) { saveH([]); draw(); toast('已清空', 'ok') } }

      view.append(
        el('div', { class: 'card' }, [
          el('h3', {}, ['📜 翻译历史与收藏']),
          el('p', { class: 'hint' }, ['每次翻译自动保存原文、译文与语种。点击 ☆ 收藏重要内容，★ 表示已收藏；可搜索、载入重译或删除。数据仅存本机。']),
          el('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap;margin:8px 0' }, [searchI, el('div', { class: 'field', style: 'flex:0 0 140px' }, [el('label', {}, ['筛选']), filterSel]), clearAll]),
          listBox
        ])
      )
    }

    let current = ''
    const setView = (v) => {
      if (v === current) return
      current = v
      tabTranslate.classList.toggle('on', v === 'translate')
      tabHistory.classList.toggle('on', v === 'history')
      clear(view)
      if (v === 'translate') renderTranslate(); else renderHistory()
    }
    setView('translate')

    const page = el('div', { class: 'page' }, [
      el('h1', {}, ['AI 翻译']),
      el('p', { class: 'sub' }, ['示范「AI 网关 + 技能包」模式 · 当前模型：' + provName]),
      seg, view
    ])
    root.append(page)
  }
}
