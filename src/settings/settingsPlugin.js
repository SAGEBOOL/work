// 设置中心：所有插件的公共底座。
// 负责 API Key、默认模型、行业标签、数据源、主题，并持久化到 localStorage。
import { el, clear, toast } from '../core/ui.js'
import { getSettings, update, INDUSTRY_PRESETS, DATA_SOURCE_PRESETS } from '../core/store.js'
import { PROVIDERS, callChat } from '../core/aiGateway.js'

export const settingsPlugin = {
  id: 'settings',
  name: '设置中心',
  icon: '⚙️',
  group: '设置',
  mount(root) {
    const s = getSettings()

    // 保存状态提示（定义在前，供各处理器调用；运行时 saveStatus 已初始化）
    const markSaved = () => {
      saveStatus.className = 'save-status ok'
      saveStatus.textContent = '✓ 已保存 ' + new Date().toLocaleTimeString()
    }

    const page = el('div', { class: 'page' }, [
      el('h1', {}, ['设置中心']),
      el('p', { class: 'sub' }, ['API 密钥仅保存在本机浏览器，请求直接从浏览器发往对应厂商。换设备需重新填写。'])
    ])

    // ---------- 1. AI 供应商配置 ----------
    const providerArea = el('div', { class: 'provider-area' })

    // 默认供应商下拉框
    const provSelect = el('select', {
      onchange: (e) => {
        const pid = e.target.value
        update((st) => { st.settings.defaultProvider = pid })
        // 刷新该供应商的配置表单与模型选项
        renderProviderArea(pid)
        renderModelField(pid)
        markSaved()
      }
    }, Object.values(PROVIDERS).map((p) => el('option', { value: p.id }, [p.name])))
    provSelect.value = s.defaultProvider

    // 默认模型区域（云厂商用下拉，Ollama 用文本输入）
    const modelWrap = el('div', { class: 'model-wrap' })
    const renderModelField = (pid) => {
      clear(modelWrap)
      const p = PROVIDERS[pid]
      if (p.isLocal) {
        const cfg = s.providerConfig?.ollama || { baseUrl: 'http://localhost:11434', model: 'llama3.1' }
        const input = el('input', {
          type: 'text',
          value: cfg.model,
          placeholder: '如 llama3.1、qwen2.5',
          oninput: (e) => {
            update((st) => {
              st.settings.providerConfig = st.settings.providerConfig || {}
              st.settings.providerConfig.ollama = { ...st.settings.providerConfig.ollama, model: e.target.value.trim() }
            })
            markSaved()
          }
        })
        modelWrap.append(input)
      } else {
        const sel = el('select', {
          onchange: (e) => { update((st) => { st.settings.defaultModel = e.target.value }); markSaved() }
        }, p.models.map((m) => el('option', { value: m }, [m])))
        const current = s.defaultModel
        sel.value = p.models.includes(current) ? current : p.models[0]
        if (!p.models.includes(current)) {
          update((st) => { st.settings.defaultModel = p.models[0] })
        }
        modelWrap.append(sel)
      }
    }

    // 供应商配置表单：云厂商显示 Key，Ollama 显示本地地址+模型
    const renderProviderArea = (pid) => {
      clear(providerArea)
      const p = PROVIDERS[pid]
      if (p.isLocal) {
        const cfg = s.providerConfig?.ollama || { baseUrl: 'http://localhost:11434', model: 'llama3.1' }
        const baseInput = el('input', {
          type: 'text',
          value: cfg.baseUrl,
          placeholder: 'http://localhost:11434',
          oninput: (e) => {
            update((st) => {
              st.settings.providerConfig = st.settings.providerConfig || {}
              st.settings.providerConfig.ollama = { ...st.settings.providerConfig.ollama, baseUrl: e.target.value.trim() }
            })
            markSaved()
          }
        })
        const hint = el('p', { class: 'hint' }, [
          '浏览器访问本地 Ollama 需以 CORS 方式启动：',
          el('code', {}, ['OLLAMA_ORIGINS="*" ollama serve'])
        ])
        providerArea.append(
          el('div', { class: 'field' }, [el('label', {}, ['本地服务地址']), baseInput]),
          hint
        )
      } else {
        const input = el('input', {
          type: 'password',
          placeholder: '粘贴 ' + p.name + ' 的 API Key',
          value: s.apiKeys[pid] || '',
          oninput: (e) => { update((st) => { st.apiKeys[pid] = e.target.value.trim() }); markSaved() }
        })
        const link = el('a', { class: 'hint', href: p.doc, target: '_blank', rel: 'noreferrer' }, ['获取密钥 ↗'])
        const hint = el('span', { class: 'prov-hint ' + (p.browserOk ? 'ok' : 'no') },
          [p.browserOk ? '✓ 浏览器可直接调用' : '✗ 浏览器直连被 CORS 拦截（建议换其他厂商）'])
        providerArea.append(
          el('div', { class: 'field' }, [el('label', {}, [p.name + ' API Key'])]),
          el('div', { class: 'row' }, [input, hint]),
          link
        )
      }
    }

    // 测试当前默认供应商
    const testBtn = el('button', { class: 'btn ghost' }, ['测试当前供应商连通性'])
    const testAlert = el('div', {})
    testBtn.onclick = async () => {
      testBtn.disabled = true
      testAlert.className = 'alert'
      testAlert.textContent = '请求中…'
      try {
        const r = await callChat({ messages: [{ role: 'user', content: '回复两个字：正常' }], stream: false })
        testAlert.className = 'alert ok'
        testAlert.textContent = '✓ 连通成功：' + (r || '').slice(0, 40)
        toast('连通测试成功', 'ok')
      } catch (err) {
        testAlert.className = 'alert err'
        testAlert.textContent = '✗ ' + err.message
        toast('连通失败：' + err.message, 'err')
      } finally {
        testBtn.disabled = false
      }
    }

    // 初始渲染
    renderProviderArea(s.defaultProvider)
    renderModelField(s.defaultProvider)

    const apiCard = el('div', { class: 'card' }, [
      el('h3', {}, ['AI 供应商配置']),
      el('div', { class: 'field' }, [el('label', {}, ['默认 AI 供应商']), provSelect]),
      providerArea,
      el('div', { class: 'field' }, [el('label', {}, ['默认模型']), modelWrap]),
      testBtn, testAlert,
      el('p', { class: 'hint' }, ['各插件可单独覆盖，不填则使用此处默认。'])
    ])

    // ---------- 3. 行业标签 ----------
    const chipWrap = el('div', { class: 'chips' })
    const syncChips = () => {
      clear(chipWrap)
      const cur = getSettings().industry
      INDUSTRY_PRESETS.forEach((tag) => {
        const on = cur.includes(tag)
        chipWrap.append(el('span', {
          class: 'chip' + (on ? ' on' : ''),
          onclick: () => {
            update((st) => {
              const i = st.settings.industry.indexOf(tag)
              if (i >= 0) st.settings.industry.splice(i, 1)
              else st.settings.industry.push(tag)
            })
            syncChips()
            markSaved()
          }
        }, [tag]))
      })
    }
    syncChips()

    const customInput = el('input', { type: 'text', placeholder: '自定义行业，回车添加' })
    customInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.value.trim()) {
        const v = e.target.value.trim()
        update((st) => { if (!st.settings.industry.includes(v)) st.settings.industry.push(v) })
        e.target.value = ''
        syncChips()
        markSaved()
      }
    })

    const industryCard = el('div', { class: 'card' }, [
      el('h3', {}, ['行业标签']),
      el('p', { class: 'hint' }, ['将注入到 AI 提示词，让翻译/分析/写作更贴合你的领域。']),
      chipWrap,
      el('div', { class: 'field', style: 'margin-top:12px' }, [customInput])
    ])

    // ---------- 4. 数据源 ----------
    const srcWrap = el('div', {})
    DATA_SOURCE_PRESETS.forEach((d) => {
      const toggle = el('input', {
        type: 'checkbox',
        onchange: (e) => { update((st) => { st.settings.dataSources[d.id] = e.target.checked }); markSaved() }
      })
      toggle.checked = !!s.dataSources[d.id]
      srcWrap.append(el('label', { class: 'switch' }, [
        el('div', {}, [el('div', { class: 'name' }, [d.name]), el('div', { class: 'desc' }, [d.desc])]),
        toggle
      ]))
    })
    const srcCard = el('div', { class: 'card' }, [
      el('h3', {}, ['数据源开关']),
      srcWrap,
      el('p', { class: 'hint' }, ['开启后，对应插件可调用该来源（纯前端版本仅作标记，后续接入具体能力）。'])
    ])

    // ---------- 5. 主题 ----------
    const themeSelect = el('select', {
      onchange: (e) => { update((st) => { st.settings.theme = e.target.value }); markSaved() }
    }, [
      el('option', { value: 'light' }, ['浅色']),
      el('option', { value: 'dark' }, ['深色'])
    ])
    themeSelect.value = s.theme
    const themeCard = el('div', { class: 'card' }, [
      el('h3', {}, ['外观']),
      el('div', { class: 'field' }, [el('label', {}, ['主题']), themeSelect])
    ])

    page.append(apiCard)
    page.append(el('div', { class: 'grid cols-2' }, [industryCard, srcCard]))
    page.append(themeCard)

    // ---------- 保存栏 ----------
    const saveStatus = el('span', { class: 'save-status' }, ['● 修改自动保存已开启'])
    const saveBtn = el('button', { class: 'btn primary' }, ['💾 保存设置'])
    // 任何设置变更都更新状态提示（行业/数据源/主题等）
    saveBtn.onclick = () => {
      update((st) => { /* 强制把当前内存状态写入 localStorage */ })
      markSaved()
      toast('设置已保存', 'ok')
    }
    const saveBar = el('div', { class: 'save-bar' }, [saveBtn, saveStatus])

    root.append(page)
    root.append(saveBar)
  }
}
