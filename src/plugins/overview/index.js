// 概览：今日工作台。读取设置 + 最近使用/收藏 + 天气 + 今日备注/便签 + 快捷入口。
import { el, clear } from '../../core/ui.js'
import { getSettings } from '../../core/store.js'
import { configuredProviders, getProvider } from '../../core/aiGateway.js'
import { allPlugins } from '../../core/pluginManager.js'
import { getRecent, getFavorites } from '../../core/store.js'
import { navigate } from '../../core/router.js'
import { renderYiguaWidget } from '../yigua/index.js'

const WMO = {
  0: '晴', 1: '大致晴朗', 2: '局部多云', 3: '阴', 45: '雾', 48: '雾凇',
  51: '小毛毛雨', 53: '毛毛雨', 55: '大毛毛雨', 61: '小雨', 63: '中雨', 65: '大雨',
  80: '阵雨', 81: '阵雨', 82: '强阵雨', 95: '雷暴', 99: '强雷暴'
}
const wxIcon = (c) => (c == null ? '🌡️' : c <= 2 ? '🌤️' : c === 3 ? '☁️' : (c >= 51 && c <= 67) ? '🌧️' : (c >= 80 && c <= 82) ? '🌦️' : (c >= 95) ? '⛈️' : '🌡️')

export const overviewPlugin = {
  id: 'overview',
  name: '概览',
  icon: '🏠',
  group: '概览',
  mount(root) {
    const s = getSettings()
    const prov = getProvider(s.defaultProvider)
    const aiReady = prov && (prov.isLocal ? true : (prov.isCustom ? !!prov.apiKey : !!s.apiKeys[prov.id]))
    const now = new Date()
    const h = now.getHours()
    const greet = h < 6 ? '夜深了' : h < 12 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好'
    const dateStr = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })

    const page = el('div', { class: 'page' }, [
      el('h1', { class: 'greet' }, [greet + '，Jerry 👋']),
      el('p', { class: 'greet-sub' }, [dateStr + ' · 一人公司工作中台'])
    ])

    // ---------- AI 配置引导卡（未就绪时突出显示） ----------
    if (!aiReady) {
      page.append(el('div', { class: 'card ai-setup-card' }, [
        el('h3', {}, ['🤖 默认 AI 尚未配置']),
        el('p', { class: 'muted' }, ['翻译、行业研究、经营分析等功能的 AI 能力需要它。点下方按钮前往设置，粘贴任意一家厂商的 Key（DeepSeek / 智谱 / 通义等均可，免费且浏览器直连）。']),
        el('button', { class: 'btn', onclick: () => navigate('settings') }, ['前往配置 AI →'])
      ]))
    }

    // ---------- 今日网格：左=快速继续，右=天气+今日备注 ----------
    const left = el('div', { class: 'card' }, [el('h3', {}, ['🚀 快速继续'])])
    const QUICK_IDS = ['pomodoro', 'gomoku', 'settings']
    const quickPlugins = allPlugins().filter((p) => QUICK_IDS.includes(p.id))
    if (quickPlugins.length) {
      const row = el('div', { class: 'recent-row' })
      quickPlugins.forEach((p) => {
        row.append(el('a', { class: 'recent-chip', href: '#/' + p.id, onclick: () => navigate(p.id) }, [
          el('span', {}, [p.icon || '•']), p.name
        ]))
      })
      left.append(row)
    } else {
      left.append(el('p', { class: 'muted' }, ['暂无快捷入口。']))
    }

    const right = el('div', { class: 'card' }, [el('h3', {}, ['🌤️ 北京天气']), el('div', { class: 'today-weather', id: 'ov-wx' }, ['加载中…'])])
    page.append(el('div', { class: 'today-grid' }, [left, right]))

    // ---------- 今日日历备注 + 便签 ----------
    const calKey = 'opwb:notes:calendar'
    const cal = JSON.parse(localStorage.getItem(calKey) || '{}')
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const memo = localStorage.getItem('opwb:notes:memo') || ''

    const noteCard = el('div', { class: 'card', style: 'margin-top:16px' }, [
      el('h3', {}, ['📌 今日备注 & 便签']),
    ])
    const calText = cal[todayKey]
    if (calText) {
      noteCard.append(el('div', { class: 'kv-detail' }, [el('b', {}, [todayKey]), el('span', {}, [calText])]))
    } else {
      noteCard.append(el('div', { class: 'muted', style: 'margin-bottom:8px' }, ['今天还没有日历备注。']))
    }
    if (memo.trim()) {
      noteCard.append(el('div', { class: 'note-preview' }, [memo]))
    } else {
      noteCard.append(el('div', { class: 'muted' }, ['便签为空。']))
    }
    noteCard.append(el('a', { class: 'recent-chip', style: 'margin-top:10px', href: '#/leisure', onclick: () => navigate('leisure') }, ['打开日历·天气·便签 →']))
    page.append(noteCard)

    // ---------- 全部功能快捷入口 ----------
    const quick = el('div', { class: 'quick' },
      allPlugins()
        .filter((p) => p.group !== '概览')
        .map((p) => el('a', { href: '#/' + p.id, onclick: () => navigate(p.id) }, [
          el('span', {}, [p.icon || '•']), p.name
        ]))
    )
    page.append(el('div', { class: 'card', style: 'margin-top:16px' }, [
      el('h3', {}, ['🧰 全部功能']), quick
    ]))

    // ---------- 每天要一卦（嵌入全部功能下方） ----------
    const yiguaCard = el('div', { class: 'card', style: 'margin-top:16px' }, [
      el('h3', {}, ['☯ 每天要一卦']),
    ])
    renderYiguaWidget(yiguaCard)
    page.append(yiguaCard)

    root.append(page)

    // 天气异步加载（北京，免费 Open-Meteo，无需 Key）
    const wxBox = root.querySelector('#ov-wx')
    fetch('https://api.open-meteo.com/v1/forecast?latitude=39.9042&longitude=116.4074&current=temperature_2m,weather_code&timezone=auto')
      .then((r) => r.json())
      .then((w) => {
        const c = w.current
        if (!c) return
        clear(wxBox)
        wxBox.append(
          el('span', { class: 'today-wx-temp' }, [Math.round(c.temperature_2m) + '°']),
          el('div', {}, [
            el('div', { class: 'today-wx-desc' }, [wxIcon(c.weather_code) + ' ' + (WMO[c.weather_code] || '')]),
            el('div', { class: 'muted', style: 'font-size:12px' }, ['北京 · 实时'])
          ])
        )
      })
      .catch(() => { if (wxBox) wxBox.textContent = '天气获取失败（网络）' })
  }
}
