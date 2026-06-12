import type { StorageAdapter } from '@/platform/adapters/StorageAdapter'

export interface Migration {
  version: number
  description: string
  up: (storage: StorageAdapter) => Promise<void>
}

/** All migrations in order. Never modify existing ones — only append new ones. */
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Initial schema — all core tables',
    up: migration_001,
  },
  {
    version: 2,
    description: 'Add graph tables',
    up: migration_002,
  },
  {
    version: 3,
    description: 'Add RAG chunks table',
    up: migration_003,
  },
  {
    version: 4,
    description: 'Add gamification tables',
    up: migration_004,
  },
]

/** Run all pending migrations on startup. */
export async function runMigrations(storage: StorageAdapter): Promise<void> {
  // Create the migrations tracking table if it doesn't exist
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `)

  // Get current schema version
  const applied = await storage.query<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version ASC'
  )
  const appliedVersions = new Set(applied.map(r => r.version))

  // Run any pending migrations
  for (const migration of MIGRATIONS) {
    if (!appliedVersions.has(migration.version)) {
      console.log(`[DB] Running migration v${migration.version}: ${migration.description}`)
      try {
        await migration.up(storage)
        await storage.execute(
          'INSERT INTO schema_migrations (version, description, applied_at) VALUES (?, ?, ?)',
          [migration.version, migration.description, new Date().toISOString()]
        )
        console.log(`[DB] Migration v${migration.version} complete`)
      } catch (err) {
        console.error(`[DB] Migration v${migration.version} FAILED:`, err)
        throw err
      }
    }
  }
}

// ─── Migration 001: Core Tables ────────────────────────────────────────

async function migration_001(storage: StorageAdapter): Promise<void> {
  // Settings
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  // Workspaces
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)

  // Notebooks
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS notebooks (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      icon TEXT,
      color TEXT,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    )
  `)

  // Sections
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS sections (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL,
      name TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
    )
  `)

  // Pages
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      section_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'Untitled',
      content TEXT NOT NULL DEFAULT '{}',
      icon TEXT,
      cover TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      word_count INTEGER NOT NULL DEFAULT 0,
      version_count INTEGER NOT NULL DEFAULT 0,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      is_locked INTEGER NOT NULL DEFAULT 0,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
    )
  `)
  await storage.execute('CREATE INDEX IF NOT EXISTS idx_pages_section ON pages(section_id)')
  await storage.execute('CREATE INDEX IF NOT EXISTS idx_pages_updated ON pages(updated_at)')

  // Page versions (version history)
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS page_versions (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      content TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
    )
  `)
  await storage.execute('CREATE INDEX IF NOT EXISTS idx_page_versions_page ON page_versions(page_id, saved_at)')

  // Canvas documents
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS canvas_documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'Untitled Canvas',
      data TEXT NOT NULL DEFAULT '{}',
      background_type TEXT NOT NULL DEFAULT 'blank-white',
      background_color TEXT,
      course_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  // Canvas layers
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS canvas_layers (
      id TEXT PRIMARY KEY,
      canvas_id TEXT NOT NULL,
      name TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      visible INTEGER NOT NULL DEFAULT 1,
      locked INTEGER NOT NULL DEFAULT 0,
      opacity REAL NOT NULL DEFAULT 1.0,
      FOREIGN KEY (canvas_id) REFERENCES canvas_documents(id) ON DELETE CASCADE
    )
  `)

  // Courses
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '📚',
      color TEXT NOT NULL DEFAULT '#7C6FFF',
      semester TEXT,
      professor TEXT,
      course_code TEXT,
      schedule TEXT NOT NULL DEFAULT '[]',
      room TEXT,
      zoom_link TEXT,
      syllabus_document_id TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `)

  // Course links (links any object to a course)
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS course_links (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      object_id TEXT NOT NULL,
      object_type TEXT NOT NULL,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    )
  `)
  await storage.execute('CREATE INDEX IF NOT EXISTS idx_course_links ON course_links(course_id, object_type)')

  // Flashcard decks
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS decks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_deck_id TEXT,
      course_id TEXT,
      description TEXT,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  // Flashcards
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      deck_id TEXT NOT NULL,
      front TEXT NOT NULL DEFAULT '{}',
      back TEXT NOT NULL DEFAULT '{}',
      card_type TEXT NOT NULL DEFAULT 'basic',
      cloze_data TEXT,
      occlusion_rects TEXT,
      image_url TEXT,
      audio_url TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      source_object_id TEXT,
      -- SM-2 state
      interval INTEGER NOT NULL DEFAULT 0,
      ease_factor REAL NOT NULL DEFAULT 2.5,
      repetitions INTEGER NOT NULL DEFAULT 0,
      due_date TEXT NOT NULL,
      lapses INTEGER NOT NULL DEFAULT 0,
      is_leech INTEGER NOT NULL DEFAULT 0,
      is_suspended INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
    )
  `)
  await storage.execute('CREATE INDEX IF NOT EXISTS idx_cards_deck ON cards(deck_id)')
  await storage.execute('CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(due_date)')

  // Card reviews
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS card_reviews (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      reviewed_at TEXT NOT NULL,
      ease REAL NOT NULL,
      interval INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      time_taken INTEGER NOT NULL,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    )
  `)
  await storage.execute('CREATE INDEX IF NOT EXISTS idx_reviews_card ON card_reviews(card_id, reviewed_at)')

  // Tasks
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      due_at TEXT,
      priority TEXT NOT NULL DEFAULT 'P3',
      course_id TEXT,
      estimated_minutes INTEGER,
      actual_minutes INTEGER,
      status TEXT NOT NULL DEFAULT 'todo',
      recurrence TEXT NOT NULL DEFAULT 'none',
      parent_task_id TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      completed_at TEXT
    )
  `)
  await storage.execute('CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_at)')
  await storage.execute('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)')
  await storage.execute('CREATE INDEX IF NOT EXISTS idx_tasks_course ON tasks(course_id)')

  // Calendar events
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'personal',
      course_id TEXT,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      recurrence TEXT NOT NULL DEFAULT 'none',
      recurrence_rule TEXT,
      notes TEXT,
      color TEXT,
      location TEXT,
      created_at TEXT NOT NULL
    )
  `)
  await storage.execute('CREATE INDEX IF NOT EXISTS idx_events_start ON calendar_events(start_at)')

  // Assignments
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      course_id TEXT NOT NULL,
      due_at TEXT NOT NULL,
      weight REAL,
      status TEXT NOT NULL DEFAULT 'not-started',
      grade REAL,
      max_grade REAL NOT NULL DEFAULT 100,
      notes TEXT,
      created_at TEXT NOT NULL
    )
  `)
  await storage.execute('CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course_id)')
  await storage.execute('CREATE INDEX IF NOT EXISTS idx_assignments_due ON assignments(due_at)')

  // Exams
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      course_id TEXT NOT NULL,
      exam_at TEXT NOT NULL,
      topics TEXT NOT NULL DEFAULT '[]',
      difficulty TEXT NOT NULL DEFAULT 'medium',
      format TEXT NOT NULL DEFAULT 'mixed',
      location TEXT,
      readiness_score REAL,
      grade REAL,
      max_grade REAL NOT NULL DEFAULT 100,
      notes TEXT,
      created_at TEXT NOT NULL
    )
  `)
  await storage.execute('CREATE INDEX IF NOT EXISTS idx_exams_course ON exams(course_id)')
  await storage.execute('CREATE INDEX IF NOT EXISTS idx_exams_date ON exams(exam_at)')

  // Pomodoro sessions
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS pomodoro_sessions (
      id TEXT PRIMARY KEY,
      course_id TEXT,
      task_id TEXT,
      duration_minutes INTEGER NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      started_at TEXT NOT NULL,
      ended_at TEXT
    )
  `)

  // Daily goals
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS daily_goals (
      id TEXT PRIMARY KEY,
      course_id TEXT,
      goal_type TEXT NOT NULL,
      target_value REAL NOT NULL,
      created_at TEXT NOT NULL
    )
  `)

  // Documents (PDFs, DOCX, etc.)
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      content_text TEXT,
      page_count INTEGER,
      course_id TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      imported_at TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}'
    )
  `)
  await storage.execute('CREATE INDEX IF NOT EXISTS idx_documents_course ON documents(course_id)')

  // Annotations (for PDFs)
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      page INTEGER NOT NULL,
      type TEXT NOT NULL,
      position TEXT NOT NULL,
      content TEXT,
      color TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    )
  `)
  await storage.execute('CREATE INDEX IF NOT EXISTS idx_annotations_doc ON annotations(document_id, page)')

  // Media items (YouTube videos, images, audio)
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS media_items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT,
      thumbnail TEXT,
      duration INTEGER,
      channel_name TEXT,
      course_id TEXT,
      transcript TEXT,
      file_path TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      added_at TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}'
    )
  `)

  // Media timestamps
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS media_timestamps (
      id TEXT PRIMARY KEY,
      media_id TEXT NOT NULL,
      time_seconds REAL NOT NULL,
      note_page_id TEXT,
      label TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (media_id) REFERENCES media_items(id) ON DELETE CASCADE
    )
  `)

  // Lectures
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS lectures (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      course_id TEXT,
      audio_path TEXT,
      transcript TEXT NOT NULL DEFAULT '[]',
      summary TEXT,
      notes_page_id TEXT,
      duration INTEGER,
      recorded_at TEXT NOT NULL,
      processed_at TEXT,
      status TEXT NOT NULL DEFAULT 'recording',
      tags TEXT NOT NULL DEFAULT '[]'
    )
  `)

  // Lecture chapters
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS lecture_chapters (
      id TEXT PRIMARY KEY,
      lecture_id TEXT NOT NULL,
      title TEXT NOT NULL,
      start_time REAL NOT NULL,
      end_time REAL,
      FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE
    )
  `)

  // AI conversations
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New Conversation',
      context_object_ids TEXT NOT NULL DEFAULT '[]',
      messages TEXT NOT NULL DEFAULT '[]',
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  // Tutor sessions
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS tutor_sessions (
      id TEXT PRIMARY KEY,
      mode TEXT NOT NULL,
      course_id TEXT,
      summary TEXT,
      concepts_covered TEXT NOT NULL DEFAULT '[]',
      weakness_report TEXT,
      created_at TEXT NOT NULL
    )
  `)

  // Oral exam sessions
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS oral_exam_sessions (
      id TEXT PRIMARY KEY,
      course_id TEXT,
      topics TEXT NOT NULL DEFAULT '[]',
      transcript TEXT NOT NULL DEFAULT '[]',
      scores TEXT NOT NULL DEFAULT '{}',
      overall_grade REAL,
      feedback TEXT,
      taken_at TEXT NOT NULL
    )
  `)

  // Activity log
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      action_type TEXT NOT NULL,
      object_id TEXT,
      object_type TEXT,
      course_id TEXT,
      duration_seconds INTEGER,
      metadata TEXT NOT NULL DEFAULT '{}',
      logged_at TEXT NOT NULL
    )
  `)
  await storage.execute('CREATE INDEX IF NOT EXISTS idx_activity_logged ON activity_log(logged_at)')
  await storage.execute('CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_log(action_type)')
  await storage.execute('CREATE INDEX IF NOT EXISTS idx_activity_course ON activity_log(course_id)')

  // Knowledge objects (unified)
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS knowledge_objects (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content_text TEXT NOT NULL DEFAULT '',
      content_rich TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      course_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      ai_summary TEXT,
      ai_keywords TEXT NOT NULL DEFAULT '[]',
      ai_description TEXT,
      metadata TEXT NOT NULL DEFAULT '{}',
      links TEXT NOT NULL DEFAULT '[]',
      related_ids TEXT NOT NULL DEFAULT '[]',
      is_indexed INTEGER NOT NULL DEFAULT 0
    )
  `)
  await storage.execute('CREATE INDEX IF NOT EXISTS idx_ko_type ON knowledge_objects(type)')
  await storage.execute('CREATE INDEX IF NOT EXISTS idx_ko_course ON knowledge_objects(course_id)')
  await storage.execute('CREATE INDEX IF NOT EXISTS idx_ko_updated ON knowledge_objects(updated_at)')

  // Full-text search index (virtual table)
  await storage.execute(`
    CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
      page_id UNINDEXED,
      title,
      content,
      tags,
      tokenize='porter ascii'
    )
  `)

  console.log('[DB] Migration 001 complete: core tables created')
}

