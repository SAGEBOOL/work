// 专业功能 · 行业研究：6 步向导（选行业→载入数据源→导入数据→指标可视化→AI洞察→导出报告）。
// 重点：搜集官方/专业行业数据，做分析整理（非公司经营财务）。纯前端，数据存本机。
import { el, clear, toast } from '../../core/ui.js'
import { lineChart, barChart } from '../../core/charts.js'
import { callChat } from '../../core/aiGateway.js'
import { INDUSTRY_PRESETS, getSettings } from '../../core/store.js'

const KEY = 'opwb:ir:v1'
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

// 通用官方/专业数据源（任意行业都可叠加）
const GENERAL_SOURCES = [
  { name: '国家统计局', url: 'http://www.stats.gov.cn', category: '政府与统计', freq: '月/季/年', credibility: '高', note: '综合宏观数据' },
  { name: '国家数据（统计局数据库）', url: 'https://data.stats.gov.cn', category: '政府与统计', freq: '不定期', credibility: '高', note: '可检索下载指标' },
  { name: '中国人民银行', url: 'http://www.pbc.gov.cn', category: '金融', freq: '日/月', credibility: '高', note: '货币、信贷' },
  { name: '工业和信息化部', url: 'https://www.miit.gov.cn', category: '政府与监管', freq: '不定期', credibility: '高', note: '产业运行' },
  { name: '中国证监会', url: 'http://www.csrc.gov.cn', category: '金融/监管', freq: '日', credibility: '高', note: '上市公司' },
  { name: '巨潮资讯（上市公司财报）', url: 'http://www.cninfo.com.cn', category: '上市公司', freq: '日', credibility: '高', note: '财报/公告' },
  { name: '中国海关', url: 'https://www.customs.gov.cn', category: '贸易', freq: '月', credibility: '高', note: '进出口' },
  { name: '国家知识产权局（专利）', url: 'https://www.cnipa.gov.cn', category: '知识产权', freq: '月', credibility: '高', note: '专利数据' }
]

