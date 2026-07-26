// 翻译：示范 AI 网关 + 技能包(skill pack) 模式。
// 提示词根据设置中心的「行业标签 / 数据源」自动调整，体现解耦与复用。
import { el, clear, toast } from '../../core/ui.js'
import { getSettings } from '../../core/store.js'
import { callChat, PROVIDERS } from '../../core/aiGateway.js'

const LANGS = ['英语', '日语', '韩语', '法语', '德语', '西班牙语', '俄语']

export const translatePlugin = {
  id: 'translate',
  name: 'AI 翻译',
  icon: '🌐',
  group: '基础办公',
  mount(root) {
    const s = getSettings()

    const input = el('textarea', { placeholder: '输入要翻译的文本…' })
    const langSelect = el('select', {}, LANGS.map((l) => el('option', { value: l }, [l])))
    const out = el('div', { class: 'card', style: 'min-height:120px;white-space:pre-wrap' }, ['译文将显示在这里…'])
    const btn = el('button', { class: 'btn' }, ['翻译'])
    const alert = el('div', {})

    // —— skill pack：把领域/数据源信息拼进系统提示词 ——
    const buildMessages = (text, target) => {
      const st = getSettings()
      const industries = st.industry.join('、') || '通用'
      const sys = `你是一名专业翻译。用户行业背景：${industries}。
请将用户文本准确、自然地翻译成${target}，保留专有名词与语气，只输出译文本身，不要解释。`
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
      if (!st.apiKeys[st.defaultProvider]) {
        alert.className = 'alert err'
        alert.textContent = '未配置默认 AI Key，请到「设置」填写后重试。'
        return
      }
      btn.disabled = true
      clear(out); out.textContent = '翻译中…'
      alert.textContent = ''
      try {
        await callChat({
          messages: buildMessages(text, langSelect.value),
          stream: true,
          onToken: (d) => { out.textContent += d }
        })
        toast('翻译完成', 'ok')
      } catch (err) {
        clear(out); out.textContent = '译文将显示在这里…'
        alert.className = 'alert err'
        alert.textContent = '✗ ' + err.message
        toast('翻译失败：' + err.message, 'err')
      } finally {
        btn.disabled = false
      }
    }

    const provName = PROVIDERS[s.defaultProvider]?.name || s.defaultProvider
    const page = el('div', { class: 'page' }, [
      el('h1', {}, ['AI 翻译']),
      el('p', { class: 'sub' }, ['示范「AI 网关 + 技能包」模式 · 当前模型：' + provName]),
      el('div', { class: 'card' }, [
        el('div', { class: 'field' }, [el('label', {}, ['原文']), input]),
        el('div', { class: 'field' }, [
          el('label', {}, ['目标语言']), langSelect
        ]),
        btn, alert
      ]),
      el('div', { class: 'card', style: 'margin-top:16px' }, [
        el('label', {}, ['译文']), out
      ])
    ])
    root.append(page)
  }
}
