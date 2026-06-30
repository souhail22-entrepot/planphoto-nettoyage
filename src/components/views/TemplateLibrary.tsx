import { useState } from 'react'
import { X, Star, Search, BookOpen, Plus, Trash2 } from 'lucide-react'
import { useTemplateStore } from '@/store/useTemplateStore'
import { TEMPLATE_CATEGORY_LABELS, TEMPLATE_CATEGORY_COLORS } from '@/types/templates'
import type { TemplateCategory } from '@/types/templates'
import toast from 'react-hot-toast'

interface Props {
  open: boolean
  onClose: () => void
  onInsert: (content: string, title: string) => void
}

export default function TemplateLibrary({ open, onClose, onInsert }: Props) {
  const { templates, toggleFavorite, deleteTemplate } = useTemplateStore()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<TemplateCategory | 'all'>('all')
  const [favOnly, setFavOnly] = useState(false)

  if (!open) return null

  const filtered = templates.filter((t) => {
    if (favOnly && !t.isFavorite) return false
    if (category !== 'all' && t.category !== category) return false
    if (search) {
      const q = search.toLowerCase()
      return t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)
    }
    return true
  })

  const categories = ['all', ...Object.keys(TEMPLATE_CATEGORY_LABELS)] as (TemplateCategory | 'all')[]

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-lg bg-white shadow-2xl flex flex-col h-full animate-slide-in">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <BookOpen className="w-5 h-5 text-primary-600" />
          <h2 className="font-bold text-gray-900 flex-1">Bibliothèque de modèles</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search + filters */}
        <div className="px-4 py-3 border-b border-gray-100 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                  category === cat
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat === 'all' ? 'Tous' : TEMPLATE_CATEGORY_LABELS[cat as TemplateCategory]}
              </button>
            ))}
            <button
              onClick={() => setFavOnly(!favOnly)}
              className={`ml-auto flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-colors ${
                favOnly ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <Star className="w-3 h-3" /> Favoris
            </button>
          </div>
        </div>

        {/* Templates list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <BookOpen className="w-10 h-10 mx-auto mb-2 text-gray-200" />
              <p>Aucun modèle trouvé</p>
            </div>
          ) : (
            filtered.map((t) => (
              <div key={t.id} className="border-b border-gray-50 px-5 py-3 hover:bg-gray-50 group transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 text-sm">{t.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${TEMPLATE_CATEGORY_COLORS[t.category]}`}>
                        {TEMPLATE_CATEGORY_LABELS[t.category]}
                      </span>
                    </div>
                    {t.description && (
                      <p className="text-xs text-gray-400">{t.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => toggleFavorite(t.id)} className="p-1.5 rounded hover:bg-yellow-100 transition-colors">
                      <Star className={`w-3.5 h-3.5 ${t.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
                    </button>
                    {!t.isBuiltIn && (
                      <button onClick={() => { deleteTemplate(t.id); toast.success('Modèle supprimé') }}
                        className="p-1.5 rounded hover:bg-red-100 transition-colors">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => { onInsert(t.content, t.title); onClose() }}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Insérer ce modèle
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
