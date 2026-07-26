// PDF 工具：多文件合并为单 PDF；拆分首份 PDF 为每页单独文件并打包 ZIP。
// 纯前端，使用 pdf-lib；ZIP 打包复用 jszip。
import { el, clear } from '../../core/ui.js'
import { PDFDocument } from 'pdf-lib'
import JSZip from 'jszip'

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = el('a', { href: url, download: filename })
  document.body.append(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export const pdfToolsPlugin = {
  id: 'pdf-tools',
  name: 'PDF 工具',
  icon: '📎',
  group: '基础办公',
  mount(root) {
    let files = []          // { file, name }
    let mode = 'merge'      // merge | split

    const fileInput = el('input', { type: 'file', accept: 'application/pdf', multiple: 'true', style: 'display:none' })
    const drop = el('div', { class: 'dropzone' }, ['拖入 PDF 文件，或点击选择（可多选，合并按列表顺序）'])
    const listEl = el('div', { class: 'filelist' })
    const alert = el('div', {})
    const tabMerge = el('button', { class: 'tab active' }, ['合并'])
    const tabSplit = el('button', { class: 'tab' }, ['拆分'])
    const runBtn = el('button', { class: 'btn' }, ['开始处理'])
    const tabs = el('div', { class: 'tabs' }, [tabMerge, tabSplit])

    const renderList = () => {
      clear(listEl)
      if (!files.length) { listEl.append(el('div', { class: 'muted' }, ['尚未选择文件'])); return }
      files.forEach((f, i) => {
        const up = el('button', { class: 'mini', title: '上移' }, ['↑'])
        const down = el('button', { class: 'mini', title: '下移' }, ['↓'])
        const del = el('button', { class: 'mini', title: '移除' }, ['✕'])
        up.onclick = () => { if (i > 0) { [files[i - 1], files[i]] = [files[i], files[i - 1]]; renderList() } }
        down.onclick = () => { if (i < files.length - 1) { [files[i + 1], files[i]] = [files[i], files[i + 1]]; renderList() } }
        del.onclick = () => { files.splice(i, 1); renderList() }
        const ctrl = mode === 'merge' ? el('div', { class: 'row-ctrl' }, [up, down, del]) : del
        listEl.append(el('div', { class: 'fileitem' }, [
          el('span', { class: 'idx' }, [String(i + 1)]),
          el('span', { class: 'fname' }, [f.name]),
          ctrl
        ]))
      })
    }

    const setMode = (m) => {
      mode = m
      tabMerge.className = 'tab' + (m === 'merge' ? ' active' : '')
      tabSplit.className = 'tab' + (m === 'split' ? ' active' : '')
      runBtn.textContent = m === 'merge' ? '合并为一个 PDF' : '拆分为每页单独文件'
      renderList()
    }
    tabMerge.onclick = () => setMode('merge')
    tabSplit.onclick = () => setMode('split')

    drop.onclick = () => fileInput.click()
    fileInput.onchange = () => {
      for (const f of fileInput.files) files.push({ file: f, name: f.name.replace(/\.pdf$/i, '') })
      fileInput.value = ''
      renderList()
    }
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over') }
    drop.ondragleave = () => drop.classList.remove('over')
    drop.ondrop = (e) => {
      e.preventDefault(); drop.classList.remove('over')
      for (const f of e.dataTransfer.files) if (/\.pdf$/i.test(f.name)) files.push({ file: f, name: f.name.replace(/\.pdf$/i, '') })
      renderList()
    }

    runBtn.onclick = async () => {
      if (!files.length) { alert.className = 'alert err'; alert.textContent = '请先选择至少一个 PDF'; return }
      runBtn.disabled = true; alert.className = ''; alert.textContent = '处理中…'
      try {
        if (mode === 'merge') {
          const out = await PDFDocument.create()
          for (const { file } of files) {
            const buf = await file.arrayBuffer()
            const src = await PDFDocument.load(buf)
            const pages = await out.copyPages(src, src.getPageIndices())
            pages.forEach((p) => out.addPage(p))
          }
          const bytes = await out.save()
          downloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'merged.pdf')
          alert.className = 'alert ok'; alert.textContent = `✓ 已合并 ${files.length} 个文件 → merged.pdf`
        } else {
          const buf = await files[0].file.arrayBuffer()
          const src = await PDFDocument.load(buf)
          const n = src.getPageCount()
          const zip = new JSZip()
          for (let i = 0; i < n; i++) {
            const one = await PDFDocument.create()
            const [p] = await one.copyPages(src, [i])
            one.addPage(p)
            const bytes = await one.save()
            zip.file(`${String(i + 1).padStart(3, '0')}.pdf`, bytes)
          }
          const blob = await zip.generateAsync({ type: 'blob' })
          downloadBlob(blob, `${files[0].name || 'split'}-pages.zip`)
          alert.className = 'alert ok'; alert.textContent = `✓ 已拆分 ${n} 页 → ${files[0].name || 'split'}-pages.zip`
        }
      } catch (err) {
        alert.className = 'alert err'; alert.textContent = '✗ ' + err.message
      } finally {
        runBtn.disabled = false
      }
    }

    setMode('merge')
    const page = el('div', { class: 'page' }, [
      el('h1', {}, ['PDF 工具']),
      el('p', { class: 'sub' }, ['合并多份 PDF，或拆分单份为每页文件 · 全程本机处理，文件不上传']),
      el('div', { class: 'card' }, [
        tabs,
        drop,
        el('p', { class: 'hint' }, ['合并：列表顺序即输出顺序，可用 ↑↓ 调整。拆分：仅处理列表第一个文件。']),
        listEl,
        runBtn, alert
      ])
    ])
    root.append(page)
  }
}
