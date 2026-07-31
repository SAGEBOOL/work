// FallingText 的 vanilla JS 移植（源自 React Bits 的 FallingText 组件，去掉 React/Canvas，
// 用 DOM 词元 + matter-js 物理体驱动）。词元为绝对定位的 DOM 元素，每帧根据物理体位置同步 left/top/rotate。
// 用法：mountFallingText(container, { words, gravity, fontSize, wordSpacing, highlightWords, highlightClass })
//   返回 { start(), restore(), reset() } —— start() 可重复调用（每次重新从居中布局散开）。
//
// 关键修复：引擎 / runner / mouse / MouseConstraint 只在挂载时创建【一次】，散开( start )与归位( restore/reset )
// 只增删物理体并启停 DOM 同步循环。避免每次 start 都 Mouse.create 重复挂载监听器导致事件泄漏与二次 start 异常。
import Matter from 'matter-js'

export function mountFallingText(container, opts = {}) {
  const {
    words = [],
    gravity = 1,
    fontSize = '1.5rem',
    wordSpacing = '6px',
    highlightWords = [],
    highlightClass = 'yg-ft-hl',
    colors = []
  } = opts

  const { Engine, Runner, Bodies, Composite, Mouse, MouseConstraint, Body } = Matter

  function colorize(spans) {
    if (!colors.length) return
    spans.forEach((e) => {
      if (e.classList.contains(highlightClass)) return
      e.style.color = colors[Math.floor(Math.random() * colors.length)]
    })
  }

  const target = document.createElement('div')
  target.className = 'falling-text-target'
  target.style.fontSize = fontSize
  target.style.lineHeight = '1.6'
  container.appendChild(target)

  let currentWords = [...words]

  function renderSpans() {
    target.innerHTML = currentWords.map((w) => {
      const hl = highlightWords.some((h) => w.startsWith(h)) ? ` ${highlightClass}` : ''
      return `<span class="word${hl}">${w}</span>`
    }).join(`<span class="ft-space" style="display:inline-block;width:${wordSpacing}"></span>`)
  }
  renderSpans()
  let spans = Array.from(target.querySelectorAll('.word'))
  colorize(spans)

  /* —— 只创建一次的物理环境 —— */
  const engine = Engine.create()
  engine.world.gravity.y = gravity
  const wallOpt = { isStatic: true, render: { visible: false } }
  const mouse = Mouse.create(container)            // 单一 mouse，复用 -> 无监听器泄漏
  const mc = MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.9, render: { visible: false } } })
  Composite.add(engine.world, mc)
  const runner = Runner.create()
  Runner.run(runner, engine)                        // 常驻运行；空世界时开销极低

  let walls = []
  let currentPairs = []
  let rafId = null

  function addWalls() {
    const r = container.getBoundingClientRect()
    const W = r.width, H = r.height
    if (W <= 0 || H <= 0) return
    walls = [
      Bodies.rectangle(W / 2, H + 25, W, 50, wallOpt),   // 地板
      Bodies.rectangle(-25, H / 2, 50, H, wallOpt),       // 左墙
      Bodies.rectangle(W + 25, H / 2, 50, H, wallOpt),    // 右墙
      Bodies.rectangle(W / 2, -25, W, 50, wallOpt)        // 顶
    ]
    Composite.add(engine.world, walls)
  }
  function clearWalls() {
    walls.forEach((w) => Composite.remove(engine.world, w))
    walls = []
  }
  function clearDynamic() {
    currentPairs.forEach((p) => { if (p.body) Composite.remove(engine.world, p.body) })
    currentPairs = []
  }
  function stopLoop() {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = null
  }

  /* 让卦字回到整齐静态排列（inline 居中），并清掉所有物理体、停掉 DOM 同步 */
  function neat() {
    stopLoop()
    clearDynamic()
    clearWalls()
    spans.forEach((e) => {
      e.style.position = ''
      e.style.left = ''
      e.style.top = ''
      e.style.transform = ''
    })
    Mouse.clearSourceEvents(mouse)
  }

  /* 散开并物理下落（可重复调用） */
  function start() {
    neat()                       // 先归位、清旧体
    addWalls()
    const rect = container.getBoundingClientRect()
    const W = rect.width, H = rect.height
    if (W <= 0 || H <= 0) return
    currentPairs = spans.map((elem) => {
      const r = elem.getBoundingClientRect()
      const x = r.left - rect.left + r.width / 2
      const y = r.top - rect.top + r.height / 2
      const body = Bodies.rectangle(x, y, r.width, r.height, {
        restitution: 0.85, frictionAir: 0.012, friction: 0.2, render: { visible: false }
      })
      Body.setVelocity(body, { x: (Math.random() - 0.5) * 7, y: (Math.random() - 0.5) * 3 })
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.06)
      elem.style.position = 'absolute'
      elem.style.left = x + 'px'
      elem.style.top = y + 'px'
      elem.style.transform = 'translate(-50%,-50%)'
      return { elem, body }
    })
    Composite.add(engine.world, currentPairs.map((p) => p.body))
    const loop = () => {
      currentPairs.forEach(({ elem, body }) => {
        elem.style.left = body.position.x + 'px'
        elem.style.top = body.position.y + 'px'
        elem.style.transform = `translate(-50%,-50%) rotate(${body.angle}rad)`
      })
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)
  }

  /* 换一组卦字并归位（整齐排列，等待再次点击） */
  function reset(newWords) {
    if (Array.isArray(newWords) && newWords.length) currentWords = newWords
    renderSpans()
    spans = Array.from(target.querySelectorAll('.word'))
    colorize(spans)
    neat()
  }

  return { start, restore: neat, reset, destroy: neat }
}
