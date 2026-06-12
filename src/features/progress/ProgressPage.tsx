import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { Flame, Zap, Trophy, Sparkles, Loader2, Lock, TrendingUp } from 'lucide-react'
import { useActivityStore, BADGES } from '@/store/activityStore'
import { useCourseStore } from '@/store/courseStore'
import { useAppStore } from '@/store/appStore'
import { aiService, streamToString } from '@/services/ai'
import { xpForLevel } from '@/types/activity'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { eachDayOfInterval, subDays, format, isSameDay } from 'date-fns'

const TOOLTIP_STYLE = { background: '#1F1F2E', border: '1px solid #2A2A3D', borderRadius: 8, fontSize: 12 }

export function ProgressPage() {
  const stats = useActivityStore((s) => s.stats)
  const recent = useActivityStore((s) => s.recent)
  const weekActivity = useActivityStore((s) => s.weekActivity)
  const earnedBadges = useActivityStore((s) => s.earnedBadges)
  const load = useActivityStore((s) => s.load)
  const courses = useCourseStore((s) => s.courses)
  const toast = useAppStore((s) => s.addToast)
  const [report, setReport] = useState('')
  const [reportLoading, setReportLoading] = useState(false)

  useEffect(() => { void load() }, [load])

  // Time by subject (from week activity durations)
  const timeBySubject = courses.map((c) => {
    const seconds = weekActivity.filter((a) => a.courseId === c.id).reduce((sum, a) => sum + (a.durationSeconds ?? 0), 0)
    return { name: c.name, value: Math.round(seconds / 36) / 100, color: c.color }
  }).filter((d) => d.value > 0)

  // Productivity by hour
  const byHour = Array.from({ length: 24 }, (_, h) => ({
    hour: h, count: weekActivity.filter((a) => a.loggedAt.getHours() === h).length,
  }))

  // 12-week heatmap
  const heatmapDays = eachDayOfInterval({ start: subDays(new Date(), 83), end: new Date() })
  const intensity = (day: Date) => weekActivity.filter((a) => isSameDay(a.loggedAt, day)).length

  const generateReport = async () => {
    if (!aiService.isConfigured) { toast({ type: 'warning', title: 'Set up AI in Settings' }); return }
    setReportLoading(true)
    try {
      const data = `Study hours this week: ${(weekActivity.reduce((s, a) => s + (a.durationSeconds ?? 0), 0) / 3600).toFixed(1)}h. ` +
        `Activities: ${weekActivity.length}. Streak: ${stats?.currentStreak ?? 0} days. ` +
        `Flashcards reviewed: ${stats?.totalFlashcardsReviewed ?? 0}. Level: ${stats?.level ?? 1}.`
      const text = await streamToString(await aiService.generateCoachReport(data))
      setReport(text)
    } catch { toast({ type: 'error', title: 'Failed to generate report' }) }
    finally { setReportLoading(false) }
  }

  if (!stats) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-accent-primary" /></div>

  const xpThisLevel = stats.totalXP - Array.from({ length: stats.level - 1 }, (_, i) => xpForLevel(i + 1)).reduce((a, b) => a + b, 0)
  const xpNeeded = xpForLevel(stats.level)
  const levelProgress = Math.min(100, (xpThisLevel / xpNeeded) * 100)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <h1 className="text-xl font-bold text-text-primary">Progress</h1>

      {/* Level + XP + Streak */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 p-5 rounded-xl bg-surface border border-border-subtle">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-accent-primary/15 flex items-center justify-center">
              <Zap size={22} className="text-accent-primary" />
            </div>
            <div>
              <p className="text-lg font-bold text-text-primary">Level {stats.level}</p>
              <p className="text-xs text-text-muted">{stats.totalXP.toLocaleString()} XP total</p>
            </div>
          </div>
          <div className="h-2 rounded-full bg-surface-elevated overflow-hidden">
            <div className="h-full bg-accent-primary transition-all" style={{ width: `${levelProgress}%` }} />
          </div>
          <p className="text-xs text-text-muted mt-1.5">{Math.max(0, xpNeeded - xpThisLevel)} XP to level {stats.level + 1}</p>
        </div>

        <div className="p-5 rounded-xl bg-warning/10 border border-warning/20 flex items-center gap-3">
          <Flame size={32} className={cn('text-orange-400', stats.currentStreak > 0 && 'animate-streak-flame')} />
          <div>
            <p className="text-2xl font-bold text-text-primary">{stats.currentStreak}</p>
            <p className="text-xs text-text-muted">day streak · best {stats.longestStreak}</p>
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile icon={TrendingUp} label="Study hours" value={stats.totalStudyHours.toFixed(1)} />
        <StatTile icon={Sparkles} label="Flashcards" value={`${stats.totalFlashcardsReviewed}`} />
        <StatTile icon={Trophy} label="Tasks done" value={`${stats.totalTasksCompleted}`} />
        <StatTile icon={Zap} label="Badges" value={`${earnedBadges.length}/${BADGES.length}`} />
      </div>


      {/* Heatmap */}
      <Panel title="Activity Heatmap (12 weeks)">
        <div className="flex flex-wrap gap-1">
          {heatmapDays.map((day) => {
            const level = Math.min(4, intensity(day))
            const bg = ['#1F1F2E', '#2d4a3e', '#2e7d5b', '#3ECFB2', '#7CFFD8'][level]
            return <div key={day.toISOString()} title={`${format(day, 'MMM d')}: ${intensity(day)} activities`}
              className="w-3 h-3 rounded-sm" style={{ backgroundColor: bg }} />
          })}
        </div>
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Time by subject */}
        <Panel title="Time by Subject (this week)">
          {timeBySubject.length === 0 ? <Empty text="No study time logged yet" /> : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={timeBySubject} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {timeBySubject.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => `${v}h`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Productivity by hour */}
        <Panel title="Productivity by Hour">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byHour}>
              <XAxis dataKey="hour" tick={{ fill: '#55556A', fontSize: 9 }} axisLine={false} tickLine={false} interval={3} />
              <YAxis tick={{ fill: '#55556A', fontSize: 9 }} axisLine={false} tickLine={false} width={18} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(124,111,255,0.1)' }} />
              <Bar dataKey="count" fill="#7C6FFF" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* AI Weekly Coach */}
      <Panel title="AI Study Coach" action={<Button size="sm" variant="outline" onClick={generateReport} disabled={reportLoading}>{reportLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Generate weekly report</Button>}>
        {report ? (
          <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">{report}</p>
        ) : (
          <p className="text-sm text-text-muted">Get a personalized weekly review of your study habits, retention trends, and actionable advice.</p>
        )}
      </Panel>

      {/* Badges */}
      <Panel title="Achievements">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {BADGES.map((b) => {
            const earned = earnedBadges.includes(b.id)
            return (
              <div key={b.id} className={cn('flex items-center gap-2.5 p-2.5 rounded-lg border', earned ? 'border-accent-primary/30 bg-accent-primary/5' : 'border-border-subtle bg-surface/50 opacity-60')}>
                <span className="text-xl">{earned ? b.emoji : <Lock size={16} className="text-text-muted" />}</span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">{b.name}</p>
                  <p className="text-2xs text-text-muted truncate">{b.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </Panel>

      {/* Recent activity */}
      <Panel title="Recent Activity">
        {recent.length === 0 ? <Empty text="No activity yet — start studying!" /> : (
          <div className="space-y-1.5">
            {recent.slice(0, 10).map((a) => (
              <div key={a.id} className="flex items-center gap-3 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-primary" />
                <span className="text-text-secondary capitalize flex-1">{a.actionType.replace(/_/g, ' ')}</span>
                <span className="text-xs text-text-muted">{format(a.loggedAt, 'MMM d, HH:mm')}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}

function StatTile({ icon: Icon, label, value }: { icon: typeof Flame; label: string; value: string }) {
  return (
    <div className="p-4 rounded-xl bg-surface border border-border-subtle">
      <Icon size={16} className="text-accent-primary mb-2" />
      <p className="text-xl font-bold text-text-primary">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  )
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface border border-border-subtle overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle">
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-text-muted text-center py-6">{text}</p>
}