// 分行业的官方/专业数据源（选行业后一键载入）
const INDUSTRY_SOURCES = {
  '建筑规划': [
    { name: '国家统计局·固定资产投资/房地产', url: 'https://data.stats.gov.cn', category: '政府与统计', freq: '月/年', credibility: '高', note: '房地产开发投资、建筑业总产值、新开工面积' },
    { name: '住房和城乡建设部', url: 'https://www.mohurd.gov.cn', category: '政府与监管', freq: '不定期', credibility: '高', note: '城市更新、绿色建筑政策' },
    { name: '中国建筑业协会', url: 'http://www.zgjzy.org', category: '行业协会', freq: '年', credibility: '中', note: '行业产值、企业排名' },
    { name: '自然资源部', url: 'https://www.mnr.gov.cn', category: '政府与监管', freq: '季', credibility: '高', note: '土地出让、用地审批' }
  ],
  '非遗传创': [
    { name: '文化和旅游部·非物质文化遗产司', url: 'https://www.mct.gov.cn', category: '政府与监管', freq: '年', credibility: '高', note: '国家级非遗名录、传承人' },
    { name: '中国非物质文化遗产网', url: 'http://www.ihchina.cn', category: '专业平台', freq: '不定期', credibility: '高', note: '非遗项目数据库' },
    { name: '国家统计局·文化及相关产业', url: 'https://data.stats.gov.cn', category: '政府与统计', freq: '年', credibility: '高', note: '文化产业增加值' },
    { name: '中国文化产业协会', url: 'http://www.ccia.org.cn', category: '行业协会', freq: '年', credibility: '中', note: '文创市场规模' }
  ],
  '研学': [
    { name: '教育部', url: 'http://www.moe.gov.cn', category: '政府与监管', freq: '年', credibility: '高', note: '中小学在校生、研学政策' },
    { name: '文化和旅游部', url: 'https://www.mct.gov.cn', category: '政府与监管', freq: '季', credibility: '高', note: '文旅接待、研学旅行' },
    { name: '中国旅游研究院', url: 'http://www.ctaweb.org', category: '研究机构', freq: '季', credibility: '中', note: '旅游/研学市场规模' },
    { name: '国家统计局·教育/旅游', url: 'https://data.stats.gov.cn', category: '政府与统计', freq: '年', credibility: '高', note: '教育、旅游数据' }
  ],
  '自媒体': [
    { name: 'CNNIC·中国互联网络发展状况统计', url: 'https://www.cnnic.net.cn', category: '研究机构', freq: '半年', credibility: '高', note: '网民规模、短视频用户' },
    { name: 'QuestMobile', url: 'https://www.questmobile.com.cn', category: '数据机构', freq: '季', credibility: '中', note: '移动互联网活跃、创作者' },
    { name: '中国广告协会', url: 'http://www.china-caa.org', category: '行业协会', freq: '年', credibility: '中', note: '广告市场规模' },
    { name: '国家统计局·信息服务业', url: 'https://data.stats.gov.cn', category: '政府与统计', freq: '年', credibility: '高', note: '信息服务、数字经济' }
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
const STEP_LABELS = ['选行业', '载入数据源', '导入数据', '指标可视化', 'AI 洞察', '导出报告']

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

// 解析 HTML <table> 为 { columns, rows }
function parseTable(table) {
  const rows = Array.from(table.querySelectorAll('tr'))
  if (!rows.length) return null
  const first = rows[0]
  const ths = Array.from(first.querySelectorAll('th'))
  const hasHeader = ths.length > 0
  let cols
  if (hasHeader) cols = ths.map((c, i) => (c.textContent || '').trim() || ('列' + (i + 1)))
  else cols = Array.from(first.querySelectorAll('td')).map((c, i) => (c.textContent || '').trim() || ('列' + (i + 1)))
  const dataRows = hasHeader ? rows.slice(1) : rows
  const out = []
  dataRows.forEach((tr) => {
    const tds = Array.from(tr.querySelectorAll('td'))
    if (!tds.length) return
    const o = {}
    cols.forEach((c, i) => { o[c] = tds[i] ? (tds[i].textContent || '').trim().replace(/\s+/g, ' ') : '' })
    out.push(o)
  })
  return { columns: cols, rows: out }
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
      el('p', { class: 'sub' }, ['选行业 → 一键载入数据源 → 导入数据 → 指标可视化 → AI 洞察 → 导出报告。数据存本机。'])
    ])

    // 向导上下文：自动带行业/数据集/指标/角度/洞察
    const wiz = {
      step: 1,
      industry: (getSettings().industry && getSettings().industry[0]) || INDUSTRY_PRESETS[0],
      datasetId: s.datasets.length ? s.datasets[0].id : '',
      col: '',
      chartKind: 'line',
      angle: '综合',
      insight: ''
    }
    const curDs = () => s.datasets.find((d) => d.id === wiz.datasetId)

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
      else if (wiz.step === 4) renderStep4()
      else if (wiz.step === 5) renderStep5()
      else renderStep6()
    }

    // ---------- 步骤 1：选行业 ----------
    const renderStep1 = () => {
      const indSel = el('select', {}, INDUSTRY_PRESETS.map((i) => el('option', { value: i, selected: i === wiz.industry ? 'selected' : null }, [i])))
      indSel.onchange = () => {
        wiz.industry = indSel.value
        // 若当前数据集所属行业与新选行业不同，提醒但不强制
        if (curDs() && curDs().industry !== wiz.industry) {
          toast('已切换行业为「' + wiz.industry + '」，后续数据源将按此行业载入', 'ok')
        }
      }
      stepBody.append(el('div', { class: 'card' }, [
        el('h3', {}, ['① 选择行业']),
        el('p', { class: 'hint' }, ['选择你正在研究的行业，后续「数据源」「指标库」会按此行业自动匹配。也可在「设置」中维护常用行业。']),
        el('div', { class: 'field', style: 'max-width:320px' }, [el('label', {}, ['所属行业']), indSel]),
        el('div', { class: 'kv-table', style: 'margin-top:12px' }, [
          el('div', { class: 'kv-h' }, [el('span', {}, ['本行业建议关注的指标（参考）'])]),
          el('div', { class: 'kv-r', style: 'grid-template-columns:1fr' }, [
            el('div', { class: 'chips' }, (INDICATOR_PRESETS[wiz.industry] || []).map((n) => el('span', { class: 'chip on' }, [n])))
          ])
        ]),
        el('p', { class: 'hint', style: 'margin-top:12px' }, ['点击右下角「下一步」进入数据源载入。'])
      ]))
    }

    // ---------- 步骤 2：载入数据源 ----------
    const renderStep2 = () => {
      const list = el('div', { class: 'kv-table' })
      const drawList = () => {
        clear(list)
        list.append(el('div', { class: 'kv-h' }, [el('span', {}, ['名称']), el('span', {}, ['类别/频率']), el('span', {}, ['可信度']), el('span', {}, [''])]))
        if (!s.sources.length) {
          list.append(el('div', { class: 'kv-r', style: 'grid-template-columns:1fr' }, [el('span', { class: 'muted' }, ['暂无数据源，可一键载入行业源或手动添加'])]))
        }
        s.sources.forEach((src, idx) => {
          const del = el('button', { class: 'mini', title: '删除' }, ['✕'])
          del.onclick = () => { s.sources.splice(idx, 1); save(s); drawList() }
          list.append(el('div', { class: 'kv-r', style: 'grid-template-columns:2fr 2fr 1fr 44px' }, [
            el('div', {}, [el('a', { href: src.url, target: '_blank', rel: 'noreferrer' }, [src.name]), src.note ? el('div', { class: 'muted', style: 'font-size:12px' }, [src.note]) : null]),
            el('span', {}, [src.category + ' · ' + (src.freq || '—')]),
            el('span', {}, [src.credibility || '—']),
            del
          ]))
        })
      }
      drawList()

      const indSel = el('select', {}, INDUSTRY_PRESETS.map((i) => el('option', { value: i, selected: i === wiz.industry ? 'selected' : null }, [i])))
      const indLoadBtn = el('button', { class: 'btn' }, ['一键载入行业数据源'])
      indLoadBtn.onclick = () => {
        wiz.industry = indSel.value
        const list2 = (INDUSTRY_SOURCES[wiz.industry] || []).concat(GENERAL_SOURCES)
        let added = 0
        list2.forEach((p) => { if (!s.sources.some((x) => x.url === p.url)) { s.sources.push({ id: uid(), ...p, industry: wiz.industry }); added++ } })
        save(s); drawList()
        toast('已载入 ' + added + ' 个「' + wiz.industry + '」相关数据源', 'ok')
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
      const noteI = el('input', { type: 'text', placeholder: '备注（可选）' })
      const addBtn = el('button', { class: 'btn' }, ['＋ 添加数据源'])
      addBtn.onclick = () => {
        if (!nameI.value.trim() || !urlI.value.trim()) { toast('请填写名称和链接', 'err'); return }
        s.sources.push({ id: uid(), name: nameI.value.trim(), url: urlI.value.trim(), category: catI.value.trim(), freq: freqI.value, credibility: credI.value, note: noteI.value.trim() })
        save(s); drawList(); nameI.value = urlI.value = catI.value = noteI.value = ''; toast('已添加', 'ok')
      }

      stepBody.append(el('div', { class: 'card' }, [
        el('h3', {}, ['② 载入数据源（' + wiz.industry + '）']),
        el('p', { class: 'hint' }, ['一键载入该行业的官方/专业数据源。第③步「从第②步数据源录入」可经 CORS 代理尝试自动抓取网页表格；若代理不可用或站点为 JS 动态渲染，则请到对应站点下载后于「③ 导入数据」粘贴或上传。']),
        el('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap;margin:8px 0' }, [
          el('div', { class: 'field', style: 'flex:1;min-width:140px' }, [el('label', {}, ['行业']), indSel]),
          indLoadBtn, genBtn
        ]),
        list,
        el('h3', { style: 'margin-top:16px' }, ['添加数据源']),
        el('div', { class: 'grid cols-2' }, [
          el('div', { class: 'field' }, [el('label', {}, ['名称']), nameI]),
          el('div', { class: 'field' }, [el('label', {}, ['链接']), urlI]),
          el('div', { class: 'field' }, [el('label', {}, ['类别']), catI]),
          el('div', { class: 'row', style: 'gap:8px' }, [
            el('div', { class: 'field', style: 'flex:1' }, [el('label', {}, ['更新频率']), freqI]),
            el('div', { class: 'field', style: 'flex:1' }, [el('label', {}, ['可信度']), credI])
          ])
        ]),
        el('div', { class: 'field' }, [el('label', {}, ['备注']), noteI]),
        addBtn
      ]))
    }

    // ---------- 步骤 3：导入数据（两路来源：导入文件 / 从第②步数据源录入） ----------
    const renderStep3 = () => {
      let mode = 'file' // 'file' | 'source'
      let parsed = null
      let srcId = ''

      const ta = el('textarea', { rows: 6, placeholder: '粘贴 CSV（首行为列名）或 JSON 数组，例如：\n年份,市场规模(亿元),同比增速\n2021,1200,8.5\n2022,1310,9.2' })
      const fileI = el('input', { type: 'file', accept: '.csv,.json,.xlsx,.xls,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const preview = el('div', {})
      const nameI = el('input', { type: 'text', placeholder: '数据集名称，如 2021-2024 非遗文创规模' })
      const indI = el('select', {}, INDUSTRY_PRESETS.map((i) => el('option', { value: i, selected: i === wiz.industry ? 'selected' : null }, [i])))

      // —— 数据源模式：从第②步已载入的数据源中检索并选用一个用于引用 ——
      const srcSearch = el('input', { type: 'text', placeholder: '🔍 搜索第②步已载入的数据源（按名称/类别/备注）' })
      const srcSel = el('select', {})
      const srcLink = el('a', { target: '_blank', rel: 'noreferrer', style: 'display:none' }, ['打开所选源'])
      const drawSrcOpts = () => {
        const q = srcSearch.value.trim().toLowerCase()
        const list = s.sources.filter((x) => !q || (x.name + ' ' + (x.category || '') + ' ' + (x.note || '')).toLowerCase().includes(q))
        clear(srcSel)
        if (!list.length) srcSel.append(el('option', { value: '' }, ['（无匹配数据源，可回到②载入）']))
        else list.forEach((x) => srcSel.append(el('option', { value: x.id, selected: x.id === srcId ? 'selected' : null }, [x.name + '（' + (x.credibility || '—') + '）'])))
        updateSrcLink()
      }
      const updateSrcLink = () => {
        const x = s.sources.find((d) => d.id === srcSel.value)
        if (x) { srcLink.href = x.url; srcLink.textContent = '🔗 打开：' + x.name; srcLink.style.display = '' } else srcLink.style.display = 'none'
      }
      srcSearch.oninput = drawSrcOpts
      srcSel.onchange = () => { srcId = srcSel.value; updateSrcLink() }
      drawSrcOpts()

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

      const status = el('div', { class: 'muted', style: 'margin-top:6px' }, ['已保存数据集：' + s.datasets.length + ' 个' + (s.datasets.length ? '（' + s.datasets.map((d) => d.name).join('、') + '）' : '')])

      const saveBtn = el('button', { class: 'btn primary' }, ['保存为数据集'])
      saveBtn.onclick = () => {
        if (!parsed) { toast('请先解析数据', 'err'); return }
        if (!nameI.value.trim()) { toast('请填写数据集名称', 'err'); return }
        if (mode === 'source' && !srcId) { toast('请先在上方选择一个数据源', 'err'); return }
        const rec = { id: uid(), name: nameI.value.trim(), industry: indI.value, importedAt: new Date().toISOString().slice(0, 10), columns: parsed.columns, rows: parsed.rows, note: '', sourceId: mode === 'source' ? srcId : '' }
        s.datasets.push(rec); save(s)
        wiz.datasetId = rec.id; wiz.col = ''
        toast('已保存数据集' + (mode === 'source' ? '（已关联数据源）' : ''), 'ok'); nameI.value = ''
        renderStepsBar(); status.textContent = '已保存数据集：' + s.datasets.length + ' 个（' + s.datasets.map((d) => d.name).join('、') + '）'
      }

      // 模式切换
      const fileTab = el('button', { class: 'seg-btn' }, ['📁 导入文件'])
      const srcTab = el('button', { class: 'seg-btn' }, ['🔗 从第②步数据源录入'])
      const proxyI = el('input', { type: 'text', placeholder: 'CORS 代理前缀（留空用设置里的）', value: getSettings().corsProxy || '' })
      const fetchBtn = el('button', { class: 'btn' }, ['🤖 尝试自动抓取'])
      const fetchStatus = el('div', { class: 'muted', style: 'font-size:12px;margin-top:6px' }, ['经 CORS 代理拉取所选源的网页，解析其中的 <table> 表格。若站点为 JS 动态渲染或代理不可用则会失败，此时请改用手动粘贴/上传。'])

      const srcRow = el('div', { class: 'field', style: 'display:none' }, [
        el('label', {}, ['选择并引用数据源']),
        el('div', { class: 'row', style: 'gap:8px;align-items:center' }, [srcSel, srcLink]),
        el('div', { class: 'field', style: 'margin-top:8px' }, [el('label', {}, ['CORS 代理前缀（可选，留空用设置里的）']), proxyI]),
        fetchBtn,
        fetchStatus,
        el('div', { class: 'muted', style: 'font-size:12px' }, ['选择一个数据源后点「尝试自动抓取」：成功会自动解析表格并填好数据集名称，保存时关联此来源；失败可改用手动粘贴/上传。'])
      ])

      fetchBtn.onclick = async () => {
        const src = s.sources.find((d) => d.id === srcSel.value)
        if (!src) { toast('请先选择一个数据源', 'err'); return }
        const proxy = (proxyI.value.trim() || getSettings().corsProxy || '').trim()
        if (!proxy) { toast('请填写 CORS 代理地址（设置→数据抓取代理，或上方临时填）', 'err'); return }
        fetchBtn.disabled = true; fetchBtn.textContent = '⏳ 抓取中…'
        try {
          const target = proxy.includes('=') ? proxy + encodeURIComponent(src.url) : (proxy.replace(/\/?$/, '/') + src.url)
          const resp = await fetch(target)
          if (!resp.ok) throw new Error('HTTP ' + resp.status)
          const html = await resp.text()
          const doc = new DOMParser().parseFromString(html, 'text/html')
          const tables = Array.from(doc.querySelectorAll('table'))
          if (!tables.length) throw new Error('页面未找到 <table> 表格（可能是 JS 动态渲染站点）')
          let best = tables[0], bestN = 0
          tables.forEach((t) => { const n = t.querySelectorAll('tr').length; if (n > bestN) { bestN = n; best = t } })
          const result = parseTable(best)
          if (!result || result.rows.length < 1) throw new Error('表格解析为空')
          parsed = result
          if (!nameI.value.trim()) nameI.value = src.name + ' · ' + new Date().toISOString().slice(0, 10)
          drawPreview()
          toast('自动抓取成功：' + parsed.rows.length + ' 行 × ' + parsed.columns.length + ' 列', 'ok')
        } catch (e) {
          parsed = null; clear(preview)
          toast('自动抓取失败：' + e.message + '（可改用手动粘贴/上传）', 'err')
        } finally {
          fetchBtn.disabled = false; fetchBtn.textContent = '🤖 尝试自动抓取'
        }
      }
      const fileRow = el('div', { class: 'row', style: 'gap:8px;margin:8px 0' }, [parseBtn, fileI])
      const setMode = (m) => {
        mode = m
        fileTab.classList.toggle('on', m === 'file')
        srcTab.classList.toggle('on', m === 'source')
        srcRow.style.display = m === 'source' ? '' : 'none'
        fileRow.style.display = m === 'file' ? '' : 'none'
      }
      fileTab.onclick = () => setMode('file')
      srcTab.onclick = () => setMode('source')
      setMode('file')

      stepBody.append(el('div', { class: 'card' }, [
        el('h3', {}, ['③ 导入数据']),
        el('p', { class: 'hint' }, ['数据依据有两种途径，任选其一即可：①上传/粘贴文件（CSV·JSON·xlsx）；②从第②步已载入的官方/专业数据源检索并引用——可点「尝试自动抓取」经 CORS 代理拉取网页表格，失败则改用手动粘贴/上传。保存时自动带上「所属行业」作为数据元。']),
        el('div', { class: 'seg' }, [fileTab, srcTab]),
        srcRow,
        ta,
        fileRow,
        preview,
        el('div', { class: 'grid cols-2', style: 'margin-top:12px' }, [
          el('div', { class: 'field' }, [el('label', {}, ['数据集名称']), nameI]),
          el('div', { class: 'field' }, [el('label', {}, ['所属行业（数据元）']), indI])
        ]),
        saveBtn,
        status
      ]))
    }

    // ---------- 步骤 4：指标可视化 ----------
    const renderStep4 = () => {
      const dsSel = el('select', {}, s.datasets.length ? s.datasets.map((d) => el('option', { value: d.id, selected: d.id === wiz.datasetId ? 'selected' : null }, [d.name + '（' + d.industry + '）'])) : [el('option', { value: '' }, ['（暂无数据集，请先到③导入）'])])
      const numSel = el('select', {})
      const chartKind = el('select', {}, [el('option', { value: 'line' }, ['折线图']), el('option', { value: 'bar' }, ['柱状图'])])
      const chartWrap = el('div', {})

      const refreshNum = () => {
        const ds = s.datasets.find((d) => d.id === dsSel.value)
        wiz.datasetId = dsSel.value || ''
        clear(numSel)
        if (!ds) { numSel.append(el('option', { value: '' }, ['（无数据集）'])); clear(chartWrap); return }
        const cols = numColsOf(ds)
        cols.forEach((c) => numSel.append(el('option', { value: c, selected: c === wiz.col ? 'selected' : null }, [c])))
        if (!cols.length) numSel.append(el('option', { value: '' }, ['（无数值列）']))
        // 若之前记录的列已失效则回落到首个
        if (!cols.includes(wiz.col) && cols.length) wiz.col = cols[0]
        drawChart()
      }
      const drawChart = () => {
        const ds = s.datasets.find((d) => d.id === dsSel.value)
        const col = numSel.value
        wiz.col = col
        wiz.chartKind = chartKind.value
        clear(chartWrap)
        if (!ds) { chartWrap.append(el('div', { class: 'muted' }, ['请先导入数据集'])); return }
        if (!col) { chartWrap.append(el('div', { class: 'muted' }, ['该数据集无数值列，无法绘图'])); return }
        const vals = ds.rows.map((r) => parseFloat(r[col])).filter((v) => !isNaN(v))
        if (chartKind.value === 'bar') {
          const xs = ds.rows.map((r, i) => (ds.columns[0] && r[ds.columns[0]] !== '' ? r[ds.columns[0]] : ('#' + (i + 1)))).slice(0, 20)
          const items = vals.slice(0, 20).map((v, i) => ({ label: String(xs[i] || (i + 1)).slice(0, 8), value: v }))
          chartWrap.append(el('div', { class: 'muted', style: 'margin:4px 0' }, ['「' + col + '」分布（前 20）']), barChart(items))
        } else {
          chartWrap.append(el('div', { class: 'muted', style: 'margin:4px 0' }, ['「' + col + '」趋势']), lineChart(vals))
        }
      }
      dsSel.onchange = refreshNum
      numSel.onchange = drawChart
      chartKind.onchange = drawChart
      refreshNum()

      // 指标库参考（本行业核心指标）
      const indBox = el('div', {})
      const drawInd = () => {
        clear(indBox)
        const preset = INDICATOR_PRESETS[wiz.industry] || []
        const custom = s.indicators.filter((x) => x.industry === wiz.industry).map((x) => x.name)
        indBox.append(el('p', { class: 'hint' }, ['「' + wiz.industry + '」核心指标建议（参考，可在分析中比照）：']))
        const grid = el('div', { class: 'chips' })
        preset.concat(custom).forEach((n) => grid.append(el('span', { class: 'chip on' }, [n])))
        indBox.append(grid)
      }
      drawInd()
      const addName = el('input', { type: 'text', placeholder: '补充自定义指标名' })
      const addBtn = el('button', { class: 'btn ghost' }, ['＋ 添加指标'])
      addBtn.onclick = () => {
        const n = addName.value.trim()
        if (!n) { toast('请输入指标名', 'err'); return }
        if (!s.indicators.some((x) => x.industry === wiz.industry && x.name === n)) { s.indicators.push({ industry: wiz.industry, name: n }); save(s); drawInd() }
        addName.value = ''
      }

      stepBody.append(el('div', { class: 'card' }, [
        el('h3', {}, ['④ 指标可视化']),
        el('p', { class: 'hint' }, ['选择数据集与数值指标，生成趋势/分布图。当前数据集：' + (curDs() ? curDs().name : '无')]),
        el('div', { class: 'grid cols-3' }, [
          el('div', { class: 'field' }, [el('label', {}, ['数据集']), dsSel]),
          el('div', { class: 'field' }, [el('label', {}, ['数值指标']), numSel]),
          el('div', { class: 'field' }, [el('label', {}, ['图表类型']), chartKind])
        ]),
        chartWrap,
        el('div', { class: 'row', style: 'gap:8px;margin-top:12px;align-items:flex-end' }, [el('div', { class: 'field', style: 'flex:1' }, [el('label', {}, ['补充本行业指标']), addName]), addBtn]),
        indBox
      ]))
    }

    // ---------- 步骤 5：AI 洞察 ----------
    const renderStep5 = () => {
      const angleSel = el('select', {}, [
        el('option', { value: '综合', selected: wiz.angle === '综合' ? 'selected' : null }, ['综合洞察']),
        el('option', { value: '政策影响', selected: wiz.angle === '政策影响' ? 'selected' : null }, ['政策影响']),
        el('option', { value: '市场规模', selected: wiz.angle === '市场规模' ? 'selected' : null }, ['市场规模']),
        el('option', { value: '竞争格局', selected: wiz.angle === '竞争格局' ? 'selected' : null }, ['竞争格局'])
      ])
      const insightBox = el('div', { class: 'trans-output' })
      if (wiz.insight) insightBox.textContent = wiz.insight

      const aiBtn = el('button', { class: 'btn primary' }, ['✨ 生成 AI 洞察'])
      aiBtn.onclick = async () => {
        const ds = curDs()
        if (!ds) { toast('请先在④选择数据集', 'err'); return }
        const col = wiz.col
        if (!col) { toast('请在④选择数值指标', 'err'); return }
        const vals = ds.rows.map((r) => parseFloat(r[col])).filter((v) => !isNaN(v))
        const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
        const head = ds.rows.slice(0, 6).map((r) => ds.columns.map((c) => c + '=' + r[c]).join('，')).join('\n')
        const srcText = s.sources.length ? s.sources.map((x) => x.name + '(' + x.url + ')').join('；') : '（未登记数据源）'
        const angle = angleSel.value
        wiz.angle = angle
        let angleReq = ''
        if (angle === '政策影响') angleReq = '本次聚焦于【政策影响】：请重点分析近年来相关政策/监管对该行业的影响方向与力度、政策红利与风险点，并给出合规与机会判断。'
        else if (angle === '市场规模') angleReq = '本次聚焦于【市场规模】：请重点分析市场规模总量、增速、渗透率与天花板，细分赛道规模及核心增长驱动力。'
        else if (angle === '竞争格局') angleReq = '本次聚焦于【竞争格局】：请重点分析市场集中度、主要参与者份额、进入壁垒、差异化策略与潜在颠覆者。'
        else angleReq = '本次为【综合洞察】：请从趋势、异常、对标与建议多维度综合研判。'
        const prompt = '你是资深行业研究分析师。请基于以下行业研究数据生成结构化简报（中文，条理清晰，使用 Markdown 小标题）：\n行业：' + ds.industry +
          '\n数据集：' + ds.name +
          '\n数据来源：' + srcText +
          '\n分析指标：' + col +
          '\n分析角度：' + angle +
          '\n样本量：' + vals.length + ' 条；首个值=' + (vals[0] ?? '无') + '；末个值=' + (vals[vals.length - 1] ?? '无') + '；均值=' + avg.toFixed(2) +
          '\n前 6 行原始数据：\n' + head +
          '\n\n' + angleReq +
          '\n\n请输出：\n## 一、趋势解读（描述走势与拐点）\n## 二、异常与关键发现（指出明显异常或结构性变化）\n## 三、行业对标与建议（结合行业常识给出判断）\n## 四、一句话结论'

        clear(insightBox)
        insightBox.append(el('span', { class: 'muted' }, ['AI 分析中…']))
        aiBtn.disabled = true
        try {
          let acc = ''
          await callChat({ messages: [{ role: 'user', content: prompt }], stream: true, onToken: (t) => {
            if (acc === '') clear(insightBox)
            acc += t
            insightBox.textContent = acc
          } })
          wiz.insight = acc
          toast('分析完成', 'ok')
        } catch (e) {
          clear(insightBox)
          insightBox.append(el('span', { class: 'err' }, ['✗ ' + e.message + '（请到设置配置可用 AI 供应商）']))
        } finally { aiBtn.disabled = false }
      }

      const dsSrc5 = (curDs() && curDs().sourceId) ? s.sources.find((x) => x.id === curDs().sourceId) : null
      stepBody.append(el('div', { class: 'card' }, [
        el('h3', {}, ['⑤ AI 洞察']),
        el('p', { class: 'hint' }, ['基于「' + (curDs() ? curDs().name + '（' + curDs().industry + '）' : '未选数据集') + '」的「' + (wiz.col || '未选指标') + '」生成分析。' + (dsSrc5 ? '数据来源：' + dsSrc5.name + '。' : '') + '选择分析角度，聚焦不同维度。']),
        el('div', { class: 'field', style: 'max-width:280px;margin-bottom:10px' }, [el('label', {}, ['分析角度']), angleSel]),
        aiBtn,
        el('label', { style: 'display:block;margin:12px 0 4px' }, ['AI 分析洞察']),
        insightBox
      ]))
    }

    // ---------- 步骤 6：导出报告 ----------
    const renderStep6 = () => {
      const ds = curDs()
      const col = wiz.col
      const dsSrc = (ds && ds.sourceId) ? s.sources.find((x) => x.id === ds.sourceId) : null
      const exportCard = el('div', { class: 'card' }, [
        el('h3', {}, ['⑥ 导出报告']),
        el('p', { class: 'hint' }, ['汇总数据集、指标、AI 洞察与数据来源，导出为 Markdown 或直接打印为 PDF。'])
      ])

      if (!ds || !col) {
        exportCard.append(el('p', { class: 'err' }, ['尚未完成前序步骤：' + (!ds ? '请在④选择数据集；' : '') + (!col ? '请在④选择数值指标。' : '')]))
        const backBtn = el('button', { class: 'btn' }, ['← 返回④指标可视化'])
        backBtn.onclick = () => goto(4)
        exportCard.append(backBtn)
        stepBody.append(exportCard)
        return
      }

      const vals = ds.rows.map((r) => parseFloat(r[col])).filter((v) => !isNaN(v))
      const mdBtn = el('button', { class: 'btn ghost' }, ['导出 Markdown'])
      mdBtn.onclick = () => {
        const lines = []
        lines.push('# 行业研究报告')
        lines.push('')
        lines.push('- 数据集：' + ds.name)
        lines.push('- 所属行业：' + ds.industry)
        lines.push('- 分析角度：' + wiz.angle)
        lines.push('- 生成时间：' + new Date().toLocaleString())
        lines.push('')
        lines.push('## 一、数据概览')
        lines.push('记录数：' + ds.rows.length + ' ｜ 字段：' + ds.columns.join('、'))
        if (vals.length) lines.push('指标「' + col + '」：首个=' + vals[0] + '，末个=' + vals[vals.length - 1] + '，均值=' + (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2))
        lines.push('')
        lines.push('## 二、可视化')
        lines.push('指标「' + col + '」趋势/分布图见系统内「行业研究 · ④指标可视化」。')
        lines.push('')
        lines.push('## 三、AI 分析洞察（' + wiz.angle + '）')
        lines.push(wiz.insight || '（未生成，回到⑤点击「生成 AI 洞察」后导出）')
        lines.push('')
        lines.push('## 四、数据来源')
        if (dsSrc) lines.push('- 【本数据集来源】' + dsSrc.name + '：' + dsSrc.url)
        const others = s.sources.filter((x) => x !== dsSrc)
        if (others.length) others.forEach((x) => lines.push('- ' + x.name + '：' + x.url))
        else if (!dsSrc) lines.push('（未登记）')
        const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
        const a = el('a', { href: URL.createObjectURL(blob), download: '行业研究-' + ds.name + '.md' })
        document.body.append(a); a.click(); a.remove()
        toast('已导出 Markdown', 'ok')
      }
      const pdfBtn = el('button', { class: 'btn ghost' }, ['打印 / 导出 PDF'])
      pdfBtn.onclick = () => {
        const L = []
        L.push('# 行业研究报告\n')
        L.push('- 数据集：' + ds.name + ' ｜ 行业：' + ds.industry + ' ｜ 分析角度：' + wiz.angle + ' ｜ ' + new Date().toLocaleString() + '\n')
        L.push('## 数据概览\n记录数：' + ds.rows.length + ' ｜ 字段：' + ds.columns.join('、') + '\n')
        if (vals.length) L.push('指标「' + col + '」：首个=' + vals[0] + '，末个=' + vals[vals.length - 1] + '\n')
        L.push('\n## AI 分析洞察（' + wiz.angle + '）\n' + (wiz.insight || '（未生成）') + '\n')
        L.push('\n## 数据来源\n')
        const srcLines = []
        if (dsSrc) srcLines.push('- 【本数据集来源】' + dsSrc.name + '：' + dsSrc.url)
        const others = s.sources.filter((x) => x !== dsSrc)
        if (others.length) others.forEach((x) => srcLines.push('- ' + x.name + '：' + x.url))
        else if (!dsSrc) srcLines.push('（未登记）')
        L.push(srcLines.join('\n'))
        const html = '<pre style="font-family:-apple-system,sans-serif;white-space:pre-wrap;word-break:break-word;padding:32px;line-height:1.7">' + L.join('\n').replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre>'
        const w = window.open('', '_blank')
        w.document.write('<html><head><meta charset="utf-8"><title>行业研究报告</title></head><body>' + html + '<scr' + 'ipt>window.onload=function(){window.print()}</scr' + 'ipt></body></html>')
        w.document.close()
      }

      exportCard.append(el('div', { class: 'kv-table', style: 'margin-bottom:12px' }, [
        el('div', { class: 'kv-h' }, [el('span', {}, ['报告概要'])]),
        el('div', { class: 'kv-r', style: 'grid-template-columns:1fr' }, [
          el('div', {}, [el('b', {}, ['数据集：']), ds.name + '（' + ds.industry + '）']),
          el('div', {}, [el('b', {}, ['指标：']), col]),
          el('div', {}, [el('b', {}, ['分析角度：']), wiz.angle]),
          el('div', {}, [el('b', {}, ['AI 洞察：']), wiz.insight ? '已生成（' + wiz.insight.length + ' 字）' : '未生成'])
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
