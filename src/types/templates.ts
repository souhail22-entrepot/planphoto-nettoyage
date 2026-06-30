export type TemplateCategory =
  | 'general' | 'introduction' | 'methodologie' | 'nettoyage'
  | 'ventilation' | 'securite' | 'recommandations' | 'conclusion'

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  general:          'Général',
  introduction:     'Introduction',
  methodologie:     'Méthodologie',
  nettoyage:        'Nettoyage',
  ventilation:      'Ventilation',
  securite:         'Sécurité',
  recommandations:  'Recommandations',
  conclusion:       'Conclusion',
}

export const TEMPLATE_CATEGORY_COLORS: Record<TemplateCategory, string> = {
  general:         'bg-gray-100 text-gray-700',
  introduction:    'bg-blue-100 text-blue-700',
  methodologie:    'bg-indigo-100 text-indigo-700',
  nettoyage:       'bg-primary-100 text-primary-700',
  ventilation:     'bg-cyan-100 text-cyan-700',
  securite:        'bg-red-100 text-red-700',
  recommandations: 'bg-yellow-100 text-yellow-700',
  conclusion:      'bg-purple-100 text-purple-700',
}

export interface ParagraphTemplate {
  id: string
  title: string
  category: TemplateCategory
  content: string
  description?: string
  isFavorite: boolean
  isBuiltIn: boolean
  tags: string[]
  createdAt: string
  updatedAt: string
}
