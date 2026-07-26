// 休闲娱乐：日历（可备注）+ 天气预报（Open-Meteo 免费无需 Key）+ 记事便签（localStorage）。
import { el, clear } from '../../core/ui.js'

const WMO = {
  0: '晴', 1: '大致晴朗', 2: '局部多云', 3: '阴',
  45: '雾', 48: '雾凇',
  51: '小毛毛雨', 53: '毛毛雨', 55: '大毛毛雨',
  56: '冻毛毛雨', 57: '强冻毛毛雨',
  61: '小雨', 63: '中雨', 65: '大雨',
  66: '冻雨', 67: '强冻雨',
  71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒',
  80: '小阵雨', 81: '阵雨', 82: '强阵雨',
  85: '小阵雪', 86: '强阵雪',
  95: '雷暴', 96: '雷暴伴冰雹', 99: '强雷暴伴冰雹'
}
const wxIcon = (code) => {
  if (code === 0) return '☀️'
  if (code <= 2) return '🌤️'
  if (code === 3) return '☁️'
  if (code === 45 || code === 48) return '🌫️'
  if (code >= 51 && code <= 67) return '🌧️'
  if (code >= 71 && code <= 77) return '❄️'
  if (code >= 80 && code <= 82) return '🌦️'
  if (code >= 85 && code <= 86) return '🌨️'
  if (code >= 95) return '⛈️'
  return '🌡️'
}

