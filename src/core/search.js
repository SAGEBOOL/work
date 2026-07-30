// 联网搜索核心：纯前端调用搜索 API，把结果归一化为 {title,url,snippet}。
// 支持 DuckDuckGo（免费免 Key）/ Brave Search / SerpAPI / 自定义（URL 模板 + JSON 路径）。
// 可选 CORS 代理前缀（部分搜索 API 不允许浏览器跨域时兜底）。

// 简单 JSON 路径取值，如 'data.web.results'
function getByPath(obj, path) {
  if (!path) return obj
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj)
}

// ---- DuckDuckGo Lite HTML 解析（免 API Key，通过 CORS 代理抓取） ----
function parseDDGLite(html) {
  const results = []
  try {
    // DDG Lite 用 <table> 包裹结果，每条 <tr> 含 <a class="result-link"> 和 <td class="result-snippet">
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    // 方法1：找包含结果链接的表格行
    const rows = doc.querySelectorAll('table tr')
    for (const tr of rows) {
      const link = tr.querySelector('a[href]')
      if (!link || !link.href || link.href.startsWith('#')) continue
      // 排除导航链接
      const href = link.href
      if (href.includes('duckduckgo.com') && (href.includes('/q=') || href.includes('/l/?'))) continue
      let snippet = ''
      const tds = tr.querySelectorAll('td')
      for (const td of tds) {
        const txt = td.textContent.trim()
        if (txt.length > 20 && txt !== link.textContent.trim()) { snippet = txt; break }
      }
      // 从 DDG 跳转链接中提取真实 URL
      let realUrl = href
      const uMatch = href.match(/uddg=([^&]+)/)
      if (uMatch) realUrl = decodeURIComponent(uMatch[1])
      if (link.textContent.trim().length > 2) {
        results.push({ title: link.textContent.trim(), url: realUrl, snippet })
      }
    }
    // 方法2：如果方法1没找到，尝试更宽泛的选择器
    if (!results.length) {
      const links = doc.querySelectorAll('a.result-link, .result__a, [class*="result"] a[href]')
      for (const a of links) {
        if (!a.href || a.textContent.trim().length < 3) continue
        let realUrl = a.href
        const uMatch = a.href.match(/uddg=([^&]+)/)
        if (uMatch) realUrl = decodeURIComponent(uMatch[1])
        // 取相邻元素作为摘要
        let snippet = ''
        const parent = a.closest('tr') || a.parentElement?.parentElement
        if (parent) { const txt = parent.textContent.replace(a.textContent, '').trim(); if (txt.length > 15) snippet = txt.slice(0, 300) }
        results.push({ title: a.textContent.trim(), url: realUrl, snippet })
      }
    }
  } catch (_) { /* 解析失败返回空 */ }
  return results
}

export async function searchWeb(query, cfg) {
  cfg = cfg || {}
  const q = encodeURIComponent(query)
  const proxy = (cfg.proxy || '').trim()
  const prefix = (target) => (proxy ? (proxy.includes('=') ? proxy + encodeURIComponent(target) : proxy.replace(/\/?$/, '/') + target) : target)

  let url, headers = { Accept: 'application/json' }, results = []

  if (cfg.provider === 'duckduckgo') {
    // DuckDuckGo Lite：完全免费，无需 API Key，通过 CORS 代理获取 HTML 并解析
    const ddgUrl = `https://lite.duckduckgo.com/lite/?q=${q}`
    const resp = await fetch(prefix(ddgUrl))
    const html = await resp.text()
    results = parseDDGLite(html)
  } else if (cfg.provider === 'serpapi') {
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
