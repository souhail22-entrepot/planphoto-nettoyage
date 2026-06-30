import { jsPDF } from 'jspdf'
import type { Project } from '@/types'
import type { Intervention, PhotoIntervention } from '@/types/interventions'
import { STATUTS_INTERVENTION } from '@/types/interventions'

// ── Mise en page A4 paysage ───────────────────────────────────────────────────
const PW = 297; const PH = 210
const ML = 12;  const MR = 12
const UW = PW - ML - MR   // 273 mm

const HDR_H  = 30
const FTR_H  = 8
const TBL_Y  = HDR_H + 4
const BODY_H = PH - TBL_Y - FTR_H - 4

// Photos dans les cellules composante
const PH_W       = 14    // largeur photo mm (agrandi)
const PH_H       = 13    // hauteur photo mm (agrandi)
const PH_G       = 1.5   // gouttière
const PH_PER_ROW = 3     // photos par rangée
const MAX_PH     = 6     // max par phase (2 rangées × 3)

// Largeurs colonnes  (total = 273)
const COL_DATE   = 22
const COL_APT    = 32
const COL_COMP   = 50     // chaque composante (×3 = 150)
const COL_2AVIS  = 26
const COL_NOTES  = UW - COL_DATE - COL_APT - COL_COMP * 3 - COL_2AVIS  // ≈ 43

// Hauteurs dans une cellule composante
const STAT_H   = 14  // section statut + refs texte (espace pour Av:/Ap: sous le badge)
const LABEL_H  = 4   // libellé AV / AP
const CELL_PAD = 2

type n = number
const DBLUE: [n,n,n] = [30, 64, 175]
const BLUE:  [n,n,n] = [37, 99, 235]
const GRAY:  [n,n,n] = [107, 114, 128]
const LGRAY: [n,n,n] = [209, 213, 219]
const WHITE: [n,n,n] = [255, 255, 255]
const BG:    [n,n,n] = [249, 250, 251]
const ORANGE:[n,n,n] = [249, 115, 22]
const GREEN: [n,n,n] = [22, 163, 74]
const RED:   [n,n,n] = [220, 38, 38]

