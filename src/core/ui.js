// 极简 DOM 助手，避免引入框架。
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue
    if (k === 'class') node.className = v
    else if (k === 'html') node.innerHTML = v
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v)
    else node.setAttribute(k, v)
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue
    node.append(c.nodeType ? c : document.createTextNode(String(c)))
  }
  return node
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild)
}

// 应用主题到 <html data-theme>
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light')
}

// 轻量 Toast 提示
let toastTimer = null
export function toast(msg, type = 'ok') {
  let t = document.getElementById('wb-toast')
  if (!t) {
    t = document.createElement('div')
    t.id = 'wb-toast'
    document.body.appendChild(t)
  }
  t.className = 'toast ' + (type || 'ok')
  t.textContent = msg
  // 强制重排以触发过渡
  void t.offsetWidth
  t.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800)
}
