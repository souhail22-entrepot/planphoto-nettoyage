import jsPDF from 'jspdf'
import type { Project, PlanDebit, PointDebit, Systeme } from '@/types'
import { TYPE_POINT_DEBIT, METHODE_MESURE_LABELS } from '@/types'
import { drawCoverPage, drawTextPageHeader, drawSectionPageFooter } from './pdfGenerator'

// Libellé affiché dans l'en-tête (même forme que « Rapport de nettoyage — conduits de ventilation »)
const HEADER_LABEL = "Rapport de mesures de débit d'air"

// ── Palette ──────────────────────────────────────────────────────────────────
const BLUE:  [number,number,number] = [27,  79,  138]
const LGRAY: [number,number,number] = [100, 116, 139]
const LBLUE: [number,number,number] = [235, 242, 250]
const DGRAY: [number,number,number] = [55,  65,  81]
const WHITE: [number,number,number] = [255, 255, 255]

// ── A4 portrait ──────────────────────────────────────────────────────────────
const PW   = 210
const PH   = 297
const ML   = 14
const MR   = 14
const UW   = PW - ML - MR

// Zone de contenu utile — mêmes bornes que les pages « rapport écrit » du rapport de
// nettoyage (BODY_TOP = S_MT 10 + S_HDR_H 35 + 3 ; BODY_BOT = S_PH 297 - S_MB 10 - S_FTR_H 14 - 2).
const CONTENT_TOP    = 48
const CONTENT_BOTTOM = 271

const safe = (v: any) => (v == null ? '' : String(v))

// ── Couleurs par type ─────────────────────────────────────────────────────────
function typeRGB(type: string): [number,number,number] {
  if (type === 'diffuseur')  return [37,  99, 235]
  if (type === 'reprise')    return [5,  150, 105]
  if (type === 'extraction') return [220, 38,  38]
  return [100, 116, 139]
}

