import { useState } from 'react'
import {
  Bot, Palette, Bell, Database, Keyboard,
  Info, CheckCircle2, AlertCircle, Loader2,
  Eye, EyeOff, ChevronRight, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/store/settingsStore'
import { useAIStore } from '@/store/aiStore'
import { aiService } from '@/services/ai'
import type { AIProviderType } from '@/types/ai'

type SettingsSection = 'ai' | 'appearance' | 'notifications' | 'data' | 'shortcuts' | 'about'

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('ai')

  const sections: { id: SettingsSection; label: string; icon: LucideIcon }[] = [
    { id: 'ai', label: 'AI Provider', icon: Bot },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'data', label: 'Data & Privacy', icon: Database },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard },
    { id: 'about', label: 'About', icon: Info },
  ]

  return (
    <div className="flex h-full">
      <div className="w-52 flex-shrink-0 border-r border-border-subtle bg-sidebar-bg p-3">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider px-2 mb-2">Settings</h2>
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={cn(
              'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors',
              activeSection === s.id
                ? 'bg-accent-primary/15 text-accent-primary font-medium'
                : 'text-text-secondary hover:bg-surface hover:text-text-primary',
            )}
          >
            <s.icon size={15} />
            {s.label}
            {activeSection === s.id && <ChevronRight size={12} className="ml-auto" />}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-8 max-w-2xl">
        {activeSection === 'ai' && <AISettings />}
        {activeSection === 'appearance' && <AppearanceSettings />}
        {activeSection === 'notifications' && <NotificationSettings />}
        {activeSection === 'data' && <DataSettings />}
        {activeSection === 'shortcuts' && <ShortcutsRef />}
        {activeSection === 'about' && <AboutSection />}
      </div>
    </div>
  )
}

