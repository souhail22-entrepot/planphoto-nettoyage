import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ParagraphTemplate, TemplateCategory } from '@/types/templates'
import { BUILTIN_TEMPLATES } from '@/data/builtinTemplates'

interface TemplateState {
  templates: ParagraphTemplate[]
  addTemplate:      (t: Omit<ParagraphTemplate, 'id' | 'createdAt' | 'updatedAt'>) => ParagraphTemplate
  updateTemplate:   (id: string, data: Partial<Omit<ParagraphTemplate, 'id' | 'isBuiltIn'>>) => void
  deleteTemplate:   (id: string) => void
  toggleFavorite:   (id: string) => void
  reorderTemplates: (fromId: string, toId: string) => void
  getByCategory:    (cat: TemplateCategory | 'all' | 'favorites') => ParagraphTemplate[]
  searchTemplates:  (q: string) => ParagraphTemplate[]
}

export const useTemplateStore = create<TemplateState>()(
  persist(
    (set, get) => ({
      templates: [...BUILTIN_TEMPLATES],

      addTemplate: (t) => {
        const now = new Date().toISOString()
        const newT: ParagraphTemplate = { ...t, id: `ut-${Date.now()}`, createdAt: now, updatedAt: now }
        set((s) => ({ templates: [...s.templates, newT] }))
        return newT
      },

      updateTemplate: (id, data) =>
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === id && !t.isBuiltIn
              ? { ...t, ...data, updatedAt: new Date().toISOString() }
              : t
          ),
        })),

      deleteTemplate: (id) =>
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id || t.isBuiltIn) })),

      toggleFavorite: (id) =>
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === id ? { ...t, isFavorite: !t.isFavorite } : t
          ),
        })),

      reorderTemplates: (fromId, toId) =>
        set((s) => {
          const list = [...s.templates]
          const from = list.findIndex((t) => t.id === fromId)
          const to   = list.findIndex((t) => t.id === toId)
          if (from === -1 || to === -1 || from === to) return s
          const [moved] = list.splice(from, 1)
          list.splice(to, 0, moved)
          return { templates: list }
        }),

      getByCategory: (cat) => {
        const { templates } = get()
        if (cat === 'favorites') return templates.filter((t) => t.isFavorite)
        if (cat === 'all')       return templates
        return templates.filter((t) => t.category === cat)
      },

      searchTemplates: (q) => {
        if (!q.trim()) return get().templates
        const lq = q.toLowerCase()
        return get().templates.filter(
          (t) =>
            t.title.toLowerCase().includes(lq) ||
            t.description?.toLowerCase().includes(lq) ||
            t.tags?.some((tag) => tag.toLowerCase().includes(lq))
        )
      },
    }),
    {
      name: 'nettoyage-templates',
      partialize: (s) => ({
        templates: [
          ...s.templates.filter((t) => t.isBuiltIn).map((t) => ({ id: t.id, isFavorite: t.isFavorite })),
          ...s.templates.filter((t) => !t.isBuiltIn),
        ],
      }),
      merge: (persisted: any, current) => {
        const stored: any[] = persisted?.templates ?? []
        const storedFavs = new Map<string, boolean>(
          stored
            .filter((t) => BUILTIN_TEMPLATES.some((b) => b.id === t.id))
            .map((t) => [t.id, t.isFavorite ?? false]),
        )
        const userTemplates = stored.filter(
          (t) => !BUILTIN_TEMPLATES.some((b) => b.id === t.id),
        )
        return {
          ...current,
          templates: [
            ...BUILTIN_TEMPLATES.map((b) => ({ ...b, isFavorite: storedFavs.get(b.id) ?? b.isFavorite })),
            ...userTemplates,
          ],
        }
      },
    }
  )
)
