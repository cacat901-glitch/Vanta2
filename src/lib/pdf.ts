import * as pdfjsLib from 'pdfjs-dist'

// Canonical pdf.js v4 + Vite worker setup: new URL(..., import.meta.url) is
// statically rewritten by Vite to the correct bundled worker asset. The older
// `?url` import frequently fails to load the ESM worker, which made
// getDocument() hang forever (the "PDF loads forever" bug).
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export type PdfDoc = pdfjsLib.PDFDocumentProxy

/** Load a PDF document from raw bytes, with a hard timeout so it can never hang. */
export async function loadPdf(data: Uint8Array, timeoutMs = 30000): Promise<PdfDoc> {
  const task = pdfjsLib.getDocument({ data })
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      void task.destroy()
      reject(new Error('PDF load timed out — the file may be corrupt or too large.'))
    }, timeoutMs)
  })
  try {
    return await Promise.race([task.promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Extract all text from a PDF (used for search + AI + RAG). */
export async function extractPdfText(doc: PdfDoc): Promise<string> {
  const parts: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
    parts.push(text)
  }
  return parts.join('\n\n')
}

/** Extract text from a single page. */
export async function extractPageText(doc: PdfDoc, pageNum: number): Promise<string> {
  const page = await doc.getPage(pageNum)
  const content = await page.getTextContent()
  return content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
}

/** Render a PDF page to a canvas element at a given scale. */
export async function renderPage(
  doc: PdfDoc,
  pageNum: number,
  canvas: HTMLCanvasElement,
  scale = 1.5,
): Promise<{ width: number; height: number }> {
  const page = await doc.getPage(pageNum)
  const viewport = page.getViewport({ scale })
  const ctx = canvas.getContext('2d')!
  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({ canvasContext: ctx, viewport }).promise
  return { width: viewport.width, height: viewport.height }
}
