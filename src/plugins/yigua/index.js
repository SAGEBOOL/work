// 每天要一卦：点击呼吸圆 → 静默 5 秒心念所问 → 出卦象（六爻 SVG + 卦辞 + 白话）
// + 结合心愿的 AI 解读（接入站点 AI 网关 callChat；未配置 Key 时回退模板解读）。
// 底部折线走势图记录每次吉凶评分，点击任意点看当次详情。
import { el } from '../../core/ui.js'
import { getSettings } from '../../core/store.js'
import { callChat, getProvider, configuredProviders } from '../../core/aiGateway.js'

/* ===== 六十四卦数据（文王卦序） ===== */
const GUA = [
  {n:"乾为天", t:"元亨利贞。", d:"刚健中正，万物资始。诸事通达，宜进取守正。", luck:88},
  {n:"坤为地", t:"元亨，利牝马之贞。", d:"厚德载物，柔顺包容。宜守静，顺势而为。", luck:86},
  {n:"水雷屯", t:"元亨利贞，勿用有攸往，利建侯。", d:"万物始生，艰难初创。宜立足根基，不宜冒进。", luck:55},
  {n:"山水蒙", t:"亨。匪我求童蒙，童蒙求我。", d:"蒙昧待启，求教于师。宜虚心学习，拨云见日。", luck:58},
  {n:"水天需", t:"有孚，光亨，贞吉。利涉大川。", d:"云上于天，待时而动。耐心等待，时机成熟则吉。", luck:62},
  {n:"天水讼", t:"有孚，窒。惕中吉。终凶。", d:"争讼之事，宜止不宜争。退一步海阔天空。", luck:40},
  {n:"地水师", t:"贞丈人，吉无咎。", d:"兵者凶器，用师以正。宜团结，慎于用人。", luck:50},
  {n:"水地比", t:"吉。原筮，元永贞，无咎。", d:"亲比相辅，择善而从。与人合作，万事顺遂。", luck:75},
  {n:"风天小畜", t:"亨。密云不雨，自我西郊。", d:"小有积蓄，力量未足。宜积小成大，暂待时机。", luck:60},
  {n:"天泽履", t:"履虎尾，不咥人，亨。", d:"小心行走，如履虎尾。谨慎行事可免祸。", luck:65},
  {n:"地天泰", t:"小往大来，吉亨。", d:"天地交泰，阴阳和合。诸事顺通，大吉。", luck:95},
  {n:"天地否", t:"否之匪人，不利君子贞，大往小来。", d:"天地不交，闭塞不通。宜韬光养晦，待否极泰来。", luck:30},
  {n:"天火同人", t:"同人于野，亨。利涉大川。", d:"与人和同，齐心协力。同心则事成。", luck:82},
  {n:"火天大有", t:"元亨。", d:"大有所得，富有之日。守谦持盈，盛极防溢。", luck:90},
  {n:"地山谦", t:"亨，君子有终。", d:"谦谦君子，卑而不可逾。谦逊得福，终有善报。", luck:92},
  {n:"雷地豫", t:"利建侯行师。", d:"欢乐顺动，未雨绸缪。安逸中勿忘戒惧。", luck:70},
  {n:"泽雷随", t:"元亨利贞，无咎。", d:"随时而动，从善如流。顺势则吉。", luck:78},
  {n:"山风蛊", t:"元亨，利涉大川。先甲三日，后甲三日。", d:"弊久生蛊，整治革新。拨乱反正，振衰起敝。", luck:52},
  {n:"地泽临", t:"元，亨，利，贞。至于八月有凶。", d:"临下以教，阳气渐长。把握当下，盛极当防。", luck:80},
  {n:"风地观", t:"盥而不荐，有孚颙若。", d:"观察省视，以德化人。静观其变，审时度势。", luck:66},
  {n:"火雷噬嗑", t:"亨。利用狱。", d:"咬合去梗，排除障碍。遇有阻滞，果断决断。", luck:58},
  {n:"山火贲", t:"亨。小利有攸往。", d:"文饰之美，质素为本。外在修饰，内在须真。", luck:72},
  {n:"山地剥", t:"不利有攸往。", d:"阴盛剥阳，剥落将尽。宜静守，勿妄动。", luck:32},
  {n:"地雷复", t:"亨。出入无疾，朋来无咎。", d:"一阳来复，生机重启。迷途知返，往复得吉。", luck:85},
  {n:"天雷无妄", t:"元亨利贞。其匪正有眚，不利有攸往。", d:"不妄为，顺天命。守正免灾，妄动招咎。", luck:74},
  {n:"山天大畜", t:"利贞，不家食吉，利涉大川。", d:"厚积笃实，蓄德养才。时机至则大有作为。", luck:83},
  {n:"山雷颐", t:"贞吉。观颐，自求口实。", d:"颐养之道，慎言节欲。养正为吉。", luck:77},
  {n:"泽风大过", t:"栋桡，利有攸往，亨。", d:"大过之时，栋梁将挠。非常之事，非常之举。", luck:46},
  {n:"坎为水", t:"习坎，有孚，维心亨，行有尚。", d:"重重险陷，唯诚可济。处险守心，终能出险。", luck:42},
  {n:"离为火", t:"利贞，亨。畜牝牛，吉。", d:"附丽光明，日月丽天。守正得丽，光明通达。", luck:76},
  {n:"泽山咸", t:"亨，利贞，取女吉。", d:"感应相通，男女相悦。以诚相感，万物和合。", luck:84},
  {n:"雷风恒", t:"亨，无咎，利贞，利有攸往。", d:"恒久不已，持之以恒。守常则利，变则失。", luck:80},
  {n:"天山遁", t:"亨，小利贞。", d:"退避以全，明哲保身。时不当则隐，待时而出。", luck:55},
  {n:"雷天大壮", t:"利贞。", d:"阳刚壮盛，壮勿妄动。盛时守礼，强而能止。", luck:70},
  {n:"火地晋", t:"康侯用锡马蕃庶，昼日三接。", d:"晋升长进，光明渐进。积小进，步步高。", luck:82},
  {n:"地火明夷", t:"利艰贞。", d:"光明受伤，韬晦守正。处艰难，内明外柔。", luck:45},
  {n:"风火家人", t:"利女贞。", d:"家道之正，女主内而男主外。齐家治国，始于一室。", luck:78},
  {n:"火泽睽", t:"小事吉。", d:"乖离背反，求同存异。异中求合，小事可成。", luck:50},
  {n:"水山蹇", t:"利西南，不利东北。利见大人，贞吉。", d:"蹇难在前，止而思反。反身修德，徐图解脱。", luck:40},
  {n:"雷水解", t:"利西南。无所往，其来复吉。", d:"险难消解，舒缓解脱。把握时机，解难纾困。", luck:75},
  {n:"山泽损", t:"有孚，元吉，无咎，可贞，利有攸往。", d:"损下益上，损中有得。节损私欲，反得其益。", luck:68},
  {n:"风雷益", t:"利有攸往，利涉大川。", d:"损上益下，与时偕行。受益当施，进德修业。", luck:86},
  {n:"泽天夬", t:"扬于王庭，孚号有厉。", d:"决而能断，刚决柔也。果断除奸，然须防危。", luck:60},
  {n:"天风姤", t:"女壮，勿用取女。", d:"不期而遇，阴长侵阳。遇合需慎，防微杜渐。", luck:44},
  {n:"泽地萃", t:"亨。王假有庙，利见大人。", d:"荟萃聚集，人物相济。聚合以诚，事业可成。", luck:80},
  {n:"地风升", t:"元亨，用见大人，勿恤，南征吉。", d:"积小成大，步步升进。顺势而上，前景开朗。", luck:84},
  {n:"泽水困", t:"亨，贞，大人吉，无咎。", d:"困穷之时，守正处困。穷则思变，困而能通。", luck:38},
  {n:"水风井", t:"改邑不改井，无丧无得。", d:"井养不穷，德泽常新。修身养德，惠泽于人。", luck:72},
  {n:"泽火革", t:"巳日乃孚，元亨利贞，悔亡。", d:"顺天应人，革故鼎新。时机至则变革，旧去新来。", luck:70},
  {n:"火风鼎", t:"元吉，亨。", d:"鼎新之象，烹饪养贤。稳重调和，事业鼎兴。", luck:85},
  {n:"震为雷", t:"亨。震来虩虩，笑言哑哑。", d:"震动惊惧，恐惧修省。临危不乱，则致福。", luck:63},
  {n:"艮为山", t:"艮其背，不获其身，行其庭，不见其人。", d:"止而能安，动静有时。当止则止，心安无咎。", luck:67},
  {n:"风山渐", t:"女归吉，利贞。", d:"循序渐进，如鸿渐陆。稳步前行，渐入佳境。", luck:81},
  {n:"雷泽归妹", t:"征凶，无攸利。", d:"归妹失正，因情生乱。行事勿悖常理。", luck:42},
  {n:"雷火丰", t:"亨，王假之，勿忧，宜日中。", d:"丰大盛满，日中则昃。盛时当守，满招损。", luck:73},
  {n:"火山旅", t:"小亨，旅贞吉。", d:"行旅在外，柔顺得安。客居宜慎，随遇而安。", luck:58},
  {n:"巽为风", t:"小亨，利有攸往，利见大人。", d:"巽顺以入，随风而行。谦顺进取，渐进得通。", luck:70},
  {n:"兑为泽", t:"亨，利贞。", d:"悦泽相济，和悦待人。以诚悦人，欢欣和合。", luck:83},
  {n:"风水涣", t:"亨。王假有庙，利涉大川。", d:"涣散之象，涣释聚合。散而能聚，涣难为通。", luck:60},
  {n:"水泽节", t:"亨。苦节不可贞。", d:"节制有度，适可而止。守节持中，过则苦。", luck:71},
  {n:"风泽中孚", t:"豚鱼吉，利涉大川，利贞。", d:"中心诚信，感格豚鱼。以信立身，无往不利。", luck:86},
  {n:"雷山小过", t:"亨，利贞，可小事，不可大事。", d:"小有过越，宜下不宜上。谨小慎微，过而能改。", luck:56},
  {n:"水火既济", t:"亨，小利贞，初吉终乱。", d:"事已成矣，慎防反复。成功之际，尤须戒骄。", luck:78},
  {n:"火水未济", t:"亨，小狐汔济，濡其尾，无攸利。", d:"事未竟也，谨慎将事。穷则变，变则通。", luck:68}
]

