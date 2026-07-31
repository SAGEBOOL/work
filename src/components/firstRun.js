// 首次启动向导：未引导过（无 opwb:onboarded:v1）时自动弹出。
// 三步：欢迎 → 选行业标签 →（可选）配置默认 AI → 完成。可随时跳过。
import { el, clear, toast } from '../core/ui.js'
import { getSettings, update, INDUSTRY_PRESETS, isOnboarded, setOnboarded } from '../core/store.js'
import { PROVIDERS, getProvider } from '../core/aiGateway.js'

let root = null

function close() {
  if (root) root.remove(); root = null
}

export function maybeShowFirstRun() {
  if (isOnboarded()) return
  render()
}

function render() {
  let step = 0
  const s = getSettings()
  const chosen = new Set(s.industry || [])

  const card = el('div', { class: 'fr-card' })
  const overlay = el('div', { class: 'fr-overlay' }, [card])

  const title = el('h2', { class: 'fr-title' })
  const body = el('div', { class: 'fr-body' })
  const footer = el('div', { class: 'fr-foot' })
  const skip = el('button', { class: 'btn ghost', onclick: () => { setOnboarded(); close() } }, ['跳过引导'])
  const next = el('button', { class: 'btn' })

  const drawWelcome = () => {
    title.textContent = '👋 欢迎使用一人公司工作中台'
    clear(body)
    body.append(
      el('p', { class: 'muted' }, ['这是一个纯本机的多功能工作台：办公工具 + 专业资料/客户/经营分析 + 休闲。三步即可上手，全程数据只存在你的浏览器。']),
      el('div', { class: 'fr-tips' }, [
        el('div', {}, ['⚡ 随时按 ⌘K / Ctrl+K 打开命令面板，秒搜任意功能']),
        el('div', {}, ['🤖 配置一个 AI 厂商后，翻译/分析/写作更顺手']),
        el('div', {}, ['💾 记得在「设置中心 → 数据管理」定期导出备份'])
      ])
    )
    next.textContent = '开始（约 1 分钟）'
    next.onclick = () => { step = 1; draw() }
  }

  const drawIndustry = () => {
    title.textContent = '① 选你的行业标签'
    clear(body)
    body.append(el('p', { class: 'muted' }, ['会注入 AI 提示词，让翻译/分析更贴合你的领域。可多选，之后在设置里随时改。']))
    const chips = el('div', { class: 'chips' })
    const sync = () => {
      clear(chips)
      INDUSTRY_PRESETS.forEach((tag) => {
        const on = chosen.has(tag)
        chips.append(el('span', {
          class: 'chip' + (on ? ' on' : ''),
          onclick: () => { on ? chosen.delete(tag) : chosen.add(tag); sync() }
        }, [tag]))
      })
    }
    sync()
    body.append(chips)
    next.textContent = '下一步：配置 AI（可选）'
    next.onclick = () => {
      update((st) => { st.settings.industry = [...chosen]; if (!st.settings.industry.length) st.settings.industry = ['通用'] })
      step = 2; draw()
    }
  }

  const drawAI = () => {
    title.textContent = '② 配置默认 AI（可选）'
    clear(body)
    body.append(el('p', { class: 'muted' }, ['以 DeepSeek 为例（免费、浏览器可直接调用）。跳过也行，之后在「设置中心」随时填。']))
    const sel = el('select', {}, Object.values(PROVIDERS).map((p) => el('option', { value: p.id }, [p.name + (p.browserOk ? '' : '（浏览器受限）')])))
    sel.value = s.defaultProvider || 'deepseek'
    const keyInput = el('input', { type: 'password', placeholder: '粘贴 API Key（可留空跳过）' })
    const hint = el('p', { class: 'hint' }, ['获取地址：', el('a', { href: PROVIDERS.deepseek.doc, target: '_blank', rel: 'noreferrer' }, ['DeepSeek 密钥 ↗'])])
    body.append(
      el('div', { class: 'field' }, [el('label', {}, ['默认 AI 供应商']), sel]),
      el('div', { class: 'field' }, [el('label', {}, ['API Key']), keyInput]),
      hint
    )
    next.textContent = '完成，进入工作台'
    next.onclick = () => {
      update((st) => {
        st.settings.defaultProvider = sel.value
        if (keyInput.value.trim()) st.settings.apiKeys[sel.value] = keyInput.value.trim()
      })
      finish()
    }
  }

  const draw = () => { if (step === 0) drawWelcome(); else if (step === 1) drawIndustry(); else drawAI() }

  footer.append(skip, next)
  card.append(title, body, footer)
  draw() // 渲染首屏（修复：否则向导空白且整条分支被打包器摇树移除）
  root = overlay
  document.body.append(overlay)
}

function finish() {
  setOnboarded()
  close()
  toast('引导完成，开始使用吧', 'ok')
}
