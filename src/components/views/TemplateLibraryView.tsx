import { useState, useRef } from 'react'
import {
  Search, Plus, Star, Trash2, Edit2, Copy, Check,
  BookOpen, X, ChevronDown, ChevronUp, Tag, Eye, EyeOff, FilePlus, Minus,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useTemplateStore } from '@/store/useTemplateStore'
import { useAppStore } from '@/store/useAppStore'
import type { ParagraphTemplate, TemplateCategory } from '@/types/templates'
import { TEMPLATE_CATEGORY_LABELS, TEMPLATE_CATEGORY_COLORS } from '@/types/templates'
import { applyTemplateVariables, hasVariables, TEMPLATE_VARIABLE_DEFS } from '@/utils/templateVars'
import type { Project } from '@/types'

// ── Category sidebar ──────────────────────────────────────────────────────────

const ALL_CATS: (TemplateCategory | 'all' | 'favorites')[] = [
  'all', 'favorites',
  'introduction', 'methodologie', 'nettoyage', 'ventilation',
  'securite', 'recommandations', 'conclusion', 'general',
]

const CAT_LABELS: Record<string, string> = {
  all:       'Tous',
  favorites: 'Favoris',
  ...TEMPLATE_CATEGORY_LABELS,
}

// ── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({
  template, project, previewMode, onFavorite, onEdit, onDelete, onCopy, onInsertToReport, copiedId,
}: {
  template:          ParagraphTemplate
  project:           Project | undefined
  previewMode:       boolean
  onFavorite:        () => void
  onEdit:            () => void
  onDelete:          () => void
  onCopy:            () => void
  onInsertToReport:  (type: 'subtitle' | 'text') => void
  copiedId:          string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const isCopied  = copiedId === template.id
  const catColor  = TEMPLATE_CATEGORY_COLORS[template.category] ?? 'bg-gray-100 text-gray-600'
  const hasVars   = hasVariables(template.content)

  const resolvedContent = (previewMode && project && hasVars)
    ? applyTemplateVariables(template.content, project)
    : template.content

  const preview = resolvedContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240)

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border transition-all ${
      template.isFavorite
        ? 'border-yellow-300 dark:border-yellow-600/60 shadow-md'
        : 'border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md'
    }`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${catColor}`}>
                {TEMPLATE_CATEGORY_LABELS[template.category]}
              </span>
              {template.isBuiltIn && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                  intégré
                </span>
              )}
              {hasVars && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  previewMode && project
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                }`}>
                  {previewMode && project ? '✓ variables appliquées' : 'contient des variables'}
                </span>
              )}
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{template.title}</h3>
            {template.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{template.description}</p>
            )}
          </div>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={onFavorite}
              title={template.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              className={`p-1.5 rounded-lg transition-colors ${
                template.isFavorite
                  ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                  : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
              }`}
            >
              <Star className="w-3.5 h-3.5" fill={template.isFavorite ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={onCopy}
              title={previewMode && project ? 'Copier avec données projet' : 'Copier HTML brut'}
              className={`p-1.5 rounded-lg transition-colors ${
                isCopied
                  ? 'text-green-600 bg-green-50 dark:bg-green-900/20'
                  : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              }`}
            >
              {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            {!template.isBuiltIn && (
              <>
                <button
                  onClick={onEdit}
                  title="Modifier"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onDelete}
                  title="Supprimer"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
          {expanded ? (
            <div
              className="prose prose-xs dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: resolvedContent }}
            />
          ) : (
            <p className="line-clamp-3">{preview}</p>
          )}
        </div>

        {/* Tags */}
        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {template.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                <Tag className="w-2.5 h-2.5" /> {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-blue-500 transition-colors"
          >
            {expanded
              ? <><ChevronUp className="w-3 h-3" />Réduire</>
              : <><ChevronDown className="w-3 h-3" />Voir le contenu</>}
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 mr-0.5">Insérer comme :</span>
            <button
              onClick={() => onInsertToReport('subtitle')}
              title="Avec titre — sous-section numérotée (1.1, 1.2…) sous le chapitre précédent"
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition-colors"
            >
              <Minus className="w-3 h-3" /> Avec titre
            </button>
            <button
              onClick={() => onInsertToReport('text')}
              title="Sans titre — paragraphe de texte pur"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <FilePlus className="w-3.5 h-3.5" /> Sans titre
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Variables reference panel ─────────────────────────────────────────────────

function VarsPanel({ project }: { project: Project | undefined }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/60 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-gray-500" />
          Variables disponibles
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="p-3 grid grid-cols-2 gap-1.5 bg-white dark:bg-gray-900">
          {TEMPLATE_VARIABLE_DEFS.map(({ key, label }) => {
            const resolved = project ? applyTemplateVariables(key, project) : null
            const hasValue = resolved && resolved !== '___' && !resolved.includes('___')
            return (
              <div key={key} className="flex flex-col gap-0.5 px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800">
                <code className="text-[11px] font-mono text-blue-600 dark:text-blue-400">{key}</code>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">{label}</span>
                {project && (
                  <span className={`text-[10px] font-medium truncate ${
                    hasValue ? 'text-green-700 dark:text-green-400' : 'text-gray-400 italic'
                  }`}>
                    {hasValue ? resolved : '(non renseigné)'}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Edit/Create modal ─────────────────────────────────────────────────────────

function EditModal({
  template, onSave, onClose,
}: {
  template?: ParagraphTemplate
  onSave: (data: Omit<ParagraphTemplate, 'id' | 'createdAt' | 'updatedAt'>) => void
  onClose: () => void
}) {
  const [title,    setTitle]    = useState(template?.title ?? '')
  const [category, setCategory] = useState<TemplateCategory>(template?.category ?? 'general')
  const [content,  setContent]  = useState(template?.content ?? '')
  const [desc,     setDesc]     = useState(template?.description ?? '')
  const [tags,     setTags]     = useState(template?.tags?.join(', ') ?? '')

  const cats = Object.keys(TEMPLATE_CATEGORY_LABELS) as TemplateCategory[]

  function handleSave() {
    if (!title.trim() || !content.trim()) return
    onSave({
      title:       title.trim(),
      category,
      content:     content.trim(),
      description: desc.trim() || undefined,
      isFavorite:  template?.isFavorite ?? false,
      isBuiltIn:   false,
      tags:        tags.split(',').map((t) => t.trim()).filter(Boolean),
    })
  }

  function insertVar(key: string) {
    setContent((c) => c + key)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
            {template ? 'Modifier le modèle' : 'Nouveau modèle de paragraphe'}
          </h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Titre *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titre du paragraphe"
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Catégorie *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none"
              >
                {cats.map((c) => <option key={c} value={c}>{TEMPLATE_CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Description courte</label>
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Description optionnelle"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Contenu HTML *</label>
            {/* Quick-insert variable buttons */}
            <div className="flex flex-wrap gap-1 mb-2">
              {TEMPLATE_VARIABLE_DEFS.map(({ key }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => insertVar(key)}
                  className="text-[10px] font-mono px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
                >
                  {key}
                </button>
              ))}
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              placeholder="<p>Contenu HTML du paragraphe…</p>"
              className="w-full px-3 py-2 text-xs font-mono border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-y"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Mots-clés (virgule)</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="nettoyage, NADCA, conduits…"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || !content.trim()}
            className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-colors"
          >
            {template ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page view ─────────────────────────────────────────────────────────────────

export default function TemplateLibraryView() {
  const templates      = useTemplateStore((s) => s.templates)
  const toggleFavorite = useTemplateStore((s) => s.toggleFavorite)
  const addTemplate    = useTemplateStore((s) => s.addTemplate)
  const updateTemplate = useTemplateStore((s) => s.updateTemplate)
  const deleteTemplate = useTemplateStore((s) => s.deleteTemplate)

  const currentProjectId = useAppStore((s) => s.currentProjectId)
  const project          = useAppStore((s) => s.projects.find((p) => p.id === currentProjectId))

  const [activeTab,    setActiveTab]    = useState<TemplateCategory | 'all' | 'favorites'>('all')
  const [search,       setSearch]       = useState('')
  const [showModal,    setShowModal]    = useState(false)
  const [editTarget,   setEditTarget]   = useState<ParagraphTemplate | undefined>()
  const [copiedId,     setCopiedId]     = useState<string | null>(null)
  const [previewMode,  setPreviewMode]  = useState(true)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const displayed = (() => {
    let list = templates
    if (activeTab === 'favorites') list = list.filter((t) => t.isFavorite)
    else if (activeTab !== 'all') list = list.filter((t) => t.category === activeTab)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.tags?.some((tag) => tag.toLowerCase().includes(q))
      )
    }
    return list
  })()

  function handleCopy(t: ParagraphTemplate) {
    const content = (previewMode && project && hasVariables(t.content))
      ? applyTemplateVariables(t.content, project)
      : t.content
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(t.id)
      toast.success(previewMode && project ? 'Copié avec données projet' : 'HTML brut copié')
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopiedId(null), 2000)
    })
  }

  function handleDelete(id: string) {
    if (window.confirm('Supprimer ce modèle ?')) {
      deleteTemplate(id)
      toast.success('Modèle supprimé')
    }
  }

  function handleSave(data: Omit<ParagraphTemplate, 'id' | 'createdAt' | 'updatedAt'>) {
    if (editTarget) {
      updateTemplate(editTarget.id, data)
      toast.success('Modèle mis à jour')
    } else {
      addTemplate(data)
      toast.success('Modèle créé')
    }
    setShowModal(false)
  }

  function handleInsertToReport(t: ParagraphTemplate, sectionType: 'subtitle' | 'text') {
    const content = (previewMode && project && hasVariables(t.content))
      ? applyTemplateVariables(t.content, project)
      : t.content
    const state = useAppStore.getState()
    const mkId = () => `tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    // "Sous-titre" = section texte AVEC le titre → numérotée 1.1, 1.2… sous le chapitre précédent
    // "Texte libre" = section texte SANS titre → paragraphe pur sans en-tête
    const newSection = sectionType === 'subtitle'
      ? { id: mkId(), type: 'text' as const, title: t.title, content }
      : { id: mkId(), type: 'text' as const, title: '',      content }
    state.setReportSections([...state.reportSections, newSection])
    toast.success(`"${t.title}" inséré comme ${sectionType === 'subtitle' ? 'sous-titre' : 'texte libre'}`)
    window.setAppView('report')
  }

  const builtinCount = templates.filter((t) => t.isBuiltIn).length
  const userCount    = templates.filter((t) => !t.isBuiltIn).length

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 overflow-hidden">

      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30">
            <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Bibliothèque de modèles</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {builtinCount} intégrés · {userCount} personnalisé{userCount !== 1 ? 's' : ''}
              {project && (
                <span className="ml-2 text-blue-600 dark:text-blue-400 font-medium">
                  — {project.name}
                </span>
              )}
            </p>
          </div>
          <div className="flex-1" />

          {/* Preview mode toggle */}
          <button
            onClick={() => setPreviewMode(!previewMode)}
            title={previewMode ? 'Afficher les variables brutes ({{...}})' : 'Afficher avec données projet'}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
              previewMode
                ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400'
                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100'
            }`}
          >
            {previewMode ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {previewMode ? 'Données projet' : 'Variables brutes'}
          </button>

          <button
            onClick={() => { setEditTarget(undefined); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouveau modèle
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par titre, description ou mot-clé…"
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Category sidebar */}
        <nav className="w-44 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 py-2 overflow-y-auto">
          {ALL_CATS.map((cat) => {
            const count =
              cat === 'all'      ? templates.length
              : cat === 'favorites' ? templates.filter((t) => t.isFavorite).length
              : templates.filter((t) => t.category === cat).length
            const active = activeTab === cat
            return (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`w-full flex items-center justify-between px-4 py-2 text-sm transition-colors text-left ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-semibold border-r-2 border-blue-500'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <span>{CAT_LABELS[cat]}</span>
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    active ? 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* Variables panel */}
          <div className="mb-5">
            <VarsPanel project={project} />
          </div>

          {displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <BookOpen className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                {search ? 'Aucun modèle correspondant' : 'Aucun modèle dans cette catégorie'}
              </p>
              {!search && (
                <button
                  onClick={() => { setEditTarget(undefined); setShowModal(true) }}
                  className="mt-3 text-sm text-blue-600 hover:underline"
                >
                  Créer un modèle personnalisé
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {displayed.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  project={project}
                  previewMode={previewMode}
                  onFavorite={() => toggleFavorite(t.id)}
                  onEdit={() => { setEditTarget(t); setShowModal(true) }}
                  onDelete={() => handleDelete(t.id)}
                  onCopy={() => handleCopy(t)}
                  onInsertToReport={(type) => handleInsertToReport(t, type)}
                  copiedId={copiedId}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <EditModal
          template={editTarget}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