// ─── Migration 002: Graph Tables ───────────────────────────────────────

async function migration_002(storage: StorageAdapter): Promise<void> {
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS graph_nodes (
      id TEXT PRIMARY KEY,
      object_id TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      node_type TEXT NOT NULL,
      properties TEXT NOT NULL DEFAULT '{}',
      FOREIGN KEY (object_id) REFERENCES knowledge_objects(id) ON DELETE CASCADE
    )
  `)

  await storage.execute(`
    CREATE TABLE IF NOT EXISTS graph_edges (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      edge_type TEXT NOT NULL,
      weight REAL NOT NULL DEFAULT 1.0,
      metadata TEXT NOT NULL DEFAULT '{}',
      FOREIGN KEY (source_id) REFERENCES graph_nodes(id) ON DELETE CASCADE,
      FOREIGN KEY (target_id) REFERENCES graph_nodes(id) ON DELETE CASCADE
    )
  `)
  await storage.execute('CREATE INDEX IF NOT EXISTS idx_edges_source ON graph_edges(source_id)')
  await storage.execute('CREATE INDEX IF NOT EXISTS idx_edges_target ON graph_edges(target_id)')
  await storage.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_edges_unique ON graph_edges(source_id, target_id, edge_type)')
}

// ─── Migration 003: RAG Chunks ──────────────────────────────────────────

async function migration_003(storage: StorageAdapter): Promise<void> {
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id TEXT PRIMARY KEY,
      object_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      embedding TEXT,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY (object_id) REFERENCES knowledge_objects(id) ON DELETE CASCADE
    )
  `)
  await storage.execute('CREATE INDEX IF NOT EXISTS idx_chunks_object ON knowledge_chunks(object_id)')
}

