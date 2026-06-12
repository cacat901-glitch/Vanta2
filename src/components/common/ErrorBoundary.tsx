import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error)
  }

  reset = () => this.setState({ hasError: false, message: '' })

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-danger/10 flex items-center justify-center">
            <AlertTriangle size={26} className="text-danger" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Something went wrong</h2>
            <p className="text-sm text-text-muted mt-1 max-w-md">{this.state.message || 'An unexpected error occurred in this view.'}</p>
          </div>
          <button onClick={this.reset} className="px-4 py-2 rounded-lg bg-accent-primary text-white text-sm hover:bg-accent-hover transition-colors">
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
