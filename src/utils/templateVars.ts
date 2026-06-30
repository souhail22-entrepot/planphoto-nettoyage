import type { Project } from '@/types'

/** Toutes les variables disponibles dans les modèles de paragraphes */
export const TEMPLATE_VARIABLE_DEFS = [
  { key: '{{client}}',           label: 'Nom du client' },
  { key: '{{adresse}}',          label: 'Adresse complète du projet' },
  { key: '{{ville}}',            label: 'Ville' },
  { key: '{{date}}',             label: 'Date de début des travaux' },
  { key: '{{dateFin}}',          label: 'Date de fin des travaux' },
  { key: '{{numProjet}}',        label: 'N° de contrat / projet' },
  { key: '{{mandat}}',           label: 'Mandat' },
  { key: '{{bonCommande}}',      label: 'Bon de commande' },
  { key: '{{referenceClient}}',  label: 'Référence client' },
  { key: '{{technicien}}',       label: 'Technicien responsable' },
  { key: '{{technicienFull}}',   label: 'Technicien (nom + titre)' },
  { key: '{{verificateur}}',     label: 'Vérificateur' },
  { key: '{{verificateurFull}}', label: 'Vérificateur (nom + titre)' },
  { key: '{{refsFull}}',         label: 'Références du dossier (contrat · B.C. · réf. client)' },
  { key: '{{systemes}}',         label: 'Systèmes CVAC (liste courte)' },
  { key: '{{systemes_liste}}',   label: 'Systèmes CVAC (liste HTML)' },
  { key: '{{nbSystemes}}',       label: 'Nombre de systèmes' },
  { key: '{{nbLogements}}',       label: 'Nombre de logements' },
  { key: '{{nbAppartements}}',    label: 'Nombre d\'appartements traités (= logements)' },
  { key: '{{systemes_tableau}}',  label: 'Systèmes CVAC (tableau HTML)' },
  { key: '{{nomImmeuble}}',       label: 'Nom de l\'immeuble' },
  { key: '{{typeBatiment}}',      label: 'Type de bâtiment' },
  { key: '{{nbEtages}}',          label: 'Nombre d\'étages' },
  { key: '{{zonesSpecifiques}}',  label: 'Zones spécifiques' },
  { key: '{{anneeConstruction}}', label: 'Année de construction' },
] as const

export type TemplateVarKey = typeof TEMPLATE_VARIABLE_DEFS[number]['key']