// ─── Migration 004: Gamification ──────────────────────────────────────

async function migration_004(storage: StorageAdapter): Promise<void> {
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS user_stats (
      id TEXT PRIMARY KEY DEFAULT 'singleton',
      total_xp INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      current_streak INTEGER NOT NULL DEFAULT 0,
      longest_streak INTEGER NOT NULL DEFAULT 0,
      last_study_date TEXT,
      total_study_hours REAL NOT NULL DEFAULT 0,
      total_flashcards_reviewed INTEGER NOT NULL DEFAULT 0,
      total_tasks_completed INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    )
  `)

  await storage.execute(`
    CREATE TABLE IF NOT EXISTS earned_badges (
      id TEXT PRIMARY KEY,
      badge_id TEXT NOT NULL UNIQUE,
      earned_at TEXT NOT NULL
    )
  `)

  await storage.execute(`
    CREATE TABLE IF NOT EXISTS ai_coach_reports (
      id TEXT PRIMARY KEY,
      report_text TEXT NOT NULL,
      week_start TEXT NOT NULL,
      week_end TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      generated_at TEXT NOT NULL
    )
  `)

  // Insert default user stats singleton
  await storage.execute(`
    INSERT OR IGNORE INTO user_stats (id, updated_at)
    VALUES ('singleton', ?)
  `, [new Date().toISOString()])
}