// ── Tableau comparatif ────────────────────────────────────────────────────────
// Async : peut ajouter des pages (en-tête/pied répétés) si le tableau ne tient pas
// en une page — jamais de lignes tronquées silencieusement.
async function drawTable(
  pdf: jsPDF,
  project: Project,
  points: PointDebit[],
  unite: string,
  startY: number,
  systemes: Systeme[] = [],
  pageRef: { n: number } = { n: 0 },
  // 'systeme' (défaut) : colonne Système — utilisé quand un même tableau mélange plusieurs
  // systèmes (ex. par plan). 'plan' : colonne Plan — utilisé quand le tableau est déjà scindé
  // par système (la colonne Système y serait redondante) et regroupe plusieurs plans.
  refColumn: 'systeme' | 'plan' = 'systeme',
  plansDebit: PlanDebit[] = [],
): Promise<number> {
  const sorted = [...points].sort((a, b) => a.identifiant.localeCompare(b.identifiant, 'fr', { numeric: true }))

  // Colonnes redistributées pour donner plus de place aux observations
  const obsW = UW - 14 - 18 - 24 - 16 - 24 - 24 - 14 - 14
  const cols = [
    { label: 'ID',               w: 14,   align: 'left'  as const },
    { label: refColumn === 'plan' ? 'Plan' : 'Système', w: 18, align: 'left' as const },
    { label: 'Local / Zone',      w: 24,   align: 'left'  as const },
    { label: 'Méthode',           w: 16,   align: 'left'  as const },
    { label: `Avant (${unite})`,  w: 24,   align: 'right' as const },
    { label: `Après (${unite})`,  w: 24,   align: 'right' as const },
    { label: 'Écart',             w: 14,   align: 'right' as const },
    { label: 'Var. %',            w: 14,   align: 'right' as const },
    { label: 'Observations / Conditions', w: obsW, align: 'left' as const },
  ]

  const OBS_IDX = 8
  const BASE_ROW_H = 6.5
  const LINE_H     = 3.6  // hauteur d'une ligne supplémentaire

  let y = startY

  const drawHeaderRow = () => {
    pdf.setFillColor(...BLUE)
    pdf.rect(ML, y, UW, BASE_ROW_H, 'F')
    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...WHITE)
    let hx = ML
    for (const col of cols) {
      const tx = col.align === 'right' ? hx + col.w - 2 : hx + 2
      pdf.text(col.label, tx, y + 4.2, { align: col.align })
      hx += col.w
    }
    y += BASE_ROW_H
  }

  const newTablePage = async () => {
    drawSectionPageFooter(pdf)
    pdf.addPage()
    pageRef.n++
    await drawTextPageHeader(pdf, project, pageRef.n, HEADER_LABEL)
    y = CONTENT_TOP
    drawHeaderRow()
  }

  drawHeaderRow()
  let cx = ML

  // Lignes
  pdf.setFont('helvetica', 'normal')
  for (let i = 0; i < sorted.length; i++) {
    const pt  = sorted[i]
    const rgb = typeRGB(pt.type)

    const ecart     = (pt.debitAvant !== undefined && pt.debitApres !== undefined) ? pt.debitApres - pt.debitAvant : null
    const variation = (pt.debitAvant && ecart !== null) ? (ecart / pt.debitAvant) * 100 : null

    const refValue      = refColumn === 'plan'
      ? (plansDebit.find((pl) => pl.id === pt.planDebitId)?.name ?? '—')
      : (systemes.find((s) => s.id === pt.systemeId)?.nom ?? '—')
    const methode       = pt.methode ? (METHODE_MESURE_LABELS[pt.methode] ?? pt.methode) : '—'
    const avantStr      = pt.debitAvant !== undefined
      ? `${pt.debitAvant.toFixed(0)}${pt.dateAvant ? ` (${pt.dateAvant.slice(0, 10)})` : ''}`
      : '—'
    const apresStr      = pt.debitApres !== undefined
      ? `${pt.debitApres.toFixed(0)}${pt.dateApres ? ` (${pt.dateApres.slice(0, 10)})` : ''}`
      : '—'
    const obsConditions = [pt.observations, pt.conditions].filter(Boolean).join(' — ') || ''

    // Calculer le nombre de lignes obs pour déterminer la hauteur de la ligne
    const obsLines = obsConditions ? pdf.splitTextToSize(obsConditions, obsW - 3) : []
    const extraLines = Math.max(0, Math.min(obsLines.length, 3) - 1)
    const rowH = BASE_ROW_H + extraLines * LINE_H

    // Nouvelle page si la ligne ne tient pas — en-tête de tableau répété automatiquement
    if (y + rowH > CONTENT_BOTTOM) {
      await newTablePage()
      cx = ML
    }

    // Fond alterné
    if (i % 2 === 0) {
      pdf.setFillColor(...LBLUE)
      pdf.rect(ML, y, UW, rowH, 'F')
    }

    // Pastille ID
    pdf.setFillColor(...rgb)
    pdf.circle(ML + 3.5, y + BASE_ROW_H / 2, 2.2, 'F')
    pdf.setTextColor(...WHITE)
    pdf.setFontSize(5.5)
    pdf.text(pt.identifiant.length <= 4 ? pt.identifiant : pt.type[0].toUpperCase(), ML + 3.5, y + BASE_ROW_H / 2, { align: 'center', baseline: 'middle' })

    const cells = [
      pt.identifiant,
      refValue,
      pt.local || '—',
      methode,
      avantStr,
      apresStr,
      ecart !== null ? `${ecart >= 0 ? '+' : ''}${ecart.toFixed(0)}` : '—',
      variation !== null ? `${variation >= 0 ? '+' : ''}${variation.toFixed(1)}%` : '—',
      obsConditions,
    ]

    pdf.setFontSize(7)
    cx = ML
    for (let ci = 0; ci < cols.length; ci++) {
      const col = cols[ci]
      if (ci === 0) { cx += col.w; continue }
      const tx = col.align === 'right' ? cx + col.w - 2 : cx + 2
      if (ci === 7 && variation !== null) {
        pdf.setTextColor(variation >= 0 ? 22 : 220, variation >= 0 ? 163 : 38, variation >= 0 ? 74 : 38)
      } else if (ci === 6 && ecart !== null) {
        pdf.setTextColor(ecart >= 0 ? 22 : 220, ecart >= 0 ? 163 : 38, ecart >= 0 ? 74 : 38)
      } else {
        pdf.setTextColor(...DGRAY)
      }
      if (ci === OBS_IDX && obsLines.length > 0) {
        // Observations : jusqu'à 3 lignes
        const linesToDraw = obsLines.slice(0, 3) as string[]
        linesToDraw.forEach((line: string, li: number) => {
          pdf.text(line, tx, y + 4.2 + li * LINE_H)
        })
      } else {
        const txt = pdf.splitTextToSize(cells[ci], col.w - 3) as string[]
        pdf.text(txt[0] ?? '', tx, y + 4.2, { align: col.align })
      }
      cx += col.w
    }
    y += rowH
  }

  // Ligne de totaux
  const totalAvant = sorted.reduce((s, p) => s + (p.debitAvant ?? 0), 0)
  const totalApres = sorted.reduce((s, p) => s + (p.debitApres  ?? 0), 0)
  const ecartTotal = totalApres - totalAvant
  const mesures    = sorted.filter((p) => p.debitAvant !== undefined && p.debitApres !== undefined)
  const varMoy     = mesures.length > 0
    ? mesures.reduce((s, p) => {
        const v = p.debitAvant ? ((p.debitApres! - p.debitAvant) / p.debitAvant) * 100 : 0
        return s + v
      }, 0) / mesures.length
    : null

  if (y + BASE_ROW_H > CONTENT_BOTTOM) {
    await newTablePage()
    cx = ML
  }

  pdf.setFillColor(...BLUE)
  pdf.rect(ML, y, UW, BASE_ROW_H, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.setTextColor(...WHITE)
  pdf.text(`TOTAL / MOY. (${sorted.length} points)`, ML + 2, y + 4.2)

  cx = ML
  // cols: ID Système Local Méthode Avant Après Écart Var% Obs → skip first 4
  const totals = ['', '', '', '', totalAvant.toFixed(0), totalApres.toFixed(0),
    `${ecartTotal >= 0 ? '+' : ''}${ecartTotal.toFixed(0)}`,
    varMoy !== null ? `${varMoy >= 0 ? '+' : ''}${varMoy.toFixed(1)}%` : '—', '']
  for (let ci = 0; ci < cols.length; ci++) {
    const col = cols[ci]
    if (ci <= 3) { cx += col.w; continue }
    const tx = col.align === 'right' ? cx + col.w - 2 : cx + 2
    pdf.text(totals[ci], tx, y + 4.2, { align: col.align })
    cx += col.w
  }
  y += BASE_ROW_H

  return y
}

