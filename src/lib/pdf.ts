import * as pdfjsLib from 'pdfjs-dist'
// Vite resolves this to a hashed worker URL
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export type PdfDoc = pdfjsLib.PDFDocumentProxy

/** Load a PDF document from raw bytes. */
export async function loadPdf(data: Uint8Array): Promise<PdfDoc> {
  const loadingTask = pdfjsLib.getDocument({ data })
  return loadingTask.promise
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
