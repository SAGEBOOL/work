// 概览：读取设置，展示中台当前状态与快捷入口。验证插件可读取全局状态。
import { el } from '../../core/ui.js'
import { getSettings } from '../../core/store.js'
import { configuredProviders, PROVIDERS } from '../../core/aiGateway.js'
import { allPlugins } from '../../core/pluginManager.js'
import { navigate } from '../../core/router.js'

export const overviewPlugin = {
  id: 'overview',
  name: '概览',
  icon: '🏠',
  group: '概览',
  mount(root) {
    const s = getSettings()
    const aiReady = configuredProviders().length
    const defaultProv = PROVIDERS[s.defaultProvider]
    const defaultOk = !!s.apiKeys[s.defaultProvider]
    const funcCount = allPlugins().filter((p) => p.group !== '概览' && p.group !== '设置').length
    const dataOn = Object.entries(s.dataSources).filter(([, v]) => v).map(([k]) => k)

    const stat = (num, label) => el('div', { class: 'card' }, [
      el('div', { class: 'stat' }, [String(num)]),
      el('div', { class: 'stat-label' }, [label])
    ])

    const quick = el('div', { class: 'quick' },
      allPlugins()
        .filter((p) => p.group !== '概览')
        .map((p) => el('a', { href: '#/' + p.id, onclick: () => navigate(p.id) }, [
          el('span', {}, [p.icon || '•']), p.name
        ]))
    )

    const page = el('div', { class: 'page' }, [
      el('h1', {}, ['工作台概览']),
      el('p', { class: 'sub' }, ['一人公司工作中台 · 微内核 + 插件架构']),
      el('div', { class: 'stat-grid' }, [
        stat(aiReady, '已配置 AI 厂商'),
        stat(funcCount, '已安装功能插件'),
        stat(s.industry.length, '行业标签'),
        stat(dataOn.length, '已开启数据源')
      ]),
      el('div', { class: 'card', style: 'margin-top:16px' }, [
        el('h3', {}, ['AI 状态']),
        el('p', { class: 'muted' }, [
          defaultOk
            ? '默认模型：' + defaultProv.name + ' / ' + s.defaultModel + '（已就绪）'
            : '默认厂商 ' + (defaultProv?.name || s.defaultProvider) + ' 尚未配置 Key，请到「设置」填写。'
        ])
      ]),
      el('div', { class: 'card', style: 'margin-top:16px' }, [
        el('h3', {}, ['快捷入口']),
        quick
      ])
    ])
    root.append(page)
  }
}
