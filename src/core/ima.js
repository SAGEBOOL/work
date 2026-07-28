// IMA 知识库检索核心：纯前端调用 IMA OpenAPI 检索用户知识库。
// 接口：ima.qq.com/openapi/wiki/v1/{search_knowledge_base, search_knowledge}
// 鉴权头：ima-openapi-clientid / ima-openapi-apikey / ima-openapi-ctx
// 注意：ima.qq.com 主要为服务端设计，浏览器直连常被 CORS 拦截；
// 可在设置中填「请求代理」前缀（如 https://你的代理/?url=）兜底。

const BASE = 'https://ima.qq.com'
const VERSION = '1.1.8'

export async function listKnowledgeBases(cfg) {
  const { clientId, apiKey, proxy } = cfg
  const prefix = (t) => (proxy ? (proxy.includes('=') ? proxy + encodeURIComponent(t) : proxy.replace(/\/?$/, '/') + t) : t)
  const resp = await fetch(prefix(`${BASE}/openapi/wiki/v1/search_knowledge_base`), {
    method: 'POST',
    headers: {
      'ima-openapi-clientid': clientId,
      'ima-openapi-apikey': apiKey,
      'ima-openapi-ctx': `skill_version=${VERSION}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: '', cursor: '', limit: 20 })
  })
  const json = await resp.json()
  if (json.code != null && json.code !== 0) throw new Error(json.msg || 'IMA 接口错误')
  return (json.data && json.data.list) || []
}

export async function searchIMA(query, cfg) {
  cfg = cfg || {}
  const { clientId, apiKey, proxy, knowledgeBaseId } = cfg
  if (!clientId || !apiKey) throw new Error('未配置 IMA clientId / apiKey（请在设置中填写）')
  const prefix = (t) => (proxy ? (proxy.includes('=') ? proxy + encodeURIComponent(t) : proxy.replace(/\/?$/, '/') + t) : t)

  const post = async (apiPath, body) => {
    const resp = await fetch(prefix(`${BASE}/${apiPath}`), {
      method: 'POST',
      headers: {
        'ima-openapi-clientid': clientId,
        'ima-openapi-apikey': apiKey,
        'ima-openapi-ctx': `skill_version=${VERSION}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    const json = await resp.json()
    if (json.code != null && json.code !== 0) throw new Error(json.msg || 'IMA 接口错误')
    return json.data || {}
  }

  // 1) 确定要检索的知识库
  let kbs = []
  if (knowledgeBaseId) {
    kbs = [{ knowledge_base_id: knowledgeBaseId, name: cfg.knowledgeBaseName || '指定知识库' }]
  } else {
    kbs = await listKnowledgeBases(cfg)
    if (!kbs.length) throw new Error('未找到任何知识库（请先在 IMA 创建知识库）')
  }

  // 2) 逐库检索
  const out = []
  for (const kb of kbs.slice(0, 10)) {
    try {
      const data = await post('openapi/wiki/v1/search_knowledge', {
        query,
        knowledge_base_id: kb.knowledge_base_id,
        cursor: ''
      })
      const list = data.info_list || []
      list.forEach((it) => {
        out.push({
          title: it.title || '(未命名)',
          snippet: it.summary || it.content || it.description || '',
          kb: kb.name || '',
          mediaId: it.media_id || ''
        })
      })
    } catch (e) {
      // 单个库失败不影响其余
      out.push({ title: '[检索失败] ' + (kb.name || ''), snippet: e.message, kb: kb.name || '', mediaId: '' })
    }
  }
  if (!out.length) throw new Error('知识库中未找到相关内容')
  return out.slice(0, 15)
}
