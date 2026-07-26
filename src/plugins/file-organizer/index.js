// 文件归纳：上传多文件/文件夹 → 按类型/年月/大小分组 → 统计 → 打包 ZIP 或导出 CSV。
// 新增「相同文件」：基于 SHA-256 内容哈希找出重复文件。纯前端，使用 jszip，文件不离开本机。
import { el, clear } from '../../core/ui.js'
import JSZip from 'jszip'

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = el('a', { href: url, download: filename }); document.body.append(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}
const fmtSize = (b) => b < 1024 ? b + 'B' : b < 1048576 ? (b / 1024).toFixed(1) + 'KB' : (b / 1048576).toFixed(1) + 'MB'
const catOf = (mode, f) => {
  if (mode === 'type') { const m = f.name.match(/\.([^.]+)$/); return (m ? m[1] : '无扩展名').toLowerCase() }
  if (mode === 'date') { const d = new Date(f.lastModified); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') }
  const b = f.size
  if (b < 102400) return '1_小 (<100KB)'
  if (b < 1048576) return '2_中 (100KB-1MB)'
  if (b < 10485760) return '3_大 (1MB-10MB)'
  return '4_超大 (>10MB)'
}

async function sha256(file) {
  const buf = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const fileOrganizerPlugin = {
  id: 'file-organizer',
  name: '文件归纳',
  icon: '🗂️',
  group: '基础办公',
  mount(root) {
    let items = []      // { file, name, size, lastModified }
    let mode = 'type'
    const hashCache = new Map()  // file -> sha256

    const fileInput = el('input', { type: 'file', multiple: 'true', style: 'display:none' })
    const folderInput = el('input', { type: 'file', multiple: 'true', webkitdirectory: '', style: 'display:none' })
    const drop = el('div', { class: 'dropzone' }, ['拖入文件或文件夹，或点击下方按钮选择'])
    const btnFiles = el('button', { class: 'btn ghost' }, ['选择文件'])
    const btnFolder = el('button', { class: 'btn ghost' }, ['选择文件夹'])
    const listEl = el('div', { class: 'filelist' })
    const alert = el('div', {})
    const tabType = el('button', { class: 'tab active' }, ['按类型'])
    const tabDate = el('button', { class: 'tab' }, ['按年月'])
    const tabSize = el('button', { class: 'tab' }, ['按大小'])
    const tabDup = el('button', { class: 'tab' }, ['相同文件'])
    const tabs = el('div', { class: 'tabs' }, [tabType, tabDate, tabSize, tabDup])
    const zipBtn = el('button', { class: 'btn' }, ['打包下载 ZIP'])
    const csvBtn = el('button', { class: 'btn ghost' }, ['导出清单 CSV'])

    const addFiles = (fileList) => { for (const f of fileList) items.push({ file: f, name: f.name, size: f.size, lastModified: f.lastModified }); renderList() }
    const renderList = () => {
      clear(listEl)
      if (!items.length) { listEl.append(el('div', { class: 'muted' }, ['尚未选择文件'])); return }
      if (mode === 'dup') { renderDup(); return }
      const groups = {}
      for (const it of items) (groups[catOf(mode, it)] ||= []).push(it)
      const total = items.reduce((s, x) => s + x.size, 0)
      listEl.append(el('div', { class: 'muted', style: 'margin-bottom:8px' }, [`共 ${items.length} 个文件 · ${fmtSize(total)} · ${Object.keys(groups).length} 个分组`]))
      for (const k of Object.keys(groups).sort()) {
        const g = groups[k]
        const gs = g.reduce((s, x) => s + x.size, 0)
        listEl.append(el('div', { class: 'grp' }, [
          el('div', { class: 'grp-head' }, [el('span', { class: 'grp-name' }, [k]), el('span', { class: 'muted' }, [`${g.length} 个 · ${fmtSize(gs)}`])]),
          el('div', { class: 'grp-items' }, g.slice(0, 50).map((it) => el('span', { class: 'chip' }, [it.name])))
        ]))
      }
    }
    const renderDup = async () => {
      listEl.append(el('div', { class: 'muted' }, ['正在计算文件指纹（SHA-256）…']))
      const map = {}
      for (const it of items) {
        if (!hashCache.has(it.file)) {
          try { hashCache.set(it.file, await sha256(it.file)) } catch { hashCache.set(it.file, 'ERR:' + it.name) }
        }
        const h = hashCache.get(it.file)
        ;(map[h] ||= []).push(it)
      }
      clear(listEl)
      const dups = Object.entries(map).filter(([, g]) => g.length > 1)
      const dupCount = dups.reduce((s, [, g]) => s + g.length - 1, 0)
      if (!dups.length) {
        listEl.append(el('div', { class: 'muted' }, [`未找到重复文件（已比对 ${items.length} 个文件的内容指纹）`]))
        return
      }
      listEl.append(el('div', { class: 'grp-head', style: 'margin-bottom:8px' }, [
        el('span', { class: 'grp-name' }, [`发现 ${dups.length} 组重复 · 共 ${dupCount} 个多余副本`])
      ]))
      for (const [h, g] of dups) {
        listEl.append(el('div', { class: 'grp' }, [
          el('div', { class: 'grp-head' }, [
            el('span', { class: 'grp-name' }, ['指纹 ' + h.slice(0, 12)]),
            el('span', { class: 'muted' }, [`${g.length} 个相同 · ${fmtSize(g[0].size)}`])
          ]),
          el('div', { class: 'grp-items' }, g.map((it) => {
            const del = el('button', { class: 'mini', title: '移除此副本' }, ['✕'])
            del.onclick = () => {
              const i = items.indexOf(it); if (i >= 0) items.splice(i, 1)
              hashCache.delete(it.file); renderList()
            }
            return el('span', { class: 'chip' }, [it.name, del])
          }))
        ]))
      }
    }
    const setMode = (m) => {
      mode = m
      for (const [t, mm] of [[tabType, 'type'], [tabDate, 'date'], [tabSize, 'size'], [tabDup, 'dup']]) {
        t.className = 'tab' + (mm === m ? ' active' : '')
      }
      renderList()
    }
    tabType.onclick = () => setMode('type')
    tabDate.onclick = () => setMode('date')
    tabSize.onclick = () => setMode('size')
    tabDup.onclick = () => setMode('dup')

    btnFiles.onclick = () => { folderInput.value = ''; fileInput.click() }
    btnFolder.onclick = () => { fileInput.value = ''; folderInput.click() }
    fileInput.onchange = () => { addFiles(fileInput.files); fileInput.value = '' }
    folderInput.onchange = () => { addFiles(folderInput.files); folderInput.value = '' }
    drop.onclick = () => btnFiles.click()
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over') }
    drop.ondragleave = () => drop.classList.remove('over')
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files) }

    zipBtn.onclick = async () => {
      if (!items.length) { alert.className = 'alert err'; alert.textContent = '请先选择文件'; return }
      zipBtn.disabled = true; alert.className = ''; alert.textContent = '打包中…'
      try {
        const zip = new JSZip(); const used = {}
        for (const it of items) {
          const cat = catOf(mode, it).replace(/[\\/:*?"<>|]/g, '_')
          let path = `${cat}/${it.name}`, i = 1
          while (used[path]) { path = `${cat}/${it.name} (${++i})`; }
          used[path] = 1; zip.file(path, it.file)
        }
        const blob = await zip.generateAsync({ type: 'blob' })
        downloadBlob(blob, `organized-${mode}.zip`)
        alert.className = 'alert ok'; alert.textContent = `✓ 已按「${mode}」打包 ${items.length} 个文件 → organized-${mode}.zip`
      } catch (err) {
        alert.className = 'alert err'; alert.textContent = '✗ ' + err.message
      } finally { zipBtn.disabled = false }
    }
    csvBtn.onclick = () => {
      if (!items.length) { alert.className = 'alert err'; alert.textContent = '请先选择文件'; return }
      const rows = [['原文件名', '分类', '大小(字节)', '修改时间']]
      for (const it of items) rows.push([it.name, catOf(mode, it), it.size, new Date(it.lastModified).toLocaleString()])
      const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
      downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `manifest-${mode}.csv`)
      alert.className = 'alert ok'; alert.textContent = '✓ 已导出清单 CSV'
    }

    setMode('type')
    const page = el('div', { class: 'page' }, [
      el('h1', {}, ['文件归纳']),
      el('p', { class: 'sub' }, ['按类型/年月/大小自动分类，或按内容指纹查找重复文件 · 文件不离开本机']),
      el('div', { class: 'card' }, [
        tabs, drop,
        el('div', { class: 'row', style: 'margin-top:12px' }, [btnFiles, btnFolder]),
        listEl,
        el('div', { class: 'row', style: 'margin-top:8px' }, [zipBtn, csvBtn]),
        alert
      ])
    ])
    root.append(page)
  }
}