// ── Titre de section dans le corps de page ────────────────────────────────────
// L'en-tête (drawTextPageHeader) n'affiche pas de sous-titre par page : chaque section
// s'identifie donc elle-même en haut du contenu, comme les pages « rapport écrit ».
function drawSectionHeading(pdf: jsPDF, title: string, y: number): number {
  pdf.setFillColor(...BLUE)
  pdf.rect(ML, y - 4, 3, 6, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(...BLUE)
  pdf.text(title, ML + 5, y)
  return y + 7
}

// ── Légende ───────────────────────────────────────────────────────────────────
function drawLegend(pdf: jsPDF, y: number): number {
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(...DGRAY)
  pdf.text('Légende :', ML, y + 4)
  let cx = ML + 14
  for (const [, info] of Object.entries(TYPE_POINT_DEBIT)) {
    const rgb = typeRGB(Object.keys(TYPE_POINT_DEBIT).find((k) => TYPE_POINT_DEBIT[k as keyof typeof TYPE_POINT_DEBIT] === info) ?? '')
    pdf.setFillColor(...rgb)
    pdf.circle(cx + 2.5, y + 3.5, 2, 'F')
    pdf.setTextColor(...DGRAY)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`${info.abbr} — ${info.label}`, cx + 6, y + 4.5)
    cx += 55
  }
  return y + 9
}

