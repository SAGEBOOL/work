// 基于 hash 的极简路由，刷新/分享链接可定位到具体插件。
import { getState } from './store.js'
import { getPlugin } from './pluginManager.js'
import { clear } from './ui.js'

export function navigate(id) {
  location.hash = '#/' + id
}

export function currentId() {
  const id = location.hash.replace('#/', '')
  return id || getState().activePlugin || 'overview'
}

export function initRouter(mountEl) {
  const render = () => {
    const id = currentId()
    const plugin = getPlugin(id) || getPlugin('overview')
    clear(mountEl)
    if (plugin?.mount) plugin.mount(mountEl, { navigate })
    document.title = '一人公司工作中台 · ' + (plugin?.name || '')
  }
  window.addEventListener('hashchange', render)
  render()
}
