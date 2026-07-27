// 专业功能 · 行业研究：数据源目录 + 外部数据导入 + 指标库 + 可视化 + AI 洞察 + 报告导出。
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
      el('p', { class: 'sub' }, ['搜集官方/专业行业数据 → 导入整理 → 指标可视化 → AI 洞察 → 报告导出。数据存本机。'])
    ])

    let active = 'sources'
    const tabChips = el('div', { class: 'chips' })
    const panelWrap = el('div', {})
    const TABS = [['sources', '数据源目录'], ['import', '数据导入'], ['indicators', '指标库'], ['report', '分析与报告']]
    const syncTabs = () => { [...tabChips.children].forEach((c, i) => { c.className = 'chip' + (TABS[i][0] === active ? ' on' : '') }) }
    TABS.forEach(([id, label]) => {
      tabChips.append(el('span', { class: 'chip' + (id === active ? ' on' : ''), onclick: () => { active = id; syncTabs(); renderPanels() } }, [label]))
    })
    const renderPanels = () => {
      clear(panelWrap)
      if (active === 'sources') panelWrap.append(renderSources())
      else if (active === 'import') panelWrap.append(renderImport())
      else if (active === 'indicators') panelWrap.append(renderIndicators())
      else panelWrap.append(renderReport())
    }

    // ---------- 面板 1：数据源目录 ----------
    const renderSources = () => {
      const list = el('div', { class: 'kv-table' })
      const drawList = () => {
        clear(list)
        list.append(el('div', { class: 'kv-h' }, [
          el('span', {}, ['名称']), el('span', {}, ['类别/频率']), el('span', {}, ['可信度']), el('span', {}, [''])
        ]))
        if (!s.sources.length) {
          list.append(el('div', { class: 'kv-r', style: 'grid-template-columns:1fr' }, [
            el('span', { class: 'muted' }, ['暂无数据源，可一键载入官方预设或手动添加'])
          ]))
        }
        s.sources.forEach((src, idx) => {
          const del = el('button', { class: 'mini', title: '删除' }, ['✕'])
          del.onclick = () => { s.sources.splice(idx, 1); save(s); drawList() }
          list.append(el('div', { class: 'kv-r', style: 'grid-template-columns:2fr 2fr 1fr 44px' }, [
            el('div', {}, [
              el('a', { href: src.url, target: '_blank', rel: 'noreferrer' }, [src.name]),
              src.note ? el('div', { class: 'muted', style: 'font-size:12px' }, [src.note]) : null
            ]),
            el('span', {}, [src.category + ' · ' + (src.freq || '—')]),
            el('span', {}, [src.credibility || '—']),
            del
          ]))
        })
      }
      drawList()

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
        save(s); drawList()
        nameI.value = urlI.value = catI.value = noteI.value = ''
        toast('已添加', 'ok')
      }
      const presetBtn = el('button', { class: 'btn ghost' }, ['载入通用官方源'])
      presetBtn.onclick = () => {
        let added = 0
        GENERAL_SOURCES.forEach((p) => { if (!s.sources.some((x) => x.url === p.url)) { s.sources.push({ id: uid(), ...p }); added++ } })
        save(s); drawList()
        toast('已载入 ' + added + ' 个通用官方数据源', 'ok')
      }
      const userIndustry = (getSettings().industry && getSettings().industry[0]) || INDUSTRY_PRESETS[0]
      const indSelSrc = el('select', {}, INDUSTRY_PRESETS.map((i) => el('option', { value: i, selected: i === userIndustry ? 'selected' : null }, [i])))
      const indLoadBtn = el('button', { class: 'btn' }, ['一键载入行业数据源'])
      indLoadBtn.onclick = () => {
        const ind = indSelSrc.value
        const list2 = (INDUSTRY_SOURCES[ind] || []).concat(GENERAL_SOURCES)
        let added = 0
        list2.forEach((p) => { if (!s.sources.some((x) => x.url === p.url)) { s.sources.push({ id: uid(), ...p, industry: ind }); added++ } })
        save(s); drawList()
        toast('已载入 ' + added + ' 个「' + ind + '」相关数据源', 'ok')
      }

      return el('div', { class: 'card' }, [
        el('div', { class: 'row', style: 'justify-content:space-between;align-items:center' }, [el('h3', {}, ['数据源目录']), presetBtn]),
        el('p', { class: 'hint' }, ['选择行业后一键载入该行业专属的官方/专业数据源；浏览器受跨域限制无法直接抓取网页数据，请到对应站点下载后于「数据导入」粘贴或上传。']),
        el('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap;margin:8px 0' }, [
          el('div', { class: 'field', style: 'flex:1;min-width:140px' }, [el('label', {}, ['行业']), indSelSrc]),
          indLoadBtn
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
      ])
    }

    // ---------- 面板 2：数据导入 ----------
    const renderImport = () => {
      const ta = el('textarea', { rows: 6, placeholder: '粘贴 CSV（首行为列名）或 JSON 数组，例如：\n年份,市场规模(亿元),同比增速\n2021,1200,8.5\n2022,1310,9.2' })
      const fileI = el('input', { type: 'file', accept: '.csv,.json,.xlsx,.xls,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const preview = el('div', {})
      let parsed = null

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
          drawPreview()
          toast('解析成功：' + parsed.rows.length + ' 行 × ' + parsed.columns.length + ' 列', 'ok')
        } catch (e) {
          parsed = null; clear(preview)
          toast('解析失败：' + e.message, 'err')
        }
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
        if (parsed.rows.length > 8) {
          tbl.append(el('div', { class: 'kv-r', style: 'grid-template-columns:1fr' }, [
            el('span', { class: 'muted' }, ['… 仅预览前 8 行，共 ' + parsed.rows.length + ' 行'])
          ]))
        }
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
            drawPreview()
            toast('解析成功：' + parsed.rows.length + ' 行 × ' + parsed.columns.length + ' 列', 'ok')
          } else {
            const txt = await f.text()
            ta.value = txt.slice(0, 5000)
            doParse(txt)
          }
        } catch (e) {
          parsed = null; clear(preview)
          toast('解析失败：' + e.message, 'err')
        }
      }

      const nameI = el('input', { type: 'text', placeholder: '数据集名称，如 2021-2024 非遗文创规模' })
      const indI = el('select', {}, INDUSTRY_PRESETS.map((i) => el('option', { value: i }, [i])))
      const saveBtn = el('button', { class: 'btn primary' }, ['保存为数据集'])
      saveBtn.onclick = () => {
        if (!parsed) { toast('请先解析数据', 'err'); return }
        if (!nameI.value.trim()) { toast('请填写数据集名称', 'err'); return }
        s.datasets.push({ id: uid(), name: nameI.value.trim(), industry: indI.value, importedAt: new Date().toISOString().slice(0, 10), columns: parsed.columns, rows: parsed.rows, note: '' })
        save(s); toast('已保存数据集', 'ok'); nameI.value = ''
      }

      return el('div', { class: 'card' }, [
        el('h3', {}, ['导入外部数据']),
        el('p', { class: 'hint' }, ['从国家统计局/行业协会/上市公司公告等下载 CSV 或导出 JSON 后粘贴。复杂网站的反爬数据建议先导出再导入。']),
        ta,
        el('div', { class: 'row', style: 'gap:8px;margin:8px 0' }, [parseBtn, fileI]),
        preview,
        el('div', { class: 'grid cols-2', style: 'margin-top:12px' }, [
          el('div', { class: 'field' }, [el('label', {}, ['数据集名称']), nameI]),
          el('div', { class: 'field' }, [el('label', {}, ['所属行业']), indI])
        ]),
        saveBtn
      ])
    }

    // ---------- 面板 3：指标库 ----------
    const renderIndicators = () => {
      const indSel = el('select', {}, INDUSTRY_PRESETS.map((i) => el('option', { value: i }, [i])))
      const box = el('div', {})
      const draw = () => {
        clear(box)
        const ind = indSel.value
        const preset = INDICATOR_PRESETS[ind] || []
        const custom = s.indicators.filter((x) => x.industry === ind).map((x) => x.name)
        box.append(el('p', { class: 'hint' }, ['行业核心指标建议（预置，参考用）：']))
        const grid = el('div', { class: 'chips' })
        preset.concat(custom).forEach((n) => grid.append(el('span', { class: 'chip on' }, [n])))
        box.append(grid)
      }
      indSel.onchange = draw; draw()

      const addName = el('input', { type: 'text', placeholder: '自定义指标名' })
      const addBtn = el('button', { class: 'btn' }, ['＋ 添加指标'])
      addBtn.onclick = () => {
        const n = addName.value.trim()
        if (!n) { toast('请输入指标名', 'err'); return }
        if (!s.indicators.some((x) => x.industry === indSel.value && x.name === n)) {
          s.indicators.push({ industry: indSel.value, name: n }); save(s); draw()
        }
        addName.value = ''
      }

      return el('div', { class: 'card' }, [
        el('h3', {}, ['指标库']),
        el('p', { class: 'hint' }, ['不同行业关注的核心指标不同。预置为参考，可补充你实际追踪的指标。']),
        el('div', { class: 'field' }, [el('label', {}, ['选择行业']), indSel]),
        box,
        el('div', { class: 'row', style: 'gap:8px;margin-top:12px' }, [addName, addBtn])
      ])
    }

    // ---------- 面板 4：分析与报告 ----------
    const renderReport = () => {
      if (!s.datasets.length) {
        return el('div', { class: 'card' }, [el('h3', {}, ['分析与报告']), el('p', { class: 'hint' }, ['请先在「数据导入」保存至少一个数据集。'])])
      }

      const dsSel = el('select', {}, s.datasets.map((d) => el('option', { value: d.id }, [d.name + '（' + d.industry + '）'])))
      const numSel = el('select', {})
      const chartKind = el('select', {}, [el('option', { value: 'line' }, ['折线图']), el('option', { value: 'bar' }, ['柱状图'])])
      const angleSel = el('select', {}, [
        el('option', { value: '综合' }, ['综合洞察']),
        el('option', { value: '政策影响' }, ['政策影响']),
        el('option', { value: '市场规模' }, ['市场规模']),
        el('option', { value: '竞争格局' }, ['竞争格局'])
      ])
      const chartWrap = el('div', {})
      const insightBox = el('div', { class: 'trans-output' })
      let lastInsight = ''
      let lastAngle = '综合'

      const refreshNum = () => {
        const ds = s.datasets.find((d) => d.id === dsSel.value)
        clear(numSel)
        numColsOf(ds).forEach((c) => numSel.append(el('option', { value: c }, [c])))
        if (!numSel.options.length) numSel.append(el('option', { value: '' }, ['（无数值列）']))
        drawChart()
      }
      const drawChart = () => {
        const ds = s.datasets.find((d) => d.id === dsSel.value)
        const col = numSel.value
        clear(chartWrap)
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

      const aiBtn = el('button', { class: 'btn' }, ['✨ AI 分析洞察'])
      aiBtn.onclick = async () => {
        const ds = s.datasets.find((d) => d.id === dsSel.value)
        const col = numSel.value
        if (!col) { toast('该数据集无数值列', 'err'); return }
        const vals = ds.rows.map((r) => parseFloat(r[col])).filter((v) => !isNaN(v))
        const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
        const head = ds.rows.slice(0, 6).map((r) => ds.columns.map((c) => c + '=' + r[c]).join('，')).join('\n')
        const srcText = s.sources.length ? s.sources.map((x) => x.name + '(' + x.url + ')').join('；') : '（未登记数据源）'
        const angle = angleSel.value
        lastAngle = angle
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
          lastInsight = acc
          toast('分析完成', 'ok')
        } catch (e) {
          clear(insightBox)
          insightBox.append(el('span', { class: 'err' }, ['✗ ' + e.message + '（请到设置配置可用 AI 供应商）']))
        } finally { aiBtn.disabled = false }
      }

      const mdBtn = el('button', { class: 'btn ghost' }, ['导出 Markdown'])
      mdBtn.onclick = () => {
        const ds = s.datasets.find((d) => d.id === dsSel.value)
        const col = numSel.value
        const vals = ds.rows.map((r) => parseFloat(r[col])).filter((v) => !isNaN(v))
        const lines = []
        lines.push('# 行业研究报告')
        lines.push('')
        lines.push('- 数据集：' + ds.name)
        lines.push('- 所属行业：' + ds.industry)
        lines.push('- 分析角度：' + lastAngle)
        lines.push('- 生成时间：' + new Date().toLocaleString())
        lines.push('')
        lines.push('## 一、数据概览')
        lines.push('记录数：' + ds.rows.length + ' ｜ 字段：' + ds.columns.join('、'))
        if (vals.length) lines.push('指标「' + col + '」：首个=' + vals[0] + '，末个=' + vals[vals.length - 1] + '，均值=' + (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2))
        lines.push('')
        lines.push('## 二、可视化')
        lines.push('指标「' + col + '」趋势图见系统内「分析与报告」。')
        lines.push('')
        lines.push('## 三、AI 分析洞察')
        lines.push(lastInsight || '（未生成，点击「AI 分析洞察」后导出）')
        lines.push('')
        lines.push('## 四、数据来源')
        if (s.sources.length) s.sources.forEach((x) => lines.push('- ' + x.name + '：' + x.url))
        else lines.push('（未登记）')
        const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
        const a = el('a', { href: URL.createObjectURL(blob), download: '行业研究-' + ds.name + '.md' })
        document.body.append(a); a.click(); a.remove()
        toast('已导出 Markdown', 'ok')
      }
      const pdfBtn = el('button', { class: 'btn ghost' }, ['打印 / 导出 PDF'])
      pdfBtn.onclick = () => {
        const ds = s.datasets.find((d) => d.id === dsSel.value)
        const col = numSel.value
        const vals = ds.rows.map((r) => parseFloat(r[col])).filter((v) => !isNaN(v))
        const L = []
        L.push('# 行业研究报告\n')
        L.push('- 数据集：' + ds.name + ' ｜ 行业：' + ds.industry + ' ｜ 分析角度：' + lastAngle + ' ｜ ' + new Date().toLocaleString() + '\n')
        L.push('## 数据概览\n记录数：' + ds.rows.length + ' ｜ 字段：' + ds.columns.join('、') + '\n')
        if (vals.length) L.push('指标「' + col + '」：首个=' + vals[0] + '，末个=' + vals[vals.length - 1] + '\n')
        L.push('\n## AI 分析洞察\n' + (lastInsight || '（未生成）') + '\n')
        L.push('\n## 数据来源\n')
        L.push(s.sources.length ? s.sources.map((x) => '- ' + x.name + '：' + x.url).join('\n') : '（未登记）')
        const html = '<pre style="font-family:-apple-system,sans-serif;white-space:pre-wrap;word-break:break-word;padding:32px;line-height:1.7">' + L.join('\n').replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre>'
        const w = window.open('', '_blank')
        w.document.write('<html><head><meta charset="utf-8"><title>行业研究报告</title></head><body>' + html + '<scr' + 'ipt>window.onload=function(){window.print()}</scr' + 'ipt></body></html>')
        w.document.close()
      }

      return el('div', { class: 'card' }, [
        el('h3', {}, ['分析与报告']),
        el('div', { class: 'grid cols-3' }, [
          el('div', { class: 'field' }, [el('label', {}, ['数据集']), dsSel]),
          el('div', { class: 'field' }, [el('label', {}, ['数值指标']), numSel]),
          el('div', { class: 'field' }, [el('label', {}, ['图表类型']), chartKind])
        ]),
        el('div', { class: 'field', style: 'max-width:280px;margin-top:8px' }, [el('label', {}, ['分析角度']), angleSel]),
        chartWrap,
        el('div', { class: 'row', style: 'gap:8px;margin:12px 0' }, [aiBtn, mdBtn, pdfBtn]),
        el('label', {}, ['AI 分析洞察']),
        insightBox
      ])
    }

    renderPanels()
    page.append(tabChips, panelWrap)
    root.append(page)
  }
}
