import { BookCopy, Plus } from 'lucide-react'
import { useCourseStore } from '@/store/courseStore'
import { useNavigate, useParams } from 'react-router-dom'
import { randomCourseColor } from '@/lib/utils'

export function CoursesPage() {
  const { courseId } = useParams()
  const courses = useCourseStore((s) => s.courses)
  const createCourse = useCourseStore((s) => s.create)
  const navigate = useNavigate()

  const selectedCourse = courseId ? courses.find((c) => c.id === courseId) : null

  if (selectedCourse) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-4xl">{selectedCourse.icon}</span>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{selectedCourse.name}</h1>
            {selectedCourse.professor && <p className="text-text-muted text-sm">{selectedCourse.professor}</p>}
          </div>
        </div>
        <p className="text-text-muted text-sm">Full course overview with linked notebooks, PDFs, flashcards, assignments, and AI readiness score coming in Step 7 (Course Intelligence module).</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-text-primary">Courses</h1>
        <button
          onClick={async () => {
            const c = await createCourse({ name: 'New Course', icon: '📚', color: randomCourseColor(), semester: null, professor: null, courseCode: null, schedule: [], room: null, zoomLink: null, syllabusDocumentId: null, isActive: true })
            navigate(`/courses/${c.id}`)
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent-primary text-white text-sm hover:bg-accent-hover transition-colors"
        >
          <Plus size={14} /> New Course
        </button>
      </div>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <BookCopy size={40} className="text-text-muted" />
          <div>
            <h2 className="text-lg font-semibold text-text-primary">No courses yet</h2>
            <p className="text-text-muted text-sm mt-1">Add your first course to organize all your study materials</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
            <button key={course.id} onClick={() => navigate(`/courses/${course.id}`)}
              className="flex items-center gap-3 p-4 rounded-xl bg-surface border border-border-subtle hover:border-border-default transition-colors text-left"
              style={{ borderLeftColor: course.color, borderLeftWidth: '3px' }}>
              <span className="text-2xl">{course.icon}</span>
              <div className="min-w-0">
                <p className="font-medium text-text-primary truncate">{course.name}</p>
                {course.semester && <p className="text-xs text-text-muted">{course.semester}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
