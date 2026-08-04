// 专业功能 · 行业研究：4 步主线（选行业 → 搜集资料 → AI 分析 → 导出报告）。
// 定位：搜索/汇集专业官方知识 + 用户导入资料，再按用户需求用 AI 技能做分析整理（非公司经营财务）。纯前端，数据存本机。
import { el, clear, toast } from '../../core/ui.js'
import { lineChart, barChart } from '../../core/charts.js'
import { callChat } from '../../core/aiGateway.js'
import { INDUSTRY_PRESETS, getSettings } from '../../core/store.js'
import { searchWeb } from '../../core/search.js'
import { searchIMA } from '../../core/ima.js'

const KEY = 'opwb:ir:v1'
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

// 官方信息类型：选行业后，按此分类检索与整理官方信息
const INFO_TYPES = ['官方资讯', '官方规范制度', '官方公开数据']
const INFO_TYPE_ICONS = { '官方资讯': '📰', '官方规范制度': '📋', '官方公开数据': '📊' }
// 官方精选库：选行业 + 信息类型后，直接内联展示的权威官方条目（不跳转第三方搜索）
// 每条：t=标题 u=官方链接 s=来源机构 d=一句话精选说明
const CURATED_INFO = {
  '通用': {
    '官方资讯': [
      { t: '中国政府网·国务院新闻', u: 'https://www.gov.cn/', s: '国务院办公厅', d: '国务院政策发布、政务动态、重要会议与讲话，宏观政策一手来源。' },
      { t: '国务院政策文件库', u: 'https://www.gov.cn/zhengce/index.htm', s: '中国政府网', d: '集中公开党中央、国务院及部门政策文件，可按主题/时间检索。' },
      { t: '新华网·权威发布', u: 'https://www.news.cn/', s: '新华通讯社', d: '国家通讯社，重大政策与官方资讯首发平台。' }
    ],
    '官方规范制度': [
      { t: '国家法律法规数据库', u: 'https://flk.npc.gov.cn/', s: '全国人大', d: '现行法律、行政法规、司法解释权威库，查法条原文。' },
      { t: '国务院政策文件库（法规）', u: 'https://www.gov.cn/zhengce/flfg.htm', s: '中国政府网', d: '行政法规、国务院文件、部门规章集中公开。' },
      { t: '国家标准全文公开系统', u: 'https://openstd.samr.gov.cn/', s: '市场监管总局', d: '强制性/推荐性国家标准全文公开检索，查行业规范。' }
    ],
    '官方公开数据': [
      { t: '国家统计局', u: 'https://www.stats.gov.cn/', s: '国家统计局', d: '综合宏观统计数据：GDP、人口、投资、消费等。' },
      { t: '国家数据平台', u: 'https://data.stats.gov.cn/', s: '国家统计局', d: '可在线检索、下载细分指标时序数据。' },
      { t: '中国人民银行·金融数据', u: 'http://www.pbc.gov.cn/', s: '中国人民银行', d: '货币供应、信贷、利率等金融统计数据。' }
    ]
  },
  '建筑规划': {
    '官方资讯': [
      { t: '住建部·新闻发布', u: 'https://www.mohurd.gov.cn/', s: '住房和城乡建设部', d: '城市更新、建筑业、房地产政策动态与官方发布。' },
      { t: '自然资源部·新闻', u: 'https://www.mnr.gov.cn/', s: '自然资源部', d: '国土空间规划、土地出让、用地审批官方动态。' },
      { t: '中国建筑业协会', u: 'http://www.zgjzy.org/', s: '中国建筑业协会', d: '行业运行、企业排名、产值信息发布。' }
    ],
    '官方规范制度': [
      { t: '国家标准全文公开系统（工程建设）', u: 'https://openstd.samr.gov.cn/', s: '市场监管总局', d: '工程建设国家标准（GB）全文检索。' },
      { t: '住建部·政策文件', u: 'https://www.mohurd.gov.cn/', s: '住房和城乡建设部', d: '城市更新、绿色建筑、建筑市场监管部门规章。' },
      { t: '中华人民共和国城乡规划法', u: 'https://flk.npc.gov.cn/', s: '全国人大', d: '《城乡规划法》法条原文。' }
    ],
    '官方公开数据': [
      { t: '国家数据·固定资产投资/房地产', u: 'https://data.stats.gov.cn/', s: '国家统计局', d: '房地产开发投资、建筑业总产值、新开工面积等指标。' },
      { t: '自然资源部·土地市场', u: 'https://www.mnr.gov.cn/', s: '自然资源部', d: '土地出让、成交价款等公开数据。' },
      { t: '中国建筑业协会·统计', u: 'http://www.zgjzy.org/', s: '中国建筑业协会', d: '建筑业总产值、企业排名等。' }
    ]
  },
  '非遗传创': {
    '官方资讯': [
      { t: '文旅部·非遗司动态', u: 'https://www.mct.gov.cn/', s: '文化和旅游部', d: '国家级非遗名录、传承人、非遗活动官方发布。' },
      { t: '中国非物质文化遗产网', u: 'http://www.ihchina.cn/', s: '中国非遗保护中心', d: '非遗项目数据库、展览、传承活动资讯。' },
      { t: '中国文化产业协会', u: 'http://www.ccia.org.cn/', s: '中国文化产业协会', d: '文创产业动态、市场信息。' }
    ],
    '官方规范制度': [
      { t: '中华人民共和国非物质文化遗产法', u: 'https://flk.npc.gov.cn/', s: '全国人大', d: '《非物质文化遗产法》法条原文。' },
      { t: '文旅部·政策文件', u: 'https://www.mct.gov.cn/', s: '文化和旅游部', d: '非遗保护、文化产业相关规章与通知。' },
      { t: '国家级非遗代表性传承人认定办法', u: 'https://www.mct.gov.cn/', s: '文化和旅游部', d: '传承人认定与管理办法。' }
    ],
    '官方公开数据': [
      { t: '国家数据·文化及相关产业', u: 'https://data.stats.gov.cn/', s: '国家统计局', d: '文化产业增加值、文化企业营收等。' },
      { t: '中国非遗网·项目数据库', u: 'http://www.ihchina.cn/', s: '中国非遗保护中心', d: '各级非遗项目数量、传承人统计。' },
      { t: '文旅部·文化和旅游统计', u: 'https://www.mct.gov.cn/', s: '文化和旅游部', d: '文旅接待人次、收入等公开数据。' }
    ]
  },
  '研学': {
    '官方资讯': [
      { t: '教育部·新闻发布', u: 'http://www.moe.gov.cn/', s: '教育部', d: '中小学教育、研学实践教育政策动态。' },
      { t: '文旅部·文旅动态', u: 'https://www.mct.gov.cn/', s: '文化和旅游部', d: '研学旅行、文旅融合活动资讯。' },
      { t: '中国旅游研究院', u: 'http://www.ctaweb.org/', s: '中国旅游研究院', d: '旅游/研学市场研究报告发布。' }
    ],
    '官方规范制度': [
      { t: '研学旅行服务规范（LB/T 054）', u: 'https://openstd.samr.gov.cn/', s: '文旅部/国标委', d: '研学旅行服务行业标准，查服务要求。' },
      { t: '教育部·政策文件', u: 'http://www.moe.gov.cn/', s: '教育部', d: '中小学综合实践、研学实践教育基地政策。' },
      { t: '中华人民共和国未成年人保护法', u: 'https://flk.npc.gov.cn/', s: '全国人大', d: '《未成年人保护法》法条原文。' }
    ],
    '官方公开数据': [
      { t: '国家数据·教育统计', u: 'https://data.stats.gov.cn/', s: '国家统计局', d: '中小学在校生、教育支出等。' },
      { t: '教育部·教育统计数据', u: 'http://www.moe.gov.cn/', s: '教育部', d: '全国教育事业发展统计公报。' },
      { t: '中国旅游研究院·研究报告', u: 'http://www.ctaweb.org/', s: '中国旅游研究院', d: '旅游/研学市场规模研究。' }
    ]
  },
  '自媒体': {
    '官方资讯': [
      { t: 'CNNIC·互联网络动态', u: 'https://www.cnnic.net.cn/', s: '中国互联网络信息中心', d: '网民规模、互联网发展权威发布。' },
      { t: '广电总局·网络视听', u: 'https://www.nrta.gov.cn/', s: '国家广播电视总局', d: '网络视听、短视频管理动态。' },
      { t: '中国广告协会', u: 'http://www.china-caa.org/', s: '中国广告协会', d: '广告行业动态、自律规范。' }
    ],
    '官方规范制度': [
      { t: '网络信息内容生态治理规定', u: 'https://flk.npc.gov.cn/', s: '国家网信办', d: '网络内容生态治理核心规章。' },
      { t: '互联网信息服务管理办法', u: 'https://flk.npc.gov.cn/', s: '国务院', d: '互联网信息服务管理基础法规。' },
      { t: '中华人民共和国网络安全法', u: 'https://flk.npc.gov.cn/', s: '全国人大', d: '《网络安全法》法条原文。' }
    ],
    '官方公开数据': [
      { t: 'CNNIC·互联网发展统计报告', u: 'https://www.cnnic.net.cn/', s: '中国互联网络信息中心', d: '网民规模、短视频用户、网络视频用户数据。' },
      { t: '国家数据·信息服务业', u: 'https://data.stats.gov.cn/', s: '国家统计局', d: '信息服务、数字经济相关统计。' },
      { t: '网络视听发展研究报告', u: 'https://www.nrta.gov.cn/', s: '国家广电总局', d: '短视频、网络直播用户与市场规模。' }
    ]
  }
}

