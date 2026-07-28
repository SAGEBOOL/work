// 联网搜索核心：纯前端调用搜索 API，把结果归一化为 {title,url,snippet}。
// 支持 Brave Search / SerpAPI / 自定义（URL 模板 + JSON 路径）。
// 可选 CORS 代理前缀（部分搜索 API 不允许浏览器跨域时兜底）。

// 简单 JSON 路径取值，如 'data.web.results'
function getByPath(obj, path) {
  if (!path) return obj
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj)
}

export async function searchWeb(query, cfg) {
  cfg = cfg || {}
  const q = encodeURIComponent(query)
  const proxy = (cfg.proxy || '').trim()
  const prefix = (target) => (proxy ? (proxy.includes('=') ? proxy + encodeURIComponent(target) : proxy.replace(/\/?$/, '/') + target) : target)

  let url, headers = { Accept: 'application/json' }, results = []

  if (cfg.provider === 'serpapi') {
    url = `https://serpapi.com/search.json?engine=google&q=${q}&api_key=${encodeURIComponent(cfg.key || '')}`
    const resp = await fetch(prefix(url))
    const json = await resp.json()
    const arr = json.organic_results || []
    results = arr.map((r) => ({ title: r.title || '', url: r.link || '', snippet: r.snippet || '' }))
  } else if (cfg.provider === 'custom') {
    const c = cfg.custom || {}
    const tpl = (c.url || '').replace('{q}', q).replace('{key}', encodeURIComponent(cfg.key || ''))
    if (!tpl) throw new Error('自定义搜索未配置 URL 模板')
    const resp = await fetch(prefix(tpl), { headers })
    const json = await resp.json()
    const arr = getByPath(json, c.resultPath) || []
    results = (Array.isArray(arr) ? arr : []).map((r) => ({
      title: getByPath(r, c.titlePath) || '',
      url: getByPath(r, c.urlPath) || '',
      snippet: getByPath(r, c.snippetPath) || ''
    }))
  } else {
    // 默认 Brave Search
    url = `https://api.search.brave.com/res/v1/web/search?q=${q}`
    const h = { ...headers, 'X-Subscription-Token': cfg.key || '' }
    const resp = await fetch(prefix(url), { headers: h })
    const json = await resp.json()
    const arr = (json.data && json.data.web && json.data.web.results) || []
    results = arr.map((r) => ({ title: r.title || '', url: r.url || '', snippet: r.description || '' }))
  }

  if (!results.length) throw new Error('未返回搜索结果（检查 API Key 或代理）')
  return results.slice(0, 12)
}