export const leisurePlugin = {
  id: 'leisure',
  name: '日历·天气·便签',
  icon: '📅',
  group: '休闲娱乐',
  mount(root) {
    // ---------- 日历 ----------
    const calKey = 'opwb:notes:calendar'
    const notes = JSON.parse(localStorage.getItem(calKey) || '{}')
    const now = new Date()
    let vy = now.getFullYear(), vm = now.getMonth()
    const dayStr = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    let selected = dayStr(vy, vm, now.getDate())

    const calGrid = el('div', { class: 'cal-grid' })
    const calTitle = el('div', { class: 'cal-title' })
    const prevBtn = el('button', { class: 'mini' }, ['‹'])
    const nextBtn = el('button', { class: 'mini' }, ['›'])
    const noteInput = el('textarea', { placeholder: '为选中日期写备注…', style: 'min-height:64px' })
    const noteWrap = el('div', {})

    const renderCal = () => {
      clear(calGrid)
      calTitle.textContent = `${vy} 年 ${vm + 1} 月`
      ;['日', '一', '二', '三', '四', '五', '六'].forEach((w) => calGrid.append(el('div', { class: 'cal-wk' }, [w])))
      const first = new Date(vy, vm, 1).getDay()
      const days = new Date(vy, vm + 1, 0).getDate()
      for (let i = 0; i < first; i++) calGrid.append(el('div', { class: 'cal-cell empty' }))
      const t = new Date()
      const todayS = dayStr(t.getFullYear(), t.getMonth(), t.getDate())
      for (let d = 1; d <= days; d++) {
        const ds = dayStr(vy, vm, d)
        const cell = el('div', {
          class: 'cal-cell'
            + (ds === selected ? ' sel' : '')
            + (ds === todayS ? ' today' : '')
            + (notes[ds] ? ' has' : '')
        }, [String(d)])
        cell.onclick = () => { selected = ds; renderCal(); renderNote() }
        calGrid.append(cell)
      }
    }
    const renderNote = () => {
      clear(noteWrap)
      noteWrap.append(el('div', { class: 'muted', style: 'margin-bottom:6px' }, ['📌 ' + selected + (notes[selected] ? '（已有备注）' : '')]))
      noteInput.value = notes[selected] || ''
      noteWrap.append(noteInput)
    }
    noteInput.oninput = () => {
      if (noteInput.value.trim()) notes[selected] = noteInput.value.trim()
      else delete notes[selected]
      localStorage.setItem(calKey, JSON.stringify(notes))
      renderCal()
    }
    prevBtn.onclick = () => { vm--; if (vm < 0) { vm = 11; vy-- } renderCal() }
    nextBtn.onclick = () => { vm++; if (vm > 11) { vm = 0; vy++ } renderCal() }
    renderCal(); renderNote()

    const calCard = el('div', { class: 'card' }, [
      el('div', { class: 'row', style: 'justify-content:space-between;align-items:center' }, [calTitle, el('div', { class: 'row' }, [prevBtn, nextBtn])]),
      calGrid, noteWrap
    ])

    // ---------- 天气 ----------
    const cityInput = el('input', { type: 'text', placeholder: '输入城市，如 北京 / 上海 / 杭州', value: '北京' })
    const wxBtn = el('button', { class: 'btn' }, ['查询天气'])
    const wxAlert = el('div', {})
    const wxNow = el('div', { class: 'wx-now' })
    const wxDays = el('div', { class: 'wx-days' })

    const loadWeather = async (city) => {
      wxBtn.disabled = true; wxAlert.textContent = ''; wxNow.textContent = '查询中…'; clear(wxDays)
      try {
        const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh`)).json()
        if (!g.results?.length) throw new Error('未找到该城市，请检查名称')
        const loc = g.results[0]
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}`
          + `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`
          + `&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`
        const w = await (await fetch(url)).json()
        const c = w.current
        wxNow.replaceChildren(
          el('div', { class: 'wx-temp' }, [String(Math.round(c.temperature_2m)) + '°']),
          el('div', { class: 'wx-desc' }, [wxIcon(c.weather_code), ' ' + (WMO[c.weather_code] || '—')]),
          el('div', { class: 'muted' }, [`${loc.name}${loc.country ? ' · ' + loc.country : ''} · 湿度 ${c.relative_humidity_2m}% · 风 ${c.wind_speed_10m}km/h`])
        )
        clear(wxDays)
        const dates = w.daily.time
        for (let i = 0; i < dates.length; i++) {
          const code = w.daily.weather_code[i]
          const label = i === 0 ? '今天' : i === 1 ? '明天' : dates[i].slice(5)
          wxDays.append(el('div', { class: 'wx-day' }, [
            el('div', { class: 'muted' }, [label]),
            el('div', { class: 'wx-day-ico' }, [wxIcon(code)]),
            el('div', {}, [`${Math.round(w.daily.temperature_2m_min[i])}° / ${Math.round(w.daily.temperature_2m_max[i])}°`]),
            el('div', { class: 'muted', style: 'font-size:12px' }, [WMO[code] || ''])
          ]))
        }
      } catch (err) {
        wxAlert.className = 'alert err'; wxAlert.textContent = '✗ ' + err.message
        wxNow.textContent = ''
      } finally { wxBtn.disabled = false }
    }
    wxBtn.onclick = () => { if (cityInput.value.trim()) loadWeather(cityInput.value.trim()) }

    const wxCard = el('div', { class: 'card' }, [
      el('div', { class: 'field' }, [el('label', {}, ['城市']), el('div', { class: 'row' }, [cityInput, wxBtn])]),
      wxAlert, wxNow, wxDays,
      el('p', { class: 'hint' }, ['数据来自 Open-Meteo，免费、无需 Key；若长时间无响应可能是网络问题。'])
    ])

    // ---------- 便签 ----------
    const memoKey = 'opwb:notes:memo'
    const memo = el('textarea', { placeholder: '随手记…（自动保存到本机）', style: 'min-height:140px' })
    memo.value = localStorage.getItem(memoKey) || ''
    const memoStatus = el('span', { class: 'muted' }, ['已自动保存'])
    memo.oninput = () => { localStorage.setItem(memoKey, memo.value); memoStatus.textContent = '已自动保存 ' + new Date().toLocaleTimeString() }
    const memoCard = el('div', { class: 'card' }, [
      el('div', { class: 'row', style: 'justify-content:space-between;align-items:center' }, [el('label', {}, ['记事便签']), memoStatus]),
      memo
    ])

    const page = el('div', { class: 'page' }, [
      el('h1', {}, ['日历 · 天气 · 便签']),
      el('p', { class: 'sub' }, ['纯本机 / 免费数据 · 日历备注与便签保存在浏览器，天气来自 Open-Meteo']),
      el('div', { class: 'grid cols-2' }, [calCard, wxCard]),
      memoCard
    ])
    root.append(page)

    loadWeather(cityInput.value.trim())
  }
}
