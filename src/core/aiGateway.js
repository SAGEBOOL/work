// 浏览器端 AI 网关：统一封装多家兼容 OpenAI 协议的供应商。
// 密钥来自设置中心（localStorage），请求直接从浏览器发出。
import { getSettings } from './store.js'

export const PROVIDERS = {
  deepseek: {
    id: 'deepseek', name: 'DeepSeek',
    base: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    doc: 'https://platform.deepseek.com/api_keys'
  },
  openai: {
    id: 'openai', name: 'OpenAI',
    base: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
    doc: 'https://platform.openai.com/api-keys'
  },
  zhipu: {
    id: 'zhipu', name: '智谱 GLM',
    base: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4-plus', 'glm-4-air', 'glm-4-flash'],
    doc: 'https://open.bigmodel.cn/usercenter/apikeys'
  },
  qwen: {
    id: 'qwen', name: '通义千问',
    base: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-plus', 'qwen-max', 'qwen-turbo'],
    doc: 'https://dashscope.console.aliyun.com/api-key'
  },
  moonshot: {
    id: 'moonshot', name: 'Kimi',
    base: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    doc: 'https://platform.moonshot.cn/console/api-keys'
  }
}

export function providerList() {
  return Object.values(PROVIDERS)
}

// 已配置密钥的供应商
export function configuredProviders() {
  const keys = getSettings().apiKeys
  return providerList().filter((p) => keys[p.id])
}

// 统一聊天调用。
// opts: { messages, provider?, model?, temperature?, stream?, onToken? }
export async function callChat(opts = {}) {
  const s = getSettings()
  const providerId = opts.provider || s.defaultProvider
  const p = PROVIDERS[providerId]
  if (!p) throw new Error('未知供应商: ' + providerId)
  const key = s.apiKeys[providerId]
  if (!key) throw new Error('未配置 ' + p.name + ' 的 API Key，请到「设置」填写')
  const model = opts.model || s.defaultModel
  const url = p.base + '/chat/completions'

  const body = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.7,
    stream: !!opts.onToken
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(p.name + ' 调用失败 (' + res.status + ')：' + errText.slice(0, 240))
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