// 通用官方/专业数据源（任意行业都可叠加）
const GENERAL_SOURCES = [
  { name: '国家统计局', url: 'http://www.stats.gov.cn', category: '政府与统计', freq: '月/季/年', credibility: '高', note: '综合宏观数据', infoType: '官方公开数据' },
  { name: '国家数据（统计局数据库）', url: 'https://data.stats.gov.cn', category: '政府与统计', freq: '不定期', credibility: '高', note: '可检索下载指标', infoType: '官方公开数据' },
  { name: '中国人民银行', url: 'http://www.pbc.gov.cn', category: '金融', freq: '日/月', credibility: '高', note: '货币、信贷', infoType: '官方公开数据' },
  { name: '工业和信息化部', url: 'https://www.miit.gov.cn', category: '政府与监管', freq: '不定期', credibility: '高', note: '产业运行', infoType: '官方规范制度' },
  { name: '中国证监会', url: 'http://www.csrc.gov.cn', category: '金融/监管', freq: '日', credibility: '高', note: '上市公司', infoType: '官方规范制度' },
  { name: '巨潮资讯（上市公司财报）', url: 'http://www.cninfo.com.cn', category: '上市公司', freq: '日', credibility: '高', note: '财报/公告', infoType: '官方公开数据' },
  { name: '中国海关', url: 'https://www.customs.gov.cn', category: '贸易', freq: '月', credibility: '高', note: '进出口', infoType: '官方公开数据' },
  { name: '国家知识产权局（专利）', url: 'https://www.cnipa.gov.cn', category: '知识产权', freq: '月', credibility: '高', note: '专利数据', infoType: '官方公开数据' }
]

// 分行业的官方/专业数据源（选行业后一键载入）
const INDUSTRY_SOURCES = {
  '建筑规划': [
    { name: '国家统计局·固定资产投资/房地产', url: 'https://data.stats.gov.cn', category: '政府与统计', freq: '月/年', credibility: '高', note: '房地产开发投资、建筑业总产值、新开工面积', infoType: '官方公开数据' },
    { name: '住房和城乡建设部', url: 'https://www.mohurd.gov.cn', category: '政府与监管', freq: '不定期', credibility: '高', note: '城市更新、绿色建筑政策', infoType: '官方规范制度' },
    { name: '中国建筑业协会', url: 'http://www.zgjzy.org', category: '行业协会', freq: '年', credibility: '中', note: '行业产值、企业排名', infoType: '官方资讯' },
    { name: '自然资源部', url: 'https://www.mnr.gov.cn', category: '政府与监管', freq: '季', credibility: '高', note: '土地出让、用地审批', infoType: '官方公开数据' }
  ],
  '非遗传创': [
    { name: '文化和旅游部·非物质文化遗产司', url: 'https://www.mct.gov.cn', category: '政府与监管', freq: '年', credibility: '高', note: '国家级非遗名录、传承人', infoType: '官方规范制度' },
    { name: '中国非物质文化遗产网', url: 'http://www.ihchina.cn', category: '专业平台', freq: '不定期', credibility: '高', note: '非遗项目数据库', infoType: '官方公开数据' },
    { name: '国家统计局·文化及相关产业', url: 'https://data.stats.gov.cn', category: '政府与统计', freq: '年', credibility: '高', note: '文化产业增加值', infoType: '官方公开数据' },
    { name: '中国文化产业协会', url: 'http://www.ccia.org.cn', category: '行业协会', freq: '年', credibility: '中', note: '文创市场规模', infoType: '官方资讯' }
  ],
  '研学': [
    { name: '教育部', url: 'http://www.moe.gov.cn', category: '政府与监管', freq: '年', credibility: '高', note: '中小学在校生、研学政策', infoType: '官方规范制度' },
    { name: '文化和旅游部', url: 'https://www.mct.gov.cn', category: '政府与监管', freq: '季', credibility: '高', note: '文旅接待、研学旅行', infoType: '官方资讯' },
    { name: '中国旅游研究院', url: 'http://www.ctaweb.org', category: '研究机构', freq: '季', credibility: '中', note: '旅游/研学市场规模', infoType: '官方公开数据' },
    { name: '国家统计局·教育/旅游', url: 'https://data.stats.gov.cn', category: '政府与统计', freq: '年', credibility: '高', note: '教育、旅游数据', infoType: '官方公开数据' }
  ],
  '自媒体': [
    { name: 'CNNIC·中国互联网络发展状况统计', url: 'https://www.cnnic.net.cn', category: '研究机构', freq: '半年', credibility: '高', note: '网民规模、短视频用户', infoType: '官方公开数据' },
    { name: 'QuestMobile', url: 'https://www.questmobile.com.cn', category: '数据机构', freq: '季', credibility: '中', note: '移动互联网活跃、创作者', infoType: '官方公开数据' },
    { name: '中国广告协会', url: 'http://www.china-caa.org', category: '行业协会', freq: '年', credibility: '中', note: '广告市场规模', infoType: '官方资讯' },
    { name: '国家统计局·信息服务业', url: 'https://data.stats.gov.cn', category: '政府与统计', freq: '年', credibility: '高', note: '信息服务、数字经济', infoType: '官方公开数据' }
  ]
}