const STATUT_RGB: Record<string, [n,n,n]> = {
  a_faire:  [107, 114, 128],
  en_cours: [234, 179,   8],
  complete: [ 34, 197,  94],
  valide:   [ 59, 130, 246],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safe(s?: string | null) { return (s ?? '').replace(/[^\x20-\x7EÀ-ɏ]/g, '?') }

async function ensureImg(src: string) {
  return new Promise<void>((res, rej) => {
    const img = new Image(); img.onload = () => res(); img.onerror = rej; img.src = src
  })
}

function fmt(src: string) { return src.startsWith('data:image/png') ? 'PNG' : 'JPEG' }

function nbRows(count: number) { return count > 0 ? Math.ceil(Math.min(count, MAX_PH) / PH_PER_ROW) : 0 }

function phSectionH(count: number) {
  return count > 0 ? LABEL_H + nbRows(count) * (PH_H + PH_G) : 0
}

function rowHeight(comps: { avLen: number; apLen: number }[]) {
  const maxAv = Math.max(...comps.map((c) => c.avLen), 0)
  const maxAp = Math.max(...comps.map((c) => c.apLen), 0)
  return Math.max(14, STAT_H + phSectionH(maxAv) + phSectionH(maxAp) + CELL_PAD)
}

function compX(ci: 0 | 1 | 2) { return ML + COL_DATE + COL_APT + ci * COL_COMP }
function avisX()  { return ML + COL_DATE + COL_APT + 3 * COL_COMP }
function notesX() { return avisX() + COL_2AVIS }

function drawHeader(pdf: jsPDF, project: Project, _pg: number) {
  pdf.setFillColor(...DBLUE); pdf.rect(0, 0, PW, HDR_H, 'F')
  pdf.setTextColor(...WHITE)

  // Ligne 1 — Titre + date
  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold')
  pdf.text('RAPPORT D\'INTERVENTION – SECTEUR APPARTEMENTS', ML, 8)
  pdf.setFontSize(7); pdf.setFont('helvetica', 'normal')
  pdf.text(new Date().toLocaleDateString('fr-CA'), PW - MR, 8, { align: 'right' })

  // Ligne 2 — Projet | Client | Adresse travaux
  pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal')
  const mid = PW / 2
  pdf.text(safe('Projet : ' + (project.name || '')), ML, 16, { maxWidth: 88 })
  if (project.client)  pdf.text(safe('Client : ' + project.client),  mid, 16, { align: 'center', maxWidth: 88 })
  if (project.adresse) pdf.text(safe('Adresse : ' + project.adresse), PW - MR, 16, { align: 'right', maxWidth: 88 })

  // Ligne 3 — Mandat | Contrat SDC | [numéro page — sera écrit en post-pass]
  if (project.mandat)  pdf.text(safe('Mandat N° : ' + project.mandat),   ML,  24, { maxWidth: 88 })
  if (project.contrat) pdf.text(safe('Contrat SDC : ' + project.contrat), mid, 24, { align: 'center', maxWidth: 88 })
}

function drawFooter(pdf: jsPDF) {
  const y = PH - FTR_H + 1
  pdf.setDrawColor(...LGRAY); pdf.setLineWidth(0.25); pdf.line(ML, y, PW - MR, y)
  pdf.setTextColor(...GRAY); pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal')
  pdf.text('Confidentiel — Usage interne', PW / 2, y + 4, { align: 'center' })
}

function drawTableHeader(pdf: jsPDF) {
  pdf.setFillColor(...BLUE); pdf.rect(ML, TBL_Y, UW, 7, 'F')
  pdf.setTextColor(...WHITE); pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold')
  pdf.text('Date',             ML + 1.5,                TBL_Y + 4.8)
  pdf.text('Appartement',      ML + COL_DATE + 1.5,     TBL_Y + 4.8)
  // Composantes — noms identiques à l'appli web
  ;(['Hotte', 'SDB', 'Chgt hotte'] as const).forEach((lbl, ci) => {
    pdf.text(lbl, compX(ci as 0|1|2) + COL_COMP / 2, TBL_Y + 4.8, { align: 'center' })
  })
  pdf.text('Date 2e avis',      avisX()  + COL_2AVIS / 2, TBL_Y + 4.8, { align: 'center' })
  pdf.text('Notes / Particularités', notesX() + 1.5,      TBL_Y + 4.8)
}

function statutBadge(pdf: jsPDF, statut: string | null, x: number, y: number, w: number) {
  if (!statut) return
  const rgb = STATUT_RGB[statut] ?? GRAY
  const lbl = safe(STATUTS_INTERVENTION[statut as keyof typeof STATUTS_INTERVENTION]?.label ?? statut)
  const bw  = pdf.getTextWidth(lbl) + 5
  pdf.setFillColor(...rgb); pdf.roundedRect(x + (w - bw) / 2, y - 3.5, bw, 4.5, 0.7, 0.7, 'F')
  pdf.setTextColor(...WHITE); pdf.setFontSize(6); pdf.setFont('helvetica', 'bold')
  pdf.text(lbl, x + w / 2, y, { align: 'center' })
}

// ── Export ────────────────────────────────────────────────────────────────────

type PhotoEntry = { url: string; ref: string }

// Logique de rendu partagée — startAbsPage = numéro absolu de la 1re page paysage
async function doRenderInterventionTableau(
  pdf: jsPDF,
  project: Project,
  interventions: Intervention[],
  photoStore: Record<string, string>,
  startAbsPage: number,
): Promise<void> {
  function resolvePhotos(intv: Intervention, arr: PhotoIntervention[]): PhotoEntry[] {
    return (arr ?? [])
      .map((p) => ({ url: photoStore[`${intv.projectId}_intv_${p.ref}`] || p.url || '', ref: p.ref }))
      .filter((p) => p.url)
  }

  let page = 1; let curY = TBL_Y + 7

  drawHeader(pdf, project, page)
  drawTableHeader(pdf)
  drawFooter(pdf)

  function nextPage() {
    page++; pdf.addPage('a4', 'landscape')
    drawHeader(pdf, project, page); drawTableHeader(pdf); drawFooter(pdf)
    curY = TBL_Y + 7
  }

  /**
   * Dessine statut badge + résumé refs ("Av: P001 P002") + photos numérotées.
   * Tout dans la colonne composante (COL_COMP mm).
   */
  async function renderCompCell(
    statut: string | null,
    avPhotos: PhotoEntry[], apPhotos: PhotoEntry[],
    cellX: number, cellY: number,
  ) {
    const pad = 1.5
    const ty  = cellY + 6

    // ── Statut badge (ligne 1) ─────────────────────────────────────────────
    statutBadge(pdf, statut, cellX, ty, COL_COMP)

    // ── Résumé refs texte (ligne 2, sous le badge) ─────────────────────────
    const avRefs = avPhotos.map((p) => p.ref).join(' ')
    const apRefs = apPhotos.map((p) => p.ref).join(' ')
    const refMaxW = COL_COMP - pad * 2

    if (avRefs || apRefs) {
      let refY = ty + 3.5
      if (avRefs) {
        pdf.setFontSize(5.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...ORANGE)
        pdf.text('Av:', cellX + pad, refY)
        pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...GRAY)
        pdf.text(avRefs, cellX + pad + 5, refY, { maxWidth: refMaxW - 5 })
        refY += 3
      }
      if (apRefs) {
        pdf.setFontSize(5.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...GREEN)
        pdf.text('Ap:', cellX + pad, refY)
        pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...GRAY)
        pdf.text(apRefs, cellX + pad + 5, refY, { maxWidth: refMaxW - 5 })
      }
    }

    // ── Photos en grille avec label AV/AP + bordure colorée ──────────────────
    let photoY = cellY + STAT_H

    const phases: { label: string; photos: PhotoEntry[]; rgb: [n, n, n] }[] = [
      { label: 'AV', photos: avPhotos.slice(0, MAX_PH), rgb: ORANGE },
      { label: 'AP', photos: apPhotos.slice(0, MAX_PH), rgb: GREEN  },
    ]

    for (const { label, photos, rgb } of phases) {
      if (photos.length === 0) continue

      // Badge label AV / AP
      pdf.setFillColor(...rgb)
      pdf.roundedRect(cellX + pad, photoY, 5.5, 3.5, 0.5, 0.5, 'F')
      pdf.setTextColor(...WHITE); pdf.setFontSize(5.5); pdf.setFont('helvetica', 'bold')
      pdf.text(label, cellX + pad + 2.75, photoY + 2.8, { align: 'center' })
      photoY += LABEL_H

      for (let pi = 0; pi < photos.length; pi++) {
        const { url, ref } = photos[pi]
        const col = pi % PH_PER_ROW
        const row = Math.floor(pi / PH_PER_ROW)
        const px  = cellX + pad + col * (PH_W + PH_G)
        const py  = photoY + row * (PH_H + PH_G)

        // Bordure colorée fine : orange = AV, vert = AP
        pdf.setDrawColor(...rgb); pdf.setLineWidth(0.5)
        pdf.rect(px - 0.3, py - 0.3, PH_W + 0.6, PH_H + 0.6)

        try { await ensureImg(url); pdf.addImage(url, fmt(url), px, py, PH_W, PH_H) } catch {}

        // Badge ref (P001) coin bas-droit de la photo
        const nw = pdf.getTextWidth(ref) + 2
        pdf.setFillColor(20, 20, 20)
        pdf.rect(px + PH_W - nw, py + PH_H - 3, nw, 3, 'F')
        pdf.setTextColor(...WHITE); pdf.setFontSize(4.5); pdf.setFont('helvetica', 'bold')
        pdf.text(ref, px + PH_W - 0.8, py + PH_H - 0.6, { align: 'right' })
      }

      photoY += nbRows(photos.length) * (PH_H + PH_G)
    }
  }

  for (let ri = 0; ri < interventions.length; ri++) {
    const intv = interventions[ri]

    const comps = [
      { av: resolvePhotos(intv, intv.photosHotteAvant    ?? []), ap: resolvePhotos(intv, intv.photosHotteApres    ?? []) },
      { av: resolvePhotos(intv, intv.photosSdbAvant      ?? []), ap: resolvePhotos(intv, intv.photosSdbApres      ?? []) },
      { av: resolvePhotos(intv, intv.photosChgtHotteAvant ?? []), ap: resolvePhotos(intv, intv.photosChgtHotteApres ?? []) },
    ]

    const rh = rowHeight(comps.map((c) => ({ avLen: c.av.length, apLen: c.ap.length })))

    if (curY + rh > TBL_Y + 7 + BODY_H) nextPage()

    if (ri % 2 === 0) { pdf.setFillColor(...BG); pdf.rect(ML, curY, UW, rh, 'F') }
    pdf.setDrawColor(...LGRAY); pdf.setLineWidth(0.2)
    pdf.line(ML, curY + rh, ML + UW, curY + rh)

    const ty = curY + 6; const pad = 1.5

    // Date
    pdf.setTextColor(...GRAY); pdf.setFontSize(7); pdf.setFont('helvetica', 'normal')
    pdf.text(safe(intv.date), ML + pad, ty)

    // Appartement + chemin dossier photos
    pdf.setTextColor(...DBLUE); pdf.setFontSize(8); pdf.setFont('helvetica', 'bold')
    pdf.text(safe(intv.appartement), ML + COL_DATE + pad, ty, { maxWidth: COL_APT - pad * 2 })
    const photoFolder = intv.appartement
      ? `interventions/${intv.appartement}/`
      : 'interventions/'
    pdf.setTextColor(...GRAY); pdf.setFontSize(5); pdf.setFont('helvetica', 'normal')
    pdf.text(safe(photoFolder), ML + COL_DATE + pad, ty + 4.5, { maxWidth: COL_APT - pad * 2 })

    // 3 composantes
    const statuts = [intv.hotteStatut, intv.sdbStatut, intv.changementHotteStatut ?? null]
    for (let ci = 0 as 0|1|2; ci < 3; ci++) {
      await renderCompCell(statuts[ci], comps[ci].av, comps[ci].ap, compX(ci), curY)
    }

    // Date 2e avis + absent
    const ax = avisX()
    if (intv.dateDeuxiemeAvis) {
      pdf.setTextColor(...GRAY); pdf.setFontSize(7); pdf.setFont('helvetica', 'normal')
      pdf.text(safe(intv.dateDeuxiemeAvis), ax + pad, ty)
    }
    if (intv.absentDeuxiemeAvis) {
      const aw = pdf.getTextWidth('ABSENT') + 5
      pdf.setFillColor(...RED)
      pdf.roundedRect(ax + (COL_2AVIS - aw) / 2, ty + 2, aw, 4, 0.5, 0.5, 'F')
      pdf.setTextColor(...WHITE); pdf.setFontSize(6); pdf.setFont('helvetica', 'bold')
      pdf.text('ABSENT', ax + COL_2AVIS / 2, ty + 4.8, { align: 'center' })
    }

    // Notes / Particularités (cases à cocher + texte)
    const nx = notesX(); const nw = COL_NOTES - pad * 2
    let noteY = ty
    if (intv.replHotte30) {
      const quoi = intv.replHotte30 === 'hotte' ? 'hotte seule' : intv.replHotte30 === 'filtres' ? 'filtres seuls' : 'hotte + filtres'
      pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(37, 99, 235)
      pdf.text('Repl. hotte 30" : ' + quoi, nx + pad, noteY, { maxWidth: nw })
      noteY += 4
    }
    if (intv.replHotte24) {
      const quoi = intv.replHotte24 === 'hotte' ? 'hotte seule' : intv.replHotte24 === 'filtres' ? 'filtres seuls' : 'hotte + filtres'
      pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(37, 99, 235)
      pdf.text('Repl. hotte 24" : ' + quoi, nx + pad, noteY, { maxWidth: nw })
      noteY += 4
    }
    if (intv.notes) {
      const lines = (pdf.splitTextToSize(safe(intv.notes), nw) as string[]).slice(0, 5)
      pdf.setTextColor(75, 85, 99); pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal')
      lines.forEach((l: string, li: number) => pdf.text(l, nx + pad, noteY + li * 3.5))
    }

    curY += rh
  }

  for (let p = 1; p <= page; p++) {
    pdf.setPage(startAbsPage + p - 1)
    pdf.setFillColor(...DBLUE); pdf.rect(PW - MR - 24, 20, 24, 5.5, 'F')
    pdf.setTextColor(...WHITE); pdf.setFontSize(7); pdf.setFont('helvetica', 'normal')
    pdf.text(`Page ${p} / ${page}`, PW - MR, 24, { align: 'right' })
  }
  pdf.setPage(pdf.getNumberOfPages())
}

