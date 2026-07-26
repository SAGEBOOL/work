// 应用入口：组装外壳 + 注册插件 + 启动路由 + 应用主题。
import './styles/base.css'
import { el, applyTheme } from './core/ui.js'
import { getSettings, subscribe } from './core/store.js'
import { initRouter, navigate } from './core/router.js'
import { registerPlugin } from './core/pluginManager.js'
import { renderSidebar } from './components/sidebar.js'
import { renderTopbar } from './components/topbar.js'
import { closeNav } from './components/nav.js'

import { overviewPlugin } from './plugins/overview/index.js'
import { pomodoroPlugin } from './plugins/pomodoro/index.js'
import { translatePlugin } from './plugins/translate/index.js'
import { pdfToolsPlugin } from './plugins/pdf-tools/index.js'
import { imageWatermarkPlugin } from './plugins/image-watermark/index.js'
import { videoWatermarkPlugin } from './plugins/video-watermark/index.js'
import { fileOrganizerPlugin } from './plugins/file-organizer/index.js'
import { industryAnalysisPlugin } from './plugins/industry-analysis/index.js'
import { industryResearchPlugin } from './plugins/industry-research/index.js'
import { docOrganizerPlugin } from './plugins/doc-organizer/index.js'
import { crmPlugin } from './plugins/crm/index.js'
import { bizAnalysisPlugin } from './plugins/biz-analysis/index.js'
import { leisurePlugin } from './plugins/leisure/index.js'
import { settingsPlugin } from './settings/settingsPlugin.js'

// 1) 注册所有插件（新增功能只改这一处 + 加一个插件文件）
registerPlugin(overviewPlugin)
registerPlugin(pomodoroPlugin)
registerPlugin(translatePlugin)
registerPlugin(pdfToolsPlugin)
registerPlugin(imageWatermarkPlugin)
registerPlugin(videoWatermarkPlugin)
registerPlugin(fileOrganizerPlugin)
registerPlugin(industryAnalysisPlugin)
registerPlugin(industryResearchPlugin)
registerPlugin(docOrganizerPlugin)
registerPlugin(crmPlugin)
registerPlugin(bizAnalysisPlugin)
registerPlugin(leisurePlugin)
registerPlugin(settingsPlugin)

// 2) 组装外壳
const app = document.getElementById('app')
const sidebarEl = el('aside', { class: 'sidebar' })
const mainEl = el('main', { class: 'main' })
const topbarEl = el('header', { class: 'topbar' })
const contentEl = el('section', { class: 'content' })
const overlayEl = el('div', { class: 'sidebar-overlay', onclick: () => closeNav() })
mainEl.append(topbarEl, contentEl)
app.append(sidebarEl, mainEl, overlayEl)

const rerenderChrome = () => {
  renderSidebar(sidebarEl, { navigate })
  renderTopbar(topbarEl, { navigate })
  applyTheme(getSettings().theme)
}

renderSidebar(sidebarEl, { navigate })
renderTopbar(topbarEl, { navigate })
applyTheme(getSettings().theme)
subscribe(rerenderChrome)

// 3) 启动路由
initRouter(contentEl)
