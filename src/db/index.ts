/**
 * Database facade — single entry point for all data access.
 * Initializes the storage adapter once and provides all repositories.
 */
import type { StorageAdapter } from '@/platform/adapters/StorageAdapter'
import { getStorageAdapter } from '@/platform'
import { PageRepository } from './repositories/PageRepository'
import { FlashcardRepository } from './repositories/FlashcardRepository'
import { SettingsRepository } from './repositories/SettingsRepository'
import { CourseRepository } from './repositories/CourseRepository'
import { ActivityRepository } from './repositories/ActivityRepository'
import { TaskRepository } from './repositories/TaskRepository'
import { CanvasRepository } from './repositories/CanvasRepository'
import { MediaRepository } from './repositories/MediaRepository'
import { DocumentRepository } from './repositories/DocumentRepository'
import { ConversationRepository } from './repositories/ConversationRepository'
import { LectureRepository } from './repositories/LectureRepository'
import { KnowledgeRepository } from './repositories/KnowledgeRepository'

export interface DB {
  storage: StorageAdapter
  pages: PageRepository
  flashcards: FlashcardRepository
  settings: SettingsRepository
  courses: CourseRepository
  activity: ActivityRepository
  tasks: TaskRepository
  canvas: CanvasRepository
  media: MediaRepository
  documents: DocumentRepository
  conversations: ConversationRepository
  lectures: LectureRepository
  knowledge: KnowledgeRepository
}

let _db: DB | null = null
let _initPromise: Promise<DB> | null = null

export async function initDB(): Promise<DB> {
  if (_db) return _db
  if (_initPromise) return _initPromise

  _initPromise = (async () => {
    const storage = await getStorageAdapter()
    _db = {
      storage,
      pages: new PageRepository(storage),
      flashcards: new FlashcardRepository(storage),
      settings: new SettingsRepository(storage),
      courses: new CourseRepository(storage),
      activity: new ActivityRepository(storage),
      tasks: new TaskRepository(storage),
      canvas: new CanvasRepository(storage),
      media: new MediaRepository(storage),
      documents: new DocumentRepository(storage),
      conversations: new ConversationRepository(storage),
      lectures: new LectureRepository(storage),
      knowledge: new KnowledgeRepository(storage),
    }
    return _db
  })()

  return _initPromise
}

export async function getDB(): Promise<DB> {
  if (!_db) return initDB()
  return _db
}

export {
  PageRepository, FlashcardRepository, SettingsRepository, CourseRepository,
  ActivityRepository, TaskRepository, CanvasRepository, MediaRepository,
  DocumentRepository, ConversationRepository, LectureRepository, KnowledgeRepository,
}
