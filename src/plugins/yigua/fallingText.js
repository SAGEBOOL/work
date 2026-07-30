// FallingText 的 vanilla JS 移植（源自 React Bits 的 FallingText 组件，去掉 React/Canvas，
// 用 DOM 词元 + matter-js 物理体驱动）。词元为绝对定位的 DOM 元素，每帧根据物理体位置同步 left/top/rotate。
// 用法：mountFallingText(container, { words, gravity, fontSize, wordSpacing, highlightWords, highlightClass })
//   返回 { start(), restore(), destroy() } —— start() 可重复调用（每次重新从居中布局散开）。
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
  target.innerHTML = words.map((w) => {
    const hl = highlightWords.some((h) => w.startsWith(h)) ? ` ${highlightClass}` : ''
    return `<span class="word${hl}">${w}</span>`
  }).join(`<span class="ft-space" style="display:inline-block;width:${wordSpacing}"></span>`)
  container.appendChild(target)

  let currentWords = [...words]
  let spans = Array.from(target.querySelectorAll('.word'))
  colorize(spans)
  let engine = null, runner = null, rafId = null, mouse = null, currentPairs = []

  function teardown() {
    if (rafId) cancelAnimationFrame(rafId)
    if (runner) Runner.stop(runner)
    if (engine) { Composite.clear(engine.world, false); Engine.clear(engine) }
    if (mouse) Mouse.clearSourceEvents(mouse)
    rafId = runner = engine = mouse = null
    currentPairs = []
  }

  function restore() {
    teardown()
    spans.forEach((e) => {
      e.style.position = ''
      e.style.left = ''
      e.style.top = ''
      e.style.transform = ''
    })
  }

  function start() {
    restore() // 回到居中布局，重新测量
    const rect = container.getBoundingClientRect()
    const W = rect.width, H = rect.height
    if (W <= 0 || H <= 0) return

    const { Engine, Runner, Bodies, Composite, Mouse, MouseConstraint, Body } = Matter
    engine = Engine.create()
    engine.world.gravity.y = gravity

    const wall = { isStatic: true, render: { visible: false } }
    Composite.add(engine.world, [
      Bodies.rectangle(W / 2, H + 25, W, 50, wall),      // 地板
      Bodies.rectangle(-25, H / 2, 50, H, wall),          // 左墙
      Bodies.rectangle(W + 25, H / 2, 50, H, wall),       // 右墙
      Bodies.rectangle(W / 2, -25, W, 50, wall)           // 顶
    ])

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

    mouse = Mouse.create(container)
    const mc = MouseConstraint.create(engine, {
      mouse, constraint: { stiffness: 0.9, render: { visible: false } }
    })
    Composite.add(engine.world, mc)

    runner = Runner.create()
    Runner.run(runner, engine)

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

  function reset(newWords) {
    teardown()
    if (Array.isArray(newWords) && newWords.length) currentWords = newWords
    target.innerHTML = currentWords.map((w) => {
      const hl = highlightWords.some((h) => w.startsWith(h)) ? ` ${highlightClass}` : ''
      return `<span class="word${hl}">${w}</span>`
    }).join(`<span class="ft-space" style="display:inline-block;width:${wordSpacing}"></span>`)
    spans = Array.from(target.querySelectorAll('.word'))
    colorize(spans)
    restore()
  }

  return { start, restore, reset, destroy: teardown }
}
