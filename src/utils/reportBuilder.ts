/**
 * Générateur de rapport CVAC piloté exclusivement par les données du projet.
 * Aucune dépendance au gabarit statique REPORT_GABARIT_NADCA.
 * Seul le type GabaritSection est importé (pas le tableau de données).
 */

import type {
  Project, TravailNettoyage, Plan, Systeme,
  ReportSection, TextReportSection, EquipmentItem, ObservationItem, TypeAnomalie,
} from '@/types'
import type { GabaritSection } from '@/data/reportGabarit'
import { COMPOSANTES_CVAC, ANOMALIE_LABELS } from '@/types'

// ── Groupes de composantes ────────────────────────────────────────────────────

const CONDUIT_TYPES = new Set([
  'conduit_alimentation_principal', 'conduit_alimentation_secondaire',
  'conduit_retour', 'conduit_air_frais', 'conduit_air_vicie',
  'conduit_evacuation', 'transfert', 'plenum',
])
const UTA_TYPES = new Set([
  'unite', 'compartiment_ventilateur', 'compartiment_filtres',
  'compartiment_melange', 'compartiment_serpentins',
  'plenum_air_frais', 'plenum_air_vicie',
])
const HOTTE_TYPES   = new Set(['hotte_cuisine'])
const EXTRAC_TYPES  = new Set(['extracteur_sdb'])
const GRILLE_TYPES  = new Set(['grille_diffuseur'])

const isConduit    = (t: TravailNettoyage) => CONDUIT_TYPES.has(t.typeComposante ?? '')
const isUTA        = (t: TravailNettoyage) => UTA_TYPES.has(t.typeComposante ?? '')
const isHotte      = (t: TravailNettoyage) => HOTTE_TYPES.has(t.typeComposante ?? '')
const isExtracteur = (t: TravailNettoyage) => EXTRAC_TYPES.has(t.typeComposante ?? '')
const isGrille     = (t: TravailNettoyage) => GRILLE_TYPES.has(t.typeComposante ?? '')
const isDone       = (t: TravailNettoyage) => t.statut === 'complete' || t.statut === 'valide'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })
}

function compLabel(type?: string): string {
  if (!type) return ''
  return (COMPOSANTES_CVAC as Record<string, { label: string }>)[type]?.label ?? type
}

function irsst(n?: number | null): string {
  if (!n) return '—'
  const L: Record<number, string> = {
    1: 'N1 — Tres propre',
    2: 'N2 — Film mince',
    3: 'N3 — Sale',
    4: 'N4 — Tres sale',
  }
  return L[n] ?? `N${n}`
}

function addr(p: Project): string {
  return [p.adresse, p.ville, p.codePostal].filter(Boolean).join(', ') || '—'
}

function techFull(p: Project): string {
  return [p.technicien?.trim(), p.technicienTitre?.trim()].filter(Boolean).join(', ') || '—'
}

function verFull(p: Project): string {
  return [p.verificateur?.trim(), p.verificateurTitre?.trim()].filter(Boolean).join(', ') || '—'
}

function refs(p: Project): string {
  const parts: string[] = []
  const n = p.contrat?.trim() || p.mandat?.trim()
  if (n) parts.push(`contrat n° ${n}`)
  if (p.bonCommande?.trim())     parts.push(`B.C. : ${p.bonCommande.trim()}`)
  if (p.referenceClient?.trim()) parts.push(`ref. client : ${p.referenceClient.trim()}`)
  return parts.join(' · ') || p.name || '—'
}

function sysName(t: TravailNettoyage, project: Project): string {
  return project.systemes?.find(s => s.id === t.systemeId)?.nom ?? '—'
}

function li(text: string): string { return `  <li>${text}</li>` }
function ul(items: string[]): string { return `<ul>\n${items.join('\n')}\n</ul>` }
function p(text: string): string { return `<p>${text}</p>` }
function strong(text: string): string { return `<strong>${text}</strong>` }

function table(head: string[], rows: string[][]): string {
  const th = head.map(h => `<th>${h}</th>`).join('')
  const trs = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('\n')
  return `<table>\n  <thead><tr>${th}</tr></thead>\n  <tbody>\n${trs}\n  </tbody>\n</table>`
}

// ── Générateur principal ──────────────────────────────────────────────────────