export async function generateInterventionReport(
  project: Project,
  interventions: Intervention[],
  photoStore: Record<string, string>,
): Promise<void> {
  if (interventions.length === 0) return
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  await doRenderInterventionTableau(pdf, project, interventions, photoStore, 1)
  pdf.save(`rapport-intervention-${new Date().toISOString().slice(0, 10)}.pdf`)
}

export async function appendInterventionTableau(
  pdf: jsPDF,
  project: Project,
  interventions: Intervention[],
  photoStore: Record<string, string>,
): Promise<void> {
  if (interventions.length === 0) return
  pdf.addPage('a4', 'landscape')
  const startAbsPage = pdf.getNumberOfPages()
  await doRenderInterventionTableau(pdf, project, interventions, photoStore, startAbsPage)
}

// ── Fiches individuelles A4 portrait ─────────────────────────────────────────

const FPW = 210; const FPH = 297
const FML = 12;  const FMR = 12
const FUW = FPW - FML - FMR          // 186 mm
const F_HDR   = 30
const F_APT   = 14                   // bandeau appartement
const F_FTR   = 8
const F_BY    = F_HDR + F_APT        // corps commence à y = 44
const F_BE    = FPH - F_FTR          // corps finit à y = 289
const F_PHW   = 22; const F_PHH = 22; const F_PHG = 2
const F_PPR   = 3                    // photos par rangée
const F_MAXPH = 6
const F_COL   = FUW / 2              // 93 mm par colonne AV / AP
const F_PAD   = 3

