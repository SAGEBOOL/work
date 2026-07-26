// 侧边栏：分组导航。分组顺序固定，新插件按 group 自动归类。
import { el, clear } from '../core/ui.js'
import { pluginsByGroup } from '../core/pluginManager.js'
import { currentId } from '../core/router.js'

const GROUP_ORDER = ['概览', '基础办公', '专业工作', '休闲娱乐', '设置']

export function renderSidebar(root, { navigate }) {
  clear(root)
  root.append(
    el('div', { class: 'brand' }, [
      el('span', { class: 'logo' }, ['🛠️']),
      el('span', {}, ['一人公司工作中台'])
    ])
  )

  const groups = pluginsByGroup()
  const active = currentId()

  for (const g of GROUP_ORDER) {
    const items = groups[g]
    if (!items || !items.length) continue
    root.append(el('div', { class: 'group-label' }, [g]))
    const nav = el('nav', { class: 'nav' })
    for (const p of items) {
      const isActive = p.id === active
      nav.append(
        el('a', {
          class: 'nav-item' + (isActive ? ' active' : ''),
          href: '#/' + p.id,
          onclick: () => navigate(p.id)
        }, [
          el('span', { class: 'ico' }, [p.icon || '•']),
          el('span', {}, [p.name])
        ])
      )
    }
    root.append(nav)
  }
}