// ── Résumé exécutif ────────────────────────────────────────────────────────────
function drawResumeExecutif(
  pdf: jsPDF,
  project: Project,
  allPoints: PointDebit[],
  systemes: Systeme[],
  plansDebit: PlanDebit[],
  unite: string,
  startY: number,
): number {
  let y = startY

  const paragraph = (text: string) => {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8.5)
    pdf.setTextColor(...DGRAY)
    const lines = pdf.splitTextToSize(text, UW) as string[]
    pdf.text(lines, ML, y)
    y += lines.length * 4.2 + 4
  }

  y = drawSectionHeading(pdf, 'Résumé exécutif', y) + 2

  const nomBatiment = project.nomImmeuble || project.name
  const adresse = [project.adresse, project.ville].filter(Boolean).join(', ')
  paragraph(
    `Le présent rapport présente les résultats des mesures de débit d'air réalisées avant et après le nettoyage ` +
    `des systèmes de ventilation${nomBatiment ? ` du bâtiment ${safe(nomBatiment)}` : ''}${adresse ? `, situé au ${safe(adresse)}` : ''}, ` +
    `dans le cadre du mandat de nettoyage des conduits de ventilation CVCA${project.mandat ? ` (${safe(project.mandat)})` : ''}.`
  )

  const sysNoms = systemes.map((s) => s.nom).filter(Boolean)
  if (sysNoms.length > 0) {
    paragraph(
      `Les travaux ont porté sur le nettoyage des systèmes suivants : ${sysNoms.join(', ')}. ` +
      `Des mesures de débit d'air ont été effectuées aux diffuseurs, grilles de reprise et grilles d'extraction ` +
      `identifiés sur ${plansDebit.length} plan${plansDebit.length > 1 ? 's' : ''} de repérage, avant et après l'intervention de nettoyage.`
    )
  } else {
    paragraph(
      `Des mesures de débit d'air ont été effectuées aux diffuseurs, grilles de reprise et grilles d'extraction ` +
      `identifiés sur ${plansDebit.length} plan${plansDebit.length > 1 ? 's' : ''} de repérage, avant et après l'intervention de nettoyage.`
    )
  }

  const periode = [
    project.dateDebut ? `du ${project.dateDebut}` : '',
    project.dateFin   ? `au ${project.dateFin}`   : '',
  ].filter(Boolean).join(' ')
  if (periode) {
    paragraph(`La période d'intervention s'est déroulée ${periode}.`)
  }

  const totalAvant = allPoints.reduce((s, p) => s + (p.debitAvant ?? 0), 0)
  const totalApres = allPoints.reduce((s, p) => s + (p.debitApres  ?? 0), 0)
  const mesures    = allPoints.filter((p) => p.debitAvant !== undefined && p.debitApres !== undefined)
  const ecart      = totalApres - totalAvant
  const varMoy     = mesures.length > 0
    ? mesures.reduce((s, p) => s + (p.debitAvant ? ((p.debitApres! - p.debitAvant) / p.debitAvant) * 100 : 0), 0) / mesures.length
    : null

  paragraph(
    `Au total, ${allPoints.length} point${allPoints.length > 1 ? 's' : ''} de mesure ${allPoints.length > 1 ? 'ont' : 'a'} été relevé${allPoints.length > 1 ? 's' : ''}, ` +
    `dont ${mesures.length} avec des débits complets avant et après nettoyage. Le débit total mesuré avant nettoyage s'élève à ${totalAvant.toFixed(0)} ${unite}, ` +
    `comparativement à ${totalApres.toFixed(0)} ${unite} après nettoyage, soit un écart global de ${ecart >= 0 ? '+' : ''}${ecart.toFixed(0)} ${unite}` +
    (varMoy !== null ? ` (variation moyenne de ${varMoy >= 0 ? '+' : ''}${varMoy.toFixed(1)} %).` : '.')
  )

  return y
}

