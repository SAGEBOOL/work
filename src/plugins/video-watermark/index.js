// 视频去水印：上传视频 → ffmpeg.wasm 解码为帧 → 涂抹水印区域 → 逐帧 OpenCV inpaint → 重编码下载。
// 浏览器端逐帧修复极慢，仅适合短视频（建议 <15s），且水印须为固定位置。引擎均从本站本地加载。
import { el, clear } from '../../core/ui.js'

function loadOpenCV() {
  return new Promise((resolve, reject) => {
    if (window.cv && window.cv.getVersion) return resolve(window.cv)
    const s = document.createElement('script')
    s.src = './opencv.js'
    s.onload = () => {
      let tries = 0
      const wait = () => {
        if (window.cv && window.cv.getVersion) return resolve(window.cv)
        if (++tries > 200) return reject(new Error('OpenCV 初始化超时，请刷新页面重试'))
        setTimeout(wait, 100)
      }
      wait()
    }
    s.onerror = () => reject(new Error('OpenCV 加载失败，请刷新页面重试'))
    document.head.append(s)
  })
}

export const videoWatermarkPlugin = {
  id: 'video-watermark',
  name: '视频去水印',
  icon: '🎬',
  group: '基础办公',
  mount(root) {
    let ffmpeg = null
    let fetchFileFn = null
    let frames = []          // 帧文件名
    let frameW = 0, frameH = 0
    let busy = false

    const fileInput = el('input', { type: 'file', accept: 'video/*', style: 'display:none' })
    const drop = el('div', { class: 'dropzone' }, ['拖入视频，或点击选择（建议短视频 <15s，水印位置固定）'])
    const stage = el('div', { class: 'stage' })
    const view = el('canvas', { class: 'view' })
    const mask = el('canvas', { class: 'mask' })
    stage.append(view, mask)
    const vctx = view.getContext('2d')
    const mctx = mask.getContext('2d')
    const brush = el('input', { type: 'range', min: '8', max: '80', value: '28', style: 'width:160px' })
    const brushVal = el('span', { class: 'muted' }, ['28px'])
    const extractBtn = el('button', { class: 'btn' }, ['提取帧'])
    const runBtn = el('button', { class: 'btn ghost' }, ['开始去水印'])
    const dlBtn = el('button', { class: 'btn ghost' }, ['下载结果'])
    const alert = el('div', {})
    const prog = el('div', { class: 'muted' }, [''])
    const hint = el('p', { class: 'hint' }, ['① 选择视频 → ② 提取帧（约 31MB 引擎，首次慢）→ ③ 在画面上涂抹水印 → ④ 开始去水印（逐帧修复，较慢）→ ⑤ 下载。'])

    // ffmpeg 惰性加载（动态 import，避免污染主包）
    const ensureFFmpeg = async () => {
      if (ffmpeg) return ffmpeg
      alert.className = ''; alert.textContent = '加载视频处理引擎（ffmpeg.wasm，约 31MB，首次较慢）…'
      const { FFmpeg } = await import('@ffmpeg/ffmpeg')
      const { toBlobURL, fetchFile } = await import('@ffmpeg/util')
      fetchFileFn = fetchFile
      ffmpeg = new FFmpeg()
      await ffmpeg.load({
        coreURL: await toBlobURL('./ffmpeg/ffmpeg-core.js', 'text/javascript'),
        wasmURL: await toBlobURL('./ffmpeg/ffmpeg-core.wasm', 'application/wasm')
      })
      alert.textContent = ''
      return ffmpeg
    }

    const setBusy = (b) => { busy = b; extractBtn.disabled = b; runBtn.disabled = b; fileInput.disabled = b }

    // 画笔
    let drawing = false
    const pos = (e) => {
      const r = mask.getBoundingClientRect()
      return { x: (e.clientX - r.left) * (mask.width / r.width), y: (e.clientY - r.top) * (mask.height / r.height) }
    }
    const start = (e) => { drawing = true; mask.setPointerCapture(e.pointerId); const p = pos(e); mctx.beginPath(); mctx.moveTo(p.x, p.y); mctx.strokeStyle = 'rgba(255,60,60,.55)'; mctx.lineWidth = +brush.value; mctx.lineCap = 'round'; mctx.lineJoin = 'round' }
    const move = (e) => { if (!drawing) return; const p = pos(e); mctx.lineTo(p.x, p.y); mctx.stroke() }
    const end = () => { drawing = false }
    mask.addEventListener('pointerdown', start)
    mask.addEventListener('pointermove', move)
    mask.addEventListener('pointerup', end)
    mask.addEventListener('pointerleave', end)
    brush.oninput = () => { brushVal.textContent = brush.value + 'px' }

    drop.onclick = () => fileInput.click()
    fileInput.onchange = () => { if (fileInput.files[0]) extract(fileInput.files[0]); fileInput.value = '' }
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over') }
    drop.ondragleave = () => drop.classList.remove('over')
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) extract(e.dataTransfer.files[0]) }

    const extract = async (file) => {
      if (busy) return
      setBusy(true)
      try {
        await ensureFFmpeg()
        mctx.clearRect(0, 0, mask.width, mask.height)
        alert.className = ''; alert.textContent = '写入视频…'
        await ffmpeg.writeFile('in.mp4', await fetchFileFn(file))
        alert.textContent = '解码为帧（降采样 15fps, 宽640）…'
        await ffmpeg.exec(['-i', 'in.mp4', '-vf', 'fps=15,scale=640:-1', 'frames/f%04d.png'])
        const list = await ffmpeg.listDir('frames')
        frames = list.filter((f) => f.name.endsWith('.png')).map((f) => f.name).sort()
        if (!frames.length) throw new Error('未能解码出帧')
        const data = await ffmpeg.readFile('frames/' + frames[0])
        const blob = new Blob([data], { type: 'image/png' })
        const url = URL.createObjectURL(blob)
        const img = new Image()
        img.onload = () => {
          frameW = img.naturalWidth; frameH = img.naturalHeight
          for (const c of [view, mask]) { c.width = frameW; c.height = frameH; c.style.width = frameW + 'px'; c.style.height = frameH + 'px' }
          vctx.drawImage(img, 0, 0, frameW, frameH)
          mctx.clearRect(0, 0, frameW, frameH)
          URL.revokeObjectURL(url)
          alert.className = 'alert ok'; alert.textContent = `✓ 已提取 ${frames.length} 帧，请在画面上涂抹水印区域`
        }
        img.src = url
      } catch (err) {
        alert.className = 'alert err'; alert.textContent = '✗ ' + err.message
      } finally { setBusy(false) }
    }

    runBtn.onclick = async () => {
      if (!frames.length) { alert.className = 'alert err'; alert.textContent = '请先提取帧'; return }
      const hasMask = (() => { const d = mctx.getImageData(0, 0, mask.width, mask.height).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 10) return true; return false })()
      if (!hasMask) { alert.className = 'alert err'; alert.textContent = '请先用画笔在水印上涂抹'; return }
      if (frames.length > 600) { alert.className = 'alert err'; alert.textContent = `帧数过多（${frames.length}），浏览器易卡死，请用更短的视频`; return }
      setBusy(true)
      try {
        const cv = await loadOpenCV()
        alert.className = ''; alert.textContent = '逐帧修复中…'
        const outCanvas = document.createElement('canvas')
        outCanvas.width = frameW; outCanvas.height = frameH
        const octx = outCanvas.getContext('2d')
        const maskMat = cv.imread(mask)
        cv.cvtColor(maskMat, maskMat, cv.COLOR_RGBA2GRAY)
        cv.threshold(maskMat, maskMat, 10, 255, cv.THRESH_BINARY)
        for (let i = 0; i < frames.length; i++) {
          const data = await ffmpeg.readFile('frames/' + frames[i])
          const blob = new Blob([data], { type: 'image/png' })
          const url = URL.createObjectURL(blob)
          await new Promise((res) => { const img = new Image(); img.onload = () => { octx.drawImage(img, 0, 0, frameW, frameH); res() }; img.src = url })
          URL.revokeObjectURL(url)
          const src = cv.imread(outCanvas)
          const dst = new cv.Mat()
          cv.inpaint(src, maskMat, dst, 3, cv.INPAINT_TELEA)
          cv.imshow(outCanvas, dst)
          src.delete(); dst.delete()
          const pngBlob = await new Promise((res) => outCanvas.toBlob(res, 'image/png'))
          const buf = await pngBlob.arrayBuffer()
          await ffmpeg.writeFile('out/' + frames[i], new Uint8Array(buf))
          prog.textContent = `进度 ${i + 1}/${frames.length}`
        }
        maskMat.delete()
        alert.textContent = '重新编码视频…'
        await ffmpeg.exec(['-i', 'out/f%04d.png', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'out.mp4'])
        const out = await ffmpeg.readFile('out.mp4')
        const outBlob = new Blob([out], { type: 'video/mp4' })
        dlBtn.onclick = () => {
          const u = URL.createObjectURL(outBlob)
          const a = el('a', { href: u, download: 'video-watermark-removed.mp4' }); document.body.append(a); a.click(); a.remove()
          setTimeout(() => URL.revokeObjectURL(u), 1500)
        }
        alert.className = 'alert ok'; alert.textContent = `✓ 处理完成，可下载（${frames.length} 帧）`
      } catch (err) {
        alert.className = 'alert err'; alert.textContent = '✗ ' + err.message
      } finally { setBusy(false) }
    }

    const page = el('div', { class: 'page' }, [
      el('h1', {}, ['视频去水印']),
      el('p', { class: 'sub' }, ['逐帧 OpenCV 内容修复（浏览器端，需 ffmpeg.wasm，建议短视频）']),
      el('div', { class: 'card' }, [drop, hint, stage]),
      el('div', { class: 'card', style: 'margin-top:16px' }, [
        el('div', { class: 'row' }, [
          el('label', { class: 'muted' }, ['笔刷']), brush, brushVal,
          el('span', { style: 'flex:1' }), extractBtn, runBtn, dlBtn
        ]),
        alert, prog
      ])
    ])
    root.append(page)
  }
}
