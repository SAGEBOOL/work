// 顶栏：显示当前默认 AI 供应商状态、主题切换、快捷设置入口。
import { el, clear } from '../core/ui.js'
import { getSettings, update } from '../core/store.js'
import { PROVIDERS } from '../core/aiGateway.js'
import { applyTheme } from '../core/ui.js'

export function renderTopbar(root, { navigate }) {
  clear(root)
  const s = getSettings()
  const prov = PROVIDERS[s.defaultProvider]
  const ready = !!s.apiKeys[s.defaultProvider]

  const status = el('span', { class: 'ai-status ' + (ready ? 'on' : 'off') }, [
    ready ? '🟢 ' + (prov?.name || s.defaultProvider) + ' 已就绪' : '🔴 未配置默认 API Key'
  ])

  const themeBtn = el('button', {
    class: 'btn-icon', title: '切换主题',
    onclick: () => {
      const next = (document.documentElement.getAttribute('data-theme') === 'dark') ? 'light' : 'dark'
      applyTheme(next)
      update((st) => { st.settings.theme = next })
    }
  }, [document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙'])

  const setBtn = el('button', {
    class: 'btn-icon', title: '设置',
    onclick: () => navigate('settings')
  }, ['⚙️'])

  root.append(
    el('div', { class: 'topbar-left' }, [status]),
    el('div', { class: 'topbar-right' }, [themeBtn, setBtn])
  )
}
