// 移动端抽屉导航控制：用 body 上的 class 驱动 CSS 开合。
export function openNav() { document.body.classList.add('nav-open') }
export function closeNav() { document.body.classList.remove('nav-open') }
export function toggleNav() { document.body.classList.toggle('nav-open') }