// ── Conditions de mesure ───────────────────────────────────────────────────────
function drawConditionsMesure(pdf: jsPDF, allPoints: PointDebit[], unite: string, startY: number): number {
  let y = drawSectionHeading(pdf, 'Conditions de mesure', startY) + 2

  const methodesUtilisees = [...new Set(allPoints.map((p) => p.methode).filter(Boolean))] as (keyof typeof METHODE_MESURE_LABELS)[]
  const conditionsNotes   = [...new Set(allPoints.map((p) => p.conditions).filter(Boolean))]

  const bullets: string[] = [
    'Les systèmes de ventilation étaient en fonctionnement normal au moment des relevés.',
    `Les débits ont été mesurés en conditions d'exploitation observées lors de l'intervention, sans modification des réglages du système.`,
    `Unité de mesure : ${unite}.`,
    methodesUtilisees.length > 0
      ? `Instrumentation et méthode de prise de mesure : ${methodesUtilesText(methodesUtilisees)}.`
      : `Méthode de prise de mesure : non précisée pour l'ensemble des points.`,
  ]
  if (conditionsNotes.length > 0) {
    bullets.push(`Conditions particulières notées lors des relevés : ${conditionsNotes.join(' ; ')}.`)
  }

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8.5)
  pdf.setTextColor(...DGRAY)
  for (const b of bullets) {
    const lines = pdf.splitTextToSize(`•  ${b}`, UW - 2) as string[]
    pdf.text(lines, ML, y)
    y += lines.length * 4.2 + 1.5
  }

  return y + 3
}

function methodesUtilesText(methodes: (keyof typeof METHODE_MESURE_LABELS)[]): string {
  return methodes.map((m) => METHODE_MESURE_LABELS[m] ?? m).join(', ')
}

// ── Conclusion ──────────────────────────────────────────────────────────────────
function drawConclusion(pdf: jsPDF, allPoints: PointDebit[], unite: string, startY: number): number {
  let y = drawSectionHeading(pdf, 'Conclusion', startY) + 2

  const mesures = allPoints.filter((p) => p.debitAvant !== undefined && p.debitApres !== undefined)
  const incomplets = allPoints.length - mesures.length
  const totalAvant = mesures.reduce((s, p) => s + (p.debitAvant ?? 0), 0)
  const totalApres = mesures.reduce((s, p) => s + (p.debitApres  ?? 0), 0)
  const ecart = totalApres - totalAvant
  const varMoy = mesures.length > 0
    ? mesures.reduce((s, p) => s + (p.debitAvant ? ((p.debitApres! - p.debitAvant) / p.debitAvant) * 100 : 0), 0) / mesures.length
    : null

  const paragraph = (text: string) => {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8.5)
    pdf.setTextColor(...DGRAY)
    const lines = pdf.splitTextToSize(text, UW) as string[]
    pdf.text(lines, ML, y)
    y += lines.length * 4.2 + 4
  }

  if (mesures.length === 0) {
    paragraph(
      `Aucun point de mesure ne dispose de débits complets avant et après nettoyage, ce qui ne permet pas d'établir ` +
      `de comparaison quantitative pour ce mandat.`
    )
    return y
  }

  paragraph(
    `Sur ${mesures.length} point${mesures.length > 1 ? 's' : ''} de mesure ${mesures.length > 1 ? 'comportant' : 'comportant'} des débits complets avant et après nettoyage, ` +
    `le débit total est passé de ${totalAvant.toFixed(0)} ${unite} à ${totalApres.toFixed(0)} ${unite}, soit un écart global de ` +
    `${ecart >= 0 ? '+' : ''}${ecart.toFixed(0)} ${unite} (variation moyenne de ${varMoy! >= 0 ? '+' : ''}${varMoy!.toFixed(1)} %).`
  )

  if (varMoy !== null && varMoy > 5) {
    paragraph(
      `Cette variation positive est cohérente avec une amélioration du débit d'air généralement observée à la suite du nettoyage ` +
      `des conduits de ventilation, sans qu'il soit possible d'en isoler la cause exacte à partir des seules mesures de débit.`
    )
  } else if (varMoy !== null && varMoy < -5) {
    paragraph(
      `Cette diminution du débit global peut découler de plusieurs facteurs (réglage des dispositifs de balancement, ` +
      `conditions d'exploitation variables entre les deux relevés, précision de l'instrumentation) et ne permet pas, à elle seule, ` +
      `de conclure à une problématique du système.`
    )
  } else if (varMoy !== null) {
    paragraph(
      `Les débits mesurés avant et après nettoyage demeurent globalement comparables, sans variation notable.`
    )
  }

  if (incomplets > 0) {
    paragraph(
      `Notons que ${incomplets} point${incomplets > 1 ? 's' : ''} de mesure ne dispose${incomplets > 1 ? 'nt' : ''} pas de débit avant et après complet ` +
      `et n'${incomplets > 1 ? 'ont' : 'a'} pas été inclus dans le calcul de variation moyenne ci-dessus.`
    )
  }

  return y
}

