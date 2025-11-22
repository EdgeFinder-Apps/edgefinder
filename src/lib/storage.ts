import { UserDataset } from '../types'

const STORAGE_KEY = 'arb_finder_dataset'

export const storage = {
  getUserDataset(): UserDataset | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return null
      return JSON.parse(stored)
    } catch {
      return null
    }
  },

  setUserDataset(dataset: UserDataset): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataset))
    } catch (error) {
      console.error('Failed to save dataset:', error)
    }
  },

  clearUserDataset(): void {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error('Failed to clear dataset:', error)
    }
  }
}
