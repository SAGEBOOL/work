// 翻译：示范 AI 网关 + 技能包(skill pack) 模式。
// 源语言支持「自动检测」，目标语言支持「中文」。提示词根据设置中心的行业标签自动调整。
import { el, clear, toast } from '../../core/ui.js'
import { getSettings } from '../../core/store.js'
import { callChat, getProvider } from '../../core/aiGateway.js'

const SOURCES = ['自动检测', '中文', '英语', '日语', '韩语', '法语', '德语', '西班牙语', '俄语']
const TARGETS = ['中文', '英语', '日语', '韩语', '法语', '德语', '西班牙语', '俄语']

export const translatePlugin = {
  id: 'translate',
  name: 'AI 翻译',
  icon: '🌐',
  group: '基础办公',
  mount(root) {
    const s = getSettings()

    const input = el('textarea', { placeholder: '输入要翻译的文本…' })
    const srcSelect = el('select', {}, SOURCES.map((l) => el('option', { value: l }, [l])))
    const tgtSelect = el('select', {}, TARGETS.map((l) => el('option', { value: l }, [l])))
    const out = el('div', { class: 'trans-output', style: 'min-height:120px;white-space:pre-wrap' }, ['译文将显示在这里…'])
    const copyBtn = el('button', { class: 'mini copy-btn', title: '拷贝译文' }, ['拷贝'])
    const btn = el('button', { class: 'btn' }, ['翻译'])
    const alert = el('div', {})

    // —— skill pack：把领域/数据源信息拼进系统提示词 ——
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

    btn.onclick = async () => {
      const text = input.value.trim()
      if (!text) { alert.className = 'alert err'; alert.textContent = '请先输入文本'; return }
      // 始终读取最新设置，避免设置页改动后本页快照过期
      const st = getSettings()
      const provider = getProvider(st.defaultProvider)
      if (!provider) {
        alert.className = 'alert err'
        alert.textContent = '未知默认供应商，请到「设置」检查。'
        return
      }
      const hasKey = provider.isLocal
        ? true
        : (provider.isCustom ? !!provider.apiKey : !!st.apiKeys[provider.id])
      if (!hasKey) {
        alert.className = 'alert err'
        alert.textContent = '未配置默认 AI Key，请到「设置」填写后重试。'
        return
      }
      if (srcSelect.value !== '自动检测' && srcSelect.value === tgtSelect.value) {
        alert.className = 'alert err'
        alert.textContent = '源语言与目标语言相同，请调整后再翻译。'
        return
      }
      btn.disabled = true
      copyBtn.disabled = true
      clear(out); out.textContent = '翻译中…'
      alert.textContent = ''
      let started = false
      try {
        await callChat({
          messages: buildMessages(text, srcSelect.value, tgtSelect.value),
          stream: true,
          onToken: (d) => {
            if (!started) { started = true; clear(out) }
            out.textContent += d
          }
        })
        copyBtn.disabled = false
        toast('翻译完成', 'ok')
      } catch (err) {
        clear(out); out.textContent = '译文将显示在这里…'
        copyBtn.disabled = true
        alert.className = 'alert err'
        alert.textContent = '✗ ' + err.message
        toast('翻译失败：' + err.message, 'err')
      } finally {
        btn.disabled = false
      }
    }

    copyBtn.onclick = async () => {
      const text = out.textContent.trim()
      if (!text || text === '译文将显示在这里…' || text === '翻译中…') {
        toast('没有可拷贝的译文', 'err'); return
      }
      try {
        await navigator.clipboard.writeText(text)
        toast('译文已拷贝', 'ok')
      } catch {
        toast('拷贝失败，请手动复制', 'err')
      }
    }

    const provider = getProvider(s.defaultProvider)
    const modelName = provider?.isLocal
      ? (s.providerConfig?.ollama?.model || '本地模型')
      : (provider?.isCustom
        ? (provider.model || s.defaultProvider)
        : (s.defaultModel || s.defaultProvider))
    const provName = (provider?.name || s.defaultProvider) + ' · ' + modelName
    const page = el('div', { class: 'page' }, [
      el('h1', {}, ['AI 翻译']),
      el('p', { class: 'sub' }, ['示范「AI 网关 + 技能包」模式 · 当前模型：' + provName]),
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
    ])
    root.append(page)
  }
}
