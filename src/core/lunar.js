// 农历（阴历）核心模块：1900–2100，纯前端、无依赖。
// 数据基于公开的中国农历信息表 lunarInfo，转换算法为通用实现。
const lunarInfo = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
  0x092e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
  0x0d520
]

const GAN = '甲乙丙丁戊己庚辛壬癸'
const ZHI = '子丑寅卯辰巳午未申酉戌亥'
const ZODIAC = '鼠牛虎兔龙蛇马羊猴鸡狗猪'
const MONTHS = '正二三四五六七八九十冬腊'
const DAYS = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十']

function lYearDays(y) {
  let sum = 348
  for (let i = 0x8000; i > 0x8; i >>= 1) sum += (lunarInfo[y - 1900] & i) ? 1 : 0
  return sum + leapDays(y)
}
function leapDays(y) {
  if (leapMonth(y)) return (lunarInfo[y - 1900] & 0x10000) ? 30 : 29
  return 0
}
function leapMonth(y) { return lunarInfo[y - 1900] & 0xf }
function monthDays(y, m) { return (lunarInfo[y - 1900] & (0x10000 >> m)) ? 30 : 29 }

// 公历 → 农历。m 为 1–12（自然月）。
export function solarToLunar(y, m, d) {
  const base = Date.UTC(1900, 0, 31) // 1900-01-31 为农历 1900 正月初一
  let offset = Math.round((Date.UTC(y, m - 1, d) - base) / 86400000)
  let lunarYear = 1900, temp = 0
  for (; lunarYear < 2101 && offset > 0; lunarYear++) { temp = lYearDays(lunarYear); offset -= temp }
  if (offset < 0) { offset += temp; lunarYear-- }
  const leap = leapMonth(lunarYear)
  let isLeap = false, lunarMonth = 1
  for (; lunarMonth <= 12 && offset > 0; lunarMonth++) {
    if (leap > 0 && lunarMonth === (leap + 1) && !isLeap) {
      lunarMonth--; isLeap = true; temp = leapDays(lunarYear)
    } else {
      temp = monthDays(lunarYear, lunarMonth)
    }
    if (isLeap && lunarMonth === (leap + 1)) isLeap = false
    offset -= temp
  }
  if (offset === 0 && leap > 0 && lunarMonth === leap + 1) {
    if (isLeap) isLeap = false
    else { isLeap = true; lunarMonth-- }
  }
  if (offset < 0) { offset += temp; lunarMonth-- }
  const lunarDay = offset + 1
  return { lYear: lunarYear, lMonth: lunarMonth, lDay: lunarDay, isLeap }
}

export function lunarDayText(d) { return DAYS[d - 1] || '' }
export function lunarMonthText(m, isLeap) { return (isLeap ? '闰' : '') + (MONTHS[m - 1] || '') + '月' }
export function ganZhiYear(y) {
  const g = GAN[(((y - 4) % 10) + 10) % 10]
  const z = ZHI[(((y - 4) % 12) + 12) % 12]
  return g + z
}
export function zodiac(y) { return ZODIAC[(((y - 4) % 12) + 12) % 12] }

// 格子里显示用的短文本：农历月初显示月份（如「正月」），其余显示日（如「十五」）。
export function lunarCellText(r) {
  if (r.lDay === 1) return lunarMonthText(r.lMonth, r.isLeap).replace('月', '月')
  return lunarDayText(r.lDay)
}

// 选中日期详情用的完整文本。
export function lunarFullText(r) {
  return '农历 ' + ganZhiYear(r.lYear) + '年 ' + lunarMonthText(r.lMonth, r.isLeap) + lunarDayText(r.lDay)
    + ' · 生肖' + zodiac(r.lYear)
}
