// 设置中心：所有插件的公共底座。
// 负责 API Key、默认模型、行业标签、数据源、主题、自定义模型，并持久化到 localStorage。
import { el, clear, toast } from '../core/ui.js'
import { getSettings, update, INDUSTRY_PRESETS, DATA_SOURCE_PRESETS } from '../core/store.js'
import { PROVIDERS, getProvider, callChat } from '../core/aiGateway.js'

export const settingsPlugin = {
  id: 'settings',
  name: '设置中心',
  icon: '⚙️',
  group: '设置',
  mount(root) {
    const s = getSettings()

    // 保存状态提示
    const markSaved = () => {
      saveStatus.className = 'save-status ok'
      saveStatus.textContent = '✓ 已保存 ' + new Date().toLocaleTimeString()
    }

    const page = el('div', { class: 'page' }, [
      el('h1', {}, ['设置中心']),
      el('p', { class: 'sub' }, ['API 密钥仅保存在本机浏览器，请求直接从浏览器发往对应厂商。换设备需重新填写。'])
    ])

    // ---------- 通用：测试某个供应商 ----------
    const testProvider = async (pid, alertEl, btnEl) => {
      if (btnEl) btnEl.disabled = true
      if (alertEl) {
        alertEl.className = 'alert'
        alertEl.textContent = '请求中…'
      }
      try {
        const r = await callChat({ messages: [{ role: 'user', content: '回复两个字：正常' }], provider: pid, stream: false })
        if (alertEl) {
          alertEl.className = 'alert ok'
          alertEl.textContent = '✓ 连通成功：' + (r || '').slice(0, 40)
        }
        toast('连通测试成功', 'ok')
      } catch (err) {
        const p = getProvider(pid)
        const sentKey = p?.isCustom ? p.apiKey : (getSettings().apiKeys[pid] || '')
        const mask = sentKey.length
          ? (sentKey.slice(0, 4) + '…' + sentKey.slice(-4) + '（共 ' + sentKey.length + ' 字符）')
          : '（空，未存储该供应商 Key）'
        if (alertEl) {
          alertEl.className = 'alert err'
          alertEl.textContent = '✗ ' + err.message + ' ｜ 当前发送 Key：' + mask
        }
        toast('连通失败：' + err.message, 'err')
      } finally {
        if (btnEl) btnEl.disabled = false
      }
    }

    // ---------- 1. AI 供应商配置 ----------
    const providerArea = el('div', { class: 'provider-area' })

    // 默认供应商下拉框
    const provSelect = el('select', {
      onchange: (e) => {
        const pid = e.target.value
        const p = getProvider(pid)
        update((st) => {
          st.settings.defaultProvider = pid
          if (p?.isCustom) st.settings.defaultModel = p.model
        })
        renderProviderArea(pid)
        renderModelField(pid)
        markSaved()
      }
    })
    const buildProvOptions = () => {
      clear(provSelect)
      const customs = getSettings().customModels || []
      provSelect.append(el('optgroup', { label: '内置供应商' }, Object.values(PROVIDERS).map((p) => el('option', { value: p.id }, [p.name]))))
      if (customs.length) {
        provSelect.append(el('optgroup', { label: '自定义模型' }, customs.map((m) => el('option', { value: m.id }, [m.name + '（自定义）']))))
      }
      provSelect.value = getSettings().defaultProvider || Object.keys(PROVIDERS)[0]
    }

    // 默认模型区域
    const modelWrap = el('div', { class: 'model-wrap' })
    const renderModelField = (pid) => {
      clear(modelWrap)
      const p = getProvider(pid)
      if (!p) return
      if (p.isCustom) {
        modelWrap.append(el('input', { type: 'text', value: p.model || '', disabled: true, title: '在「自定义模型」卡片中修改' }))
      } else if (p.isLocal) {
        const cfg = getSettings().providerConfig?.ollama || { baseUrl: 'http://localhost:11434', model: 'llama3.1' }
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
        const cur = getSettings().defaultModel
        const isCustom = !!cur && !p.models.includes(cur)
        if (!isCustom && (!cur || !p.models.includes(cur))) {
          update((st) => { st.settings.defaultModel = p.models[0] })
        }
        const customBox = el('div', { style: 'margin-top:8px' })
        const showCustom = () => {
          const input = el('input', {
            type: 'text',
            value: isCustom ? cur : '',
            placeholder: '输入自定义模型名，如 glm-4-long、deepseek-reasoner',
            oninput: (e) => { update((st) => { st.settings.defaultModel = e.target.value.trim() }); markSaved() }
          })
          customBox.append(input)
        }
        const sel = el('select', {
          onchange: (e) => {
            clear(customBox)
            if (e.target.value === '__custom__') showCustom()
            else { update((st) => { st.settings.defaultModel = e.target.value }); markSaved() }
          }
        }, [
          ...p.models.map((m) => el('option', { value: m }, [m])),
          el('option', { value: '__custom__' }, ['＋ 自定义模型…'])
        ])
        sel.value = isCustom ? '__custom__' : (cur && p.models.includes(cur) ? cur : p.models[0])
        modelWrap.append(sel)
        if (isCustom) showCustom()
      }
    }

    // 供应商配置表单
    const renderProviderArea = (pid) => {
      clear(providerArea)
      const p = getProvider(pid)
      if (!p) return
      if (p.isCustom) {
        const m = (getSettings().customModels || []).find((x) => x.id === pid)
        if (!m) return
        providerArea.append(
          el('div', { class: 'alert' }, [
            '当前默认供应商为自定义模型「' + m.name + '」。可在下方「自定义模型」卡片中修改其配置。'
          ])
        )
      } else if (p.isLocal) {
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
          oninput: (e) => { update((st) => { st.settings.apiKeys[pid] = e.target.value.trim() }); markSaved() }
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
    testBtn.onclick = () => testProvider(getSettings().defaultProvider, testAlert, testBtn)

    // 初始渲染
    buildProvOptions()
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

    // ---------- 2. 自定义模型 ----------
    const customModelsList = el('div', { class: 'custom-models' })
    const renderCustomModels = () => {
      clear(customModelsList)
      const models = getSettings().customModels || []
      if (!models.length) {
        customModelsList.append(el('div', { class: 'muted', style: 'padding:8px 0' }, ['暂无自定义模型，点击下方按钮添加。']))
      }
      models.forEach((m) => {
        const row = el('div', { class: 'custom-model-row' })
        const nameInput = el('input', {
          type: 'text', value: m.name, placeholder: '显示名称',
          oninput: (e) => {
            update((st) => { const t = st.settings.customModels.find((x) => x.id === m.id); if (t) t.name = e.target.value.trim() })
            buildProvOptions()
            markSaved()
          }
        })
        const modelInput = el('input', {
          type: 'text', value: m.model, placeholder: '模型 ID，如 gpt-4o',
          oninput: (e) => {
            update((st) => { const t = st.settings.customModels.find((x) => x.id === m.id); if (t) t.model = e.target.value.trim() })
            if (m.id === getSettings().defaultProvider) renderModelField(m.id)
            markSaved()
          }
        })
        const baseInput = el('input', {
          type: 'text', value: m.baseUrl, placeholder: 'https://api.example.com/v1',
          oninput: (e) => {
            update((st) => { const t = st.settings.customModels.find((x) => x.id === m.id); if (t) t.baseUrl = e.target.value.trim().replace(/\/$/, '') })
            markSaved()
          }
        })
        const keyInput = el('input', {
          type: 'password', value: m.apiKey, placeholder: 'API Key',
          oninput: (e) => {
            update((st) => { const t = st.settings.customModels.find((x) => x.id === m.id); if (t) t.apiKey = e.target.value.trim() })
            markSaved()
          }
        })
        const defaultBtn = el('button', { class: 'btn ' + (m.isDefault ? 'primary' : 'ghost') }, [m.isDefault ? '默认' : '设为默认'])
        defaultBtn.onclick = () => {
          update((st) => {
            st.settings.customModels.forEach((x) => { x.isDefault = false })
            const t = st.settings.customModels.find((x) => x.id === m.id)
            if (t) t.isDefault = true
            st.settings.defaultProvider = m.id
            st.settings.defaultModel = m.model
          })
          buildProvOptions()
          renderProviderArea(m.id)
          renderModelField(m.id)
          renderCustomModels()
          markSaved()
        }
        const delBtn = el('button', { class: 'btn ghost' }, ['删除'])
        delBtn.onclick = () => {
          if (!confirm('确认删除自定义模型「' + m.name + '」？')) return
          update((st) => {
            st.settings.customModels = st.settings.customModels.filter((x) => x.id !== m.id)
            if (st.settings.defaultProvider === m.id) {
              st.settings.defaultProvider = 'deepseek'
              st.settings.defaultModel = PROVIDERS.deepseek.models[0]
            }
          })
          buildProvOptions()
          renderProviderArea(getSettings().defaultProvider)
          renderModelField(getSettings().defaultProvider)
          renderCustomModels()
          markSaved()
        }
        const testAlertItem = el('div', {})
        const testItemBtn = el('button', { class: 'btn ghost' }, ['测试'])
        testItemBtn.onclick = () => testProvider(m.id, testAlertItem, testItemBtn)
        row.append(
          el('div', { class: 'row' }, [
            el('div', { class: 'field', style: 'flex:1' }, [el('label', {}, ['名称']), nameInput]),
            el('div', { class: 'field', style: 'flex:1' }, [el('label', {}, ['模型 ID']), modelInput]),
            el('div', { class: 'field', style: 'flex:2' }, [el('label', {}, ['Base URL']), baseInput])
          ]),
          el('div', { class: 'row', style: 'margin-top:8px' }, [
            el('div', { class: 'field', style: 'flex:2' }, [el('label', {}, ['API Key']), keyInput]),
            el('div', { class: 'row', style: 'gap:8px;align-items:flex-end' }, [defaultBtn, testItemBtn, delBtn])
          ]),
          testAlertItem
        )
        customModelsList.append(row)
      })
    }
    const addCustomBtn = el('button', { class: 'btn' }, ['＋ 添加自定义模型'])
    addCustomBtn.onclick = () => {
      const id = 'custom-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
      update((st) => {
        st.settings.customModels = st.settings.customModels || []
        st.settings.customModels.push({ id, name: '自定义模型', model: '', baseUrl: '', apiKey: '', isDefault: false })
      })
      buildProvOptions()
      renderCustomModels()
      markSaved()
    }
    const customCard = el('div', { class: 'card' }, [
      el('h3', {}, ['自定义模型']),
      el('p', { class: 'hint' }, ['配置其他 OpenAI 兼容的 API 服务。填写后会在上方「默认 AI 供应商」中出现。']),
      customModelsList,
      addCustomBtn
    ])
    renderCustomModels()

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

    // ---------- 6. 数据管理（备份 / 导出 / 导入 / 清理） ----------
    const listBox = el('div', { class: 'kv-table' })
    const refreshList = () => {
      clear(listBox)
      listBox.append(el('div', { class: 'kv-h' }, [
        el('span', {}, ['存储键']), el('span', {}, ['大小']), el('span', {}, [''])
      ]))
      const keys = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('opwb:')) keys.push(k)
      }
      keys.sort()
      if (!keys.length) {
        listBox.append(el('div', { class: 'kv-r', style: 'grid-template-columns: 1fr' }, [
          el('span', { class: 'muted' }, ['（暂无 opwb: 前缀的数据）'])
        ]))
      }
      keys.forEach((k) => {
        const size = (localStorage.getItem(k) || '').length
        const del = el('button', { class: 'mini', title: '删除该键' }, ['✕'])
        del.onclick = () => {
          if (confirm('确认删除「' + k + '」？此操作不可恢复。')) {
            localStorage.removeItem(k); refreshList(); markSaved()
          }
        }
        listBox.append(el('div', { class: 'kv-r', style: 'grid-template-columns: 2fr 1fr 44px' }, [
          el('span', { style: 'word-break:break-all' }, [k]),
          el('span', {}, [(size / 1024).toFixed(1) + ' KB']),
          del
        ]))
      })
    }

    const exportBtn = el('button', { class: 'btn' }, ['⬇ 导出全部数据'])
    exportBtn.onclick = () => {
      const data = {}
      const keys = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('opwb:')) { data[k] = localStorage.getItem(k); keys.push(k) }
      }
      const payload = { app: '一人公司工作中台', version: 1, exportedAt: new Date().toISOString(), keys: data }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const a = el('a', { href: URL.createObjectURL(blob), download: 'opwb-backup-' + new Date().toISOString().slice(0, 10) + '.json' })
      document.body.append(a); a.click(); a.remove()
      toast('已导出 ' + keys.length + ' 项数据', 'ok')
    }

    const fileInput = el('input', { type: 'file', accept: 'application/json', style: 'display:none' })
    fileInput.onchange = async (e) => {
      const f = e.target.files && e.target.files[0]
      if (!f) return
      try {
        const text = await f.text()
        const payload = JSON.parse(text)
        const data = payload.keys || payload
        let n = 0
        for (const [k, v] of Object.entries(data)) {
          if (k.startsWith('opwb:')) { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); n++ }
        }
        refreshList()
        toast('已导入 ' + n + ' 项，即将刷新', 'ok')
        setTimeout(() => location.reload(), 900)
      } catch (err) {
        toast('导入失败：' + err.message, 'err')
      }
    }
    const importBtn = el('button', { class: 'btn ghost' }, ['⬆ 导入恢复'])
    importBtn.onclick = () => fileInput.click()

    const dataCard = el('div', { class: 'card' }, [
      el('h3', {}, ['数据管理 · 备份与恢复']),
      el('p', { class: 'hint' }, ['所有业务数据仅存于本机浏览器。务必定期导出备份；换设备或清缓存前请先导出。导入会覆盖同名数据。']),
      el('div', { class: 'row', style: 'gap:8px;margin:8px 0' }, [exportBtn, importBtn, fileInput]),
      el('label', {}, ['本机存储（opwb: 前缀）']),
      listBox
    ])
    refreshList()

    page.append(apiCard)
    page.append(customCard)
    page.append(el('div', { class: 'grid cols-2' }, [industryCard, srcCard]))
    page.append(themeCard)
    page.append(dataCard)

    // ---------- 保存栏 ----------
    const saveStatus = el('span', { class: 'save-status' }, ['● 修改自动保存已开启'])
    const saveBtn = el('button', { class: 'btn primary' }, ['💾 保存设置'])
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
