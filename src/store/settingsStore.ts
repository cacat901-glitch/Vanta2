import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { AppSettings } from '@/types/settings'
import { DEFAULT_SETTINGS } from '@/types/settings'
import { aiService } from '@/services/ai'
import { getDB } from '@/db'

interface SettingsState {
  settings: AppSettings
  isLoaded: boolean

  load: () => Promise<void>
  update: <K extends keyof AppSettings>(section: K, updates: Partial<AppSettings[K]>) => Promise<void>
  save: () => Promise<void>
  reset: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>()(
  immer((set, get) => ({
    settings: DEFAULT_SETTINGS,
    isLoaded: false,

    load: async () => {
      const db = await getDB()
      const saved = await db.settings.getAll()
      set((s) => {
        // Cast both sides to the generic Record type deepMerge expects,
        // then cast the result back to AppSettings.
        const merged = deepMerge(
          DEFAULT_SETTINGS as unknown as Record<string, unknown>,
          saved as unknown as Record<string, unknown>,
        )
        s.settings = merged as unknown as AppSettings
        s.isLoaded = true
      })
      // Reconfigure AI service with loaded settings
      const { settings } = get()
      if (settings.ai.isEnabled) {
        aiService.configure(settings.ai)
      }
    },

    update: async (section, updates) => {
      set((s) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic partial merge across keyof AppSettings
        s.settings[section] = { ...(s.settings[section] as any), ...updates } as any
      })
      await get().save()

      // Reconfigure AI service whenever the AI section changes
      if (section === 'ai') {
        aiService.configure(get().settings.ai)
      }
    },

    save: async () => {
      const db = await getDB()
      await db.settings.saveAll(get().settings)
    },

    reset: async () => {
      set((s) => { s.settings = DEFAULT_SETTINGS })
      await get().save()
    },
  })),
)

// ─── Helpers ─────────────────────────────────────────────────────────

function deepMerge(
  defaults: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...defaults }
  for (const key of Object.keys(overrides)) {
    const def = defaults[key]
    const over = overrides[key]
    if (
      over !== null &&
      typeof over === 'object' &&
      !Array.isArray(over) &&
      def !== null &&
      typeof def === 'object' &&
      !Array.isArray(def)
    ) {
      result[key] = deepMerge(
        def as Record<string, unknown>,
        over as Record<string, unknown>,
      )
    } else if (over !== undefined) {
      result[key] = over
    }
  }
  return result
}