/** Formate une date ISO en date française lisible (ex. 2026-06-19 → 19 juin 2026) */
function formatDate(iso?: string): string {
  if (!iso) return '___'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Adresse complète sur une ligne */
function fullAddress(project: Project): string {
  const parts = [project.adresse, project.ville, project.codePostal].filter(Boolean)
  return parts.join(', ') || '___'
}

/** Liste des noms de systèmes séparés par des virgules */
function systemesInline(project: Project): string {
  if (!project.systemes?.length) return '___'
  return project.systemes.map((s) => s.nom).join(', ')
}

/** Liste HTML des systèmes */
function systemesHtml(project: Project): string {
  if (!project.systemes?.length) return '<em>(aucun système défini)</em>'
  const items = project.systemes
    .map((s) => `<li><strong>${s.nom}</strong>${s.description ? ` — ${s.description}` : ''}</li>`)
    .join('')
  return `<ul>${items}</ul>`
}

/** Tableau HTML des systèmes CVAC — colonnes No / Système / Type / Description */
function systemesTableau(project: Project): string {
  if (!project.systemes?.length) return '<em>(aucun système défini dans le projet)</em>'
  const rows = project.systemes.map((s, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td><strong>${s.nom}</strong></td>
      <td>${s.type || '—'}</td>
      <td>${s.description || '—'}</td>
    </tr>`).join('')
  return `<table>
  <thead>
    <tr>
      <th>N°</th>
      <th>Système</th>
      <th>Type</th>
      <th>Description / Zone desservie</th>
    </tr>
  </thead>
  <tbody>${rows}
  </tbody>
</table>`
}

/** Technicien : nom + titre si disponible */
function technicienFull(project: Project): string {
  const nom   = project.technicien?.trim()
  const titre = project.technicienTitre?.trim()
  if (nom && titre) return `${nom}, ${titre}`
  return nom || '___'
}

/** Vérificateur : nom + titre si disponible */
function verificateurFull(project: Project): string {
  const nom   = project.verificateur?.trim()
  const titre = project.verificateurTitre?.trim()
  if (nom && titre) return `${nom}, ${titre}`
  return nom || '___'
}

/** Références combinées du dossier : contrat · bon de commande · réf. client */
function refsFull(project: Project): string {
  const parts: string[] = []
  const num = project.contrat?.trim() || project.mandat?.trim()
  if (num) parts.push(`contrat n° ${num}`)
  if (project.bonCommande?.trim())     parts.push(`bon de commande : ${project.bonCommande.trim()}`)
  if (project.referenceClient?.trim()) parts.push(`réf. client : ${project.referenceClient.trim()}`)
  return parts.length ? parts.join(' · ') : project.name || '___'
}

/** Remplace toutes les variables du contenu par les données réelles du projet */
export function applyTemplateVariables(content: string, project: Project): string {
  const adresse   = fullAddress(project)
  const ville     = project.ville ?? ''
  const numProjet = project.contrat || project.mandat || project.name || '___'
  const systemes  = systemesInline(project)
  const systemesL = systemesHtml(project)
  const nbSys     = String(project.systemes?.length ?? 0)

  return content
    .replace(/\{\{client\}\}/g,           project.client || '___')
    .replace(/\{\{adresse\}\}/g,          adresse)
    .replace(/\{\{ville\}\}/g,            ville)
    .replace(/\{\{date\}\}/g,             formatDate(project.dateDebut))
    .replace(/\{\{dateFin\}\}/g,          formatDate(project.dateFin))
    .replace(/\{\{numProjet\}\}/g,        numProjet)
    .replace(/\{\{mandat\}\}/g,           project.mandat || '___')
    .replace(/\{\{bonCommande\}\}/g,      project.bonCommande?.trim() || '')
    .replace(/\{\{referenceClient\}\}/g,  project.referenceClient?.trim() || '')
    .replace(/\{\{technicien\}\}/g,       project.technicien || '___')
    .replace(/\{\{technicienFull\}\}/g,   technicienFull(project))
    .replace(/\{\{verificateur\}\}/g,     project.verificateur || '___')
    .replace(/\{\{verificateurFull\}\}/g, verificateurFull(project))
    .replace(/\{\{refsFull\}\}/g,         refsFull(project))
    .replace(/\{\{systemes\}\}/g,         systemes)
    .replace(/\{\{systemes_liste\}\}/g,   systemesL)
    .replace(/\{\{nbSystemes\}\}/g,       nbSys)
    .replace(/\{\{nbLogements\}\}/g,       project.nbLogements       || '___')
    .replace(/\{\{nbAppartements\}\}/g,   project.nbLogements       || '___')
    .replace(/\{\{systemes_tableau\}\}/g,  systemesTableau(project))
    .replace(/\{\{nomImmeuble\}\}/g,       project.nomImmeuble       || '—')
    .replace(/\{\{typeBatiment\}\}/g,      project.typeBatiment      || '—')
    .replace(/\{\{nbEtages\}\}/g,          project.nbEtages          || '—')
    .replace(/\{\{zonesSpecifiques\}\}/g,  project.zonesSpecifiques  || '—')
    .replace(/\{\{anneeConstruction\}\}/g, project.anneeConstruction || '—')
}

/** Retourne true si le contenu contient au moins une variable */
export function hasVariables(content: string): boolean {
  return /\{\{[^}]+\}\}/.test(content)
}
