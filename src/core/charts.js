// 轻量 SVG 图表（无依赖，适配明暗主题），供专业功能模块复用。
import { el } from './ui.js'

// series: number[] —— 折线/面积图
export function lineChart(series, opts = {}) {
  const { color = 'var(--primary)', width = 560, height = 180, empty = '暂无数据' } = opts
  if (!series || !series.length) return el('div', { class: 'muted' }, [empty])
  const max = Math.max(...series, 1)
  const min = Math.min(...series, 0)
  const range = (max - min) || 1
  const pad = 28
  const w = width, h = height
  const X = i => pad + (w - 2 * pad) * (series.length === 1 ? 0.5 : i / (series.length - 1))
  const Y = v => h - pad - (h - 2 * pad) * (v - min) / range
  const pts = series.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')
  const area = `${X(0).toFixed(1)},${(h - pad).toFixed(1)} ${pts} ${X(series.length - 1).toFixed(1)},${(h - pad).toFixed(1)}`
  const c = el('div', { class: 'chart' })
  c.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="100%" preserveAspectRatio="none" style="display:block">` +
    `<polygon points="${area}" fill="${color}" opacity="0.12"/>` +
    `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/>` +
    series.map((v, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3" fill="${color}"/>`).join('') +
    `</svg>`
  return c
}

// items: [{ label, value, color? }] —— 柱状图
export function barChart(items, opts = {}) {
  const { color = 'var(--primary)', width = 560, height = 180, empty = '暂无数据' } = opts
  if (!items || !items.length) return el('div', { class: 'muted' }, [empty])
  const max = Math.max(...items.map(d => d.value), 1)
  const w = width, h = height, pad = 24
  const gap = (w - 2 * pad) / items.length
  const bw = gap * 0.6
  const svg = items.map((d, i) => {
    const bh = (h - 2 * pad) * (d.value / max)
    const x = pad + gap * i + (gap - bw) / 2
    const y = h - pad - bh
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${d.color || color}"/>` +
      `<text x="${(x + bw / 2).toFixed(1)}" y="${(h - pad + 14).toFixed(1)}" text-anchor="middle" font-size="11" fill="var(--text-2)">${d.label}</text>` +
      `<text x="${(x + bw / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" font-size="10" fill="var(--text-3)">${d.value}</text>`
  }).join('')
  const c = el('div', { class: 'chart' })
  c.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="100%" preserveAspectRatio="none" style="display:block">${svg}</svg>`
  return c
}
