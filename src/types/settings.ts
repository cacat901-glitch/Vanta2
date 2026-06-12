import type { AIProviderConfig, AIProviderType, NotificationTone } from './ai'

// ─── App Settings ─────────────────────────────────────────────────────

export type ThemeMode = 'light' | 'dark' | 'system'
export type FontSize = 'small' | 'default' | 'large' | 'xlarge'
export type FontFamily = 'inter' | 'roboto' | 'system'

export interface AppearanceSettings {
  theme: ThemeMode
  accentColor: string
  fontSize: FontSize
  fontFamily: FontFamily
  compactMode: boolean
}

export interface EditorSettings {
  autosaveInterval: number // seconds
  typewriterMode: boolean
  focusModeOnOpen: boolean
  spellCheck: boolean
  smartQuotes: boolean
  ghostAICompletions: boolean
  defaultBlockType: string
}

export interface FlashcardSettings {
  dailyNewCardLimit: number
  maxDailyReviews: number
  learningSteps: number[] // minutes, e.g. [1, 10]
  sm2EaseFactor: number   // default 2.5
  sm2IntervalModifier: number // default 1.0
  leechThreshold: number  // failures before leech
  audioEnabled: boolean
  buryRelatedCards: boolean
}

export interface PomodoroSettings {
  workDuration: number     // minutes
  shortBreakDuration: number
  longBreakDuration: number
  roundsBeforeLongBreak: number
  autoStartNextSession: boolean
  soundEnabled: boolean
  soundFile: string
  tickSoundEnabled: boolean
}

export interface NotificationSettings {
  enabled: boolean
  tone: NotificationTone
  morningBriefing: boolean
  morningBriefingTime: string // HH:mm
  eveningReminder: boolean
  eveningReminderTime: string
  streakAlert: boolean
  streakAlertTime: string
  inactivityAlert: boolean
  inactivityThresholdHours: number
  examCountdown: boolean
  examCountdownDaysStart: number
  assignmentReminder: boolean
  flashcardOverdueThreshold: number
  doNotDisturbStart: string | null // HH:mm
  doNotDisturbEnd: string | null
}

export interface TrackerSettings {
  defaultDailyGoalHours: number
  streakGoalPercentage: number // 0-100, default 80
  courseGoals: Record<string, number> // courseId -> daily hours goal
}

export interface PrivacySettings {
  analyticsEnabled: boolean
}

export interface AppSettings {
  ai: AIProviderConfig
  activeProvider: AIProviderType
  appearance: AppearanceSettings
  editor: EditorSettings
  flashcards: FlashcardSettings
  pomodoro: PomodoroSettings
  notifications: NotificationSettings
  tracker: TrackerSettings
  privacy: PrivacySettings
}

export const DEFAULT_SETTINGS: AppSettings = {
  ai: {
    type: 'ollama',
    name: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434',
    model: 'llama3.2',
    isEnabled: false,
  },
  activeProvider: 'none',
  appearance: {
    theme: 'dark',
    accentColor: '#7C6FFF',
    fontSize: 'default',
    fontFamily: 'inter',
    compactMode: false,
  },
  editor: {
    autosaveInterval: 3,
    typewriterMode: false,
    focusModeOnOpen: false,
    spellCheck: true,
    smartQuotes: true,
    ghostAICompletions: false,
    defaultBlockType: 'paragraph',
  },
  flashcards: {
    dailyNewCardLimit: 20,
    maxDailyReviews: 200,
    learningSteps: [1, 10],
    sm2EaseFactor: 2.5,
    sm2IntervalModifier: 1.0,
    leechThreshold: 8,
    audioEnabled: true,
    buryRelatedCards: false,
  },
  pomodoro: {
    workDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    roundsBeforeLongBreak: 4,
    autoStartNextSession: false,
    soundEnabled: true,
    soundFile: 'chime',
    tickSoundEnabled: false,
  },
  notifications: {
    enabled: true,
    tone: 'motivational',
    morningBriefing: true,
    morningBriefingTime: '08:00',
    eveningReminder: true,
    eveningReminderTime: '20:00',
    streakAlert: true,
    streakAlertTime: '21:00',
    inactivityAlert: true,
    inactivityThresholdHours: 24,
    examCountdown: true,
    examCountdownDaysStart: 7,
    assignmentReminder: true,
    flashcardOverdueThreshold: 20,
    doNotDisturbStart: null,
    doNotDisturbEnd: null,
  },
  tracker: {
    defaultDailyGoalHours: 4,
    streakGoalPercentage: 80,
    courseGoals: {},
  },
  privacy: {
    analyticsEnabled: false,
  },
}
