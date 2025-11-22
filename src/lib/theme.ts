const THEME_KEY = 'arb_finder_theme'

export type Theme = 'light' | 'dark'

export const theme = {
  get(): Theme {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark') return stored
    
    // respect system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  },

  set(newTheme: Theme): void {
    localStorage.setItem(THEME_KEY, newTheme)
    this.apply(newTheme)
  },

  apply(currentTheme: Theme): void {
    const root = document.documentElement
    if (currentTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  },

  toggle(): Theme {
    const current = this.get()
    const next = current === 'light' ? 'dark' : 'light'
    this.set(next)
    return next
  },

  initialize(): void {
    this.apply(this.get())
  }
}
