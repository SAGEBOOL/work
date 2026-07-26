// 插件注册表。每个插件是一个对象：{ id, name, icon, group, mount(container, ctx) }
const registry = new Map()

export function registerPlugin(plugin) {
  if (!plugin?.id) throw new Error('插件缺少 id')
  registry.set(plugin.id, plugin)
}

export function getPlugin(id) {
  return registry.get(id)
}

export function allPlugins() {
  return [...registry.values()]
}

export function pluginsByGroup() {
  const groups = {}
  for (const p of registry.values()) {
    ;(groups[p.group] ||= []).push(p)
  }
  return groups
}
