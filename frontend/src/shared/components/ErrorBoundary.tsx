import i18n from 'i18next'
import { Component, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/**
 * Last line of defence: a crash in one screen shows a recovery message instead of a blank page.
 * Production: add `componentDidCatch` here to report errors to a monitoring service (e.g. Sentry).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div
        role="alert"
        className="mx-auto mt-20 max-w-md rounded-lg border border-red-200 bg-white p-6 text-center shadow-sm"
      >
        <h1 className="text-lg font-semibold text-red-700">{i18n.t('crash.title')}</h1>
        <p className="mt-2 text-sm text-stone-600">{i18n.t('crash.text')}</p>
        <button
          type="button"
          className="mt-4 rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800"
          onClick={() => {
            window.location.assign('/')
          }}
        >
          {i18n.t('crash.home')}
        </button>
      </div>
    )
  }
}
