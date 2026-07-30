// 极简 Service Worker：运行时缓存。
// 策略：导航/静态资源命中缓存则直接用，否则网络请求并缓存；离线时回退到已缓存的首页。
const CACHE = 'opwb-cache-v1'
const PRECACHE = ['./', './index.html']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE).catch(() => {})).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  // 跨域 API（AI / 天气 / 搜索）不缓存，直接透传
  if (new URL(req.url).origin !== location.origin) return

  const url = new URL(req.url)
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/')

  if (isPage) {
    // 页面：网络优先，失败回退缓存（保证新部署能及时生效，离线也能开）
    e.respondWith(
      fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
        }
        return res
      }).catch(() => caches.match(req).then((h) => h || caches.match('./index.html')))
    )
    return
  }

  // 其余静态资源：命中即用，未命中走网络并缓存
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
        }
        return res
      }).catch(() => hit)
      return hit || net
    })
  )
})
