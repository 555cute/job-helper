import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const mammoth = require('mammoth')

export async function extractTextFromDocx(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer })
    return (result.value || '').trim()
  } catch (err) {
    console.error('[docx]', err.message)
    throw err
  }
}

export async function extractTextFromImage(buffer) {
  try {
    const Tesseract = (await import('tesseract.js')).default
    const { data } = await Tesseract.recognize(buffer, 'chi_sim+eng', { logger: () => {} })
    return (data.text || '').trim()
  } catch (err) {
    console.error('[ocr]', err.message)
    throw new Error(`图片 OCR 失败: ${err.message}`)
  }
}

export async function extractTextFromPdf(buffer) {
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const doc = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise

    const pages = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      const items = content.items.map((item) => ({
        text: item.str,
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5]),
        fontSize: Math.round(item.height * 0.85),
      }))

      const lines = []
      for (const item of items) {
        const last = lines[lines.length - 1]
        if (last && Math.abs(last.y - item.y) < 5) {
          last.items.push(item)
          last.y = (last.y + item.y) / 2
          last.fontSize = Math.max(last.fontSize, item.fontSize)
        } else {
          lines.push({ y: item.y, fontSize: item.fontSize, items: [item] })
        }
      }
      lines.sort((a, b) => b.y - a.y)

      const blocks = []
      for (const line of lines) {
        const text = line.items.map(it => it.text).join(' ').trim()
        if (!text) continue
        const lastBlock = blocks[blocks.length - 1]
        const gap = lastBlock ? Math.abs(lastBlock.lines[lastBlock.lines.length - 1].y - line.y) : 999
        if (lastBlock && gap < 12) {
          lastBlock.text += '\n' + text
          lastBlock.lines.push({ y: line.y, text })
          lastBlock.fontSize = Math.max(lastBlock.fontSize, line.fontSize)
        } else {
          blocks.push({ text, fontSize: line.fontSize, lines: [{ y: line.y, text }] })
        }
      }

      for (const block of blocks) {
        const isTitle = /^(个人信息|求职目标|求职意向|工作经历|项目经验|项目|专业技能?|教育背景|教育|证书|获奖|语言|自我评价|个人优势|个人总结|实习经历|校园经历|开源|联系方式?|其他)$/.test(block.text.trim())
        block.isHeader = isTitle || block.fontSize > 14
      }

      const merged = []
      for (const block of blocks) {
        const last2 = merged[merged.length - 1]
        if (!last2 || block.isHeader || last2.isHeader) { merged.push(block) }
        else { last2.text += '\n' + block.text; last2.fontSize = Math.max(last2.fontSize, block.fontSize) }
      }

      pages.push(merged.map(b => b.isHeader ? `\n## ${b.text}` : b.text).join('\n'))
    }

    return pages.join('\n\n').trim()
  } catch (err) {
    console.error('[pdf]', err.message)
    throw new Error(`PDF 解析失败: ${err.message}`)
  }
}

export async function extractTextFromFile(buffer, mimetype) {
  if (mimetype === 'application/pdf') return extractTextFromPdf(buffer)
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return extractTextFromDocx(buffer)
  if (mimetype.startsWith('image/')) return extractTextFromImage(buffer)
  throw new Error(`不支持的文件格式: ${mimetype}`)
}
