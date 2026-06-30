import jsPDF from 'jspdf'
import type { Project, PlanDebit, PointDebit, Systeme } from '@/types'
import { TYPE_POINT_DEBIT, METHODE_MESURE_LABELS } from '@/types'

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
const MT   = 14
const LINE = 6

const safe = (v: any) => (v == null ? '' : String(v))

// ── Couleurs par type ─────────────────────────────────────────────────────────
function typeRGB(type: string): [number,number,number] {
  if (type === 'diffuseur')  return [37,  99, 235]
  if (type === 'reprise')    return [5,  150, 105]
  if (type === 'extraction') return [220, 38,  38]
  return [100, 116, 139]
}

// ── Composite plan + pastilles sur canvas HTML ────────────────────────────────
async function compositePlanWithPins(plan: PlanDebit, points: PointDebit[]): Promise<string | null> {
  if (!plan.url) return null
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)

      const radius = Math.max(18, img.naturalWidth * 0.018)
      const fontSize = Math.round(radius * 1.1)

      for (const pt of points) {
        const px = (pt.x / 100) * img.naturalWidth
        const py = (pt.y / 100) * img.naturalHeight
        const [r, g, b] = typeRGB(pt.type)

        ctx.beginPath()
        ctx.arc(px, py, radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.fill()
        ctx.strokeStyle = 'white'
        ctx.lineWidth = Math.max(2, radius * 0.18)
        ctx.stroke()

        ctx.fillStyle = 'white'
        ctx.font = `bold ${fontSize}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const label = pt.identifiant.length <= 5 ? pt.identifiant : pt.identifiant.slice(0, 5)
        ctx.fillText(label, px, py)
      }

      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(null)
    img.src = plan.url!
  })
}

// ── En-tête de page ───────────────────────────────────────────────────────────
function drawHeader(pdf: jsPDF, project: Project, pageNum: number, title: string) {
  pdf.setFillColor(...BLUE)
  pdf.rect(0, 0, PW, 18, 'F')

  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(...WHITE)
  pdf.text('MESURES DE DÉBIT D\'AIR', ML, 7)
  pdf.setFontSize(7.5)
  pdf.setFont('helvetica', 'normal')
  pdf.text(title, ML, 12.5)

  pdf.setFontSize(7)
  pdf.setTextColor(...WHITE)
  pdf.text(`${safe(project.client)} · ${safe(project.name)}`, PW - MR, 7, { align: 'right' })
  pdf.text(`Page ${pageNum}`, PW - MR, 12.5, { align: 'right' })
}

// ── Pied de page ──────────────────────────────────────────────────────────────
function drawFooter(pdf: jsPDF) {
  const y = PH - 10
  pdf.setDrawColor(200, 210, 220)
  pdf.setLineWidth(0.3)
  pdf.line(ML, y - 2, PW - MR, y - 2)
  pdf.setFontSize(6.5)
  pdf.setTextColor(...LGRAY)
  pdf.setFont('helvetica', 'italic')
  pdf.text(
    'Les débits d\'air ont été mesurés aux grilles et diffuseurs dans les conditions d\'exploitation présentes au moment des relevés. ' +
    'Les résultats peuvent varier selon les conditions d\'opération du système.',
    ML, y + 1, { maxWidth: UW }
  )
}

// ── Tableau comparatif ────────────────────────────────────────────────────────
function drawTable(
  pdf: jsPDF,
  points: PointDebit[],
  unite: string,
  startY: number,
  systemes: Systeme[] = [],
): number {
  const sorted = [...points].sort((a, b) => a.identifiant.localeCompare(b.identifiant, 'fr', { numeric: true }))

  // Colonnes redistributées pour donner plus de place aux observations
  const obsW = UW - 14 - 18 - 24 - 16 - 24 - 24 - 14 - 14
  const cols = [
    { label: 'ID',               w: 14,   align: 'left'  as const },
    { label: 'Système',           w: 18,   align: 'left'  as const },
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

  // En-tête tableau
  pdf.setFillColor(...BLUE)
  pdf.rect(ML, y, UW, BASE_ROW_H, 'F')
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(...WHITE)
  let cx = ML
  for (const col of cols) {
    const tx = col.align === 'right' ? cx + col.w - 2 : cx + 2
    pdf.text(col.label, tx, y + 4.2, { align: col.align })
    cx += col.w
  }
  y += BASE_ROW_H

  // Lignes
  pdf.setFont('helvetica', 'normal')
  for (let i = 0; i < sorted.length; i++) {
    const pt  = sorted[i]
    const rgb = typeRGB(pt.type)

    const ecart     = (pt.debitAvant !== undefined && pt.debitApres !== undefined) ? pt.debitApres - pt.debitAvant : null
    const variation = (pt.debitAvant && ecart !== null) ? (ecart / pt.debitAvant) * 100 : null

    const sysNom        = systemes.find((s) => s.id === pt.systemeId)?.nom ?? '—'
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
    pdf.text(pt.identifiant.length <= 4 ? pt.identifiant : pt.type[0].toUpperCase(), ML + 3.5, y + BASE_ROW_H / 2 + 1.5, { align: 'center' })

    const cells = [
      pt.identifiant,
      sysNom,
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

    if (y > PH - 30) break
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

// ── Dimensions image ──────────────────────────────────────────────────────────
async function getImageDimsPdf(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload  = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => resolve({ w: 0, h: 0 })
    img.src = dataUrl
  })
}

function addLogoFit(pdf: jsPDF, dataUrl: string, dims: { w: number; h: number }, x: number, y: number, maxW: number, maxH: number) {
  if (!dims.w || !dims.h) return
  const ratio = Math.min(maxW / dims.w, maxH / dims.h)
  const lw = dims.w * ratio
  const lh = dims.h * ratio
  const fmt = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'
  pdf.addImage(dataUrl, fmt, x, y, lw, lh)
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
  let pageNum = 1

  // Pré-chargement des logos
  const logoDims       = project.logo       ? await getImageDimsPdf(project.logo)       : { w: 0, h: 0 }
  const logoClientDims = project.logoClient ? await getImageDimsPdf(project.logoClient) : { w: 0, h: 0 }

  // ── Page de garde ────────────────────────────────────────────────────────────

  // Bannière bleue
  const BANNER_H = 52
  pdf.setFillColor(...BLUE)
  pdf.rect(0, 0, PW, BANNER_H, 'F')

  // Titre
  pdf.setFontSize(20)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(...WHITE)
  pdf.text('MESURES DE DÉBIT D\'AIR', ML, 20)

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.text('Rapport comparatif avant / après nettoyage CVAC', ML, 29)

  // Nom projet + client dans bannière
  const projLabel = [project.name, project.client].filter(Boolean).join(' — ')
  if (projLabel) {
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.text(safe(projLabel), ML, 38)
  }

  // Date en haut à droite
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.text(new Date().toLocaleDateString('fr-CA'), PW - MR, 10, { align: 'right' })

  // ── Zone logos ────────────────────────────────────────────────────────────────
  const LOGO_Y    = BANNER_H + 4
  const LOGO_H    = 22
  const LOGO_MAXW = 60

  if (project.logo) {
    addLogoFit(pdf, project.logo, logoDims, ML, LOGO_Y, LOGO_MAXW, LOGO_H)
  }
  if (project.logoClient) {
    // logo client aligné à droite
    const ratio = Math.min(LOGO_MAXW / (logoClientDims.w || 1), LOGO_H / (logoClientDims.h || 1))
    const lw = (logoClientDims.w || 0) * ratio
    addLogoFit(pdf, project.logoClient, logoClientDims, PW - MR - lw, LOGO_Y, LOGO_MAXW, LOGO_H)
  }

  // Séparateur
  const SEP_Y = LOGO_Y + LOGO_H + 4
  pdf.setDrawColor(200, 210, 225)
  pdf.setLineWidth(0.3)
  pdf.line(ML, SEP_Y, PW - MR, SEP_Y)

  // ── Informations projet ───────────────────────────────────────────────────────
  let y = SEP_Y + 5

  function infoRow(label: string, value: string | undefined, cy: number, lx: number, colW: number): number {
    if (!value) return cy
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7.5)
    pdf.setTextColor(...BLUE)
    pdf.text(label + ' :', lx, cy)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(...DGRAY)
    const wrapped = pdf.splitTextToSize(value, colW - 26)
    pdf.text(wrapped[0] ?? '', lx + 26, cy)
    return cy + LINE
  }

  // Deux colonnes
  const COL1_X = ML
  const COL2_X = ML + UW / 2 + 2
  const COL_W  = UW / 2 - 2

  let y1 = y
  let y2 = y

  // Colonne gauche — identité client
  const adresse = [project.adresse, project.ville, project.codePostal].filter(Boolean).join(', ')
  y1 = infoRow('Client',        project.client,        y1, COL1_X, COL_W)
  y1 = infoRow('Adresse',       adresse || undefined,  y1, COL1_X, COL_W)
  y1 = infoRow('Contact',       project.contact,       y1, COL1_X, COL_W)
  y1 = infoRow('Téléphone',     project.telephone,     y1, COL1_X, COL_W)
  y1 = infoRow('Adresse client',project.adresseClient, y1, COL1_X, COL_W)

  // Colonne droite — référence contrat
  y2 = infoRow('Contrat',       project.contrat,         y2, COL2_X, COL_W)
  y2 = infoRow('Bon de commande',project.bonCommande,    y2, COL2_X, COL_W)
  y2 = infoRow('Réf. client',   project.referenceClient, y2, COL2_X, COL_W)
  y2 = infoRow('Mandat',        project.mandat,          y2, COL2_X, COL_W)
  y2 = infoRow('Émis pour',     project.emisPour,        y2, COL2_X, COL_W)

  y = Math.max(y1, y2) + 2

  // Séparateur léger
  pdf.setDrawColor(220, 228, 238)
  pdf.line(ML, y, PW - MR, y)
  y += 4

  // Personnel
  let yp = y
  let yp2 = y
  if (project.preparePar) {
    const titre = project.prepareParTitre ? ` (${project.prepareParTitre})` : ''
    yp = infoRow('Préparé par', project.preparePar + titre, yp, COL1_X, COL_W)
  }
  if (project.technicien) {
    const titre = project.technicienTitre ? ` (${project.technicienTitre})` : ''
    yp = infoRow('Technicien', project.technicien + titre, yp, COL1_X, COL_W)
  }
  if (project.verificateur) {
    const titre = project.verificateurTitre ? ` (${project.verificateurTitre})` : ''
    yp2 = infoRow('Vérificateur', project.verificateur + titre, yp2, COL2_X, COL_W)
  }
  const dates = [
    project.dateDebut ? `Début : ${project.dateDebut}` : '',
    project.dateFin   ? `Fin : ${project.dateFin}` : '',
  ].filter(Boolean).join('   ')
  if (dates) yp2 = infoRow('Période', dates, yp2, COL2_X, COL_W)

  y = Math.max(yp, yp2)

  // Bâtiment
  const batInfos = [
    project.nomImmeuble    && `Immeuble : ${project.nomImmeuble}`,
    project.typeBatiment   && `Type : ${project.typeBatiment}`,
    project.nbEtages       && `Étages : ${project.nbEtages}`,
    project.nbLogements    && `Logements : ${project.nbLogements}`,
    project.anneeConstruction && `Année : ${project.anneeConstruction}`,
  ].filter(Boolean).join('   ')
  if (batInfos) {
    y += 2
    pdf.setDrawColor(220, 228, 238)
    pdf.line(ML, y, PW - MR, y)
    y += 4
    infoRow('Bâtiment', batInfos, y, ML, UW)
    y += LINE
  }

  // Description
  if (project.description) {
    y += 2
    pdf.setDrawColor(220, 228, 238)
    pdf.line(ML, y, PW - MR, y)
    y += 4
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7.5)
    pdf.setTextColor(...BLUE)
    pdf.text('Description :', ML, y)
    y += LINE
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(...DGRAY)
    const desc = pdf.splitTextToSize(project.description, UW)
    const shown = desc.slice(0, 3)
    pdf.text(shown, ML, y)
    y += shown.length * LINE
  }

  // ── Sommaire par système (même format que la boîte globale) ─────────────────
  y += 5

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

  // Une boîte par système
  for (const row of sysRows) {
    drawSommaire(row.nom, row.count, row.avant, row.apres, false)
  }

  // Boîte globale (style bleu foncé)
  const totAvant = allPoints.reduce((s, p) => s + (p.debitAvant ?? 0), 0)
  const totApres = allPoints.reduce((s, p) => s + (p.debitApres  ?? 0), 0)
  drawSommaire(`Total — tous systèmes (${allPoints.length} points)`, allPoints.length, totAvant, totApres, true)

  drawFooter(pdf)

  // ── Page synthèse par système ─────────────────────────────────────────────────
  if (systemes.length > 0 || allPoints.some((p) => p.systemeId)) {
    pdf.addPage()
    pageNum++
    drawHeader(pdf, project, pageNum, 'Synthèse par système')

    let sy = 24

    // Grouper les points par système
    const bySys = new Map<string, PointDebit[]>()
    for (const pt of allPoints) {
      const key = pt.systemeId ?? '__none__'
      if (!bySys.has(key)) bySys.set(key, [])
      bySys.get(key)!.push(pt)
    }

    // Tableaux détail par système
    for (const [sysId, pts] of bySys) {
      const nom = sysId === '__none__' ? 'Sans système' : (systemes.find((s) => s.id === sysId)?.nom ?? sysId)
      if (sy > PH - 50) { pdf.addPage(); pageNum++; drawHeader(pdf, project, pageNum, 'Synthèse par système (suite)'); sy = 24 }

      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(...BLUE)
      pdf.text(`-- ${nom}`, ML, sy + 4)
      sy += 8

      sy = drawTable(pdf, pts, unite, sy, systemes)
      sy += 6
    }

    drawFooter(pdf)
  }

  // ── Pages par plan ───────────────────────────────────────────────────────────
  for (const plan of plansDebit) {
    const points = allPoints
      .filter((p) => p.planDebitId === plan.id)
      .sort((a, b) => a.identifiant.localeCompare(b.identifiant, 'fr', { numeric: true }))

    if (points.length === 0) continue

    // Page plan + image
    pdf.addPage()
    pageNum++
    drawHeader(pdf, project, pageNum, `Plan : ${plan.name}`)

    let py = 22

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
    py = drawTable(pdf, points, unite, py, systemes)

    drawFooter(pdf)
  }

  // ── Page tableau synthèse tous plans ─────────────────────────────────────────
  if (plansDebit.length > 1) {
    pdf.addPage()
    pageNum++
    drawHeader(pdf, project, pageNum, 'Tableau récapitulatif — tous les plans')

    let ty = 24
    ty = drawLegend(pdf, ty) + 2
    ty = drawTable(pdf, allPoints, unite, ty, systemes)
    drawFooter(pdf)
  }

  // ── Téléchargement ────────────────────────────────────────────────────────────
  const filename = `Mesures-debit_${(project.name || 'projet').replace(/[^a-zA-Z0-9]/g, '-')}_${new Date().toISOString().slice(0, 10)}.pdf`
  pdf.save(filename)
}
