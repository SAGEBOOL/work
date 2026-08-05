// 浏览器端 AI 网关：统一封装多家兼容 OpenAI 协议的供应商。
// 密钥来自设置中心（localStorage），请求直接从浏览器发出。
import { getSettings } from './store.js'

export const PROVIDERS = {
  deepseek: {
    id: 'deepseek', name: 'DeepSeek',
    base: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    doc: 'https://platform.deepseek.com/api_keys',
    browserOk: true
  },
  openai: {
    id: 'openai', name: 'OpenAI',
    base: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
    doc: 'https://platform.openai.com/api-keys',
    // OpenAI 默认禁止浏览器直连（CORS），纯前端架构下通常无法调用
    browserOk: false
  },
  zhipu: {
    id: 'zhipu', name: '智谱 GLM',
    base: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4-plus', 'glm-4-air', 'glm-4-flash'],
    // 图像生成模型（走 /images/generations 端点，OpenAI 兼容，浏览器 CORS 放行）
    imageModels: ['cogview-3-plus', 'cogview-3'],
    doc: 'https://open.bigmodel.cn/usercenter/apikeys',
    browserOk: true
  },
  qwen: {
    id: 'qwen', name: '通义千问',
    base: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-plus', 'qwen-max', 'qwen-turbo'],
    doc: 'https://dashscope.console.aliyun.com/api-key',
    browserOk: true
  },
  moonshot: {
    id: 'moonshot', name: 'Kimi',
    base: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    doc: 'https://platform.moonshot.cn/console/api-keys',
    browserOk: true
  },
  openrouter: {
    id: 'openrouter', name: 'OpenRouter',
    base: 'https://openrouter.ai/api/v1',
    models: ['deepseek/deepseek-chat', 'anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'meta-llama/llama-3.1-70b-instruct'],
    doc: 'https://openrouter.ai/keys',
    // 显式支持浏览器跨域，纯前端架构最稳
    browserOk: true
  },
  ollama: {
    id: 'ollama', name: 'Ollama 本地模型',
    base: 'http://localhost:11434',
    models: [],
    doc: 'https://ollama.com/',
    // 浏览器调用 Ollama 需本地以 OLLAMA_ORIGINS="*" 启动（见设置页提示）
    browserOk: true,
    isLocal: true
  }
}

// 浏览器可直连（CORS 放行）的厂商，给用户明确提示
export function browserCallableProviders() {
  return providerList().filter((p) => p.browserOk)
}

// 获取单个供应商，包含内置与自定义模型
export function getProvider(id) {
  const built = PROVIDERS[id]
  if (built) return built
  const custom = getSettings().customModels?.find((m) => m.id === id)
  if (!custom) return null
  return {
    id: custom.id,
    name: custom.name || custom.id,
    base: (custom.baseUrl || '').replace(/\/$/, ''),
    model: custom.model,
    apiKey: custom.apiKey,
    doc: custom.baseUrl || '',
    isCustom: true,
    browserOk: true
  }
}

export function providerList() {
  const customs = getSettings().customModels?.map((m) => getProvider(m.id)).filter(Boolean) || []
  return [...Object.values(PROVIDERS), ...customs]
}

// 已配置密钥的供应商
export function configuredProviders() {
  const s = getSettings()
  return providerList().filter((p) => {
    if (p.isCustom) return !!p.apiKey
    return s.apiKeys[p.id]
  })
}

// 统一聊天调用。
// opts: { messages, provider?, model?, temperature?, stream?, onToken? }
export async function callChat(opts = {}) {
  const s = getSettings()
  const providerId = opts.provider || s.defaultProvider
  const p = getProvider(providerId)
  if (!p) throw new Error('未知供应商: ' + providerId)

  // ---------- 本地模型 Ollama 分支 ----------
  if (p.isLocal) {
    const cfg = s.providerConfig?.ollama || { baseUrl: 'http://localhost:11434', model: 'llama3.1' }
    const model = opts.model || cfg.model || 'llama3.1'
    const url = (cfg.baseUrl || 'http://localhost:11434').replace(/\/$/, '') + '/api/chat'
    const body = { model, messages: opts.messages, stream: !!opts.onToken }

    let res
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
    } catch (netErr) {
      throw new Error('✗ 无法连接本地 Ollama。请确认：1) Ollama 已启动；2) 模型已拉取；3) 以 CORS 方式启动：OLLAMA_ORIGINS="*" ollama serve')
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error('Ollama 调用失败 (' + res.status + ')：' + errText.slice(0, 200) + '（请检查模型名与 Ollama 状态）')
    }

    if (opts.onToken) {
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop()
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const json = JSON.parse(line)
            const delta = json.message?.content || ''
            if (delta) opts.onToken(delta)
          } catch { /* ignore */ }
        }
      }
      return
    }

    const json = await res.json()
    return json.message?.content || ''
  }

  // ---------- 云厂商 OpenAI 兼容分支 ----------
  const key = p.isCustom ? p.apiKey : s.apiKeys[providerId]
  if (!key) throw new Error('未配置 ' + p.name + ' 的 API Key，请到「设置」填写')
  const model = opts.model || (p.isCustom ? p.model : s.defaultModel)
  const url = p.base + '/chat/completions'

  const body = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.7,
    stream: !!opts.onToken
  }

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify(body)
    })
  } catch (netErr) {
    // 浏览器直连常见两类失败：CORS 拦截 或 网络不可达
    const host = (() => { try { return new URL(p.base).host } catch { return p.base } })()
    let reason
    if (providerId === 'openai') {
      reason = 'OpenAI 默认禁止浏览器直连（CORS 拦截）。请改用 DeepSeek / 智谱 / 通义 / Kimi / OpenRouter 等支持浏览器调用的厂商。'
    } else if (!p.browserOk) {
      reason = p.name + ' 不支持浏览器直连，请换用支持浏览器调用的厂商（见设置页提示）。'
    } else {
      reason = '浏览器无法连接 ' + p.name + '（网络不可达或被 CORS 拦截）。国内访问 ' + host + ' 可能超时，可在能直连的网络下使用，或改用 OpenRouter。'
    }
    throw new Error('✗ 网络/CORS 错误：' + reason)
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    let hint = ''
    if (res.status === 401) hint = '（401：API Key 无效或未授权，请检查密钥）'
    else if (res.status === 403) hint = '（403：无权限，请确认密钥状态）'
    else if (res.status === 429) hint = '（429：额度用尽或触发限流）'
    else if (res.status === 404) hint = '（404：模型名或接口地址不正确）'
    else if (res.status >= 500) hint = '（5xx：厂商服务端异常，稍后重试）'
    throw new Error(p.name + ' 调用失败 (' + res.status + ')：' + errText.slice(0, 200) + ' ' + hint)
  }

  if (opts.onToken) {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop()
      for (const line of lines) {
        const t = line.trim()
        if (!t.startsWith('data:')) continue
        const data = t.slice(5).trim()
        if (data === '[DONE]') return
        try {
          const json = JSON.parse(data)
          const delta = json.choices?.[0]?.delta?.content || ''
          if (delta) opts.onToken(delta)
        } catch { /* ignore keep-alive lines */ }
      }
    }
    return
  }

  const json = await res.json()
  return json.choices?.[0]?.message?.content || ''
}