function AISettings() {
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)
  const syncProvider = useAIStore((s) => s.syncProvider)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null)
  const [showKey, setShowKey] = useState(false)

  const ai = settings.ai

  const providers: { type: AIProviderType; label: string; description: string; free: boolean; offline: boolean }[] = [
    { type: 'ollama', label: 'Ollama', description: 'Local LLMs — free, offline, unlimited', free: true, offline: true },
    { type: 'gemini', label: 'Google Gemini', description: '1M context, vision, audio — best free cloud option', free: true, offline: false },
    { type: 'groq', label: 'Groq', description: 'Ultra-fast inference — free tier', free: true, offline: false },
    { type: 'openrouter', label: 'OpenRouter', description: 'Many free models (DeepSeek, Qwen, Llama)', free: true, offline: false },
    { type: 'openai', label: 'OpenAI', description: 'GPT-4o — paid', free: false, offline: false },
    { type: 'lmstudio', label: 'LM Studio', description: 'Local OpenAI-compatible server', free: true, offline: true },
    { type: 'custom', label: 'Custom Endpoint', description: 'Any OpenAI-compatible API', free: false, offline: false },
  ]

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    aiService.configure({ ...ai, isEnabled: true })
    const ok = await aiService.testConnection()
    setTestResult(ok ? 'ok' : 'fail')
    setTesting(false)
  }

  const handleSave = async () => {
    await update('ai', { ...ai, isEnabled: true })
    syncProvider()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">AI Provider</h1>
        <p className="text-sm text-text-muted mt-1">Configure your AI provider. Ollama is recommended — free, offline, unlimited.</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-text-primary">Provider</label>
        <div className="grid grid-cols-1 gap-2">
          {providers.map((p) => (
            <button
              key={p.type}
              onClick={() => void update('ai', { type: p.type, model: '' })}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
                ai.type === p.type ? 'border-accent-primary bg-accent-primary/10' : 'border-border-subtle bg-surface hover:border-border-default',
              )}
            >
              <div className={cn('w-2 h-2 rounded-full flex-shrink-0', ai.type === p.type ? 'bg-accent-primary' : 'bg-border-default')} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">{p.label}</span>
                  {p.free && <span className="text-xs bg-success/20 text-success px-1.5 py-0.5 rounded font-medium">Free</span>}
                  {p.offline && <span className="text-xs bg-info/20 text-info px-1.5 py-0.5 rounded font-medium">Offline</span>}
                </div>
                <p className="text-xs text-text-muted">{p.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {(ai.type === 'ollama' || ai.type === 'lmstudio' || ai.type === 'jan' || ai.type === 'custom') && (
          <SettingsField label="Base URL">
            <input
              type="text"
              value={ai.baseUrl ?? ''}
              onChange={(e) => void update('ai', { baseUrl: e.target.value })}
              placeholder={ai.type === 'ollama' ? 'http://localhost:11434' : 'http://localhost:1234/v1'}
              className="settings-input"
            />
          </SettingsField>
        )}

        {ai.type !== 'ollama' && ai.type !== 'lmstudio' && ai.type !== 'jan' && (
          <SettingsField label="API Key" description="Stored locally, never sent anywhere except the AI provider.">
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={ai.apiKey ?? ''}
                onChange={(e) => void update('ai', { apiKey: e.target.value })}
                placeholder="sk-..."
                className="settings-input pr-9"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </SettingsField>
        )}

        <SettingsField label="Model" description="The model to use for chat and text generation.">
          <input
            type="text"
            value={ai.model}
            onChange={(e) => void update('ai', { model: e.target.value })}
            placeholder={ai.type === 'gemini' ? 'gemini-2.0-flash' : 'llama3.2'}
            className="settings-input"
          />
        </SettingsField>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleTest}
          disabled={testing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border-default hover:bg-surface-elevated text-sm text-text-primary transition-colors disabled:opacity-50"
        >
          {testing ? <Loader2 size={14} className="animate-spin" /> : null}
          Test Connection
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary text-white text-sm hover:bg-accent-hover transition-colors"
        >
          Save
        </button>
        {testResult === 'ok' && (
          <span className="flex items-center gap-1 text-success text-sm"><CheckCircle2 size={14} /> Connected</span>
        )}
        {testResult === 'fail' && (
          <span className="flex items-center gap-1 text-danger text-sm"><AlertCircle size={14} /> Connection failed</span>
        )}
      </div>

      {ai.type === 'ollama' && (
        <div className="p-4 rounded-lg bg-info/5 border border-info/20 text-sm text-text-secondary">
          <p className="font-medium text-text-primary mb-1">Setting up Ollama</p>
          <ol className="space-y-1 list-decimal list-inside text-xs">
            <li>Download from <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline">ollama.ai</a></li>
            <li>Run: <code className="bg-surface-elevated px-1 rounded font-mono">ollama pull llama3.2</code></li>
            <li>Click "Test Connection" above</li>
          </ol>
        </div>
      )}
      {ai.type === 'gemini' && (
        <div className="p-4 rounded-lg bg-success/5 border border-success/20 text-sm text-text-secondary">
          <p className="font-medium text-text-primary mb-1">Get a free Gemini API key</p>
          <p className="text-xs">Visit <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline">aistudio.google.com</a> → Get API key. Free: 15 req/min, 1M token context.</p>
        </div>
      )}
    </div>
  )
}

function AppearanceSettings() {
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-text-primary">Appearance</h1>
      <SettingsField label="Theme">
        <div className="flex gap-2">
          {(['dark', 'light', 'system'] as const).map((theme) => (
            <button key={theme} onClick={() => void update('appearance', { theme })}
              className={cn('px-3 py-1.5 rounded-lg text-sm border capitalize transition-colors',
                settings.appearance.theme === theme ? 'border-accent-primary bg-accent-primary/15 text-accent-primary' : 'border-border-subtle bg-surface text-text-secondary hover:border-border-default')}>
              {theme}
            </button>
          ))}
        </div>
      </SettingsField>
      <SettingsField label="Font Size">
        <div className="flex gap-2">
          {(['small', 'default', 'large', 'xlarge'] as const).map((size) => (
            <button key={size} onClick={() => void update('appearance', { fontSize: size })}
              className={cn('px-3 py-1.5 rounded-lg text-sm border capitalize transition-colors',
                settings.appearance.fontSize === size ? 'border-accent-primary bg-accent-primary/15 text-accent-primary' : 'border-border-subtle bg-surface text-text-secondary')}>
              {size}
            </button>
          ))}
        </div>
      </SettingsField>
      <SettingsField label="Accent Color">
        <div className="flex gap-2 flex-wrap">
          {['#7C6FFF', '#3ECFB2', '#FF5263', '#FFBB38', '#4DA6FF', '#FF9040'].map((color) => (
            <button key={color} onClick={() => void update('appearance', { accentColor: color })}
              className={cn('w-8 h-8 rounded-full border-2 transition-transform hover:scale-110',
                settings.appearance.accentColor === color ? 'border-white scale-110' : 'border-transparent')}
              style={{ backgroundColor: color }} />
          ))}
        </div>
      </SettingsField>
      <SettingsField label="Compact Mode" description="Denser UI with less padding">
        <Toggle checked={settings.appearance.compactMode} onChange={(v) => void update('appearance', { compactMode: v })} />
      </SettingsField>
    </div>
  )
}

