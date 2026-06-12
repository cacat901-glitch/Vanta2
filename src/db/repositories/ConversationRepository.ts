import { BaseRepository } from './base'
import type { AIConversation, ChatMessage, AIProviderType } from '@/types/ai'

interface ConvRow {
  id: string; title: string; context_object_ids: string; messages: string
  provider: string; model: string; created_at: string; updated_at: string
}

export class ConversationRepository extends BaseRepository {
  async getAll(): Promise<AIConversation[]> {
    const rows = await this.storage.query<ConvRow>('SELECT * FROM ai_conversations ORDER BY updated_at DESC')
    return rows.map(this._row.bind(this))
  }

  async getById(id: string): Promise<AIConversation | null> {
    const row = await this.storage.queryOne<ConvRow>('SELECT * FROM ai_conversations WHERE id = ?', [id])
    return row ? this._row(row) : null
  }

  async create(title: string, provider: AIProviderType, model: string): Promise<AIConversation> {
    const now = this.now()
    const conv: AIConversation = {
      id: this.newId(), title, contextObjectIds: [], messages: [],
      provider, model, createdAt: new Date(), updatedAt: new Date(),
    }
    await this.storage.execute(
      `INSERT INTO ai_conversations (id, title, context_object_ids, messages, provider, model, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [conv.id, title, JSON.stringify([]), JSON.stringify([]), provider, model, now, now],
    )
    return conv
  }

  async saveMessages(id: string, messages: ChatMessage[]): Promise<void> {
    await this.storage.execute('UPDATE ai_conversations SET messages = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(messages), this.now(), id])
  }

  async delete(id: string): Promise<void> {
    await this.storage.execute('DELETE FROM ai_conversations WHERE id = ?', [id])
  }

  private _row(r: ConvRow): AIConversation {
    return {
      id: r.id, title: r.title,
      contextObjectIds: this.deserialize<string[]>(r.context_object_ids, []),
      messages: this.deserialize<ChatMessage[]>(r.messages, []),
      provider: r.provider as AIProviderType, model: r.model,
      createdAt: new Date(r.created_at), updatedAt: new Date(r.updated_at),
    }
  }
}
