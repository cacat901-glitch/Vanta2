import { BaseRepository } from './base'
import type { Page, PageVersion, Section, Notebook, Workspace } from '@/types'

// ─── Raw DB row types ─────────────────────────────────────────────────

interface PageRow {
  id: string
  section_id: string
  title: string
  content: string
  icon: string | null
  cover: string | null
  tags: string
  word_count: number
  version_count: number
  is_favorite: number
  is_locked: number
  order_index: number
  created_at: string
  updated_at: string
}

interface PageVersionRow {
  id: string
  page_id: string
  content: string
  saved_at: string
}

interface SectionRow {
  id: string
  notebook_id: string
  name: string
  order_index: number
}

interface NotebookRow {
  id: string
  workspace_id: string
  name: string
  icon: string | null
  color: string | null
  order_index: number
  created_at: string
}

interface WorkspaceRow {
  id: string
  name: string
  created_at: string
}

// ─── Repository ────────────────────────────────────────────────────────

export class PageRepository extends BaseRepository {
  // ─── Workspaces ─────────────────────────────────────────────────────

  async getAllWorkspaces(): Promise<Workspace[]> {
    const rows = await this.storage.query<WorkspaceRow>(
      'SELECT * FROM workspaces ORDER BY name ASC'
    )
    return rows.map(this._rowToWorkspace.bind(this))
  }

  async createWorkspace(name: string): Promise<Workspace> {
    const workspace: Workspace = {
      id: this.newId(),
      name,
      createdAt: new Date(),
    }
    await this.storage.execute(
      'INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)',
      [workspace.id, workspace.name, workspace.createdAt.toISOString()]
    )
    return workspace
  }

  async ensureDefaultWorkspace(): Promise<Workspace> {
    const existing = await this.storage.queryOne<WorkspaceRow>(
      "SELECT * FROM workspaces LIMIT 1"
    )
    if (existing) return this._rowToWorkspace(existing)
    return this.createWorkspace('My Study Space')
  }

  // ─── Notebooks ───────────────────────────────────────────────────────

  async getNotebooksByWorkspace(workspaceId: string): Promise<Notebook[]> {
    const rows = await this.storage.query<NotebookRow>(
      'SELECT * FROM notebooks WHERE workspace_id = ? ORDER BY order_index ASC, name ASC',
      [workspaceId]
    )
    return rows.map(this._rowToNotebook.bind(this))
  }

  async createNotebook(workspaceId: string, name: string, icon?: string, color?: string): Promise<Notebook> {
    const notebook: Notebook = {
      id: this.newId(),
      workspaceId,
      name,
      icon: icon ?? null,
      color: color ?? null,
      createdAt: new Date(),
    }
    await this.storage.execute(
      'INSERT INTO notebooks (id, workspace_id, name, icon, color, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [notebook.id, notebook.workspaceId, notebook.name, notebook.icon, notebook.color, notebook.createdAt.toISOString()]
    )
    return notebook
  }