function NotificationSettings() {
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)
  const notifs = settings.notifications
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-text-primary">Notifications</h1>
      <SettingsField label="Enable Notifications">
        <Toggle checked={notifs.enabled} onChange={(v) => void update('notifications', { enabled: v })} />
      </SettingsField>
      {notifs.enabled && (
        <>
          <SettingsField label="Morning Briefing" description={`Sent at ${notifs.morningBriefingTime}`}>
            <Toggle checked={notifs.morningBriefing} onChange={(v) => void update('notifications', { morningBriefing: v })} />
          </SettingsField>
          <SettingsField label="Evening Reminder" description="Fires if daily goal not yet met">
            <Toggle checked={notifs.eveningReminder} onChange={(v) => void update('notifications', { eveningReminder: v })} />
          </SettingsField>
          <SettingsField label="Streak Alert" description="Warns if streak is at risk">
            <Toggle checked={notifs.streakAlert} onChange={(v) => void update('notifications', { streakAlert: v })} />
          </SettingsField>
          <SettingsField label="Notification Tone">
            <select value={notifs.tone}
              onChange={(e) => void update('notifications', { tone: e.target.value as typeof notifs.tone })}
              className="settings-input w-auto">
              <option value="motivational">Motivational</option>
              <option value="neutral">Neutral</option>
              <option value="sarcastic">Sarcastic</option>
              <option value="tough-love">Tough Love</option>
            </select>
          </SettingsField>
        </>
      )}
    </div>
  )
}

function DataSettings() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-text-primary">Data & Privacy</h1>
      <p className="text-sm text-text-muted">All your data is stored locally. Nothing is sent to external servers except AI API calls to your configured provider.</p>
      <div className="space-y-3">
        {[
          { label: 'Export All Data (JSON)', description: 'Full backup of everything', danger: false },
          { label: 'Export Notes as Markdown', description: 'ZIP of all notebook pages as .md files', danger: false },
          { label: 'Import Backup', description: 'Restore from a JSON backup', danger: false },
          { label: 'Open Data Folder', description: 'Reveal app data folder in file manager', danger: false },
          { label: 'Clear All Data', description: 'Permanently delete everything — cannot be undone', danger: true },
        ].map((action) => (
          <div key={action.label} className="flex items-center justify-between p-3 rounded-lg bg-surface border border-border-subtle">
            <div>
              <p className={cn('text-sm font-medium', action.danger ? 'text-danger' : 'text-text-primary')}>{action.label}</p>
              <p className="text-xs text-text-muted">{action.description}</p>
            </div>
            <button className={cn('px-3 py-1.5 rounded-md text-sm border transition-colors',
              action.danger ? 'border-danger/30 text-danger hover:bg-danger/10' : 'border-border-default text-text-secondary hover:bg-surface-elevated')}>
              {action.danger ? 'Delete' : 'Export'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function ShortcutsRef() {
  const shortcuts = [
    { key: '⌘K', action: 'Command palette' },
    { key: '⌘/', action: 'Toggle AI panel' },
    { key: '⌘⇧F', action: 'Focus mode' },
    { key: '⌘⇧L', action: 'Toggle sidebar' },
    { key: '⌘N', action: 'New page' },
    { key: '⌘⇧N', action: 'New notebook' },
    { key: '⌘S', action: 'Force save' },
    { key: '⌘Z', action: 'Undo' },
    { key: '⌘⇧Z', action: 'Redo' },
    { key: '⌘B', action: 'Bold' },
    { key: '⌘I', action: 'Italic' },
    { key: '⌘U', action: 'Underline' },
    { key: '/', action: 'Slash command menu (in editor)' },
    { key: '[[', action: 'Link to page (in editor)' },
    { key: 'Esc', action: 'Close modal / palette / panel' },
  ]
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-text-primary">Keyboard Shortcuts</h1>
      <div className="space-y-1">
        {shortcuts.map((s) => (
          <div key={s.key} className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0">
            <span className="text-sm text-text-secondary">{s.action}</span>
            <kbd className="text-xs bg-surface-elevated border border-border-default px-2 py-1 rounded font-mono text-text-primary">{s.key}</kbd>
          </div>
        ))}
      </div>
    </div>
  )
}

function AboutSection() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-accent-primary flex items-center justify-center">
          <Bot size={28} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">StudyOS</h1>
          <p className="text-sm text-text-muted">Version 0.1.0</p>
        </div>
      </div>
      <p className="text-sm text-text-secondary leading-relaxed">
        A personal AI-powered learning operating system. All data stored locally. Built with React, Tauri, and love for learning.
      </p>
      <div className="flex gap-3">
        <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-sm text-accent-primary hover:underline">GitHub →</a>
        <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" className="text-sm text-accent-primary hover:underline">Get Ollama →</a>
      </div>
    </div>
  )
}

function SettingsField({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={cn('relative inline-flex w-10 h-5 rounded-full transition-colors',
        checked ? 'bg-accent-primary' : 'bg-surface-elevated border border-border-default')}>
      <span className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
        checked ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  )
}