// 预置行业核心指标库（按用户真实行业细化）
const INDICATOR_PRESETS = {
  '建筑规划': ['城镇化率(%)', '房地产开发投资额(亿元)', '建筑业总产值(亿元)', '房屋新开工面积(万㎡)', '土地成交价款(亿元)', '绿色建筑占比(%)', '人均公园绿地面积(㎡)', '城市更新投资(亿元)'],
  '非遗传创': ['国家级非遗项目数(项)', '非遗传承人数量(人)', '文创产业增加值(亿元)', '文旅接待总人次(亿)', '非遗相关企业数(家)', '非遗产品线上销售额(亿元)', 'IP授权收入(亿元)'],
  '研学': ['研学参与人次(万)', '研学市场规模(亿元)', '中小学在校生数(万人)', '研学基地/营地数(个)', '客单价(元/人)', '学校合作覆盖率(%)', '政策补贴金额(万元)'],
  '自媒体': ['内容平台月活(亿)', '活跃创作者数(万)', '内容播放量(亿次)', '在线广告市场规模(亿元)', '直播带货GMV(亿元)', '平均粉丝增长(人/月)', '内容完播率(%)', '付费/打赏收入(亿元)'],
  '通用': ['市场规模', '同比增速', '渗透率', '行业集中度CR5']
}

const CRED = ['高', '中', '低']
const FREQS = ['日', '周', '月', '季', '年', '不定期']
const STEP_LABELS = ['选行业', '搜集资料', 'AI 分析', '导出报告']

const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null } }
const save = (s) => localStorage.setItem(KEY, JSON.stringify(s))

// 简易 CSV 解析（支持引号转义、逗号、换行）
function parseCSV(text) {
  const rows = []
  let row = [], field = '', i = 0, inQ = false
  while (i < text.length) {
    const c = text[i]
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        inQ = false; i++; continue
      }
      field += c; i++; continue
    }
    if (c === '"') { inQ = true; i++; continue }
    if (c === ',') { row.push(field); field = ''; i++; continue }
    if (c === '\r') { i++; continue }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue }
    field += c; i++
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}

// 检测哪些列是数值列
function numColsOf(ds) {
  return ds.columns.filter((c) => ds.rows.some((r) => r[c] !== '' && r[c] != null && !isNaN(parseFloat(r[c]))))
}