// 统一图像生成调用（OpenAI 兼容 /images/generations 端点）。
// 与 callChat 共用供应商配置与取 key 逻辑；兼容 url / b64_json 两种返回。
// opts: { prompt, provider?, model, size?, n? }
// 返回数组：[{ url: string|null, b64: string|null }]
export async function callImageGen(opts = {}) {
  const s = getSettings()
  const providerId = opts.provider || s.defaultProvider
  const p = getProvider(providerId)
  if (!p) throw new Error('未知供应商: ' + providerId)
  if (p.isLocal) throw new Error('Ollama 本地模型暂不支持图像生成，请改用智谱 GLM 或设置中心的自定义模型')

  const key = p.isCustom ? p.apiKey : s.apiKeys[providerId]
  if (!key) throw new Error('未配置 ' + p.name + ' 的 API Key，请到「设置」填写')

  const model = opts.model
  if (!model) throw new Error('请填写图像生成模型名（如智谱 cogview-3）')
  if (!opts.prompt || !opts.prompt.trim()) throw new Error('请先输入提示词')

  const url = p.base + '/images/generations'
  const body = { model, prompt: opts.prompt.trim() }
  if (opts.n) body.n = Math.min(opts.n | 0, 4)
  if (opts.size) body.size = opts.size

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify(body)
    })
  } catch (netErr) {
    const host = (() => { try { return new URL(p.base).host } catch { return p.base } })()
    let reason
    if (!p.browserOk) {
      reason = p.name + ' 不支持浏览器直连，请换用支持浏览器调用的厂商（如智谱 GLM）或在设置中心添加自定义模型。'
    } else {
      reason = '浏览器无法连接 ' + p.name + '（网络不可达或被 CORS 拦截）。国内访问 ' + host + ' 可能超时，可在能直连的网络下使用。'
    }
    throw new Error('✗ 网络/CORS 错误：' + reason)
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    let hint = ''
    if (res.status === 401) hint = '（401：API Key 无效或未授权，请检查密钥）'
    else if (res.status === 403) hint = '（403：无权限，请确认密钥状态）'
    else if (res.status === 404) hint = '（404：模型名或接口地址不正确，请检查图像生成模型名）'
    else if (res.status === 429) hint = '（429：额度用尽或触发限流）'
    else if (res.status >= 500) hint = '（5xx：厂商服务端异常，稍后重试）'
    throw new Error(p.name + ' 图像生成失败 (' + res.status + ')：' + errText.slice(0, 240) + ' ' + hint)
  }

  const json = await res.json().catch(() => ({}))
  const arr = Array.isArray(json.data) ? json.data : []
  if (!arr.length) throw new Error(p.name + ' 返回为空：' + JSON.stringify(json).slice(0, 200))
  return arr.map((d) => ({ url: d.url || null, b64: d.b64_json || null }))
}
