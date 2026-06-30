import jsPDF from 'jspdf'
import type { Project, PlanDebit, PointDebit } from '@/types'
import { TYPE_POINT_DEBIT } from '@/types'

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
): number {
  const sorted = [...points].sort((a, b) => a.identifiant.localeCompare(b.identifiant, 'fr', { numeric: true }))

  const cols = [
    { label: 'ID',          w: 14, align: 'left'  as const },
    { label: 'Local / Zone', w: 40, align: 'left'  as const },
    { label: 'Type',         w: 30, align: 'left'  as const },
    { label: `Avant (${unite})`, w: 24, align: 'right' as const },
    { label: `Après (${unite})`, w: 24, align: 'right' as const },
    { label: `Écart`,        w: 20, align: 'right' as const },
    { label: 'Var. %',       w: 20, align: 'right' as const },
    { label: 'Observations', w: UW - 14 - 40 - 30 - 24 - 24 - 20 - 20, align: 'left' as const },
  ]

  let y = startY
  const rowH = 6.5

  // En-tête tableau
  pdf.setFillColor(...BLUE)
  pdf.rect(ML, y, UW, rowH, 'F')
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(...WHITE)
  let cx = ML
  for (const col of cols) {
    const tx = col.align === 'right' ? cx + col.w - 2 : cx + 2
    pdf.text(col.label, tx, y + 4.2, { align: col.align })
    cx += col.w
  }
  y += rowH

  // Lignes
  pdf.setFont('helvetica', 'normal')
  for (let i = 0; i < sorted.length; i++) {
    const pt  = sorted[i]
    const rgb = typeRGB(pt.type)
    const info = TYPE_POINT_DEBIT[pt.type as keyof typeof TYPE_POINT_DEBIT]

    // fond alterné
    if (i % 2 === 0) {
      pdf.setFillColor(...LBLUE)
      pdf.rect(ML, y, UW, rowH, 'F')
    }

    // ID avec pastille colorée
    pdf.setFillColor(...rgb)
    pdf.circle(ML + 3.5, y + rowH / 2, 2.2, 'F')
    pdf.setTextColor(...WHITE)
    pdf.setFontSize(5.5)
    pdf.text(pt.identifiant.length <= 4 ? pt.identifiant : pt.type[0].toUpperCase(), ML + 3.5, y + rowH / 2 + 1.5, { align: 'center' })

    pdf.setFontSize(7)
    pdf.setTextColor(...DGRAY)

    const ecart     = (pt.debitAvant !== undefined && pt.debitApres !== undefined) ? pt.debitApres - pt.debitAvant : null
    const variation = (pt.debitAvant && ecart !== null) ? (ecart / pt.debitAvant) * 100 : null

    const cells = [
      pt.identifiant,
      pt.local || '—',
      info?.label ?? pt.type,
      pt.debitAvant !== undefined ? pt.debitAvant.toFixed(0) : '—',
      pt.debitApres  !== undefined ? pt.debitApres.toFixed(0)  : '—',
      ecart !== null ? `${ecart >= 0 ? '+' : ''}${ecart.toFixed(0)}` : '—',
      variation !== null ? `${variation >= 0 ? '+' : ''}${variation.toFixed(1)}%` : '—',
      pt.observations ?? '',
    ]

    cx = ML
    for (let ci = 0; ci < cols.length; ci++) {
      const col = cols[ci]
      if (ci === 0) { cx += col.w; continue } // ID already drawn
      const tx = col.align === 'right' ? cx + col.w - 2 : cx + 2
      // Couleur variation
      if (ci === 6 && variation !== null) {
        pdf.setTextColor(variation >= 0 ? 22 : 220, variation >= 0 ? 163 : 38, variation >= 0 ? 74 : 38)
      } else if (ci === 5 && ecart !== null) {
        pdf.setTextColor(ecart >= 0 ? 22 : 220, ecart >= 0 ? 163 : 38, ecart >= 0 ? 74 : 38)
      } else {
        pdf.setTextColor(...DGRAY)
      }
      const txt = pdf.splitTextToSize(cells[ci], col.w - 3)
      pdf.text(txt[0] ?? '', tx, y + 4.2, { align: col.align })
      cx += col.w
    }
    y += rowH

    if (y > PH - 30) break // sécurité débordement
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
  pdf.rect(ML, y, UW, rowH, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.setTextColor(...WHITE)
  pdf.text(`TOTAL / MOY. (${sorted.length} points)`, ML + 2, y + 4.2)

  cx = ML
  const totals = ['', '', '', totalAvant.toFixed(0), totalApres.toFixed(0),
    `${ecartTotal >= 0 ? '+' : ''}${ecartTotal.toFixed(0)}`,
    varMoy !== null ? `${varMoy >= 0 ? '+' : ''}${varMoy.toFixed(1)}%` : '—', '']
  for (let ci = 0; ci < cols.length; ci++) {
    const col = cols[ci]
    if (ci <= 2) { cx += col.w; continue }
    const tx = col.align === 'right' ? cx + col.w - 2 : cx + 2
    pdf.text(totals[ci], tx, y + 4.2, { align: col.align })
    cx += col.w
  }
  y += rowH

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

// ── Exporteur principal ───────────────────────────────────────────────────────

export async function generateDebitReport(
  project: Project,
  plansDebit: PlanDebit[],
  allPoints: PointDebit[],
  unite: string,
): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let pageNum = 1

  // ── Page de garde ────────────────────────────────────────────────────────────
  pdf.setFillColor(...BLUE)
  pdf.rect(0, 0, PW, 60, 'F')

  pdf.setFontSize(22)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(...WHITE)
  pdf.text('Mesures de débit d\'air', ML, 28)

  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'normal')
  pdf.text('Rapport comparatif avant / après nettoyage CVAC', ML, 38)

  pdf.setFontSize(9)
  pdf.setTextColor(...WHITE)
  pdf.text(safe(project.name),   ML, 50)
  pdf.text(safe(project.client), ML, 56)

  // Infos projet
  let y = 72
  const infoRows = [
    ['Client',       safe(project.client)],
    ['Adresse',      [project.adresse, project.ville].filter(Boolean).join(', ')],
    ['Contrat',      safe(project.contrat)],
    ['Technicien',   safe(project.technicien)],
    ['Date rapport', new Date().toLocaleDateString('fr-CA')],
  ].filter(([, v]) => v)

  pdf.setFontSize(9)
  for (const [label, val] of infoRows) {
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...BLUE)
    pdf.text(label + ' :', ML, y)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(...DGRAY)
    pdf.text(val, ML + 32, y)
    y += LINE
  }

  // Récap global
  const totalPoints = allPoints.length
  const totalAvant  = allPoints.reduce((s, p) => s + (p.debitAvant ?? 0), 0)
  const totalApres  = allPoints.reduce((s, p) => s + (p.debitApres  ?? 0), 0)

  y += 6
  pdf.setFillColor(...LBLUE)
  pdf.roundedRect(ML, y, UW, 28, 3, 3, 'F')
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(...BLUE)
  pdf.text('Sommaire global', ML + 4, y + 6)

  const stats = [
    [`${totalPoints}`, 'points mesurés'],
    [`${plansDebit.length}`, 'plan(s)'],
    [`${totalAvant.toFixed(0)} ${unite}`, 'débit total avant'],
    [`${totalApres.toFixed(0)} ${unite}`, 'débit total après'],
    [`${(totalApres - totalAvant) >= 0 ? '+' : ''}${(totalApres - totalAvant).toFixed(0)} ${unite}`, 'écart total'],
  ]
  let sx = ML + 4
  for (const [val, lbl] of stats) {
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...BLUE)
    pdf.text(val, sx, y + 16)
    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(...LGRAY)
    pdf.text(lbl, sx, y + 21)
    sx += 38
  }
  y += 34

  drawFooter(pdf)

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

    // Image du plan avec pastilles
    if (plan.url) {
      try {
        const imgH   = Math.min(100, (plan.height / plan.width) * UW)
        const imgW   = imgH * (plan.width / plan.height)
        const imgX   = ML + (UW - imgW) / 2

        pdf.addImage(plan.url, 'PNG', imgX, py, imgW, imgH)

        // Dessiner les pastilles sur l'image
        for (const pt of points) {
          const px = imgX + (pt.x / 100) * imgW
          const py2 = py  + (pt.y / 100) * imgH
          const rgb = typeRGB(pt.type)
          pdf.setFillColor(...rgb)
          pdf.setDrawColor(...WHITE)
          pdf.setLineWidth(0.4)
          pdf.circle(px, py2, 3.5, 'FD')
          pdf.setFontSize(5.5)
          pdf.setFont('helvetica', 'bold')
          pdf.setTextColor(...WHITE)
          pdf.text(pt.identifiant.length <= 4 ? pt.identifiant : pt.identifiant.slice(0, 4), px, py2 + 1.8, { align: 'center' })
        }

        py += imgH + 4
      } catch {
        py += 4
      }
    }

    py = drawLegend(pdf, py) + 2

    // Tableau pour ce plan
    py = drawTable(pdf, points, unite, py)

    drawFooter(pdf)
  }

  // ── Page tableau synthèse tous plans ─────────────────────────────────────────
  if (plansDebit.length > 1) {
    pdf.addPage()
    pageNum++
    drawHeader(pdf, project, pageNum, 'Tableau récapitulatif — tous les plans')

    let ty = 24
    ty = drawLegend(pdf, ty) + 2
    ty = drawTable(pdf, allPoints, unite, ty)
    drawFooter(pdf)
  }

  // ── Téléchargement ────────────────────────────────────────────────────────────
  const filename = `Mesures-debit_${(project.name || 'projet').replace(/[^a-zA-Z0-9]/g, '-')}_${new Date().toISOString().slice(0, 10)}.pdf`
  pdf.save(filename)
}