export const industryResearchPlugin = {
  id: 'industry-research',
  name: '行业研究',
  icon: '🔍',
  group: '专业功能',
  mount(root) {
    const s = load() || { sources: [], datasets: [], indicators: [] }
    if (!Array.isArray(s.sources)) s.sources = []
    if (!Array.isArray(s.datasets)) s.datasets = []
    if (!Array.isArray(s.indicators)) s.indicators = []

    const page = el('div', { class: 'page' }, [
      el('h1', {}, ['行业研究']),
      el('p', { class: 'sub' }, ['① 选行业 → ② 搜集专业资料（官方源 / 搜索 / 导入）→ ③ 按你的需求用 AI 分析 → ④ 导出报告。数据存本机。'])
    ])

    const wiz = {
      step: 1,
      industry: (getSettings().industry && getSettings().industry[0]) || INDUSTRY_PRESETS[0],
      datasetId: s.datasets.length ? s.datasets[0].id : '',
      col: '',
      chartKind: 'line',
      angle: '综合',
      need: '',
      insight: '',
      webResults: [],
      imaResults: []
    }
    const curDs = () => s.datasets.find((d) => d.id === wiz.datasetId)

    // 内联弹窗：按行业+信息类型精选官方权威条目（不跳转第三方搜索）
    const openCuratedModal = (industry, type, keyword) => {
      const specific = (industry !== '通用' && CURATED_INFO[industry] && CURATED_INFO[industry][type]) ? CURATED_INFO[industry][type] : []
      const base = (CURATED_INFO['通用'] && CURATED_INFO['通用'][type]) || []
      const items = specific.length ? specific : base
      const kw = (keyword || '').trim()
      let filtered = items, note
      if (kw) {
        const low = kw.toLowerCase()
        const hit = items.filter((x) => (x.t + ' ' + x.d + ' ' + x.s).toLowerCase().includes(low))
        filtered = hit.length ? hit : items
        note = hit.length ? ('已按「' + kw + '」筛选，命中 ' + hit.length + ' 条（共 ' + items.length + ' 条）') : ('未匹配到含「' + kw + '」的条目，已显示全部 ' + items.length + ' 条')
      } else {
        note = '已为您精选 ' + items.length + ' 条官方权威入口'
      }
      const overlay = el('div', { style: 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow:auto' })
      const close = () => overlay.remove()
      overlay.onclick = (e) => { if (e.target === overlay) close() }
      const box = el('div', { style: 'background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);max-width:760px;width:100%;padding:20px 22px;box-shadow:0 12px 40px rgba(0,0,0,.25)' })
      const head = el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:12px' })
      head.append(el('h3', { style: 'margin:0' }, [INFO_TYPE_ICONS[type] + ' ' + industry + ' · ' + type + ' · 官方精选']))
      head.append(el('button', { class: 'mini', title: '关闭', onclick: close }, ['✕']))
      box.append(head)
      box.append(el('div', { class: 'muted', style: 'margin:6px 0 14px;font-size:13px' }, [note]))
      const listWrap = el('div', { style: 'display:flex;flex-direction:column;gap:10px' })
      filtered.forEach((it) => {
        const card = el('div', { style: 'border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px;background:var(--bg)' })
        const top = el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:10px' })
        top.append(el('b', { style: 'font-size:14px' }, [it.t]))
        top.append(el('a', { href: it.u, target: '_blank', rel: 'noreferrer', style: 'white-space:nowrap;color:var(--primary);font-weight:600' }, ['查看官方原文 ↗']))
        card.append(top)
        card.append(el('div', { class: 'muted', style: 'font-size:12.5px;margin-top:3px' }, ['来源：' + it.s]))
        card.append(el('div', { style: 'font-size:13.5px;margin-top:6px;line-height:1.6;color:var(--text)' }, [it.d]))
        listWrap.append(card)
      })
      box.append(listWrap)
      box.append(el('div', { class: 'muted', style: 'margin-top:14px;font-size:12px' }, ['以上为按官方来源整理精选的权威入口，点击「查看官方原文」直达官方页面，不经过第三方搜索引擎。']))
      overlay.append(box)
      document.body.append(overlay)
    }

    const stepsBar = el('div', { class: 'wiz-steps' })
    const stepBody = el('div', {})
    const navBar = el('div', { class: 'wiz-nav' })

    const renderStepsBar = () => {
      clear(stepsBar)
      STEP_LABELS.forEach((label, i) => {
        const n = i + 1
        const cls = 'wiz-step' + (n === wiz.step ? ' on' : '') + (n < wiz.step ? ' done' : '')
        stepsBar.append(el('div', { class: cls, onclick: () => goto(n) }, [
          el('span', { class: 'num' }, [n < wiz.step ? '✓' : String(n)]),
          el('span', { class: 'lbl' }, [label])
        ]))
      })
    }
    const renderNav = () => {
      clear(navBar)
      const prev = el('button', { class: 'btn ghost', disabled: wiz.step === 1 }, ['← 上一步'])
      prev.onclick = () => { if (wiz.step > 1) goto(wiz.step - 1) }
      const next = el('button', { class: 'btn primary', disabled: wiz.step === STEP_LABELS.length }, ['下一步 →'])
      next.onclick = () => { if (wiz.step < STEP_LABELS.length) goto(wiz.step + 1) }
      navBar.append(prev, el('span', { class: 'muted' }, ['第 ' + wiz.step + ' / ' + STEP_LABELS.length + ' 步']), next)
    }
    const goto = (n) => { wiz.step = n; renderStepsBar(); renderStep(); renderNav() }

    const renderStep = () => {
      clear(stepBody)
      if (wiz.step === 1) renderStep1()
      else if (wiz.step === 2) renderStep2()
      else if (wiz.step === 3) renderStep3()
      else renderStep4()
    }

    // ---------- 步骤 1：选行业 ----------
    const renderStep1 = () => {
      const indSel = el('select', {}, INDUSTRY_PRESETS.map((i) => el('option', { value: i, selected: i === wiz.industry ? 'selected' : null }, [i])))
      indSel.onchange = () => { wiz.industry = indSel.value }
      stepBody.append(el('div', { class: 'card' }, [
        el('h3', {}, ['① 选择研究行业']),
        el('p', { class: 'hint' }, ['选择行业后，可在②对【官方资讯 / 官方规范制度 / 官方公开数据】三类信息一键精选与整理（内联展示，不跳转第三方搜索）。也可在「设置」中维护常用行业。']),
        el('div', { class: 'field', style: 'max-width:320px' }, [el('label', {}, ['所属行业']), indSel]),
        el('div', { class: 'kv-table', style: 'margin-top:12px' }, [
          el('div', { class: 'kv-h' }, [el('span', {}, ['本行业建议关注的指标（参考）'])]),
          el('div', { class: 'kv-r', style: 'grid-template-columns:1fr' }, [
            el('div', { class: 'chips' }, (INDICATOR_PRESETS[wiz.industry] || []).map((n) => el('span', { class: 'chip on' }, [n])))
          ])
        ]),
        el('p', { class: 'hint', style: 'margin-top:12px' }, ['点击右下角「下一步」进入资料搜集。'])
      ]))
    }

    // ---------- 步骤 2：搜集资料（数据源目录 + 录入 + 可视化） ----------
    const renderStep2 = () => {
      // —— 资料 A：数据源目录（搜索相关专业知识的基础） ——
      const list = el('div', { class: 'kv-table' })
      const srcHeader = () => el('div', { class: 'kv-h' }, [el('span', {}, ['名称']), el('span', {}, ['类别/频率']), el('span', {}, ['可信度']), el('span', {}, [''])])
      const groupTitle = (label) => el('div', { class: 'muted', style: 'font-weight:600;margin:12px 0 4px;padding-top:8px;border-top:1px dashed var(--border)' }, [label])
      const srcRow = (src) => {
        const idx = s.sources.indexOf(src)
        const del = el('button', { class: 'mini', title: '删除' }, ['✕'])
        del.onclick = () => { s.sources.splice(idx, 1); save(s); drawList() }
        const searchBtn = el('button', { class: 'mini', title: '访问官方页面', onclick: () => { window.open(src.url, '_blank', 'noopener,noreferrer') } }, ['🔗'])
        return el('div', { class: 'kv-r', style: 'grid-template-columns:2fr 2fr 1fr 88px' }, [
          el('div', {}, [el('a', { href: src.url, target: '_blank', rel: 'noreferrer' }, [src.name]), src.note ? el('div', { class: 'muted', style: 'font-size:12px' }, [src.note]) : null]),
          el('span', {}, [src.category + ' · ' + (src.freq || '—')]),
          el('span', {}, [src.credibility || '—']),
          el('div', { class: 'row', style: 'gap:4px;justify-content:flex-end' }, [searchBtn, del])
        ])
      }
      const drawList = () => {
        clear(list)
        INFO_TYPES.forEach((t) => {
          const group = s.sources.filter((x) => (x.infoType || '其他') === t)
          if (!group.length) return
          list.append(groupTitle(INFO_TYPE_ICONS[t] + ' ' + t + '（' + group.length + '）'))
          list.append(srcHeader())
          group.forEach((src) => list.append(srcRow(src)))
        })
        const others = s.sources.filter((x) => !INFO_TYPES.includes(x.infoType || ''))
        if (others.length) {
          list.append(groupTitle('其他（' + others.length + '）'))
          list.append(srcHeader())
          others.forEach((src) => list.append(srcRow(src)))
        }
        if (!s.sources.length) list.append(el('div', { class: 'kv-r', style: 'grid-template-columns:1fr' }, [el('span', { class: 'muted' }, ['暂无数据源，可一键载入行业源或手动添加'])]))
      }
      drawList()

      // —— 官方信息快速查询（按信息类型精选官方内容，内联展示，不跳转第三方） ——
      const kwInput = el('input', { type: 'text', placeholder: '提示词 / 关键词（可选，如：城市更新 / 传承人 / 短视频），用于筛选精选条目' })
      const queryBox = el('div', { class: 'grid cols-3', style: 'margin:10px 0' }, INFO_TYPES.map((t) => {
        const specific = (wiz.industry !== '通用' && CURATED_INFO[wiz.industry] && CURATED_INFO[wiz.industry][t]) ? CURATED_INFO[wiz.industry][t] : []
        const count = specific.length ? specific.length : ((CURATED_INFO['通用'] && CURATED_INFO['通用'][t]) ? CURATED_INFO['通用'][t].length : 0)
        const card = el('div', { style: 'border:1px solid var(--border);border-radius:var(--radius);padding:14px;background:var(--panel);display:flex;flex-direction:column;gap:8px' }, [
          el('b', {}, [INFO_TYPE_ICONS[t] + ' ' + t]),
          el('span', { class: 'muted' }, ['官方精选 ' + count + ' 条权威入口'])
        ])
        const btn = el('button', { class: 'btn', style: 'width:100%' }, ['📑 一键精选'])
        btn.onclick = () => openCuratedModal(wiz.industry, t, kwInput.value)
        card.append(btn)
        return card
      }))

      const indSel = el('select', {}, INDUSTRY_PRESETS.map((i) => el('option', { value: i, selected: i === wiz.industry ? 'selected' : null }, [i])))
      const indLoadBtn = el('button', { class: 'btn' }, ['一键载入行业数据源'])
      indLoadBtn.onclick = () => {
        wiz.industry = indSel.value
        const list2 = (INDUSTRY_SOURCES[wiz.industry] || []).concat(GENERAL_SOURCES)
        let added = 0
        list2.forEach((p) => { if (!s.sources.some((x) => x.url === p.url)) { s.sources.push({ id: uid(), ...p, industry: wiz.industry }); added++ } })
        save(s); drawList(); toast('已载入 ' + added + ' 个「' + wiz.industry + '」相关数据源', 'ok')
      }
      const genBtn = el('button', { class: 'btn ghost' }, ['载入通用官方源'])
      genBtn.onclick = () => {
        let added = 0
        GENERAL_SOURCES.forEach((p) => { if (!s.sources.some((x) => x.url === p.url)) { s.sources.push({ id: uid(), ...p }); added++ } })
        save(s); drawList(); toast('已载入 ' + added + ' 个通用官方数据源', 'ok')
      }
      const nameI = el('input', { type: 'text', placeholder: '数据源名称' })
      const urlI = el('input', { type: 'url', placeholder: 'https://...' })
      const catI = el('input', { type: 'text', placeholder: '类别，如 政府与统计' })
      const freqI = el('select', {}, FREQS.map((f) => el('option', { value: f }, [f])))
      const credI = el('select', {}, CRED.map((c) => el('option', { value: c }, [c])))
      const infoTypeI = el('select', {}, INFO_TYPES.map((t) => el('option', { value: t }, [t])))
      const noteI = el('input', { type: 'text', placeholder: '备注（可选）' })
      const addBtn = el('button', { class: 'btn' }, ['＋ 添加数据源'])
      addBtn.onclick = () => {
        if (!nameI.value.trim() || !urlI.value.trim()) { toast('请填写名称和链接', 'err'); return }
        s.sources.push({ id: uid(), name: nameI.value.trim(), url: urlI.value.trim(), category: catI.value.trim(), freq: freqI.value, credibility: credI.value, infoType: infoTypeI.value, note: noteI.value.trim() })
        save(s); drawList(); nameI.value = urlI.value = catI.value = noteI.value = ''; toast('已添加', 'ok')
      }

      // —— 资料 B：录入（粘贴 / 导入文件） ——
      let parsed = null
      const ta = el('textarea', { rows: 6, placeholder: '粘贴 CSV（首行为列名）或 JSON 数组，例如：\n年份,市场规模(亿元),同比增速\n2021,1200,8.5\n2022,1310,9.2' })
      const fileI = el('input', { type: 'file', accept: '.csv,.json,.xlsx,.xls,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const preview = el('div', {})
      const nameI2 = el('input', { type: 'text', placeholder: '资料/数据集名称' })
      const indI = el('select', {}, INDUSTRY_PRESETS.map((i) => el('option', { value: i, selected: i === wiz.industry ? 'selected' : null }, [i])))
      const status = el('div', { class: 'muted', style: 'margin-top:6px' }, ['已保存数据集：' + s.datasets.length + ' 个' + (s.datasets.length ? '（' + s.datasets.map((d) => d.name).join('、') + '）' : '')])

      const doParse = (text) => {
        const t = text.trim()
        if (!t) { toast('内容为空', 'err'); return }
        try {
          if (t[0] === '[' || t[0] === '{') {
            const json = JSON.parse(t)
            const arr = Array.isArray(json) ? json : (json.data || json.rows || [])
            if (!arr.length) throw new Error('JSON 无数组数据')
            const cols = Object.keys(arr[0])
            parsed = { columns: cols, rows: arr.map((o) => { const r = {}; cols.forEach((c) => { r[c] = o[c] != null ? String(o[c]) : '' }); return r }) }
          } else {
            const rowsRaw = parseCSV(t).filter((r) => r.some((c) => c.trim() !== ''))
            if (rowsRaw.length < 2) throw new Error('CSV 至少需要表头 + 1 行数据')
            const cols = rowsRaw[0].map((c, i) => c.trim() || ('列' + (i + 1)))
            parsed = { columns: cols, rows: rowsRaw.slice(1).map((r) => { const o = {}; cols.forEach((c, i) => { o[c] = (r[i] || '').trim() }); return o }) }
          }
          drawPreview(); toast('解析成功：' + parsed.rows.length + ' 行 × ' + parsed.columns.length + ' 列', 'ok')
        } catch (e) { parsed = null; clear(preview); toast('解析失败：' + e.message, 'err') }
      }
      const drawPreview = () => {
        clear(preview)
        if (!parsed) return
        const tbl = el('div', { class: 'kv-table' })
        tbl.append(el('div', { class: 'kv-h' }, parsed.columns.map((c) => el('span', {}, [c]))))
        parsed.rows.slice(0, 8).forEach((r) => {
          tbl.append(el('div', { class: 'kv-r', style: 'grid-template-columns:repeat(' + parsed.columns.length + ',1fr)' },
            parsed.columns.map((c) => el('span', { style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, [r[c]]))))
        })
        if (parsed.rows.length > 8) tbl.append(el('div', { class: 'kv-r', style: 'grid-template-columns:1fr' }, [el('span', { class: 'muted' }, ['… 仅预览前 8 行，共 ' + parsed.rows.length + ' 行'])]))
        preview.append(el('label', {}, ['解析预览']), tbl)
      }
      const parseBtn = el('button', { class: 'btn' }, ['解析数据'])
      parseBtn.onclick = () => doParse(ta.value)
      fileI.onchange = async () => {
        const f = fileI.files && fileI.files[0]
        if (!f) return
        const name = (f.name || '').toLowerCase()
        try {
          if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
            const XLSX = await import('xlsx')
            const buf = await f.arrayBuffer()
            const wb = XLSX.read(buf, { type: 'array' })
            const ws = wb.Sheets[wb.SheetNames[0]]
            const json = XLSX.utils.sheet_to_json(ws, { defval: '' })
            if (!json.length) throw new Error('XLSX 第一个工作表无数据行')
            const cols = Object.keys(json[0])
            parsed = { columns: cols, rows: json.map((o) => { const r = {}; cols.forEach((c) => { r[c] = o[c] != null ? String(o[c]) : '' }); return r }) }
            drawPreview(); toast('解析成功：' + parsed.rows.length + ' 行 × ' + parsed.columns.length + ' 列', 'ok')
          } else {
            const txt = await f.text()
            ta.value = txt.slice(0, 5000)
            doParse(txt)
          }
        } catch (e) { parsed = null; clear(preview); toast('解析失败：' + e.message, 'err') }
      }
      const saveBtn = el('button', { class: 'btn primary' }, ['保存为数据集'])
      saveBtn.onclick = () => {
        if (!parsed) { toast('请先解析数据', 'err'); return }
        if (!nameI2.value.trim()) { toast('请填写数据集名称', 'err'); return }
        const rec = { id: uid(), name: nameI2.value.trim(), industry: indI.value, importedAt: new Date().toISOString().slice(0, 10), columns: parsed.columns, rows: parsed.rows, note: '', sourceId: '' }
        s.datasets.push(rec); save(s)
        wiz.datasetId = rec.id; wiz.col = ''
        toast('已保存数据集', 'ok'); nameI2.value = ''
        renderStepsBar(); status.textContent = '已保存数据集：' + s.datasets.length + ' 个（' + s.datasets.map((d) => d.name).join('、') + '）'
      }

      // —— 资料 C：数据可视化（若已有数据集） ——
      const chartWrap = el('div', {})
      const drawChart = () => {
        const ds = s.datasets.find((d) => d.id === dsSel2.value)
        const col = numSel2.value
        wiz.col = col
        clear(chartWrap)
        if (!ds) { chartWrap.append(el('div', { class: 'muted' }, ['请先保存数据集后再看可视化'])); return }
        if (!col) { chartWrap.append(el('div', { class: 'muted' }, ['该数据集无数值列，无法绘图'])); return }
        const vals = ds.rows.map((r) => parseFloat(r[col])).filter((v) => !isNaN(v))
        if (chartKind2.value === 'bar') {
          const xs = ds.rows.map((r, i) => (ds.columns[0] && r[ds.columns[0]] !== '' ? r[ds.columns[0]] : ('#' + (i + 1)))).slice(0, 20)
          const items = vals.slice(0, 20).map((v, i) => ({ label: String(xs[i] || (i + 1)).slice(0, 8), value: v }))
          chartWrap.append(el('div', { class: 'muted', style: 'margin:4px 0' }, ['「' + col + '」分布（前 20）']), barChart(items))
        } else {
          chartWrap.append(el('div', { class: 'muted', style: 'margin:4px 0' }, ['「' + col + '」趋势']), lineChart(vals))
        }
      }
      const dsSel2 = el('select', {}, s.datasets.length ? s.datasets.map((d) => el('option', { value: d.id, selected: d.id === wiz.datasetId ? 'selected' : null }, [d.name + '（' + d.industry + '）'])) : [el('option', { value: '' }, ['（暂无数据集，请先录入）'])])
      const numSel2 = el('select', {})
      const chartKind2 = el('select', {}, [el('option', { value: 'line' }, ['折线图']), el('option', { value: 'bar' }, ['柱状图'])])
      const refreshNum = () => {
        const ds = s.datasets.find((d) => d.id === dsSel2.value)
        wiz.datasetId = dsSel2.value || ''
        clear(numSel2)
        if (!ds) { numSel2.append(el('option', { value: '' }, ['（无数据集）'])); clear(chartWrap); return }
        const cols = numColsOf(ds)
        cols.forEach((c) => numSel2.append(el('option', { value: c, selected: c === wiz.col ? 'selected' : null }, [c])))
        if (!cols.length) numSel2.append(el('option', { value: '' }, ['（无数值列）']))
        if (!cols.includes(wiz.col) && cols.length) wiz.col = cols[0]
        drawChart()
      }
      dsSel2.onchange = refreshNum; numSel2.onchange = drawChart; chartKind2.onchange = drawChart
      refreshNum()

      // —— 资料 A2：联网检索（真实联网搜索，受开关 + 配置控制） ——
      let webCard = null
      const dsSettings = getSettings()
      if (dsSettings.dataSources && dsSettings.dataSources.web) {
        const searchCfg = dsSettings.search || {}
        const webInput = el('input', { type: 'text', placeholder: '输入检索关键词，如 2025 非遗 市场规模' })
        const webStatus = el('div', { class: 'muted', style: 'font-size:12px;margin-top:6px' }, [])
        const webList = el('div', {})
        let webHits = []
        const webBtn = el('button', { class: 'btn' }, ['🔍 联网搜索'])
        webBtn.onclick = async () => {
          const q = webInput.value.trim()
          if (!q) { toast('请输入关键词', 'err'); return }
          if (!searchCfg.key && searchCfg.provider !== 'custom') { toast('请先在「设置 → 联网搜索配置」填写 API Key', 'err'); return }
          webBtn.disabled = true; webStatus.textContent = '⏳ 检索中…'; webStatus.className = 'muted'; clear(webList)
          try {
            webHits = await searchWeb(q, searchCfg)
            clear(webList)
            webHits.forEach((h) => {
              const cb = el('input', { type: 'checkbox' })
              webList.append(el('label', { class: 'retrieval-item' }, [
                cb,
                el('div', {}, [
                  el('b', {}, [h.title || '(无标题)']),
                  h.snippet ? el('div', { class: 'muted', style: 'font-size:12px;margin-top:2px' }, [h.snippet]) : null,
                  h.url ? el('a', { href: h.url, target: '_blank', rel: 'noreferrer', class: 'muted', style: 'font-size:12px;word-break:break-all' }, [h.url]) : null
                ].filter(Boolean))
              ]))
            })
            webStatus.textContent = '找到 ' + webHits.length + ' 条，勾选后点「加入 AI 分析上下文」'
          } catch (e) { webStatus.textContent = '✗ ' + e.message; webStatus.className = 'muted err' }
          finally { webBtn.disabled = false }
        }
        const webAdd = el('button', { class: 'btn primary' }, ['加入 AI 分析上下文'])
        webAdd.onclick = () => {
          const sel = webHits.filter((_, i) => webList.querySelectorAll('input[type=checkbox]')[i] && webList.querySelectorAll('input[type=checkbox]')[i].checked)
          if (!sel.length) { toast('请先勾选检索结果', 'err'); return }
          wiz.webResults = sel
          toast('已加入 ' + sel.length + ' 条联网检索结果到 AI 上下文', 'ok')
        }
        webCard = el('div', { class: 'card', style: 'margin-top:16px' }, [
          el('h3', {}, ['联网检索（真实联网搜索）']),
          el('p', { class: 'hint' }, ['调用你在「设置 → 联网搜索配置」里配置的搜索 API。勾选结果后可一键加入下方 AI 分析上下文。']),
          el('div', { class: 'row', style: 'gap:8px' }, [webInput, webBtn]),
          webStatus, webList, webAdd
        ])
      }

      // —— 资料 A3：IMA 知识库检索（受开关 + 配置控制） ——
      let imaCard = null
      if (dsSettings.dataSources && dsSettings.dataSources.ima) {
        const imaCfg = dsSettings.ima || {}
        const imaInput = el('input', { type: 'text', placeholder: '输入检索关键词，如 城市更新 案例' })
        const imaStatus = el('div', { class: 'muted', style: 'font-size:12px;margin-top:6px' }, [])
        const imaList = el('div', {})
        let imaHits = []
        const imaBtn = el('button', { class: 'btn' }, ['🔍 检索知识库'])
        imaBtn.onclick = async () => {
          const q = imaInput.value.trim()
          if (!q) { toast('请输入关键词', 'err'); return }
          if (!imaCfg.clientId || !imaCfg.apiKey) { toast('请先在「设置 → IMA 知识库配置」填写凭证', 'err'); return }
          imaBtn.disabled = true; imaStatus.textContent = '⏳ 检索中…'; imaStatus.className = 'muted'; clear(imaList)
          try {
            imaHits = await searchIMA(q, imaCfg)
            clear(imaList)
            imaHits.forEach((h) => {
              const cb = el('input', { type: 'checkbox' })
              imaList.append(el('label', { class: 'retrieval-item' }, [
                cb,
                el('div', {}, [
                  el('b', {}, [h.title || '(无标题)']),
                  h.kb ? el('div', { class: 'muted', style: 'font-size:12px' }, ['知识库：' + h.kb]) : null,
                  h.snippet ? el('div', { class: 'muted', style: 'font-size:12px;margin-top:2px' }, [h.snippet]) : null
                ].filter(Boolean))
              ]))
            })
            imaStatus.textContent = '找到 ' + imaHits.length + ' 条，勾选后点「加入 AI 分析上下文」'
          } catch (e) { imaStatus.textContent = '✗ ' + e.message + '（若提示 CORS，请在设置填请求代理）'; imaStatus.className = 'muted err' }
          finally { imaBtn.disabled = false }
        }
        const imaAdd = el('button', { class: 'btn primary' }, ['加入 AI 分析上下文'])
        imaAdd.onclick = () => {
          const sel = imaHits.filter((_, i) => imaList.querySelectorAll('input[type=checkbox]')[i] && imaList.querySelectorAll('input[type=checkbox]')[i].checked)
          if (!sel.length) { toast('请先勾选检索结果', 'err'); return }
          wiz.imaResults = sel
          toast('已加入 ' + sel.length + ' 条知识库结果到 AI 上下文', 'ok')
        }
        imaCard = el('div', { class: 'card', style: 'margin-top:16px' }, [
          el('h3', {}, ['IMA 知识库检索']),
          el('p', { class: 'hint' }, ['检索你在 IMA 的个人知识库。勾选结果后可一键加入下方 AI 分析上下文。需先在「设置 → IMA 知识库配置」填写凭证。']),
          el('div', { class: 'row', style: 'gap:8px' }, [imaInput, imaBtn]),
          imaStatus, imaList, imaAdd
        ])
      }

      stepBody.append(
        el('div', { class: 'card' }, [
          el('h3', {}, ['②-1 数据源目录（' + wiz.industry + '）']),
          el('p', { class: 'hint' }, ['上方按「官方资讯 / 官方规范制度 / 官方公开数据」三类「一键精选」官方权威内容（内联弹窗展示，不跳转第三方搜索）；下方为已登记数据源目录，载入后按类型分组。']),
          el('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap;margin:8px 0' }, [el('div', { class: 'field', style: 'flex:1;min-width:140px' }, [el('label', {}, ['行业']), indSel]), indLoadBtn, genBtn]),
          el('div', { class: 'field', style: 'margin:4px 0 0' }, [el('label', {}, ['提示词 / 关键词（可选，用于筛选精选条目）']), kwInput]),
          queryBox,
          list,
          el('h3', { style: 'margin-top:16px' }, ['添加数据源']),
          el('div', { class: 'grid cols-2' }, [
            el('div', { class: 'field' }, [el('label', {}, ['名称']), nameI]),
            el('div', { class: 'field' }, [el('label', {}, ['链接']), urlI]),
            el('div', { class: 'field' }, [el('label', {}, ['类别']), catI]),
            el('div', { class: 'field' }, [el('label', {}, ['信息类型']), infoTypeI]),
            el('div', { class: 'field' }, [el('label', {}, ['更新频率']), freqI]),
            el('div', { class: 'field' }, [el('label', {}, ['可信度']), credI])
          ]),
          el('div', { class: 'field' }, [el('label', {}, ['备注']), noteI]),
          addBtn
        ]),
        webCard,
        imaCard,
        el('div', { class: 'card', style: 'margin-top:16px' }, [
          el('h3', {}, ['②-2 录入资料（粘贴 / 导入）']),
          el('p', { class: 'hint' }, ['把从数据源/搜索引擎/知识库找到的表格、CSV、JSON（或 xlsx）粘贴或上传到这里，解析后保存为数据集。']),
          ta,
          el('div', { class: 'row', style: 'gap:8px;margin:8px 0' }, [parseBtn, fileI]),
          preview,
          el('div', { class: 'grid cols-2', style: 'margin-top:12px' }, [el('div', { class: 'field' }, [el('label', {}, ['名称']), nameI2]), el('div', { class: 'field' }, [el('label', {}, ['所属行业']), indI])]),
          saveBtn, status
        ]),
        s.datasets.length ? el('div', { class: 'card', style: 'margin-top:16px' }, [
          el('h3', {}, ['②-3 数据可视化']),
          el('p', { class: 'hint' }, ['选择数据集与数值指标，生成趋势/分布图（可选，辅助理解）。']),
          el('div', { class: 'grid cols-3' }, [el('div', { class: 'field' }, [el('label', {}, ['数据集']), dsSel2]), el('div', { class: 'field' }, [el('label', {}, ['数值指标']), numSel2]), el('div', { class: 'field' }, [el('label', {}, ['图表类型']), chartKind2])]),
          chartWrap
        ]) : null
      )
    }

    // ---------- 步骤 3：AI 分析（按用户需求） ----------
    const renderStep3 = () => {
      const needTa = el('textarea', { rows: 4, placeholder: '描述你的研究需求，例如：\n我想评估「西城非遗更新场」项目的市场机会与政策风险，重点看年轻客群与文化消费趋势。' })
      needTa.value = wiz.need || ''
      const angleSel = el('select', {}, [
        el('option', { value: '综合', selected: wiz.angle === '综合' ? 'selected' : null }, ['综合洞察']),
        el('option', { value: '政策影响', selected: wiz.angle === '政策影响' ? 'selected' : null }, ['政策影响']),
        el('option', { value: '市场规模', selected: wiz.angle === '市场规模' ? 'selected' : null }, ['市场规模']),
        el('option', { value: '竞争格局', selected: wiz.angle === '竞争格局' ? 'selected' : null }, ['竞争格局'])
      ])
      const insightBox = el('div', { class: 'trans-output' })
      if (wiz.insight) insightBox.textContent = wiz.insight

      const aiBtn = el('button', { class: 'btn primary' }, ['✨ 生成 AI 分析'])
      aiBtn.onclick = async () => {
        const need = needTa.value.trim()
        if (!need) { toast('请先描述你的研究需求', 'err'); return }
        wiz.need = need; wiz.angle = angleSel.value
        // 收集已有资料作为上下文
        const srcText = s.sources.length ? s.sources.map((x) => '· ' + x.name + '【' + (x.infoType || '其他') + '】' + '（' + x.url + '，可信度' + (x.credibility || '—') + '）').join('\n') : '（未登记数据源）'
        const dsSummary = s.datasets.length ? s.datasets.map((d) => {
          const cols = d.columns.join('、')
          const sample = d.rows.slice(0, 5).map((r) => d.columns.map((c) => c + '=' + r[c]).join('，')).join('\n')
          return '【数据集】' + d.name + '（' + d.industry + '）\n字段：' + cols + '\n样本：\n' + sample
        }).join('\n\n') : '（未导入数据集）'
        const webText = wiz.webResults && wiz.webResults.length ? wiz.webResults.map((r, i) => '【联网' + (i + 1) + '】' + (r.title || '') + '\n' + (r.snippet || '') + '\n来源：' + (r.url || '')).join('\n\n') : '（未做联网检索）'
        const imaText = wiz.imaResults && wiz.imaResults.length ? wiz.imaResults.map((r, i) => '【IMA 知识库' + (i + 1) + '】' + (r.title || '') + (r.kb ? ('（' + r.kb + '）') : '') + '\n' + (r.snippet || '')).join('\n\n') : '（未检索知识库）'
        const angle = angleSel.value
        let angleReq = ''
        if (angle === '政策影响') angleReq = '本次聚焦于【政策影响】：分析相关政策/监管的影响方向与力度、政策红利与风险点，给出合规与机会判断。'
        else if (angle === '市场规模') angleReq = '本次聚焦于【市场规模】：分析市场规模总量、增速、渗透率与天花板，细分赛道规模及核心增长驱动力。'
        else if (angle === '竞争格局') angleReq = '本次聚焦于【竞争格局】：分析市场集中度、主要参与者份额、进入壁垒、差异化策略与潜在颠覆者。'
        else angleReq = '本次为【综合洞察】：从趋势、异常、对标与建议多维度综合研判。'

        const prompt = '你是资深行业研究分析师。请基于「用户需求」与下方已搜集的行业资料，生成结构化简报（中文，条理清晰，使用 Markdown 小标题）。\n\n【用户研究需求】\n' + need +
          '\n\n【研究行业】' + wiz.industry +
          '\n【分析角度】' + angle +
          '\n\n【已搜集的资料 · 数据源目录】\n' + srcText +
          '\n\n【已搜集的资料 · 数据集】\n' + dsSummary +
          '\n\n【已搜集的资料 · 联网检索】\n' + webText +
          '\n\n【已搜集的资料 · IMA 知识库】\n' + imaText +
          '\n\n' + angleReq +
          '\n\n请输出：\n## 一、需求拆解（明确用户真正想解决的问题）\n## 二、关键发现（结合资料，指出趋势/异常/结构性变化）\n## 三、行业对标与建议（结合行业常识与资料给出判断与可执行建议）\n## 四、风险与下一步（需补充的数据/动作）\n## 五、一句话结论'

        clear(insightBox); insightBox.append(el('span', { class: 'muted' }, ['AI 分析中…']))
        aiBtn.disabled = true
        try {
          let acc = ''
          await callChat({ messages: [{ role: 'user', content: prompt }], stream: true, onToken: (t) => { if (!acc) clear(insightBox); acc += t; insightBox.textContent = acc } })
          wiz.insight = acc
          toast('分析完成', 'ok')
        } catch (e) {
          clear(insightBox); insightBox.append(el('span', { class: 'err' }, ['✗ ' + e.message + '（请到设置配置可用 AI 供应商）']))
        } finally { aiBtn.disabled = false }
      }

      stepBody.append(el('div', { class: 'card' }, [
        el('h3', {}, ['③ AI 分析（按你的需求）']),
        el('p', { class: 'hint' }, ['描述你的具体研究需求，选择分析角度，AI 会结合「② 已搜集的资料」（数据源目录 + 数据集）进行分析。资料越充分，结论越扎实。']),
        el('div', { class: 'field' }, [el('label', {}, ['你的研究需求']), needTa]),
        el('div', { class: 'field', style: 'max-width:280px;margin:10px 0' }, [el('label', {}, ['分析角度']), angleSel]),
        aiBtn,
        el('label', { style: 'display:block;margin:12px 0 4px' }, ['AI 分析洞察']),
        insightBox
      ]))
    }

    // ---------- 步骤 4：导出报告 ----------
    const renderStep4 = () => {
      const exportCard = el('div', { class: 'card' }, [
        el('h3', {}, ['④ 导出报告']),
        el('p', { class: 'hint' }, ['汇总研究行业、资料来源、你的需求与 AI 分析洞察，导出为 Markdown 或打印 PDF。'])
      ])
      if (!wiz.insight) {
        exportCard.append(el('p', { class: 'err' }, ['尚未生成 AI 分析，请回到③点击「生成 AI 分析」后再导出。']))
        const backBtn = el('button', { class: 'btn' }, ['← 返回③ AI 分析'])
        backBtn.onclick = () => goto(3)
        exportCard.append(backBtn)
        stepBody.append(exportCard)
        return
      }
      const mdBtn = el('button', { class: 'btn ghost' }, ['导出 Markdown'])
      mdBtn.onclick = () => {
        const lines = []
        lines.push('# 行业研究报告')
        lines.push('')
        lines.push('- 研究行业：' + wiz.industry)
        lines.push('- 分析角度：' + wiz.angle)
        lines.push('- 生成时间：' + new Date().toLocaleString())
        lines.push('- 用户需求：' + (wiz.need || '（未填写）'))
        lines.push('')
        lines.push('## 一、资料来源（已搜集）')
        if (s.sources.length) s.sources.forEach((x) => lines.push('- ' + x.name + '：' + x.url + '（' + (x.credibility || '—') + '）'))
        else lines.push('（未登记数据源）')
        lines.push('')
        lines.push('## 二、已导入数据集')
        if (s.datasets.length) s.datasets.forEach((d) => lines.push('- ' + d.name + '（' + d.industry + '，' + d.rows.length + ' 行，字段：' + d.columns.join('、') + '）'))
        else lines.push('（未导入数据集）')
        lines.push('')
        lines.push('## 三、AI 分析洞察（' + wiz.angle + '）')
        lines.push(wiz.insight)
        lines.push('')
        const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
        const a = el('a', { href: URL.createObjectURL(blob), download: '行业研究-' + wiz.industry + '.md' })
        document.body.append(a); a.click(); a.remove()
        toast('已导出 Markdown', 'ok')
      }
      const pdfBtn = el('button', { class: 'btn ghost' }, ['打印 / 导出 PDF'])
      pdfBtn.onclick = () => {
        const L = []
        L.push('# 行业研究报告\n')
        L.push('- 研究行业：' + wiz.industry + ' ｜ 分析角度：' + wiz.angle + ' ｜ ' + new Date().toLocaleString() + '\n')
        L.push('**用户需求：** ' + (wiz.need || '（未填写）') + '\n')
        L.push('## 资料来源\n')
        if (s.sources.length) s.sources.forEach((x) => L.push('- ' + x.name + '：' + x.url + '\n')); else L.push('（未登记）\n')
        L.push('\n## AI 分析洞察（' + wiz.angle + '）\n' + wiz.insight + '\n')
        const html = '<pre style="font-family:-apple-system,sans-serif;white-space:pre-wrap;word-break:break-word;padding:32px;line-height:1.7">' + L.join('\n').replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre>'
        const w = window.open('', '_blank')
        w.document.write('<html><head><meta charset="utf-8"><title>行业研究报告</title></head><body>' + html + '<scr' + 'ipt>window.onload=function(){window.print()}</scr' + 'ipt></body></html>')
        w.document.close()
      }
      exportCard.append(el('div', { class: 'kv-table', style: 'margin-bottom:12px' }, [
        el('div', { class: 'kv-h' }, [el('span', {}, ['报告概要'])]),
        el('div', { class: 'kv-r', style: 'grid-template-columns:1fr' }, [
          el('div', {}, [el('b', {}, ['行业：']), wiz.industry]),
          el('div', {}, [el('b', {}, ['分析角度：']), wiz.angle]),
          el('div', {}, [el('b', {}, ['资料来源：']), s.sources.length + ' 个 · 数据集：' + s.datasets.length + ' 个']),
          el('div', {}, [el('b', {}, ['AI 洞察：']), '已生成（' + wiz.insight.length + ' 字）'])
        ])
      ]))
      exportCard.append(el('div', { class: 'row', style: 'gap:8px' }, [mdBtn, pdfBtn]))
      stepBody.append(exportCard)
    }

    renderStepsBar()
    renderStep()
    renderNav()
    page.append(stepsBar, stepBody, navBar)
    root.append(page)
  }
}
