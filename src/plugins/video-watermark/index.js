// 视频去水印（遮挡版）：上传视频 → 框选水印区域 → 选覆盖方式（高斯模糊/马赛克/纯色块）
// → Canvas + MediaRecorder 实时录制输出。纯前端、零下载、秒开，适合固定位置水印。
import { el, clear, toast } from '../../core/ui.js'

export const videoWatermarkPlugin = {
  id: 'video-watermark',
  name: '视频去水印',
  icon: '🎬',
  group: '基础办公',
  mount(root) {
    let videoEl = null
    let regions = []          // { x, y, w, h }，坐标系 = 视频原始像素
    let drawing = false, startPt = null, curRect = null
    let recording = false
    let outW = 0, outH = 0, scale = 1
    let mediaRecorder = null, chunks = [], resultBlob = null, rafId = 0

    const fileInput = el('input', { type: 'file', accept: 'video/*', style: 'display:none' })
    const drop = el('div', { class: 'dropzone' }, ['拖入视频，或点击选择（建议短视频，水印位置固定）'])
    const stage = el('div', { class: 'stage' })
    const videoTag = el('video', { class: 'view', muted: 'true', playsinline: 'true', controls: 'true', style: 'max-width:100%;display:none' })
    const overlay = el('canvas', { class: 'mask' })
    overlay.style.display = 'none'
    const outCanvas = el('canvas', { style: 'display:none' })
    stage.append(videoTag, overlay, outCanvas)
    const octx = overlay.getContext('2d')
    const octx2 = outCanvas.getContext('2d')

    const methodSel = el('select', {}, [
      el('option', { value: 'blur' }, ['高斯模糊']),
      el('option', { value: 'mosaic' }, ['马赛克']),
      el('option', { value: 'solid' }, ['纯色块'])
    ])
    const strength = el('input', { type: 'range', min: '3', max: '30', value: '12', style: 'width:160px' })
    const strengthVal = el('span', { class: 'muted' }, ['12'])
    const clearBtn = el('button', { class: 'btn ghost' }, ['清除区域'])
    const processBtn = el('button', { class: 'btn' }, ['开始处理'])
    const dlBtn = el('button', { class: 'btn ghost', disabled: 'true' }, ['下载结果'])
    const alert = el('div', {})
    const prog = el('div', { class: 'muted' }, [''])
    const hint = el('p', { class: 'hint' }, ['① 选择视频 → ② 在画面上拖拽框选水印区域（可框多个）→ ③ 选覆盖方式 → ④ 开始处理（实时录制，等待视频播放完）→ ⑤ 下载。'])

    // —— 框选 ——
    const toStage = (e) => {
      const r = overlay.getBoundingClientRect()
      return { x: (e.clientX - r.left) * (overlay.width / r.width), y: (e.clientY - r.top) * (overlay.height / r.height) }
    }
    const redraw = () => {
      octx.clearRect(0, 0, overlay.width, overlay.height)
      octx.strokeStyle = 'rgba(255,60,60,.95)'; octx.lineWidth = 2
      const all = curRect ? [...regions, curRect] : regions
      for (const rg of all) octx.strokeRect(rg.x, rg.y, rg.w, rg.h)
    }
    overlay.onpointerdown = (e) => { drawing = true; overlay.setPointerCapture(e.pointerId); startPt = toStage(e); curRect = { x: startPt.x, y: startPt.y, w: 0, h: 0 } }
    overlay.onpointermove = (e) => { if (!drawing) return; const p = toStage(e); curRect = { x: Math.min(startPt.x, p.x), y: Math.min(startPt.y, p.y), w: Math.abs(p.x - startPt.x), h: Math.abs(p.y - startPt.y) }; redraw() }
    const finishRect = () => { if (!drawing) return; drawing = false; if (curRect && curRect.w > 4 && curRect.h > 4) regions.push(curRect); curRect = null; redraw() }
    overlay.onpointerup = finishRect
    overlay.onpointerleave = finishRect
    strength.oninput = () => { strengthVal.textContent = strength.value }
    clearBtn.onclick = () => { regions = []; redraw() }

    drop.onclick = () => fileInput.click()
    fileInput.onchange = () => { if (fileInput.files[0]) loadVideo(fileInput.files[0]); fileInput.value = '' }
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over') }
    drop.ondragleave = () => drop.classList.remove('over')
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) loadVideo(e.dataTransfer.files[0]) }

    const loadVideo = (file) => {
      const url = URL.createObjectURL(file)
      videoEl = videoTag
      videoEl.src = url
      videoEl.onloadedmetadata = () => {
        const vw = videoEl.videoWidth, vh = videoEl.videoHeight
        scale = Math.min(1, 1280 / vw)
        outW = Math.round(vw * scale); outH = Math.round(vh * scale)
        overlay.width = vw; overlay.height = vh
        overlay.style.width = '100%'; overlay.style.maxWidth = '100%'
        videoEl.style.display = 'block'
        overlay.style.display = 'block'
        videoEl.currentTime = 0
        videoEl.pause()
        regions = []; redraw()
        alert.className = 'alert ok'; alert.textContent = `✓ 已加载（${vw}×${vh}），请在画面上拖拽框选水印区域`
      }
    }

    // —— 每帧绘制（实时应用覆盖）——
    const drawFrame = () => {
      octx2.clearRect(0, 0, outW, outH)
      octx2.drawImage(videoEl, 0, 0, outW, outH)
      const method = methodSel.value
      const s = +strength.value
      for (const rg of regions) {
        const x = rg.x * scale, y = rg.y * scale, w = rg.w * scale, h = rg.h * scale
        if (method === 'blur') {
          octx2.save()
          octx2.beginPath(); octx2.rect(x, y, w, h); octx2.clip()
          octx2.filter = `blur(${s}px)`
          octx2.drawImage(videoEl, 0, 0, outW, outH)
          octx2.restore()
        } else if (method === 'mosaic') {
          const tw = Math.max(1, Math.round(w / s)), th = Math.max(1, Math.round(h / s))
          const tmp = document.createElement('canvas'); tmp.width = tw; tmp.height = th
          const tctx = tmp.getContext('2d'); tctx.imageSmoothingEnabled = false
          tctx.drawImage(videoEl, rg.x, rg.y, rg.w, rg.h, 0, 0, tw, th)
          octx2.imageSmoothingEnabled = false
          octx2.drawImage(tmp, 0, 0, tw, th, x, y, w, h)
          octx2.imageSmoothingEnabled = true
        } else {
          octx2.fillStyle = 'rgba(0,0,0,.88)'
          octx2.fillRect(x, y, w, h)
        }
      }
    }
    const loop = () => { if (!recording) return; drawFrame(); rafId = requestAnimationFrame(loop) }

    processBtn.onclick = () => {
      if (!videoEl) { alert.className = 'alert err'; alert.textContent = '请先选择视频'; return }
      if (!regions.length) { alert.className = 'alert err'; alert.textContent = '请先框选水印区域'; return }
      if (recording) return
      if (typeof MediaRecorder === 'undefined' || !outCanvas.captureStream) {
        alert.className = 'alert err'; alert.textContent = '当前浏览器不支持视频录制（需 MediaRecorder）'; return
      }
      let mime = ''
      for (const m of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
        if (MediaRecorder.isTypeSupported(m)) { mime = m; break }
      }
      if (!mime) { alert.className = 'alert err'; alert.textContent = '当前浏览器不支持 WebM 录制'; return }

      outCanvas.width = outW; outCanvas.height = outH
      chunks = []
      mediaRecorder = new MediaRecorder(outCanvas.captureStream(30), { mimeType: mime })
      mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data) }
      mediaRecorder.onstop = () => {
        resultBlob = new Blob(chunks, { type: mime })
        dlBtn.disabled = false
        dlBtn.onclick = () => {
          const u = URL.createObjectURL(resultBlob)
          const a = el('a', { href: u, download: 'video-watermark.webm' }); document.body.append(a); a.click(); a.remove()
          setTimeout(() => URL.revokeObjectURL(u), 2000)
        }
        alert.className = 'alert ok'; alert.textContent = '✓ 处理完成，可下载（WebM 格式）'
        recording = false; processBtn.disabled = false; prog.textContent = ''
      }
      recording = true; processBtn.disabled = true; dlBtn.disabled = true
      videoEl.currentTime = 0
      videoEl.play()
      mediaRecorder.start()
      loop()
      videoEl.onended = () => { if (recording) { recording = false; mediaRecorder.stop(); videoEl.pause() } }
      alert.className = ''; alert.textContent = '处理中（实时录制，请等待视频播放结束）…'
    }

    const page = el('div', { class: 'page' }, [
      el('h1', {}, ['视频去水印']),
      el('p', { class: 'sub' }, ['纯前端遮挡（高斯模糊 / 马赛克 / 纯色块）· 零下载 · 适合固定位置水印']),
      el('div', { class: 'card' }, [drop, hint, stage]),
      el('div', { class: 'card', style: 'margin-top:16px' }, [
        el('div', { class: 'row', style: 'flex-wrap:wrap;gap:10px;align-items:center' }, [
          el('label', { class: 'muted' }, ['覆盖方式']), methodSel,
          el('label', { class: 'muted' }, ['强度']), strength, strengthVal,
          el('span', { style: 'flex:1' }), clearBtn, processBtn, dlBtn
        ]),
        alert, prog
      ])
    ])
    root.append(page)
  }
}