function fGridH(count: number): number {
  if (count === 0) return 0
  return Math.ceil(Math.min(count, F_MAXPH) / F_PPR) * (F_PHH + F_PHG)
}

function fSectionH(avLen: number, apLen: number): number {
  if (avLen === 0 && apLen === 0) return 22
  return 10 + 5 + Math.max(fGridH(avLen), fGridH(apLen)) + 4 + 4
}

function drawFicheHeader(pdf: jsPDF, project: Project) {
  pdf.setFillColor(...DBLUE); pdf.rect(0, 0, FPW, F_HDR, 'F')
  pdf.setTextColor(...WHITE)

  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold')
  pdf.text('RAPPORT D\'INTERVENTION – FICHE APPARTEMENT', FML, 8)
  pdf.setFontSize(7); pdf.setFont('helvetica', 'normal')
  pdf.text(new Date().toLocaleDateString('fr-CA'), FPW - FMR, 8, { align: 'right' })

  const mid = FPW / 2
  pdf.setFontSize(6.5)
  pdf.text(safe('Projet : ' + (project.name || '')), FML, 16, { maxWidth: 60 })
  if (project.client)  pdf.text(safe('Client : ' + project.client),  mid, 16, { align: 'center', maxWidth: 60 })
  if (project.adresse) pdf.text(safe('Adresse : ' + project.adresse), FPW - FMR, 16, { align: 'right', maxWidth: 60 })

  if (project.mandat)  pdf.text(safe('Mandat N° : ' + project.mandat),   FML, 24, { maxWidth: 60 })
  if (project.contrat) pdf.text(safe('Contrat SDC : ' + project.contrat), mid, 24, { align: 'center', maxWidth: 60 })
}