// ── Exporteur principal ───────────────────────────────────────────────────────

export async function generateDebitReport(
  project: Project,
  plansDebit: PlanDebit[],
  allPoints: PointDebit[],
  unite: string,
  systemes: Systeme[] = [],
  planImages: Record<string, string> = {},
): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageRef = { n: 0 }

  const newPage = async () => {
    pdf.addPage()
    pageRef.n++
    await drawTextPageHeader(pdf, project, pageRef.n, HEADER_LABEL)
  }

  // ── Page de garde — identique à celle des rapports de nettoyage CVCA ───────────
  await drawCoverPage(pdf, project, {
    titre: "Mesures de débit d'air – Mesures avant et après nettoyage des systèmes CVCA",
  })

  // ── Résumé exécutif + conditions de mesure ────────────────────────────────────
  await newPage()
  let ry = CONTENT_TOP
  ry = drawResumeExecutif(pdf, project, allPoints, systemes, plansDebit, unite, ry)
  ry += 3
  if (ry > CONTENT_BOTTOM - 40) {
    drawSectionPageFooter(pdf)
    await newPage()
    ry = CONTENT_TOP
  }
  drawConditionsMesure(pdf, allPoints, unite, ry)
  drawSectionPageFooter(pdf)

  // ── Résultats — synthèse générale ──────────────────────────────────────────────
  await newPage()
  let y = drawSectionHeading(pdf, 'Résultats — Synthèse générale', CONTENT_TOP) + 3

  // Regrouper les points par systèmeId
  const bySystem = new Map<string, PointDebit[]>()
  for (const pt of allPoints) {
    const key = pt.systemeId ?? '__none__'
    if (!bySystem.has(key)) bySystem.set(key, [])
    bySystem.get(key)!.push(pt)
  }
  const sysRows = [...bySystem.entries()]
    .map(([sysId, pts]) => {
      const nom   = sysId === '__none__' ? 'Sans système' : (systemes.find((s) => s.id === sysId)?.nom ?? sysId)
      const avant = pts.reduce((s, p) => s + (p.debitAvant ?? 0), 0)
      const apres = pts.reduce((s, p) => s + (p.debitApres  ?? 0), 0)
      return { nom, avant, apres, count: pts.length }
    })
    .sort((a, b) => a.nom === 'Sans système' ? 1 : b.nom === 'Sans système' ? -1 : a.nom.localeCompare(b.nom, 'fr'))

  // Fonction utilitaire : dessine une boîte de sommaire
  function drawSommaire(title: string, count: number, avant: number, apres: number, isTotal: boolean) {
    const BOX_H = 28
    const STEP  = 34
    const ecart = apres - avant

    pdf.setFillColor(...(isTotal ? BLUE : LBLUE))
    pdf.roundedRect(ML, y, UW, BOX_H, 3, 3, 'F')

    // Titre de la boîte
    pdf.setFontSize(7.5)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...(isTotal ? WHITE : BLUE))
    pdf.text(title, ML + 4, y + 6)

    // Stats horizontales — 5 colonnes (même format que le sommaire global original)
    const statsData: [string, string][] = [
      [`${count}`,                                                'points mesurés'],
      [`${plansDebit.length}`,                                    'plan(s)'],
      [avant > 0 ? `${avant.toFixed(0)} ${unite}` : '—',         'débit total avant'],
      [apres > 0 ? `${apres.toFixed(0)} ${unite}` : '—',         'débit total après'],
      [`${ecart >= 0 ? '+' : ''}${ecart.toFixed(0)} ${unite}`,   'écart total'],
    ]
    const txtColor: [number,number,number] = isTotal ? WHITE : BLUE
    const lblColor: [number,number,number] = isTotal ? [200, 220, 255] : LGRAY
    let sx = ML + 4
    for (const [val, lbl] of statsData) {
      pdf.setFontSize(9.5)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(...txtColor)
      pdf.text(val, sx, y + 15)
      pdf.setFontSize(6.5)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(...lblColor)
      pdf.text(lbl, sx, y + 21)
      sx += STEP
    }
    y += BOX_H + 3
  }

  // Une boîte par système — seulement s'il y a réellement plus d'un système à comparer,
  // sinon la boîte totale ci-dessous montrerait déjà exactement les mêmes chiffres.
  const totAvant = allPoints.reduce((s, p) => s + (p.debitAvant ?? 0), 0)
  const totApres = allPoints.reduce((s, p) => s + (p.debitApres  ?? 0), 0)
  if (sysRows.length > 1) {
    for (const row of sysRows) {
      drawSommaire(row.nom, row.count, row.avant, row.apres, false)
    }
    drawSommaire(`Total — tous systèmes (${allPoints.length} points)`, allPoints.length, totAvant, totApres, true)
  } else {
    const seulNom = sysRows[0]?.nom
    const titre = seulNom && seulNom !== 'Sans système'
      ? `Total — Système ${seulNom} (${allPoints.length} points)`
      : `Total (${allPoints.length} points)`
    drawSommaire(titre, allPoints.length, totAvant, totApres, true)
  }

  drawSectionPageFooter(pdf)

  // ── Résultats — par système ────────────────────────────────────────────────────
  // Toujours affiché — la colonne « Plan » indique de quel plan provient chaque point,
  // puisqu'un même système peut regrouper des points situés sur plusieurs plans.
  if (allPoints.length > 0) {
    await newPage()
    let sy = drawSectionHeading(pdf, 'Résultats par système', CONTENT_TOP) + 3

    // Tableaux détail par système (regroupement déjà calculé plus haut dans bySystem)
    for (const [sysId, pts] of bySystem) {
      const nom = sysId === '__none__' ? 'Sans système' : (systemes.find((s) => s.id === sysId)?.nom ?? sysId)
      if (sy > CONTENT_BOTTOM - 20) {
        drawSectionPageFooter(pdf)
        await newPage()
        sy = drawSectionHeading(pdf, 'Résultats par système (suite)', CONTENT_TOP) + 3
      }

      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(...BLUE)
      pdf.text(`-- ${nom}`, ML, sy + 4)
      sy += 8

      sy = await drawTable(pdf, project, pts, unite, sy, systemes, pageRef, 'plan', plansDebit)
      sy += 6
    }

    drawSectionPageFooter(pdf)
  }

  // ── Résultats — détaillés par plan (plans annotés, un plan = ses points seulement) ─
  for (const plan of plansDebit) {
    const points = allPoints
      .filter((p) => p.planDebitId === plan.id)
      .sort((a, b) => a.identifiant.localeCompare(b.identifiant, 'fr', { numeric: true }))

    if (points.length === 0) continue

    // Page plan + image
    await newPage()
    let py = drawSectionHeading(pdf, `Résultats détaillés — Plan : ${plan.name}`, CONTENT_TOP) + 3

    // Image du plan pré-rendue (capturée depuis l'UI)
    const imgData = planImages[plan.id]
    if (imgData) {
      try {
        const imgH = Math.min(110, (plan.height / plan.width) * UW)
        const imgW = imgH * (plan.width / plan.height)
        const imgX = ML + (UW - imgW) / 2
        const fmt  = imgData.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG'
        pdf.addImage(imgData, fmt, imgX, py, imgW, imgH)
        py += imgH + 4
      } catch {
        py += 4
      }
    }

    py = drawLegend(pdf, py) + 2

    // Tableau pour ce plan
    py = await drawTable(pdf, project, points, unite, py, systemes, pageRef)

    drawSectionPageFooter(pdf)
  }

  // ── Conclusion ─────────────────────────────────────────────────────────────────
  await newPage()
  drawConclusion(pdf, allPoints, unite, CONTENT_TOP)
  drawSectionPageFooter(pdf)

  // ── Téléchargement ────────────────────────────────────────────────────────────
  const filename = `Mesures-debit_${(project.name || 'projet').replace(/[^a-zA-Z0-9]/g, '-')}_${new Date().toISOString().slice(0, 10)}.pdf`
  pdf.save(filename)
}
