// 视频娱乐：外部视频站点入口。点击按钮在新标签打开 tv.mydsart.work。
import { el } from '../../core/ui.js'

// 注意：原需求中地址为 tv.mydsart.wokr，按域名惯例修正为 .work
const TV_URL = 'https://tv.mydsart.work/'

export const videoEntertainmentPlugin = {
  id: 'video-entertainment',
  name: '视频娱乐',
  icon: '📺',
  group: '休闲娱乐',
  mount(root) {
    const go = () => window.open(TV_URL, '_blank', 'noopener')
    const page = el('div', { class: 'page' }, [
      el('h1', {}, ['视频娱乐']),
      el('p', { class: 'sub' }, ['外部视频站点，点击下方按钮在新标签页打开（不离开本工作台）。']),
      el('div', { class: 'card', style: 'text-align:center;padding:36px 20px' }, [
        el('div', { style: 'font-size:52px;margin-bottom:10px' }, ['📺']),
        el('div', { style: 'font-size:18px;font-weight:700;margin-bottom:4px' }, ['DSArt 视频娱乐站']),
        el('div', { class: 'muted' }, [TV_URL]),
        el('button', { class: 'btn primary', style: 'margin-top:18px;font-size:16px;padding:12px 30px' }, ['前往视频娱乐站 →'])
      ]),
      el('p', { class: 'hint' }, ['该站点为外部服务，账号、内容与可用性由其运营方负责；工作台仅提供跳转入口。'])
    ])
    page.querySelector('button').onclick = go
    root.append(page)
  }
}