function drawFicheFooter(pdf: jsPDF, p: number, total: number) {
  const y = FPH - F_FTR + 1
  pdf.setDrawColor(...LGRAY); pdf.setLineWidth(0.25); pdf.line(FML, y, FPW - FMR, y)
  pdf.setTextColor(...GRAY); pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal')
  pdf.text('Confidentiel — Usage interne', FPW / 2, y + 4, { align: 'center' })
  pdf.setFillColor(...DBLUE); pdf.rect(FPW - FMR - 24, y - 0.5, 24, 5.5, 'F')
  pdf.setTextColor(...WHITE); pdf.setFontSize(7); pdf.setFont('helvetica', 'bold')
  pdf.text(`Page ${p} / ${total}`, FPW - FMR, y + 4, { align: 'right' })
}

async function drawFicheComp(
  pdf: jsPDF,
  label: string,
  statut: string | null,
  avPhotos: PhotoEntry[],
  apPhotos: PhotoEntry[],
  y: number,
) {
  const sh = fSectionH(avPhotos.length, apPhotos.length)
  const hasPhotos = avPhotos.length > 0 || apPhotos.length > 0

  // Bandeau titre composante
  pdf.setFillColor(239, 246, 255); pdf.rect(FML, y, FUW, 10, 'F')
  pdf.setDrawColor(...LGRAY); pdf.setLineWidth(0.2)
  pdf.rect(FML, y, FUW, sh - 4)

  pdf.setTextColor(...DBLUE); pdf.setFontSize(9); pdf.setFont('helvetica', 'bold')
  pdf.text(label.toUpperCase(), FML + F_PAD, y + 6.8)
  if (statut) statutBadge(pdf, statut, FML + FUW - 45, y + 7, 42)

  if (!hasPhotos) {
    pdf.setTextColor(...LGRAY); pdf.setFontSize(7); pdf.setFont('helvetica', 'italic')
    pdf.text('Aucune photo enregistrée', FML + F_PAD, y + 16)
    return
  }

  // Séparateur vertical AV / AP
  const sepX = FML + F_COL
  pdf.setDrawColor(...LGRAY); pdf.setLineWidth(0.2)
  pdf.line(sepX, y + 10, sepX, y + sh - 4)

  const phases: { label: string; photos: PhotoEntry[]; rgb: [n, n, n]; col: number }[] = [
    { label: 'AV', photos: avPhotos.slice(0, F_MAXPH), rgb: ORANGE, col: 0 },
    { label: 'AP', photos: apPhotos.slice(0, F_MAXPH), rgb: GREEN,  col: 1 },
  ]

  for (const { label: ph_lbl, photos, rgb, col } of phases) {
    if (photos.length === 0) continue
    const cx = FML + col * F_COL + F_PAD
    let py = y + 10

    // Badge AV / AP
    pdf.setFillColor(...rgb)
    pdf.roundedRect(cx, py, 6, 4, 0.5, 0.5, 'F')
    pdf.setTextColor(...WHITE); pdf.setFontSize(5.5); pdf.setFont('helvetica', 'bold')
    pdf.text(ph_lbl, cx + 3, py + 3, { align: 'center' })
    py += 5

    // Grille photos
    for (let pi = 0; pi < photos.length; pi++) {
      const { url, ref } = photos[pi]
      const pc = pi % F_PPR
      const pr = Math.floor(pi / F_PPR)
      const px = cx + pc * (F_PHW + F_PHG)
      const py2 = py + pr * (F_PHH + F_PHG)

      pdf.setDrawColor(...rgb); pdf.setLineWidth(0.5)
      pdf.rect(px - 0.3, py2 - 0.3, F_PHW + 0.6, F_PHH + 0.6)

      try { await ensureImg(url); pdf.addImage(url, fmt(url), px, py2, F_PHW, F_PHH) } catch {}

      const nw = pdf.getTextWidth(ref) + 2
      pdf.setFillColor(20, 20, 20)
      pdf.rect(px + F_PHW - nw, py2 + F_PHH - 3, nw, 3, 'F')
      pdf.setTextColor(...WHITE); pdf.setFontSize(4.5); pdf.setFont('helvetica', 'bold')
      pdf.text(ref, px + F_PHW - 0.8, py2 + F_PHH - 0.6, { align: 'right' })
    }

    // Refs texte sous les photos
    const refs = photos.map((p) => p.ref).join(' ')
    py += fGridH(photos.length) + 1
    pdf.setFontSize(5.5); pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...rgb)
    pdf.text(ph_lbl === 'AV' ? 'Av:' : 'Ap:', cx, py)
    pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...GRAY)
    pdf.text(refs, cx + 5, py, { maxWidth: F_COL - F_PAD * 2 - 5 })
  }
}