export function buildProjectReport(
  project: Project,
  travaux: TravailNettoyage[],
  plans: Plan[],
): GabaritSection[] {
  const sections: GabaritSection[] = []
  const add = (s: GabaritSection) => sections.push(s)
  const sub = (title: string) => add({ type: 'subtitle', title })
  const txt = (title: string, content: string) => add({ type: 'text', title, content })
  const eqList = (title: string) => add({ type: 'equipment_list', title })
  const obs = (title: string) => add({ type: 'observations', title })

  // ── Analyse des données ──────────────────────────────────────────────────────
  const conduits    = travaux.filter(isConduit)
  const utaList     = travaux.filter(isUTA)
  const hottes      = travaux.filter(isHotte)
  const extracteurs = travaux.filter(isExtracteur)
  const grilles     = travaux.filter(isGrille)
  const completed   = travaux.filter(isDone)

  const hasConduits    = conduits.length > 0
  const hasUTA         = utaList.length > 0
  const hasHottes      = hottes.length > 0
  const hasExtracteurs = extracteurs.length > 0
  const hasGrilles     = grilles.length > 0
  const hasAnomalies   = travaux.some(t => (t.anomalies?.length ?? 0) > 0)
  const hasIRSST       = travaux.some(t => t.niveauSalubriteInitial || t.niveauSalubriteFinal)
  const nbOuvertures   = plans.reduce((a, pl) => a + (pl.accessDoors?.length ?? 0), 0)
  const hasAccessDoors = nbOuvertures > 0
  const allDone        = travaux.length > 0 && completed.length === travaux.length

  const totalLongueur = conduits.reduce((a, t) => {
    const l = parseFloat(t.longueur ?? '')
    return isNaN(l) ? a : a + l
  }, 0)

  const nbSys   = project.systemes?.length ?? 0
  const sysNoms = project.systemes?.map(s => s.nom).join(', ') || '—'

  // Conteurs de sous-sections par chapitre
  let n1 = 0, n3 = 0, n4 = 0
  const s1 = () => `1.${++n1}`
  const s3 = () => `3.${++n3}`
  const s4 = () => `4.${++n4}`

  // ════════════════════════════════════════════════════════════════════════════
  //  RÉSUMÉ EXÉCUTIF
  // ════════════════════════════════════════════════════════════════════════════
  sub('Resume executif')

  const vol: string[] = []
  if (hasConduits)    vol.push(`${conduits.length} section(s) de conduits${totalLongueur > 0 ? ` (${totalLongueur.toFixed(1)} m)` : ''}`)
  if (hasUTA)         vol.push(`${utaList.length} composante(s) d'UTA`)
  if (hasGrilles)     vol.push(`${grilles.length} grille(s) / diffuseur(s)`)
  if (hasHottes)      vol.push(`${hottes.length} hotte(s) de cuisine`)
  if (hasExtracteurs) vol.push(`${extracteurs.length} extracteur(s) local(aux)`)

  let execContent = p(`Travaux realises pour ${strong(project.client || '—')} — batiment situe au ${strong(addr(project))}${project.dateDebut && project.dateFin ? `, du ${strong(fmtDate(project.dateDebut))} au ${strong(fmtDate(project.dateFin))}` : ''}.`)

  if (travaux.length > 0) {
    execContent += p(`${strong(String(travaux.length))} fiche(s) de nettoyage couvrant ${strong(String(nbSys))} systeme(s)${nbSys > 0 ? ` (${sysNoms})` : ''}${vol.length > 0 ? ` : ${vol.join(', ')}` : ''}.`)
    const nbAno = travaux.reduce((a, t) => a + (t.anomalies?.length ?? 0), 0)
    execContent += hasAnomalies
      ? p(`${strong(String(nbAno))} anomalie(s) relevee(s) — suivi requis (voir section 4).`)
      : p('Aucune anomalie relevee lors des travaux.')
    execContent += p(`Avancement : ${strong(`${completed.length}/${travaux.length}`)} fiches completees.`)
  } else {
    execContent += p('Aucune fiche de nettoyage documentee pour ce projet.')
  }

  txt('', execContent)

  // ════════════════════════════════════════════════════════════════════════════
  //  1. INTRODUCTION
  // ════════════════════════════════════════════════════════════════════════════
  sub('1. Introduction')

  // 1.1 Mandat
  txt(
    `${s1()} Mandat`,
    p(`Mandat confie par ${strong(project.client || '—')} (${refs(project)}). Travaux realises du ${strong(fmtDate(project.dateDebut))} au ${strong(fmtDate(project.dateFin))} au batiment situe au ${strong(addr(project))}.`) +
    p(`Rapport prepare par ${strong(techFull(project))}, revise par ${strong(verFull(project))}.`),
  )

  // 1.2 Portee — uniquement ce qui a ete realise
  const porteeItems: string[] = []
  if (hasConduits)    porteeItems.push(`nettoyage de ${conduits.length} section(s) de conduits`)
  if (hasUTA)         porteeItems.push(`nettoyage de ${utaList.length} composante(s) d'unites de traitement d'air`)
  if (hasGrilles)     porteeItems.push(`nettoyage de ${grilles.length} grille(s) et diffuseur(s)`)
  if (hasHottes)      porteeItems.push(`nettoyage de ${hottes.length} hotte(s) de cuisine (NFPA 96)`)
  if (hasExtracteurs) porteeItems.push(`nettoyage de ${extracteurs.length} extracteur(s) local(aux)`)
  if (hasAccessDoors) porteeItems.push(`creation de ${nbOuvertures} ouverture(s) d'acces permanente(s)`)
  porteeItems.push('documentation photographique avant et apres nettoyage')
  porteeItems.push('redaction du present rapport')

  let porteeContent = ''
  if (nbSys > 0) {
    const sysItems = project.systemes!.map(s => `<li>${strong(s.nom)}${s.description ? ` — ${s.description}` : ''}</li>`).join('')
    porteeContent += p('Systemes vises :') + `<ul>${sysItems}</ul>`
  }
  porteeContent += p('Travaux realises :') + ul(porteeItems.map(li))

  txt(`${s1()} Portee des travaux`, porteeContent)

  // 1.3 Inventaire des composantes
  eqList(`${s1()} Inventaire des composantes traitees`)

  // ════════════════════════════════════════════════════════════════════════════
  //  2. NORMES ET METHODOLOGIE
  // ════════════════════════════════════════════════════════════════════════════
  sub('2. Normes et methodologie')

  const norms = [
    `${strong('NADCA ACR 2021')} — methodes de nettoyage, criteres de proprete, documentation`,
    `${strong('IRSST R-525')} — niveaux de salubrite 1–4 ; nettoyage requis a partir du niveau 3`,
  ]
  if (hasHottes) norms.push(`${strong('NFPA 96')} — hottes de cuisine et conduits d'extraction`)
  norms.push(`${strong('ASHRAE 62.1')} — qualite de l'air a la remise en service`)

  txt('2.1 Normes de reference', ul(norms.map(li)))

  txt(
    '2.2 Methode de nettoyage',
    p(`Methode mecanique par contact (NADCA ACR 2021) : mise en depression HEPA >= 99,97 % en continu, brossage rotatif motorise des parois internes, isolation des zones traitees. Les contaminants mobilises sont captes sans remise en suspension.`),
  )

  // ════════════════════════════════════════════════════════════════════════════
  //  3. RESULTATS DU NETTOYAGE
  // ════════════════════════════════════════════════════════════════════════════
  sub('3. Resultats du nettoyage')

  // 3.x Synthese — uniquement si des travaux existent
  if (travaux.length > 0) {
    const synthRows: string[][] = []
    if (hasConduits)    synthRows.push(['Conduits', `${conduits.length}${totalLongueur > 0 ? ` / ${totalLongueur.toFixed(1)} m` : ''}`, String(conduits.filter(isDone).length)])
    if (hasUTA)         synthRows.push(["Composantes UTA", String(utaList.length), String(utaList.filter(isDone).length)])
    if (hasGrilles)     synthRows.push(['Grilles et diffuseurs', String(grilles.length), String(grilles.filter(isDone).length)])
    if (hasHottes)      synthRows.push(['Hottes de cuisine', String(hottes.length), String(hottes.filter(isDone).length)])
    if (hasExtracteurs) synthRows.push(['Extracteurs locaux', String(extracteurs.length), String(extracteurs.filter(isDone).length)])
    if (hasAccessDoors) synthRows.push(["Ouvertures d'acces creees", String(nbOuvertures), '—'])

    txt(
      `${s3()} Synthese des travaux`,
      p(`${strong(String(travaux.length))} fiche(s) — ${nbSys} systeme(s) (${sysNoms}). ${completed.length} sur ${travaux.length} completees.`) +
      table(['Composante', 'Quantite', 'Completees'], synthRows),
    )
  }

  // 3.x Niveaux IRSST — uniquement si documentes
  if (hasIRSST) {
    const irows = travaux
      .filter(t => t.niveauSalubriteInitial || t.niveauSalubriteFinal)
      .map(t => [sysName(t, project), t.location || compLabel(t.typeComposante), irsst(t.niveauSalubriteInitial), irsst(t.niveauSalubriteFinal)])

    txt(
      `${s3()} Niveaux de salubrite IRSST`,
      table(['Systeme', 'Composante / localisation', 'Avant', 'Apres'], irows),
    )
  }

  // 3.x Conduits — uniquement si des conduits ont ete nettoyes
  if (hasConduits) {
    let c = p(`${strong(String(conduits.length))} section(s) de conduits nettoyees${totalLongueur > 0 ? ` — longueur totale documentee : ${strong(totalLongueur.toFixed(1) + ' m')}` : ''}.`)

    const obsAvant = conduits.filter(t => t.observationsAvant?.trim())
    const obsApres = conduits.filter(t => t.observationsApres?.trim())

    if (obsAvant.length > 0) {
      c += p(strong('Observations avant :'))
      c += ul(obsAvant.map(t => li(`${sysName(t, project)} — ${t.location || compLabel(t.typeComposante)} : ${t.observationsAvant}`)))
    }
    if (obsApres.length > 0) {
      c += p(strong('Observations apres :'))
      c += ul(obsApres.map(t => li(`${sysName(t, project)} — ${t.location || compLabel(t.typeComposante)} : ${t.observationsApres}`)))
    }

    txt(`${s3()} Nettoyage des reseaux de conduits`, c)
  }

  // 3.x UTA — uniquement si des composantes UTA ont ete nettoyees
  if (hasUTA) {
    const byType: Record<string, TravailNettoyage[]> = {}
    for (const t of utaList) {
      const k = t.typeComposante ?? 'autre'
      ;(byType[k] = byType[k] ?? []).push(t)
    }
    const utaRows = Object.entries(byType).map(([tp, items]) => [compLabel(tp), String(items.length), String(items.filter(isDone).length)])

    let c = p(`${strong(String(utaList.length))} composante(s) d'unites de traitement d'air nettoyees :`) +
      table(['Type', 'Quantite', 'Completees'], utaRows)

    const obs2 = utaList.filter(t => t.observationsAvant?.trim() || t.observationsApres?.trim())
    if (obs2.length > 0) {
      c += p(strong('Observations terrain :'))
      const items: string[] = []
      for (const t of obs2) {
        if (t.observationsAvant?.trim()) items.push(li(`${sysName(t, project)} — ${compLabel(t.typeComposante)} (avant) : ${t.observationsAvant}`))
        if (t.observationsApres?.trim()) items.push(li(`${sysName(t, project)} — ${compLabel(t.typeComposante)} (apres) : ${t.observationsApres}`))
      }
      c += ul(items)
    }

    txt(`${s3()} Nettoyage des unites de traitement d'air`, c)
  }

  // 3.x Hottes — SEULEMENT si type hotte_cuisine dans les travaux
  if (hasHottes) {
    let c = p(`${strong(String(hottes.length))} hotte(s) de cuisine nettoyees conformement a NFPA 96 (degraissage surfaces internes, filtres a graisse, conduits d'extraction, volets coupe-feu).`)

    const obs2 = hottes.filter(t => t.observationsAvant?.trim() || t.observationsApres?.trim())
    if (obs2.length > 0) {
      c += p(strong('Observations terrain :'))
      const items: string[] = []
      for (const t of obs2) {
        if (t.observationsAvant?.trim()) items.push(li(`${sysName(t, project)} (avant) : ${t.observationsAvant}`))
        if (t.observationsApres?.trim()) items.push(li(`${sysName(t, project)} (apres) : ${t.observationsApres}`))
      }
      c += ul(items)
    }

    txt(`${s3()} Nettoyage des hottes de cuisine`, c)
  }

  // 3.x Extracteurs — uniquement si presents
  if (hasExtracteurs) {
    txt(
      `${s3()} Nettoyage des extracteurs locaux`,
      p(`${strong(String(extracteurs.length))} extracteur(s) de salle de bain / local technique nettoyes (aspiration des pales, grilles et conduits accessibles).`),
    )
  }

  // 3.x Ouvertures d'acces — uniquement si creees
  if (hasAccessDoors) {
    txt(
      `${s3()} Ouvertures d'acces`,
      p(`${strong(String(nbOuvertures))} ouverture(s) d'acces pratiquees dans les reseaux et refermees avec panneaux etanches. Localisation sur les plans annotes en annexe.`),
    )
  }

  // 3.x Anomalies — SEULEMENT si documentes dans les fiches
  if (hasAnomalies) {
    obs(`${s3()} Anomalies et deficiences relevees`)
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  4. RECOMMANDATIONS
  // ════════════════════════════════════════════════════════════════════════════
  sub('4. Recommandations')

  // 4.x Maintenance
  const maintItems: string[] = [
    `${strong('Mensuel')} — Remplacement des filtres selon le delta-P ; nettoyage des grilles accessibles`,
  ]
  if (hasUTA)    maintItems.push(`${strong('Trimestriel')} — Inspection visuelle des bacs de condensat des UTA ; verification des volets coupe-feu`)
  if (hasHottes) maintItems.push(`${strong('Trimestriel / semestriel')} — Nettoyage des hottes de cuisine selon NFPA 96 (frequence selon intensite d'usage)`)
  maintItems.push(`${strong('Annuel')} — Inspection photographique des conduits principaux${hasUTA ? ' ; nettoyage des composantes internes des UTA' : ''}`)
  maintItems.push(`${strong('Tous les 3 a 5 ans')} — Nettoyage complet du reseau de conduits (selon resultats des inspections annuelles)`)

  txt(`${s4()} Programme de maintenance preventive`, ul(maintItems.map(li)))

  // 4.x Frequences
  const freqRows: string[][] = [
    ['Conduits principaux', 'Tous les 3 a 5 ans', 'NADCA ACR 2021'],
  ]
  if (hasUTA)    freqRows.push(['Composantes internes UTA', 'Annuellement', 'NADCA ACR 2021'])
  freqRows.push(['Filtres', 'Selon delta-P', 'Fabricant'])
  if (hasHottes) {
    freqRows.push(["Hottes — usage intensif (restaurant)", 'Trimestriellement', 'NFPA 96 — Art. 11.6.2'])
    freqRows.push(["Hottes — usage modere (cafeteria)", 'Semestriellement', 'NFPA 96 — Art. 11.6.2'])
  }
  if (hasGrilles) freqRows.push(['Grilles et diffuseurs', 'Tous les 2 ans', 'Bonne pratique'])

  txt(`${s4()} Frequences recommandees`, table(['Composante', 'Frequence', 'Reference'], freqRows))

  // 4.x Suivi anomalies — SEULEMENT si anomalies documentees
  if (hasAnomalies) {
    txt(
      `${s4()} Suivi des anomalies`,
      ul([
        li(`${strong('Immediat (0–15 j)')} — Anomalies presentant un risque pour la securite ou l'integrite des equipements`),
        li(`${strong('Court terme (15–60 j)')} — Deficiences affectant l'efficacite des systemes`),
        li(`${strong('Moyen terme (1–3 mois)')} — Corrections planifiables dans la maintenance reguliere`),
      ]),
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  5. CONCLUSION
  // ════════════════════════════════════════════════════════════════════════════
  sub('5. Conclusion')

  // 5.1 Attestation — jamais automatiquement "conforme NADCA" sans donnees
  let attestContent: string
  if (allDone) {
    attestContent =
      p(`Les travaux de nettoyage realises pour le compte de ${strong(project.client || '—')} ont ete executes conformement aux methodes prevues au mandat. L'ensemble des ${strong(String(travaux.length))} fiche(s) sont marquees comme completees.`) +
      p(`Rapport prepare par : ${strong(techFull(project))}`) +
      p(`Revise par : ${strong(verFull(project))}`)
  } else if (travaux.length > 0) {
    attestContent =
      p(`Les travaux documentes ont ete realises pour le compte de ${strong(project.client || '—')} selon les methodes prevues au mandat. ${strong(`${completed.length}`)} fiche(s) sur ${strong(String(travaux.length))} sont marquees comme completees.`) +
      p(`Rapport prepare par : ${strong(techFull(project))}`) +
      p(`Revise par : ${strong(verFull(project))}`)
  } else {
    attestContent =
      p(`Les travaux ont ete realises pour le compte de ${strong(project.client || '—')} selon les methodes prevues au mandat.`) +
      p(`Rapport prepare par : ${strong(techFull(project))}`) +
      p(`Revise par : ${strong(verFull(project))}`)
  }

  txt('5.1 Attestation', attestContent)

  // 5.2 Limitations
  txt(
    '5.2 Portee et limitations',
    ul([
      li('Couvre exclusivement les systemes et composantes designes a la section 1.2'),
      li('Sections structurellement inaccessibles : non traitees, non couvertes par le present rapport'),
      li('Evaluation visuelle uniquement — aucune analyse microbiologique ou prelevement d\'air'),
      li("L'etat des systemes peut evoluer selon l'intensite d'utilisation et les pratiques d'entretien ulterieures"),
    ]),
  )

  return sections
}

// ─────────────────────────────────────────────────────────────────────────────
// COUCHE 2 — DONNÉES CONSOLIDÉES + SECTIONS PDF
// Source de vérité pour generateReport() — aucune logique métier dans pdfGenerator
// ─────────────────────────────────────────────────────────────────────────────

interface ProjectReportData {
  project:     Project
  systemes:    Systeme[]
  plans:       Plan[]
  travaux:     TravailNettoyage[]
  conduits:    TravailNettoyage[]
  utaList:     TravailNettoyage[]
  hottes:      TravailNettoyage[]
  extracteurs: TravailNettoyage[]
  grilles:     TravailNettoyage[]
  completed:   TravailNettoyage[]
  hasConduits:    boolean
  hasUTA:         boolean
  hasHottes:      boolean
  hasExtracteurs: boolean
  hasGrilles:     boolean
  hasAnomalies:   boolean
  hasIRSST:       boolean
  hasAccessDoors: boolean
  allComplete:    boolean
  totalLongueur:  number
  nbOuvertures:   number
}

function buildProjectData(
  project: Project,
  travaux: TravailNettoyage[],
  plans:   Plan[],
): ProjectReportData {
  const systemes    = project.systemes as Systeme[]
  const conduits    = travaux.filter(t => CONDUIT_TYPES.has(t.typeComposante ?? ''))
  const utaList     = travaux.filter(t => UTA_TYPES.has(t.typeComposante ?? ''))
  const hottes      = travaux.filter(t => HOTTE_TYPES.has(t.typeComposante ?? ''))
  const extracteurs = travaux.filter(t => EXTRAC_TYPES.has(t.typeComposante ?? ''))
  const grilles     = travaux.filter(t => GRILLE_TYPES.has(t.typeComposante ?? ''))
  const completed   = travaux.filter(isDone)
  const totalLongueur = conduits.reduce((a, t) => {
    const l = parseFloat(t.longueur ?? '')
    return isNaN(l) ? a : a + l
  }, 0)
  const nbOuvertures = plans.reduce((a, pl) => a + (pl.accessDoors?.length ?? 0), 0)
  return {
    project, systemes, plans, travaux,
    conduits, utaList, hottes, extracteurs, grilles, completed,
    hasConduits:    conduits.length > 0,
    hasUTA:         utaList.length > 0,
    hasHottes:      hottes.length > 0,
    hasExtracteurs: extracteurs.length > 0,
    hasGrilles:     grilles.length > 0,
    hasAnomalies:   travaux.some(t => (t.anomalies?.length ?? 0) > 0),
    hasIRSST:       travaux.some(t => t.niveauSalubriteInitial || t.niveauSalubriteFinal),
    hasAccessDoors: nbOuvertures > 0,
    allComplete:    travaux.length > 0 && completed.length === travaux.length,
    totalLongueur,
    nbOuvertures,
  }
}

function buildReportSections(d: ProjectReportData): ReportSection[] {
  const out: ReportSection[] = []
  let _id = 0
  const mkId = () => `rs_${++_id}`

  // HTML helpers (valeurs directement résolues — pas de {{variables}})
  const hp     = (t: string) => `<p>${t}</p>`
  const hs     = (t: string) => `<strong>${t}</strong>`
  const hli    = (t: string) => `  <li>${t}</li>`
  const hul    = (items: string[]) => `<ul>\n${items.join('\n')}\n</ul>`
  const htable = (head: string[], rows: string[][]) => {
    const th  = head.map(h => `<th>${h}</th>`).join('')
    const trs = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('\n')
    return `<table>\n  <thead><tr>${th}</tr></thead>\n  <tbody>\n${trs}\n  </tbody>\n</table>`
  }

  const addSub = (title: string) =>
    out.push({ id: mkId(), type: 'subtitle', title } as ReportSection)
  const addTxt = (title: string, content: string) =>
    out.push({ id: mkId(), type: 'text', title, content } as ReportSection)
  const addEq = (title: string, items: EquipmentItem[]) =>
    out.push({ id: mkId(), type: 'equipment_list', title, items } as ReportSection)
  const addObs = (title: string, items: ObservationItem[]) =>
    out.push({ id: mkId(), type: 'observations', title, items } as ReportSection)

  const { project, systemes, travaux, conduits, utaList, hottes, extracteurs, grilles, completed } = d

  const fmtDate = (iso?: string) => {
    if (!iso) return '—'
    const dt = new Date(iso)
    return isNaN(dt.getTime()) ? iso : dt.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  const sysNom   = (t: TravailNettoyage) => systemes.find(s => s.id === t.systemeId)?.nom ?? '—'
  const compLbl  = (tp?: string) => (COMPOSANTES_CVAC as Record<string, { label: string }>)[tp ?? '']?.label ?? tp ?? ''
  const irsstLbl = (n?: number | null) => {
    if (!n) return '—'
    const L: Record<number, string> = { 1: 'N1 — Tres propre', 2: 'N2 — Film mince', 3: 'N3 — Sale', 4: 'N4 — Tres sale' }
    return L[n] ?? `N${n}`
  }
  const STATUT_LBL: Record<string, string> = { a_faire: 'A faire', en_cours: 'En cours', complete: 'Complete', valide: 'Valide' }
  const anoSev = (type: string): 'info' | 'attention' | 'critique' => {
    if (type === 'moisissure' || type === 'fuite') return 'critique'
    if (type === 'corrosion' || type === 'obstruction') return 'attention'
    return 'info'
  }
  const isDn    = (t: TravailNettoyage) => t.statut === 'complete' || t.statut === 'valide'
  const addr    = [project.adresse, project.ville, project.codePostal].filter(Boolean).join(', ') || '—'
  const techF   = [project.technicien?.trim(), project.technicienTitre?.trim()].filter(Boolean).join(', ') || '—'
  const verF    = [project.verificateur?.trim(), project.verificateurTitre?.trim()].filter(Boolean).join(', ') || '—'
  const nbSys   = systemes.length
  const sysNoms = systemes.map(s => s.nom).join(', ') || '—'
  let n3 = 0, n4 = 0
  const s3 = () => `3.${++n3}`, s4 = () => `4.${++n4}`

  // ── Résumé exécutif ────────────────────────────────────────────────────────
  addSub('Resume executif')
  const vol: string[] = []
  if (d.hasConduits)    vol.push(`${conduits.length} section(s) de conduits${d.totalLongueur > 0 ? ` (${d.totalLongueur.toFixed(1)} m)` : ''}`)
  if (d.hasUTA)         vol.push(`${utaList.length} composante(s) d'UTA`)
  if (d.hasGrilles)     vol.push(`${grilles.length} grille(s) / diffuseur(s)`)
  if (d.hasHottes)      vol.push(`${hottes.length} hotte(s) de cuisine`)
  if (d.hasExtracteurs) vol.push(`${extracteurs.length} extracteur(s) local(aux)`)
  let exec = hp(`Travaux realises pour ${hs(project.client || '—')} — batiment : ${hs(addr)}${project.dateDebut && project.dateFin ? `, du ${hs(fmtDate(project.dateDebut))} au ${hs(fmtDate(project.dateFin))}` : ''}.`)
  if (travaux.length > 0) {
    exec += hp(`${hs(String(travaux.length))} fiche(s) de nettoyage — ${nbSys} systeme(s)${nbSys > 0 ? ` (${sysNoms})` : ''}${vol.length > 0 ? ` : ${vol.join(', ')}` : ''}.`)
    const nbAno = travaux.reduce((a, t) => a + (t.anomalies?.length ?? 0), 0)
    exec += d.hasAnomalies
      ? hp(`${hs(String(nbAno))} anomalie(s) relevee(s) — suivi requis (section 4).`)
      : hp('Aucune anomalie relevee lors des travaux.')
    exec += hp(`Avancement : ${hs(`${completed.length}/${travaux.length}`)} fiches completees.`)
  } else {
    exec += hp('Aucune fiche de nettoyage documentee pour ce projet.')
  }
  addTxt('', exec)

  // ── 1. Introduction ────────────────────────────────────────────────────────
  addSub('1. Introduction')
  addTxt('1.1 Mandat',
    hp(`Mandat confie par ${hs(project.client || '—')}. Travaux realises du ${hs(fmtDate(project.dateDebut))} au ${hs(fmtDate(project.dateFin))} au ${hs(addr)}.`) +
    hp(`Rapport prepare par ${hs(techF)}, revise par ${hs(verF)}.`)
  )
  const porteeItems: string[] = []
  if (d.hasConduits)    porteeItems.push(`Nettoyage de ${conduits.length} section(s) de conduits`)
  if (d.hasUTA)         porteeItems.push(`Nettoyage de ${utaList.length} composante(s) d'unites de traitement d'air`)
  if (d.hasGrilles)     porteeItems.push(`Nettoyage de ${grilles.length} grille(s) et diffuseur(s)`)
  if (d.hasHottes)      porteeItems.push(`Nettoyage de ${hottes.length} hotte(s) de cuisine (NFPA 96)`)
  if (d.hasExtracteurs) porteeItems.push(`Nettoyage de ${extracteurs.length} extracteur(s) local(aux)`)
  if (d.hasAccessDoors) porteeItems.push(`Creation de ${d.nbOuvertures} ouverture(s) d'acces permanente(s)`)
  porteeItems.push('Documentation photographique avant et apres nettoyage')
  let porteeHtml = ''
  if (nbSys > 0) {
    porteeHtml += hp('Systemes vises :') +
      `<ul>${systemes.map(s => `<li>${hs(s.nom)}${s.description ? ` — ${s.description}` : ''}</li>`).join('')}</ul>`
  }
  porteeHtml += hp('Travaux realises :') + hul(porteeItems.map(hli))
  addTxt('1.2 Portee des travaux', porteeHtml)

  // Inventaire — rempli avec les travaux réels
  const invItems: EquipmentItem[] = travaux.map(t => ({
    id:           t.id,
    systeme:      sysNom(t),
    composante:   compLbl(t.typeComposante),
    zone:         t.location ?? t.zoneDesservie ?? '',
    etat:         STATUT_LBL[t.statut] ?? t.statut,
    observations: t.observationsApres?.trim() ?? '',
  }))
  if (invItems.length > 0) addEq('1.3 Inventaire des composantes traitees', invItems)

  // ── 2. Normes et méthodologie ──────────────────────────────────────────────
  addSub('2. Normes et methodologie')
  const norms = [
    `${hs('NADCA ACR 2021')} — methodes de nettoyage, criteres de proprete, documentation`,
    `${hs('IRSST R-525')} — niveaux de salubrite 1 a 4 ; nettoyage requis a partir du niveau 3`,
  ]
  if (d.hasHottes) norms.push(`${hs('NFPA 96')} — hottes de cuisine et conduits d'extraction`)
  norms.push(`${hs('ASHRAE 62.1')} — qualite de l'air a la remise en service`)
  addTxt('2.1 Normes de reference', hul(norms.map(hli)))
  addTxt('2.2 Methode de nettoyage',
    hp('Methode mecanique par contact (NADCA ACR 2021) : mise en depression avec filtration HEPA >= 99,97 % en continu, brossage rotatif motorise des parois internes, isolation des zones traitees.') +
    hp("Les contaminants mobilises sont captes sans remise en suspension dans l'environnement.")
  )

  // ── 3. Résultats du nettoyage ──────────────────────────────────────────────
  addSub('3. Resultats du nettoyage')

  if (travaux.length > 0) {
    const synthRows: string[][] = []
    if (d.hasConduits)    synthRows.push(['Conduits', `${conduits.length}${d.totalLongueur > 0 ? ` / ${d.totalLongueur.toFixed(1)} m` : ''}`, String(conduits.filter(isDn).length)])
    if (d.hasUTA)         synthRows.push(["Composantes UTA", String(utaList.length), String(utaList.filter(isDn).length)])
    if (d.hasGrilles)     synthRows.push(['Grilles / diffuseurs', String(grilles.length), String(grilles.filter(isDn).length)])
    if (d.hasHottes)      synthRows.push(['Hottes de cuisine', String(hottes.length), String(hottes.filter(isDn).length)])
    if (d.hasExtracteurs) synthRows.push(['Extracteurs locaux', String(extracteurs.length), String(extracteurs.filter(isDn).length)])
    if (d.hasAccessDoors) synthRows.push(["Ouvertures d'acces", String(d.nbOuvertures), '—'])
    addTxt(`${s3()} Synthese`,
      hp(`${hs(String(travaux.length))} fiche(s) — ${nbSys} systeme(s) (${sysNoms}). ${hs(`${completed.length}/${travaux.length}`)} completees.`) +
      htable(['Composante', 'Quantite', 'Completees'], synthRows)
    )
  }

  if (d.hasIRSST) {
    const irows = travaux
      .filter(t => t.niveauSalubriteInitial || t.niveauSalubriteFinal)
      .map(t => [sysNom(t), t.location || compLbl(t.typeComposante), irsstLbl(t.niveauSalubriteInitial), irsstLbl(t.niveauSalubriteFinal)])
    addTxt(`${s3()} Niveaux de salubrite IRSST`, htable(['Systeme', 'Composante', 'Avant', 'Apres'], irows))
  }

  if (d.hasConduits) {
    let c = hp(`${hs(String(conduits.length))} section(s) de conduits nettoyees${d.totalLongueur > 0 ? ` — longueur totale : ${hs(d.totalLongueur.toFixed(1) + ' m')}` : ''}.`)
    const obs1 = conduits.filter(t => t.observationsAvant?.trim())
    const obs2 = conduits.filter(t => t.observationsApres?.trim())
    if (obs1.length > 0) { c += hp(hs('Observations avant :')); c += hul(obs1.map(t => hli(`${sysNom(t)} — ${t.location || compLbl(t.typeComposante)} : ${t.observationsAvant}`))) }
    if (obs2.length > 0) { c += hp(hs('Observations apres :')); c += hul(obs2.map(t => hli(`${sysNom(t)} — ${t.location || compLbl(t.typeComposante)} : ${t.observationsApres}`))) }
    addTxt(`${s3()} Conduits`, c)
  }

  if (d.hasUTA) {
    const byType: Record<string, TravailNettoyage[]> = {}
    for (const t of utaList) { const k = t.typeComposante ?? 'autre'; (byType[k] = byType[k] ?? []).push(t) }
    const rows = Object.entries(byType).map(([tp, items]) => [compLbl(tp), String(items.length), String(items.filter(isDn).length)])
    let c = hp(`${hs(String(utaList.length))} composante(s) d'UTA nettoyees.`) + htable(['Type', 'Quantite', 'Completees'], rows)
    const obs2 = utaList.filter(t => t.observationsAvant?.trim() || t.observationsApres?.trim())
    if (obs2.length > 0) {
      c += hp(hs('Observations terrain :'))
      const items: string[] = []
      for (const t of obs2) {
        if (t.observationsAvant?.trim()) items.push(hli(`${sysNom(t)} — ${compLbl(t.typeComposante)} (avant) : ${t.observationsAvant}`))
        if (t.observationsApres?.trim()) items.push(hli(`${sysNom(t)} — ${compLbl(t.typeComposante)} (apres) : ${t.observationsApres}`))
      }
      c += hul(items)
    }
    addTxt(`${s3()} Unites de traitement d'air`, c)
  }

  if (d.hasHottes) {
    let c = hp(`${hs(String(hottes.length))} hotte(s) de cuisine nettoyees conformement a NFPA 96 (degraissage, filtres a graisse, conduits d'extraction, volets coupe-feu).`)
    const obs2 = hottes.filter(t => t.observationsAvant?.trim() || t.observationsApres?.trim())
    if (obs2.length > 0) {
      c += hp(hs('Observations terrain :'))
      const items: string[] = []
      for (const t of obs2) {
        if (t.observationsAvant?.trim()) items.push(hli(`${sysNom(t)} (avant) : ${t.observationsAvant}`))
        if (t.observationsApres?.trim()) items.push(hli(`${sysNom(t)} (apres) : ${t.observationsApres}`))
      }
      c += hul(items)
    }
    addTxt(`${s3()} Hottes de cuisine`, c)
  }

  if (d.hasExtracteurs) {
    addTxt(`${s3()} Extracteurs locaux`, hp(`${hs(String(extracteurs.length))} extracteur(s) de salle de bain / local technique nettoyes.`))
  }

  if (d.hasAccessDoors) {
    addTxt(`${s3()} Ouvertures d'acces`,
      hp(`${hs(String(d.nbOuvertures))} ouverture(s) d'acces pratiquees dans les reseaux et refermees avec panneaux etanches. Localisation sur les plans en annexe.`)
    )
  }

  if (d.hasAnomalies) {
    const anoItems: ObservationItem[] = []
    for (const t of travaux) {
      for (const ano of (t.anomalies ?? [])) {
        anoItems.push({
          id:       ano.id,
          severity: anoSev(ano.type),
          text:     `[${sysNom(t)} — ${compLbl(t.typeComposante)}] ${ANOMALIE_LABELS[ano.type as TypeAnomalie] ?? ano.type} : ${ano.description}`,
          photos:   [],
        })
      }
    }
    addObs(`${s3()} Anomalies et deficiences`, anoItems)
  }

  // ── 4. Recommandations ─────────────────────────────────────────────────────
  addSub('4. Recommandations')
  const maintItems: string[] = [`${hs('Mensuel')} — Remplacement des filtres selon le delta-P`]
  if (d.hasUTA)    maintItems.push(`${hs('Trimestriel')} — Inspection visuelle bacs de condensat ; volets coupe-feu`)
  if (d.hasHottes) maintItems.push(`${hs('Trimestriel / semestriel')} — Nettoyage des hottes selon NFPA 96`)
  maintItems.push(`${hs('Annuel')} — Inspection photographique des conduits principaux`)
  maintItems.push(`${hs('Tous les 3 a 5 ans')} — Nettoyage complet du reseau`)
  addTxt(`${s4()} Programme de maintenance preventive`, hul(maintItems.map(hli)))

  const freqRows: string[][] = [['Conduits principaux', 'Tous les 3 a 5 ans', 'NADCA ACR 2021']]
  if (d.hasUTA)    freqRows.push(['Composantes UTA', 'Annuellement', 'NADCA ACR 2021'])
  freqRows.push(['Filtres', 'Selon delta-P', 'Fabricant'])
  if (d.hasHottes) {
    freqRows.push(['Hottes — restaurant', 'Trimestriellement', 'NFPA 96 Art. 11.6.2'])
    freqRows.push(['Hottes — cafeteria', 'Semestriellement', 'NFPA 96 Art. 11.6.2'])
  }
  addTxt(`${s4()} Frequences recommandees`, htable(['Composante', 'Frequence', 'Reference'], freqRows))

  if (d.hasAnomalies) {
    addTxt(`${s4()} Suivi des anomalies`,
      hul([
        hli(`${hs('Immediat (0–15 j)')} — Anomalies presentant un risque pour la securite`),
        hli(`${hs('Court terme (15–60 j)')} — Deficiences affectant l'efficacite des systemes`),
        hli(`${hs('Moyen terme (1–3 mois)')} — Corrections planifiables en maintenance reguliere`),
      ])
    )
  }

  // ── 5. Conclusion ──────────────────────────────────────────────────────────
  addSub('5. Conclusion')

  let attest: string
  if (d.allComplete) {
    attest = hp(`Les travaux realises pour le compte de ${hs(project.client || '—')} ont ete executes conformement aux methodes prevues. L'ensemble des ${hs(String(travaux.length))} fiche(s) sont completees.`)
  } else if (travaux.length > 0) {
    attest = hp(`Les travaux documentes ont ete realises pour le compte de ${hs(project.client || '—')} selon les methodes prevues. ${hs(`${completed.length}`)} fiche(s) sur ${hs(String(travaux.length))} completees.`)
  } else {
    attest = hp(`Les travaux ont ete realises pour le compte de ${hs(project.client || '—')} selon les methodes prevues au mandat.`)
  }
  attest += hp(`Rapport prepare par : ${hs(techF)}`) + hp(`Revise par : ${hs(verF)}`)
  addTxt('5.1 Attestation', attest)

  addTxt('5.2 Portee et limitations',
    hul([
      hli('Couvre exclusivement les systemes et composantes designes a la section 1.2'),
      hli("Sections structurellement inaccessibles : non traitees, non couvertes"),
      hli("Evaluation visuelle uniquement — aucune analyse microbiologique"),
      hli("L'etat des systemes peut evoluer selon l'intensite d'utilisation"),
    ])
  )

  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// API PUBLIQUE — une seule fonction exposée vers l'extérieur : buildReport()
// Toutes les fonctions ci-dessous sont privées au module.
// ─────────────────────────────────────────────────────────────────────────────

function buildFinalSections(
  data: ProjectReportData,
  uiSections: ReportSection[],
): ReportSection[] {
  const technical = buildReportSections(data)

  const narrative = uiSections.filter(
    (s): s is TextReportSection =>
      s.type === 'text' && !!((s as TextReportSection).content?.trim()),
  )

  if (narrative.length === 0) return technical

  return [
    ...technical,
    { id: 'usr_sub', type: 'subtitle', title: 'Commentaires et precisions' } as ReportSection,
    ...narrative,
  ]
}

/**
 * Point d'entrée unique côté domaine.
 * Appelé par l'UI avant generateReport() — le PDF ne connaît que le résultat.
 */
export function buildReport(
  project: Project,
  travaux: TravailNettoyage[],
  plans: Plan[],
  uiSections: ReportSection[],
): ReportSection[] {
  return buildFinalSections(buildProjectData(project, travaux, plans), uiSections)
}