/* ===== 由卦名解析六爻（下→上，1阳0阴） ===== */
const G3 = {乾:"111", 坤:"000", 坎:"010", 离:"101", 震:"100", 艮:"001", 巽:"011", 兑:"110"}
const ZI = {天:"乾", 地:"坤", 水:"坎", 火:"离", 雷:"震", 山:"艮", 风:"巽", 泽:"兑"}
function linesOf(name){
  let up, low
  if(name.indexOf("为") >= 0){
    const a = name[0]
    const b = name[name.length - 1]
    up = G3[a]; low = G3[ZI[b]]
  }else{
    up = G3[ZI[name[0]]]; low = G3[ZI[name[1]]]
  }
  return (low + up).split("").map(Number)
}
function hexSVG(lines){
  const w=70, gap=12, y0=8, x1=8, x2=62, xm1=26, xm2=44
  let s = `<svg width="${w}" height="${y0*2 + gap*5 + 8}" viewBox="0 0 ${w} ${y0*2 + gap*5 + 8}">`
  for(let i=0;i<6;i++){
    const y = y0 + (5-i)*gap
    const v = lines[i]
    if(v === 1){
      s += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="var(--yg-gold)" stroke-width="4" stroke-linecap="round"/>`
    }else{
      s += `<line x1="${x1}" y1="${y}" x2="${xm1}" y2="${y}" stroke="var(--yg-gold)" stroke-width="4" stroke-linecap="round"/>`
      s += `<line x1="${xm2}" y1="${y}" x2="${x2}" y2="${y}" stroke="var(--yg-gold)" stroke-width="4" stroke-linecap="round"/>`
    }
  }
  s += `</svg>`
  return s
}
function luckLevel(v){
  if(v >= 80) return { t:"大吉", c:"#2ec27e" }
  if(v >= 65) return { t:"吉",   c:"#7fc97f" }
  if(v >= 50) return { t:"中平", c:"#d4af37" }
  if(v >= 35) return { t:"小凶", c:"#e08a52" }
  return { t:"凶", c:"#ff6b6b" }
}
function escapeHtml(s){
  return (s||"").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
}

/* ===== 结合心愿的模板解卦（AI 不可用时的回退） ===== */
function combineReading(q, g){
  const topic = (q && q.trim()) ? `就你问的「${q.trim()}」` : "就你心中所念"
  let attitude
  if(g.luck >= 80) attitude = "时机通畅，所谋多能顺遂，宜把握当下、主动而为"
  else if(g.luck >= 65) attitude = "趋势向好，循序渐进可得，宜稳扎稳打"
  else if(g.luck >= 50) attitude = "平中藏变，守正待时为宜，不宜躁进"
  else if(g.luck >= 35) attitude = "时运有阻，宜谨慎守成、谋定而后动"
  else attitude = "困滞之象，宜退守静观、避其锋芒"
  return `${topic}：${g.n}之象，${attitude}。${g.d} 凡事以此卦为鉴，结合自身处境权衡而行。`
}

/* ===== 历史（localStorage，沿用站点 opwb: 前缀） ===== */
const HKEY = "opwb:yigua:v1"
function loadHist(){
  try { return JSON.parse(localStorage.getItem(HKEY) || "[]") } catch { return [] }
}
function saveHist(h){ localStorage.setItem(HKEY, JSON.stringify(h)) }

/* ===== AI 解读：接入站点 AI 网关 ===== */
function aiEnabled(){
  const s = getSettings()
  const prov = getProvider(s.defaultProvider)
  if(!prov) return false
  if(prov.isCustom) return !!prov.apiKey
  return !!s.apiKeys[prov.id]
}
async function aiReading(q, g, idx){
  const topic = (q && q.trim()) ? `我心中所问：「${q.trim()}」` : "（未指定具体问题，请就总体而言）"
  const lv = luckLevel(g.luck)
  const messages = [
    { role:"system", content:"你是《周易》解卦顾问，精通卦象与人生启示。请结合用户的具体问题，用现代白话给出有针对性、温和、可操作的解读。强调内省与理性决策，不做宿命论断。语言简洁凝练，约 120-180 字。" },
    { role:"user", content:`${topic}\n占到【${g.n}】（第${idx+1}卦）。\n卦辞：「${g.t}」\n白话大意：${g.d}\n吉凶倾向：${lv.t}。\n请结合我的问题，写出一段有针对性的解卦解读。` }
  ]
  return await callChat({ messages, temperature: 0.85 })
}

/* ===== 样式（注入一次） ===== */
function ensureStyle(){
  if(document.getElementById("yg-style")) return
  const css = `
  .yg-wrap{max-width:760px;margin:0 auto;padding:8px 0 40px;}
  .yg-head{text-align:center;margin:6px 0 18px;}
  .yg-head h1{font-family:"Songti SC","STSong",serif;font-size:26px;letter-spacing:6px;margin:0;
    background:linear-gradient(90deg,var(--yg-gold-soft),var(--yg-gold));-webkit-background-clip:text;background-clip:text;color:transparent;}
  .yg-head p{color:var(--text-3);font-size:13px;margin:6px 0 0;letter-spacing:1px;}
  .yg-row{display:flex;align-items:center;gap:26px;flex-wrap:nowrap;justify-content:flex-start;margin:8px 0 6px;width:100%;}
  .yg-orb{
    width:150px;height:150px;border-radius:50%;flex:0 0 150px;
    display:flex;align-items:center;justify-content:center;text-align:center;cursor:pointer;user-select:none;
    background:radial-gradient(circle at 35% 30%,#2c2c5e,#13132e 70%);
    border:1px solid rgba(212,175,55,.4);color:var(--yg-gold-soft);font-size:15px;letter-spacing:2px;line-height:1.6;
    box-shadow:0 0 0 1px rgba(212,175,55,.15),0 0 34px rgba(212,175,55,.28),inset 0 0 50px rgba(212,175,55,.12);
    animation:yg-breathe 4.2s ease-in-out infinite;transition:transform .2s;padding:10px;
  }
  .yg-orb:active{transform:scale(.97);}
  .yg-orb.meditate{animation:yg-breathe-slow 5s ease-in-out infinite;color:var(--text);}
  .yg-orb .yg-count{font-size:48px;font-weight:700;color:var(--yg-gold);letter-spacing:0;}
  @keyframes yg-breathe{0%,100%{transform:scale(1);box-shadow:0 0 0 1px rgba(212,175,55,.15),0 0 26px rgba(212,175,55,.18),inset 0 0 44px rgba(212,175,55,.10);}
    50%{transform:scale(1.07);box-shadow:0 0 0 1px rgba(212,175,55,.32),0 0 60px rgba(212,175,55,.42),inset 0 0 64px rgba(212,175,55,.22);}}
  @keyframes yg-breathe-slow{0%,100%{transform:scale(1);box-shadow:0 0 0 1px rgba(212,175,55,.2),0 0 34px rgba(212,175,55,.25),inset 0 0 54px rgba(212,175,55,.14);}
    50%{transform:scale(1.04);box-shadow:0 0 0 1px rgba(212,175,55,.36),0 0 80px rgba(212,175,55,.5),inset 0 0 74px rgba(212,175,55,.26);}}
  .yg-wish{flex:1 1 auto;min-width:240px;display:flex;flex-direction:column;}
  .yg-wish label{display:block;font-size:13px;color:var(--text-2);margin-bottom:8px;letter-spacing:1px;}
  .yg-wish-input{width:100%;padding:12px 14px;border-radius:12px;background:var(--panel-2);
    border:1px solid var(--border);color:var(--text);font-size:15px;font-family:inherit;outline:none;resize:none;}
  .yg-wish-input::placeholder{color:var(--text-3);}
  .yg-wish-input:focus{border-color:var(--yg-gold);box-shadow:0 0 0 3px rgba(212,175,55,.12);}
  .yg-wish-hint{color:var(--text-3);font-size:12px;margin-top:8px;line-height:1.6;}
  .yg-hint{color:var(--text-3);font-size:13px;text-align:center;margin:14px 0 4px;min-height:18px;}
  .yg-card{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);
    box-shadow:var(--shadow);padding:22px 20px;margin-top:18px;}
  .yg-result[hidden]{display:none;}
  .yg-hex{display:flex;flex-direction:column;align-items:center;gap:7px;margin-bottom:12px;}
  .yg-name{text-align:center;font-size:22px;letter-spacing:3px;margin:4px 0 2px;color:var(--yg-gold-soft);font-family:"Songti SC","STSong",serif;}
  .yg-sub{text-align:center;color:var(--text-3);font-size:12px;letter-spacing:1px;margin-bottom:12px;}
  .yg-wq{text-align:center;font-size:13px;color:var(--yg-gold-soft);margin:0 0 12px;padding:7px 12px;
    border:1px dashed rgba(212,175,55,.4);border-radius:8px;background:rgba(212,175,55,.07);}
  .yg-wq.empty{display:none;}
  .yg-tuan{border-left:3px solid var(--yg-gold);padding:8px 14px;margin:0 0 12px;background:rgba(212,175,55,.08);
    border-radius:0 8px 8px 0;font-size:15px;line-height:1.8;}
  .yg-tuan b{color:var(--yg-gold-soft);}
  .yg-desc{font-size:14px;line-height:1.8;color:var(--text-2);margin:0 0 12px;}
  .yg-combine{font-size:14px;line-height:1.8;color:var(--text);margin:0 0 16px;border-left:3px solid var(--ok);
    padding:8px 14px;background:rgba(46,194,126,.08);border-radius:0 8px 8px 0;}
  .yg-ai{font-size:14px;line-height:1.85;color:var(--text);margin:0 0 16px;border-left:3px solid var(--yg-gold-soft);
    padding:10px 14px;background:rgba(212,175,55,.07);border-radius:0 8px 8px 0;}
  .yg-ai .yg-ai-tag{display:inline-block;font-size:11px;color:var(--yg-gold-soft);border:1px solid var(--yg-gold);
    border-radius:10px;padding:1px 8px;margin-bottom:8px;letter-spacing:1px;}
  .yg-ai.loading{opacity:.7;}
  .yg-fallback{font-size:12px;color:var(--text-3);margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
  .yg-fallback button{background:transparent;border:1px solid var(--yg-gold);color:var(--yg-gold-soft);
    font-size:12px;padding:4px 12px;border-radius:8px;cursor:pointer;}
  .yg-luck-row{display:flex;align-items:center;gap:12px;}
  .yg-luck-tag{font-size:15px;font-weight:700;padding:3px 14px;border-radius:20px;letter-spacing:2px;border:1px solid;}
  .yg-luck-track{flex:1;height:8px;border-radius:6px;background:var(--panel-2);overflow:hidden;}
  .yg-luck-fill{height:100%;border-radius:6px;transition:width .8s ease;}
  .yg-chart-head{display:flex;justify-content:space-between;align-items:baseline;}
  .yg-chart-head h3{margin:0;font-size:16px;letter-spacing:2px;color:var(--yg-gold-soft);font-weight:600;}
  .yg-chart-head .sub{color:var(--text-3);font-size:12px;}
  #ygChart{width:100%;height:210px;display:block;overflow:hidden;border-radius:8px;background:var(--panel-2);}
  .yg-chart-empty{color:var(--text-3);font-size:13px;text-align:center;padding:26px 0;}
  .yg-detail{margin-top:12px;padding:14px 16px;border-radius:12px;background:var(--panel-2);border:1px solid var(--border);}
  .yg-detail[hidden]{display:none;}
  .yg-detail .gd-head{display:flex;justify-content:space-between;align-items:center;}
  .yg-detail .gd-name{font-size:16px;color:var(--yg-gold-soft);letter-spacing:2px;font-family:"Songti SC","STSong",serif;}
  .yg-detail .gd-close{cursor:pointer;color:var(--text-3);border:none;background:transparent;font-size:20px;line-height:1;padding:0 4px;}
  .yg-detail .gd-time{color:var(--text-3);font-size:12px;margin:2px 0 8px;}
  .yg-detail .gd-q{font-size:13px;color:var(--yg-gold-soft);margin:0 0 8px;}
  .yg-detail .gd-tuan{font-size:13px;color:var(--text);margin:0 0 6px;}
  .yg-detail .gd-desc{font-size:13px;color:var(--text-2);line-height:1.7;margin:0 0 6px;}
  .yg-detail .gd-ai{font-size:13px;color:var(--text);line-height:1.75;margin-top:6px;border-left:3px solid var(--yg-gold-soft);padding-left:10px;}
  .yg-clear{margin-top:8px;background:transparent;border:1px solid rgba(255,107,107,.5);color:#ff8a80;
    font-size:12px;padding:6px 14px;border-radius:8px;cursor:pointer;letter-spacing:1px;}
  .yg-clear:hover{background:rgba(255,107,107,.12);}
  .yg-foot{color:var(--text-3);font-size:11px;margin-top:26px;text-align:center;letter-spacing:1px;line-height:1.7;}
  @media (max-width:600px){
    .yg-row{gap:16px;flex-wrap:wrap;justify-content:center;}
    .yg-orb{width:130px;height:130px;flex:0 0 130px;}
    .yg-wish{width:100%;max-width:380px;}
  }`
  const style = document.createElement("style")
  style.id = "yg-style"
  style.textContent = css
  document.head.appendChild(style)
  // 注入品牌色变量（gold），挂在 :root，供 SVG stroke 等引用
  const root = document.documentElement
  if(!root.style.getPropertyValue("--yg-gold")){
    root.style.setProperty("--yg-gold", "#d4af37")
    root.style.setProperty("--yg-gold-soft", "#e8c860")
  }
}

export const yiguaPlugin = {
  id: 'yigua',
  name: '每天要一卦',
  icon: '☯',
  group: '休闲娱乐',
  mount(root){
    ensureStyle()

    let meditating = false, timer = null

    const orb = el('div', { class:'yg-orb', html:'☯<br>点击要一卦' })
    const orbText = orb // 直接改文本
    const orbHint = el('p', { class:'yg-hint' }, ['写下心愿，点击左侧圆，静默 5 秒'])
    const wishInput = el('textarea', { class:'yg-wish-input', rows:'2', maxlength:'40',
      placeholder:'写下你心中所问之事（可选，最多 40 字）' })

    const hexBox = el('div', { class:'yg-hex' })
    const nameEl = el('div', { class:'yg-name' })
    const subEl = el('div', { class:'yg-sub' })
    const wqEl = el('div', { class:'yg-wq empty' })
    const tuanEl = el('div', { class:'yg-tuan' })
    const descEl = el('p', { class:'yg-desc' })
    const aiBox = el('div', { class:'yg-ai' })
    const luckTag = el('span', { class:'yg-luck-tag' })
    const luckFill = el('div', { class:'yg-luck-fill' })
    const result = el('section', { class:'yg-card yg-result', hidden:true }, [
      hexBox, nameEl, subEl, wqEl, tuanEl, descEl, aiBox,
      el('div', { class:'yg-luck-row' }, [luckTag, el('div', { class:'yg-luck-track' }, [luckFill])])
    ])

    const chart = el('div', { id:'ygChart' })
    const chartEmpty = el('div', { class:'yg-chart-empty' }, ['尚无记录，点击上方圆占第一卦'])
    const detail = el('div', { class:'yg-detail', hidden:true })
    const clearBtn = el('button', { class:'yg-clear' }, ['清空记录'])

    const chartCard = el('section', { class:'yg-card' }, [
      el('div', { class:'yg-chart-head' }, [
        el('div', {}, [el('h3', {}, ['卦象走势']), el('p', { class:'sub' }, ['每次占得的吉凶评分连线 · 点击任意一点看当次详情'])]),
      ]),
      chart, chartEmpty, detail,
      el('div', { style:'text-align:right' }, [clearBtn])
    ])

    const page = el('div', { class:'yg-wrap' }, [
      el('div', { class:'yg-head' }, [
        el('h1', {}, ['每 日 一 卦']),
        el('p', {}, ['心静则灵 · 每日一占'])
      ]),
      el('div', { class:'yg-row' }, [
        orb,
        el('div', { class:'yg-wish' }, [
          el('label', {}, ['🙏 写下你心中所问之事']),
          wishInput,
          el('div', { class:'yg-wish-hint' }, ['静默 5 秒，心念其事；卦成后 AI 会结合你的问题解卦。'])
        ])
      ]),
      orbHint,
      result,
      chartCard,
      el('div', { class:'yg-foot' }, ['卦辞据《周易》文王卦序整理；解读结合 AI 与白话参考，仅供娱乐与内省，重大决策请理性判断。'])
    ])
    root.append(page)

    /* —— 走势图渲染 —— */
    function drawChart(){
      const h = loadHist()
      if(h.length === 0){ chart.innerHTML = ""; chartEmpty.style.display = "block"; return }
      chartEmpty.style.display = "none"
      const W=420, H=210, padL=34, padR=12, padT=16, padB=26
      const xs = W-padL-padR, ys = H-padT-padB
      const n = h.length
      const px = (i)=> n===1 ? padL+xs/2 : padL + xs*i/(n-1)
      const py = (v)=> padT + ys*(1 - v/100)
      let grid = ""
      ;[0,25,50,75,100].forEach(g=>{
        const y = py(g)
        grid += `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" style="stroke:var(--border)" stroke-width="1"/>`
        grid += `<text x="${padL-6}" y="${y+4}" style="fill:var(--text-3)" font-size="9" text-anchor="end">${g}</text>`
      })
      let area = `M ${px(0)} ${py(h[0].luck)} `
      h.forEach((d,i)=> area += `L ${px(i)} ${py(d.luck)} `)
      area += `L ${px(n-1)} ${padT+ys} L ${px(0)} ${padT+ys} Z`
      let line = "", dots = ""
      h.forEach((d,i)=>{
        const x = px(i), y = py(d.luck)
        line += (i===0 ? `M ${x} ${y} ` : `L ${x} ${y} `)
        const lv = luckLevel(d.luck)
        dots += `<circle data-idx="${i}" cx="${x}" cy="${y}" r="5" fill="${lv.c}" style="stroke:var(--panel);cursor:pointer" stroke-width="1.5"/>`
        if(n <= 12) dots += `<text x="${x}" y="${y-9}" style="fill:var(--yg-gold-soft)" font-size="9" text-anchor="middle">${d.luck}</text>`
      })
      let xlab = ""
      const labels = n <= 8 ? h.map((_,i)=>i) : [0, Math.floor(n/2), n-1]
      labels.forEach(i=>{ xlab += `<text x="${px(i)}" y="${H-8}" style="fill:var(--text-3)" font-size="9" text-anchor="middle">#${i+1}</text>` })
      chart.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:100%;display:block">`
        + grid
        + `<path d="${area}" fill="rgba(212,175,55,.14)"/>`
        + `<path d="${line}" fill="none" style="stroke:var(--yg-gold)" stroke-width="2" stroke-linejoin="round"/>`
        + dots + xlab
        + `</svg>`
    }

    function showDetail(idx){
      const h = loadHist()
      const d = h[idx]
      if(!d) return
      const g = GUA[d.i]
      const lv = luckLevel(d.luck)
      const dt = new Date(d.t)
      const time = `${dt.getMonth()+1}月${dt.getDate()}日 ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`
      const closeBtn = el('button', { class:'gd-close', onclick:()=>{ detail.hidden = true } }, ['×'])
      detail.innerHTML = ""
      detail.append(
        el('div', { class:'gd-head' }, [
          el('span', { class:'gd-name', html:`${g.n} · <span style="color:${lv.c}">${lv.t}</span>` }),
          closeBtn
        ]),
        el('div', { class:'gd-time' }, [`${time}　评分 ${d.luck}`]),
        d.q ? el('div', { class:'gd-q', html:`❖ 你问：${escapeHtml(d.q)}` }) : el('div', {}),
        el('div', { class:'gd-tuan', html:`<b>卦辞</b>　${escapeHtml(g.t)}` }),
        el('div', { class:'gd-desc' }, [g.d]),
        el('div', { class:'gd-ai', html:`<b style="color:var(--yg-gold-soft)">AI 解卦</b>　${escapeHtml(d.ai || combineReading(d.q||"", g))}` })
      )
      detail.hidden = false
    }

    chart.addEventListener("click", (e)=>{
      const c = e.target.closest("circle[data-idx]")
      if(c) showDetail(parseInt(c.getAttribute("data-idx"), 10))
    })
    clearBtn.addEventListener("click", ()=>{
      if(confirm("确定清空所有占卦记录？")){
        localStorage.removeItem(HKEY)
        detail.hidden = true
        drawChart()
      }
    })

    /* —— 静默 5 秒 —— */
    function startMeditate(){
      if(meditating) return
      meditating = true
      orb.classList.add("meditate")
      orbHint.textContent = "静默… 心中默念你的问题"
      let n = 5
      orb.textContent = ""
      orb.append(el('span', { class:'yg-count' }, [String(n)]))
      timer = setInterval(()=>{
        n--
        if(n > 0){
          orb.textContent = ""
          orb.append(el('span', { class:'yg-count' }, [String(n)]))
        }else{
          clearInterval(timer)
          meditating = false
          orb.classList.remove("meditate")
          drawGua()
        }
      }, 1000)
    }

    function drawGua(){
      const idx = Math.floor(Math.random()*64)
      const g = GUA[idx]
      const lines = linesOf(g.n)
      const q = wishInput.value.trim()
      hexBox.innerHTML = hexSVG(lines)
      nameEl.textContent = g.n
      subEl.textContent = "第 " + (idx+1) + " 卦 · 《周易》"
      if(q){ wqEl.textContent = "❖ 你问：" + q; wqEl.classList.remove("empty") }
      else { wqEl.textContent = ""; wqEl.classList.add("empty") }
      tuanEl.innerHTML = "<b>卦辞</b>　" + escapeHtml(g.t)
      descEl.textContent = g.d
      const lv = luckLevel(g.luck)
      luckTag.textContent = lv.t
      luckTag.style.color = lv.c
      luckTag.style.borderColor = lv.c
      luckFill.style.width = g.luck + "%"
      luckFill.style.background = `linear-gradient(90deg,${lv.c},${lv.c})`

      // AI 解读区：先给模板占位，AI 可用则异步替换
      const useAI = aiEnabled()
      if(useAI){
        aiBox.className = "yg-ai loading"
        aiBox.innerHTML = `<span class="yg-ai-tag">AI 解卦</span><br>✨ 正在结合你的问题解卦…`
        aiReading(q, g, idx).then((text)=>{
          aiBox.className = "yg-ai"
          aiBox.innerHTML = `<span class="yg-ai-tag">AI 解卦（结合你的问题）</span><br>${escapeHtml(text)}`
          pushHistory(idx, g, q, text)
        }).catch(()=>{
          aiBox.className = "yg-ai"
          aiBox.innerHTML = `<span class="yg-ai-tag">模板解读</span><br>${escapeHtml(combineReading(q, g))}`
            + `<div class="yg-fallback">⚠️ AI 调用失败（网络/CORS 或额度），已用模板解读。<a href="#/settings" style="color:var(--yg-gold-soft)">去设置检查 AI 配置</a></div>`
          pushHistory(idx, g, q, "")
        })
      }else{
        aiBox.className = "yg-ai"
        aiBox.innerHTML = `<span class="yg-ai-tag">模板解读</span><br>${escapeHtml(combineReading(q, g))}`
          + `<div class="yg-fallback">未配置 AI 密钥，显示通用模板解读。<a href="#/settings" style="color:var(--yg-gold-soft)">去设置配置 AI</a> 后可获个性化解卦。</div>`
        pushHistory(idx, g, q, "")
      }

      result.hidden = false
      result.scrollIntoView({ behavior:"smooth", block:"center" })
      orb.innerHTML = "☯<br>再要一卦"
      orbHint.textContent = "可再次点击，重新占问"
    }

    function pushHistory(idx, g, q, aiText){
      const h = loadHist()
      h.push({ i:idx, n:g.n, luck:g.luck, t:Date.now(), q, ai: aiText || "" })
      saveHist(h)
      drawChart()
    }

    orb.addEventListener("click", startMeditate)
    drawChart()
  }
}
