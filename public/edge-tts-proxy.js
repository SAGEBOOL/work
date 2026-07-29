// Cloudflare Worker 代理：把浏览器 WebSocket 透传到微软 Edge TTS
// 用途：北京等网络环境无法直连 speech.platform.bing.com 时，通过自己账户的 Worker 转发。
// 部署：Cloudflare 控制台 → Workers & Pages → 创建 Worker → 粘贴本脚本 → 保存
// 使用：把 Worker 地址填到「文字转音频 → ⚙️ 网络设置」的代理框中，如 wss://your-worker.your-subdomain.workers.dev/

const UPSTREAM = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?trustedclienttoken=6A7A6B8C8B4D4A8E9F3B2A1C5D6E7F8'

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response(
        'Edge TTS WebSocket proxy\nUsage: wss://' + url.host + '/\n\nThis Worker only upgrades WebSocket connections.',
        { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
      )
    }

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]

    let upstream
    try {
      upstream = new WebSocket(UPSTREAM)
    } catch (e) {
      server.close(1011, 'upstream connect failed')
      return new Response(null, { status: 101, webSocket: client })
    }

    server.accept()
    upstream.accept()

    const relay = (from, to) => {
      from.addEventListener('message', (event) => {
        try { to.send(event.data) } catch (e) { try { from.close() } catch (_) {} }
      })
      from.addEventListener('close', () => { try { to.close() } catch (_) {} })
      from.addEventListener('error', () => { try { to.close() } catch (_) {} })
    }

    relay(server, upstream)
    relay(upstream, server)

    return new Response(null, { status: 101, webSocket: client })
  }
}