// addFirstPage = false : 1re page déjà créée (standalone) ; true : toujours addPage (annexe)
async function doRenderInterventionFiches(
  pdf: jsPDF,
  project: Project,
  interventions: Intervention[],
  photoStore: Record<string, string>,
  addFirstPage: boolean,
): Promise<void> {
  function resolvePhotos(intv: Intervention, arr: PhotoIntervention[]): PhotoEntry[] {
    return (arr ?? [])
      .map((p) => ({ url: photoStore[`${intv.projectId}_intv_${p.ref}`] || p.url || '', ref: p.ref }))
      .filter((p) => p.url)
  }

  const totalPages = interventions.length
  let pageNum = 0

  for (const intv of interventions) {
    pageNum++
    if (addFirstPage || pageNum > 1) pdf.addPage('a4', 'portrait')

    const comps = [
      { label: 'Hotte',      statut: intv.hotteStatut,
        av: resolvePhotos(intv, intv.photosHotteAvant ?? []),
        ap: resolvePhotos(intv, intv.photosHotteApres ?? []) },
      { label: 'SDB',        statut: intv.sdbStatut,
        av: resolvePhotos(intv, intv.photosSdbAvant ?? []),
        ap: resolvePhotos(intv, intv.photosSdbApres ?? []) },
      { label: 'Chgt hotte', statut: intv.changementHotteStatut ?? null,
        av: resolvePhotos(intv, intv.photosChgtHotteAvant ?? []),
        ap: resolvePhotos(intv, intv.photosChgtHotteApres ?? []) },
    ]

    // ── En-tête projet ────────────────────────────────────────────────────────
    drawFicheHeader(pdf, project)

    // ── Bandeau appartement ───────────────────────────────────────────────────
    pdf.setFillColor(237, 242, 255); pdf.rect(0, F_HDR, FPW, F_APT, 'F')
    pdf.setDrawColor(...LGRAY); pdf.setLineWidth(0.3)
    pdf.line(0, F_HDR + F_APT, FPW, F_HDR + F_APT)

    pdf.setTextColor(...DBLUE); pdf.setFontSize(13); pdf.setFont('helvetica', 'bold')
    pdf.text(safe(intv.appartement || '(sans nom)'), FML, F_HDR + 9.5)

    pdf.setTextColor(...GRAY); pdf.setFontSize(7); pdf.setFont('helvetica', 'normal')
    pdf.text(safe(intv.date), FPW - FMR, F_HDR + 6, { align: 'right' })
    const folder = intv.appartement ? `interventions/${intv.appartement}/` : 'interventions/'
    pdf.setFontSize(5.5)
    pdf.text(safe(folder), FPW - FMR, F_HDR + 12, { align: 'right' })

    // ── Sections composantes ──────────────────────────────────────────────────
    let curY = F_BY + 3

    for (const comp of comps) {
      const sh = fSectionH(comp.av.length, comp.ap.length)
      if (curY + sh > F_BE - 32) {
        // Overflow : nouvelle page portrait
        drawFicheFooter(pdf, pageNum, totalPages)
        pdf.addPage('a4', 'portrait')
        drawFicheHeader(pdf, project)
        pdf.setFillColor(237, 242, 255); pdf.rect(0, F_HDR, FPW, F_APT, 'F')
        pdf.setTextColor(...DBLUE); pdf.setFontSize(11); pdf.setFont('helvetica', 'bold')
        pdf.text(safe(intv.appartement || '(sans nom)') + ' (suite)', FML, F_HDR + 9.5)
        pdf.setDrawColor(...LGRAY); pdf.line(0, F_HDR + F_APT, FPW, F_HDR + F_APT)
        curY = F_BY + 3
      }
      await drawFicheComp(pdf, comp.label, comp.statut, comp.av, comp.ap, curY)
      curY += sh
    }

    // ── Date 2e avis + notes ──────────────────────────────────────────────────
    if (curY + 28 > F_BE) { drawFicheFooter(pdf, pageNum, totalPages); pdf.addPage('a4', 'portrait'); drawFicheHeader(pdf, project); curY = F_BY + 3 }

    pdf.setDrawColor(...LGRAY); pdf.setLineWidth(0.2)
    pdf.rect(FML, curY, FUW, 28)
    pdf.setFillColor(250, 250, 250); pdf.rect(FML, curY, FUW, 7, 'F')
    pdf.setTextColor(...DBLUE); pdf.setFontSize(8); pdf.setFont('helvetica', 'bold')
    pdf.text('2e AVIS / NOTES', FML + F_PAD, curY + 5)

    let noteY = curY + 11
    if (intv.dateDeuxiemeAvis) {
      pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...GRAY)
      pdf.text('Date 2e avis : ' + safe(intv.dateDeuxiemeAvis), FML + F_PAD, noteY)
      if (intv.absentDeuxiemeAvis) {
        pdf.setFillColor(...RED); pdf.roundedRect(FML + F_PAD + 45, noteY - 3.5, 18, 4.5, 0.5, 0.5, 'F')
        pdf.setTextColor(...WHITE); pdf.setFontSize(6); pdf.setFont('helvetica', 'bold')
        pdf.text('ABSENT', FML + F_PAD + 54, noteY, { align: 'center' })
      }
      noteY += 5
    }
    if (intv.replHotte30) {
      const q = intv.replHotte30 === 'hotte' ? 'hotte seule' : intv.replHotte30 === 'filtres' ? 'filtres seuls' : 'hotte + filtres'
      pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...BLUE)
      pdf.text('Repl. hotte 30" : ' + q, FML + F_PAD, noteY, { maxWidth: FUW - F_PAD * 2 }); noteY += 4.5
    }
    if (intv.replHotte24) {
      const q = intv.replHotte24 === 'hotte' ? 'hotte seule' : intv.replHotte24 === 'filtres' ? 'filtres seuls' : 'hotte + filtres'
      pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...BLUE)
      pdf.text('Repl. hotte 24" : ' + q, FML + F_PAD, noteY, { maxWidth: FUW - F_PAD * 2 }); noteY += 4.5
    }
    if (intv.notes) {
      const lines = (pdf.splitTextToSize(safe(intv.notes), FUW - F_PAD * 2) as string[]).slice(0, 4)
      pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(75, 85, 99)
      lines.forEach((l, li) => pdf.text(l, FML + F_PAD, noteY + li * 4))
    }

    // ── Pied de page ──────────────────────────────────────────────────────────
    drawFicheFooter(pdf, pageNum, totalPages)
  }
}

export async function generateInterventionFiches(
  project: Project,
  interventions: Intervention[],
  photoStore: Record<string, string>,
): Promise<void> {
  if (interventions.length === 0) return
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  await doRenderInterventionFiches(pdf, project, interventions, photoStore, false)
  pdf.save(`fiches-intervention-${new Date().toISOString().slice(0, 10)}.pdf`)
}

export async function appendInterventionFiches(
  pdf: jsPDF,
  project: Project,
  interventions: Intervention[],
  photoStore: Record<string, string>,
): Promise<void> {
  if (interventions.length === 0) return
  await doRenderInterventionFiches(pdf, project, interventions, photoStore, true)
}