  async updateNotebook(id: string, updates: Partial<Pick<Notebook, 'name' | 'icon' | 'color'>>): Promise<void> {
    const fields: string[] = []
    const values: unknown[] = []
    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name) }
    if (updates.icon !== undefined) { fields.push('icon = ?'); values.push(updates.icon) }
    if (updates.color !== undefined) { fields.push('color = ?'); values.push(updates.color) }
    if (fields.length === 0) return
    values.push(id)
    await this.storage.execute(`UPDATE notebooks SET ${fields.join(', ')} WHERE id = ?`, values)
  }

  async deleteNotebook(id: string): Promise<void> {
    await this.storage.execute('DELETE FROM notebooks WHERE id = ?', [id])
  }

  // ─── Sections ────────────────────────────────────────────────────────

  async getSectionsByNotebook(notebookId: string): Promise<Section[]> {
    const rows = await this.storage.query<SectionRow>(
      'SELECT * FROM sections WHERE notebook_id = ? ORDER BY order_index ASC',
      [notebookId]
    )
    return rows.map(this._rowToSection.bind(this))
  }

  async createSection(notebookId: string, name: string): Promise<Section> {
    const section: Section = {
      id: this.newId(),
      notebookId,
      name,
      orderIndex: 0,
    }
    await this.storage.execute(
      'INSERT INTO sections (id, notebook_id, name, order_index) VALUES (?, ?, ?, ?)',
      [section.id, section.notebookId, section.name, section.orderIndex]
    )
    return section
  }

  async deleteSection(id: string): Promise<void> {
    await this.storage.execute('DELETE FROM sections WHERE id = ?', [id])
  }

  // ─── Pages ───────────────────────────────────────────────────────────

  async getPagesBySection(sectionId: string): Promise<Page[]> {
    const rows = await this.storage.query<PageRow>(
      'SELECT * FROM pages WHERE section_id = ? ORDER BY order_index ASC, updated_at DESC',
      [sectionId]
    )
    return rows.map(this._rowToPage.bind(this))
  }

  async getPageById(id: string): Promise<Page | null> {
    const row = await this.storage.queryOne<PageRow>(
      'SELECT * FROM pages WHERE id = ?',
      [id]
    )
    return row ? this._rowToPage(row) : null
  }

  async getFavoritePages(): Promise<Page[]> {
    const rows = await this.storage.query<PageRow>(
      'SELECT * FROM pages WHERE is_favorite = 1 ORDER BY updated_at DESC'
    )
    return rows.map(this._rowToPage.bind(this))
  }

  async createPage(sectionId: string, title?: string): Promise<Page> {
    const now = this.now()
    const page: Page = {
      id: this.newId(),
      sectionId,
      title: title ?? 'Untitled',
      content: null,
      icon: null,
      cover: null,
      tags: [],
      wordCount: 0,
      versionCount: 0,
      isFavorite: false,
      isLocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await this.storage.execute(
      `INSERT INTO pages
        (id, section_id, title, content, icon, cover, tags, word_count, version_count,
         is_favorite, is_locked, order_index, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        page.id, page.sectionId, page.title,
        JSON.stringify({}), page.icon, page.cover,
        JSON.stringify([]), 0, 0, 0, 0, 0, now, now,
      ]
    )
    return page
  }

  async updatePage(id: string, updates: Partial<Page>): Promise<void> {
    const fields: string[] = []
    const values: unknown[] = []

    if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title) }
    if (updates.content !== undefined) { fields.push('content = ?'); values.push(JSON.stringify(updates.content)) }
    if (updates.icon !== undefined) { fields.push('icon = ?'); values.push(updates.icon) }
    if (updates.cover !== undefined) { fields.push('cover = ?'); values.push(updates.cover) }
    if (updates.tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(updates.tags)) }
    if (updates.wordCount !== undefined) { fields.push('word_count = ?'); values.push(updates.wordCount) }
    if (updates.isFavorite !== undefined) { fields.push('is_favorite = ?'); values.push(updates.isFavorite ? 1 : 0) }
    if (updates.isLocked !== undefined) { fields.push('is_locked = ?'); values.push(updates.isLocked ? 1 : 0) }

    if (fields.length === 0) return

    fields.push('updated_at = ?')
    values.push(this.now())
    values.push(id)

    await this.storage.execute(`UPDATE pages SET ${fields.join(', ')} WHERE id = ?`, values)
  }

  async deletePage(id: string): Promise<void> {
    await this.storage.execute('DELETE FROM pages WHERE id = ?', [id])
  }

  async duplicatePage(id: string): Promise<Page | null> {
    const original = await this.getPageById(id)
    if (!original) return null
    const newPage = await this.createPage(original.sectionId, `${original.title} (copy)`)
    await this.updatePage(newPage.id, {
      content: original.content,
      icon: original.icon,
      tags: original.tags,
    })
    return newPage
  }

  // ─── Version History ─────────────────────────────────────────────────

  async saveVersion(pageId: string, content: unknown): Promise<void> {
    const id = this.newId()
    await this.storage.execute(
      'INSERT INTO page_versions (id, page_id, content, saved_at) VALUES (?, ?, ?, ?)',
      [id, pageId, JSON.stringify(content), this.now()]
    )

    // Keep only last 100 versions per page
    await this.storage.execute(`
      DELETE FROM page_versions
      WHERE page_id = ?
        AND id NOT IN (
          SELECT id FROM page_versions
          WHERE page_id = ?
          ORDER BY saved_at DESC
          LIMIT 100
        )
    `, [pageId, pageId])

    // Update version count
    const countRow = await this.storage.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM page_versions WHERE page_id = ?',
      [pageId]
    )
    if (countRow) {
      await this.storage.execute(
        'UPDATE pages SET version_count = ? WHERE id = ?',
        [countRow.count, pageId]
      )
    }
  }

  async getVersions(pageId: string): Promise<PageVersion[]> {
    const rows = await this.storage.query<PageVersionRow>(
      'SELECT * FROM page_versions WHERE page_id = ? ORDER BY saved_at DESC',
      [pageId]
    )
    return rows.map(r => ({
      id: r.id,
      pageId: r.page_id,
      content: this.deserialize(r.content, {}),
      savedAt: new Date(r.saved_at),
    }))
  }

  // ─── Full-text search ─────────────────────────────────────────────────

  async searchPages(query: string): Promise<Array<{ pageId: string; title: string; excerpt: string; rank: number }>> {
    const escaped = query.replace(/'/g, "''")
    try {
      const rows = await this.storage.query<{ page_id: string; title: string; content: string; rank: number }>(
        `SELECT page_id, title, snippet(pages_fts, 2, '<mark>', '</mark>', '...', 20) AS content, rank
         FROM pages_fts
         WHERE pages_fts MATCH ?
         ORDER BY rank
         LIMIT 50`,
        [escaped]
      )
      return rows.map(r => ({
        pageId: r.page_id,
        title: r.title,
        excerpt: r.content,
        rank: r.rank,
      }))
    } catch {
      // FTS not available (browser Dexie mode), fall back to simple LIKE
      const rows = await this.storage.query<PageRow>(
        `SELECT * FROM pages WHERE title LIKE ? OR content LIKE ? LIMIT 50`,
        [`%${query}%`, `%${query}%`]
      )
      return rows.map(r => ({
        pageId: r.id,
        title: r.title,
        excerpt: '',
        rank: 0,
      }))
    }
  }

  async indexPageInFTS(pageId: string, title: string, content: string, tags: string[]): Promise<void> {
    // Delete existing FTS entry
    await this.storage.execute('DELETE FROM pages_fts WHERE page_id = ?', [pageId])
    // Insert new entry
    await this.storage.execute(
      'INSERT INTO pages_fts (page_id, title, content, tags) VALUES (?, ?, ?, ?)',
      [pageId, title, content, tags.join(' ')]
    )
  }

  // ─── Row mappers ─────────────────────────────────────────────────────

  private _rowToWorkspace(r: WorkspaceRow): Workspace {
    return { id: r.id, name: r.name, createdAt: new Date(r.created_at) }
  }

  private _rowToNotebook(r: NotebookRow): Notebook {
    return {
      id: r.id, workspaceId: r.workspace_id, name: r.name,
      icon: r.icon, color: r.color, createdAt: new Date(r.created_at),
    }
  }

  private _rowToSection(r: SectionRow): Section {
    return { id: r.id, notebookId: r.notebook_id, name: r.name, orderIndex: r.order_index }
  }

  private _rowToPage(r: PageRow): Page {
    return {
      id: r.id,
      sectionId: r.section_id,
      title: r.title,
      content: this.deserialize(r.content, null),
      icon: r.icon,
      cover: r.cover,
      tags: this.deserialize<string[]>(r.tags, []),
      wordCount: r.word_count,
      versionCount: r.version_count,
      isFavorite: this.toBool(r.is_favorite),
      isLocked: this.toBool(r.is_locked),
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
    }
  }
}
