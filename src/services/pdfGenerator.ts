import jsPDF from 'jspdf'
import type {
  Project, Plan, TravailNettoyage, Systeme,
  ReportSection, EquipmentListReportSection, ObservationsReportSection, TextReportSection,
  EquipmentItem, ObservationItem, TypeAnomalie,
  ZoneConduit,
} from '@/types'
import { COMPOSANTES_CVAC, METHODES_NETTOYAGE, ANOMALIE_LABELS, composanteRGB } from '@/types'
import type { Intervention } from '@/types/interventions'
import { appendInterventionTableau } from './interventionPdfGenerator'

// ── Utilitaires ───────────────────────────────────────────────────────────────
const safe = (v: any): string => (v == null ? '' : String(v))

// ── Palette — identique à l'application inspection ────────────────────────────
const BLUE:  [number,number,number] = [27,  79,  138]
const LGRAY: [number,number,number] = [100, 116, 139]
const LBLUE: [number,number,number] = [235, 242, 250]
const DGRAY: [number,number,number] = [55,  65,  81]

// ── Mise en page 11×17" tabloid paysage ──────────────────────────────────────
const TABLOID_W = 431.8
const TABLOID_H = 279.4
const CART_W    = 75
const CART_X    = TABLOID_W - CART_W - 2
const PLAN_X    = 2
const PLAN_W    = CART_X - 3 - PLAN_X
const PLAN_Y    = 4
const PLAN_H    = TABLOID_H - PLAN_Y - 4

// ── A4 portrait — constantes section (mêmes que l'inspection) ────────────────
const S_PH      = 297
const S_PW      = 210
const S_ML      = 12
const S_MT      = 10
const S_MB      = 10
const S_UW      = S_PW - 2 * S_ML       // 186 mm
const S_HDR_H   = 35
const S_FTR_H   = 14
const S_CARDS_Y = S_MT + S_HDR_H + 3
const S_LW      = Math.floor(S_UW / 2)  // moitié gauche (93 mm)
const LINE_H    = 6.5

const STATUT_RGB: Record<string, [number,number,number]> = {
  a_faire:  [107, 114, 128],
  en_cours: [245, 158, 11],
  complete: [16,  185, 129],
  valide:   [59,  130, 246],
}

function travailColor(t: TravailNettoyage): [number,number,number] {
  return composanteRGB(t.typeComposante)
}

// ── Images ────────────────────────────────────────────────────────────────────
async function loadImgDims(src: string): Promise<{ w: number; h: number }> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload  = () => resolve({ w: img.naturalWidth,  h: img.naturalHeight })
    img.onerror = () => resolve({ w: 0, h: 0 })
    img.src = src
  })
}

function fitInBox(iw: number, ih: number, maxW: number, maxH: number) {
  if (iw <= 0 || ih <= 0) return { w: maxW, h: maxH }
  const ratio = iw / ih
  return maxW / ratio <= maxH ? { w: maxW, h: maxW / ratio } : { w: maxH * ratio, h: maxH }
}

function imgFmt(dataUrl: string): string {
  return dataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG'
}

function projectAdresse(project: Project): string {
  const a = safe(project.adresse)
  const v = safe(project.ville)
  return a && v ? `${a}, ${v}` : a || v
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE DE COUVERTURE — même design exact que l'inspection
// ─────────────────────────────────────────────────────────────────────────────
export async function drawCoverPage(pdf: jsPDF, project: Project, opts?: { titre?: string }): Promise<void> {
  const cpW  = 210, cpH = 297
  const cpML = 15,  cpMR = 15
  const cpUW = cpW - cpML - cpMR  // 180 mm

  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, 0, cpW, cpH, 'F')

  // ── Entête : logo ────────────────────────────────────────────────────────
  const hdrH     = 28
  const cpLogoSrc = project.logo
  if (cpLogoSrc) {
    try {
      const fmt = imgFmt(cpLogoSrc)
      const { w: iw, h: ih } = await loadImgDims(cpLogoSrc)
      const { w: lw, h: lh } = fitInBox(iw, ih, cpUW, hdrH - 4)
      pdf.addImage(cpLogoSrc, fmt, cpML, 3 + (hdrH - 4 - lh) / 2, lw, lh)
    } catch {
      pdf.setTextColor(...BLUE); pdf.setFontSize(22); pdf.setFont('helvetica', 'bold')
      pdf.text('SDC', cpML, 20)
      pdf.setTextColor(34, 197, 94); pdf.setFontSize(8); pdf.setFont('helvetica', 'bold')
      pdf.text('TRAVAUX SPÉCIALISÉS', cpML + 21, 17)
    }
  } else {
    pdf.setTextColor(...BLUE); pdf.setFontSize(22); pdf.setFont('helvetica', 'bold')
    pdf.text('SDC', cpML, 20)
    pdf.setTextColor(34, 197, 94); pdf.setFontSize(8); pdf.setFont('helvetica', 'bold')
    pdf.text('TRAVAUX SPÉCIALISÉS', cpML + 21, 17)
  }

  // Ligne horizontale sous l'entête
  pdf.setDrawColor(0, 0, 0); pdf.setLineWidth(0.5)
  pdf.line(cpML, hdrH + 3, cpML + cpUW, hdrH + 3)

  // ── Bloc CLIENT / PROJET / ADRESSE ──────────────────────────────────────
  let cpY = hdrH + 14
  const lblX       = cpML
  const valX       = cpML + 24
  const valW       = cpUW - 24
  const cpAddr     = projectAdresse(project)
  const contratCvr = safe(project.contrat)

  pdf.setFontSize(10)
  const cpInfoRows: [string, string][] = [
    ['CLIENT :',  safe(project.client)],
    ['PROJET :',  safe(project.name)],
    ['ADRESSE :', cpAddr],
  ]
  if (safe(project.mandat)) cpInfoRows.push(['MANDAT :', safe(project.mandat)])
  const rapportRef = [safe(project.numeroRapport), safe(project.versionRapport) && `Rév. ${safe(project.versionRapport)}`]
    .filter(Boolean).join(' — ')
  if (rapportRef) cpInfoRows.push(['N° RAPPORT :', rapportRef])

  for (const [lbl, val] of cpInfoRows) {
    if (!val) continue
    pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0, 0, 0)
    pdf.text(lbl, lblX, cpY)
    pdf.setFont('helvetica', 'normal')
    const vLines = (pdf.splitTextToSize(val, valW) as string[]).slice(0, 3)
    pdf.text(vLines, valX, cpY)
    cpY += vLines.length * 5.8
  }

  // ── Titre principal — aligné à droite, milieu de page ────────────────────
  const titleY = 148
  const rightX = cpML + cpUW
  const titreBrut = opts?.titre || safe(project.titreRapport) || "Rapport d'intervention – Nettoyage des systèmes de ventilation"
  // Découper sur le tiret/dash long pour afficher sur 2 lignes si présent
  const titreParts = titreBrut.split(/\s*[–—-]\s*/)
  pdf.setFontSize(17); pdf.setFont('helvetica', 'bolditalic'); pdf.setTextColor(0, 0, 0)
  if (titreParts.length >= 2) {
    pdf.text(titreParts[0].toUpperCase(), rightX, titleY, { align: 'right' })
    pdf.setFontSize(15)
    pdf.text(titreParts.slice(1).join(' – '), rightX, titleY + 9, { align: 'right' })
  } else {
    const tLines = pdf.splitTextToSize(titreBrut.toUpperCase(), cpUW) as string[]
    tLines.slice(0, 2).forEach((line, i) =>
      pdf.text(line, rightX, titleY + i * 9, { align: 'right' })
    )
  }

  if (cpAddr) {
    const titleEndY = titreParts.length >= 2 ? titleY + 18 : titleY + 9 * Math.min(2, titreParts.length) + 9
    pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(80, 80, 80)
    const aLines = pdf.splitTextToSize(cpAddr, cpUW) as string[]
    pdf.text(aLines[0] || '', rightX, titleEndY, { align: 'right' })
  }

  // ── Préparé par / Préparé pour ───────────────────────────────────────────
  const prepY = 195
  const halfW = cpUW / 2 - 5

  pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(0, 0, 0)
  pdf.text('Préparé par :', cpML, prepY)
  pdf.setFont('helvetica', 'bold')
  pdf.text(safe(project.preparePar) || 'Service d\'Entretien Carlos Inc.', cpML, prepY + 6)
  pdf.setFont('helvetica', 'normal')
  pdf.text('8610 Du Creusot,', cpML, prepY + 12)
  pdf.text('St-Léonard, H1P-2A7 (Qc)', cpML, prepY + 18)
  if (contratCvr) pdf.text(`No de projet SDC inc : ${contratCvr}`, cpML, prepY + 24)

  pdf.setFont('helvetica', 'normal')
  pdf.text('Préparé pour :', rightX, prepY, { align: 'right' })
  pdf.setFont('helvetica', 'bold')
  pdf.text(safe(project.client), rightX, prepY + 6, { align: 'right' })
  pdf.setFont('helvetica', 'normal')
  const clientAddr = safe(project.adresseClient)
  if (clientAddr) {
    const forLines = pdf.splitTextToSize(clientAddr, halfW) as string[]
    forLines.slice(0, 3).forEach((line, i) => pdf.text(line, rightX, prepY + 12 + i * 6, { align: 'right' }))
  }
  const contact = safe(project.contact)
  if (contact) pdf.text(`Contact : ${contact}`, rightX, prepY + 30, { align: 'right' })

  // ── Pied de page ─────────────────────────────────────────────────────────
  const cpFtrY = cpH - 14
  pdf.setFillColor(195, 195, 195)
  pdf.rect(0, cpFtrY, cpW, 14, 'F')
  pdf.setFontSize(6); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(30, 30, 30)
  pdf.text('8610 Rue du Creusot, Saint Léonard, QC, Canada H1P2A7', cpML, cpFtrY + 5)
  pdf.text('Tél: (514) 727-3415  |  www.sdconline.com', cpML, cpFtrY + 10)
  pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...BLUE)
  pdf.text('RBQ: 8107-8735-35  |  NADCA', cpW - cpMR, cpFtrY + 5, { align: 'right' })
  pdf.setFont('helvetica', 'normal'); pdf.setTextColor(30, 30, 30)
  pdf.text('ISO 9001:2015  |  ISO 14001:2015  |  OHSAS 18001:2007', cpW - cpMR, cpFtrY + 10, { align: 'right' })
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE D'IDENTIFICATION — même design que l'inspection, titre nettoyage
// ─────────────────────────────────────────────────────────────────────────────
async function drawIdentificationPage(pdf: jsPDF, project: Project): Promise<void> {
  pdf.addPage('a4', 'p')

  const PW = 210, PH = 297
  const ML = 20,  MR = 20
  const UW = PW - ML - MR  // 170 mm

  // ── Zones fixes ────────────────────────────────────────────────────────────
  const ftrY   = PH - 14          // pied de page : 283 mm
  const SIG_Y  = ftrY - 52        // signatures commencent à 231 mm
  const EMIS_Y = SIG_Y - 38       // "ÉMIS POUR INFORMATION" à 193 mm
  const BOX_MAX_BOTTOM = EMIS_Y - 10  // boîte info ne dépasse pas 183 mm

  // ── Logo ───────────────────────────────────────────────────────────────────
  const idLogoSrc = project.logo
  if (idLogoSrc) {
    try {
      const fmt = imgFmt(idLogoSrc)
      const { w: iw, h: ih } = await loadImgDims(idLogoSrc)
      const { w: lw, h: lh } = fitInBox(iw, ih, 80, 22)
      pdf.addImage(idLogoSrc, fmt, ML, 8, lw, lh)
    } catch {
      pdf.setTextColor(...BLUE); pdf.setFontSize(18); pdf.setFont('helvetica', 'bold')
      pdf.text('SDC', ML, 22)
    }
  } else {
    pdf.setTextColor(...BLUE); pdf.setFontSize(18); pdf.setFont('helvetica', 'bold')
    pdf.text('SDC', ML, 22)
    pdf.setTextColor(34, 197, 94); pdf.setFontSize(7); pdf.setFont('helvetica', 'bold')
    pdf.text('TRAVAUX SPÉCIALISÉS', ML + 19, 19)
  }

  pdf.setDrawColor(...BLUE); pdf.setLineWidth(0.8)
  pdf.line(ML, 34, ML + UW, 34)

  // ── Titre du document ──────────────────────────────────────────────────────
  let y = 50
  const idTitreBrut = safe(project.titreRapport) || "Rapport d'intervention – Nettoyage des systèmes de ventilation"
  const idTitreParts = idTitreBrut.split(/\s*[–—-]\s*/)
  pdf.setFontSize(15); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...BLUE)
  pdf.text(idTitreParts[0].toUpperCase(), PW / 2, y, { align: 'center' })
  if (idTitreParts.length >= 2) {
    pdf.setFontSize(13); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(0, 0, 0)
    pdf.text(idTitreParts.slice(1).join(' – '), PW / 2, y + 9, { align: 'center' })
  }
  const projName = safe(project.name)
  if (projName) {
    pdf.setFontSize(8.5); pdf.setTextColor(...LGRAY)
    const nameLines = pdf.splitTextToSize(projName, UW - 20) as string[]
    nameLines.slice(0, 2).forEach((line, i) => pdf.text(line, PW / 2, y + 20 + i * 5, { align: 'center' }))
  }

  // ── Séparateur ─────────────────────────────────────────────────────────────
  y += 33
  pdf.setDrawColor(200, 200, 200); pdf.setLineWidth(0.3)
  pdf.line(ML + 15, y, ML + UW - 15, y)

  // ── Bloc info projet ───────────────────────────────────────────────────────
  const boxStart = y + 8
  const boxML = ML + 10, boxW = UW - 20
  const LABEL_X = boxML + 4, LABEL_W = 44
  const VAL_X   = boxML + LABEL_W + 2, VAL_W = boxW - LABEL_W - 6

  const idAddr = projectAdresse(project)
  const infoRows: [string, string][] = [
    ['Projet :',          safe(project.name)],
    ['Client :',          safe(project.client)],
    ['Adresse travaux :', idAddr],
    ['N° contrat SDC :',  safe(project.contrat)],
    ['Technicien :',      safe(project.technicien)],
  ]
  if (safe(project.contact))           infoRows.push(['Contact :',            safe(project.contact)])
  if (safe(project.mandat))            infoRows.push(['Mandat :',             safe(project.mandat)])
  if (safe(project.referenceClient))   infoRows.push(['Réf. client :',        safe(project.referenceClient)])
  if (safe(project.documentsConnexes)) infoRows.push(['Documents connexes :', safe(project.documentsConnexes)])

  const bonCde = safe(project.bonCommande)
  const ROW_H = 8.5
  pdf.setFontSize(8.5)

  // Calculer hauteur réelle et cap au maximum autorisé
  let rawBoxH = 7
  for (const [, val] of infoRows) {
    if (!val) continue
    const n = (pdf.splitTextToSize(val, VAL_W) as string[]).slice(0, 2).length
    rawBoxH += n > 1 ? ROW_H + 4.5 : ROW_H
  }
  if (bonCde) rawBoxH += 14
  rawBoxH += 4
  const boxH = Math.min(rawBoxH, BOX_MAX_BOTTOM - boxStart)

  // Fond + bordure
  pdf.setFillColor(247, 249, 252)
  pdf.setDrawColor(210, 218, 230); pdf.setLineWidth(0.3)
  pdf.roundedRect(boxML, boxStart, boxW, boxH, 2, 2, 'FD')

  // Lignes de données
  let iy = boxStart + 9
  const clipBottom = boxStart + boxH - 6
  for (const [lbl, val] of infoRows) {
    if (!val || iy > clipBottom) continue
    const vLines = (pdf.splitTextToSize(val, VAL_W) as string[]).slice(0, 2)
    pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...LGRAY)
    pdf.text(lbl, LABEL_X, iy)
    pdf.setFont('helvetica', 'normal'); pdf.setTextColor(0, 0, 0)
    vLines.forEach((line, li) => pdf.text(line, VAL_X, iy + li * 4.5))
    iy += vLines.length > 1 ? ROW_H + 4.5 : ROW_H
  }

  // Bon de commande — dans la boîte, séparé par un trait
  if (bonCde && iy + 14 <= clipBottom + 6) {
    pdf.setDrawColor(210, 218, 230); pdf.setLineWidth(0.3)
    pdf.line(boxML + 4, iy, boxML + boxW - 4, iy)
    iy += 5
    pdf.setFont('helvetica', 'bolditalic'); pdf.setFontSize(8.5); pdf.setTextColor(30, 64, 175)
    pdf.text(
      `Mandat autorisé par le bon de commande N° ${bonCde}`,
      boxML + boxW / 2, iy, { align: 'center' },
    )
  }

  // ── ÉMIS POUR INFORMATION — position fixe ─────────────────────────────────
  pdf.setDrawColor(200, 200, 200); pdf.setLineWidth(0.3)
  pdf.line(ML + 15, EMIS_Y - 6, ML + UW - 15, EMIS_Y - 6)

  const emisPourVal = safe(project.emisPour) || 'RAPPORT FINAL'
  pdf.setFontSize(12); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...BLUE)
  pdf.text(`ÉMIS POUR ${emisPourVal}`, PW / 2, EMIS_Y, { align: 'center' })
  const todayStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  pdf.setFontSize(10); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(0, 0, 0)
  pdf.text(`Le ${todayStr}`, PW / 2, EMIS_Y + 9, { align: 'center' })

  pdf.setDrawColor(200, 200, 200); pdf.setLineWidth(0.3)
  pdf.line(ML + 15, EMIS_Y + 17, ML + UW - 15, EMIS_Y + 17)

  // ── Bloc signatures — position fixe ───────────────────────────────────────
  const colW   = UW / 2 - 8
  const leftSX  = ML
  const rightSX = ML + UW / 2 + 8

  pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...LGRAY)
  pdf.text('Préparé par :', leftSX,  SIG_Y)
  pdf.text('Vérifié par :', rightSX, SIG_Y)

  const techSig = Array.isArray(project.signatures)
    ? project.signatures.find((s: any) => s.type === 'technicien')
    : undefined
  const sigImgH = 18
  if (techSig?.dataUrl) {
    try { pdf.addImage(techSig.dataUrl, 'PNG', leftSX, SIG_Y + 5, colW - 5, sigImgH) } catch { /* skip */ }
  }

  const lineY = SIG_Y + 5 + sigImgH + 4
  pdf.setDrawColor(0, 0, 0); pdf.setLineWidth(0.4)
  pdf.line(leftSX,  lineY, leftSX  + colW, lineY)
  pdf.line(rightSX, lineY, rightSX + colW, lineY)

  pdf.setFontSize(9.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0, 0, 0)
  const techName  = safe(project.preparePar) || safe(project.technicien)
  const verifName = safe(project.verificateur)
  if (techName)  pdf.text(techName,  leftSX,  lineY + 7)
  if (verifName) pdf.text(verifName, rightSX, lineY + 7)

  // Titre fonction sous les noms
  pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...LGRAY)
  const prepTitre  = safe(project.prepareParTitre)  || 'Technicien responsable'
  const verifTitre = safe(project.verificateurTitre) || 'Vérificateur'
  pdf.text(prepTitre,  leftSX,  lineY + 13)
  pdf.text(verifTitre, rightSX, lineY + 13)

  // ── Pied de page ───────────────────────────────────────────────────────────
  pdf.setFillColor(195, 195, 195)
  pdf.rect(0, ftrY, PW, 14, 'F')
  pdf.setFontSize(6); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(30, 30, 30)
  pdf.text('8610 Rue du Creusot, Saint Léonard, QC, Canada H1P2A7', ML, ftrY + 5)
  pdf.text('Tél: (514) 727-3415  |  www.sdconline.com', ML, ftrY + 10)
  pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...BLUE)
  pdf.text('RBQ: 8107-8735-35  |  NADCA', PW - MR, ftrY + 5, { align: 'right' })
  pdf.setFont('helvetica', 'normal'); pdf.setTextColor(30, 30, 30)
  pdf.text('ISO 9001:2015  |  ISO 14001:2015  |  OHSAS 18001:2007', PW - MR, ftrY + 10, { align: 'right' })
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Crop d'une tuile d'image via canvas ───────────────────────────────────────
async function cropImageTile(
  imgData: string,
  x0: number, y0: number, srcW: number, srcH: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = Math.max(1, Math.round(srcW))
      canvas.height = Math.max(1, Math.round(srcH))
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, x0, y0, srcW, srcH, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.92))
    }
    img.onerror = reject
    img.src = imgData
  })
}

// CARTOUCHE 11×17" TABLOID — identique inspection, couleurs bleues
// ─────────────────────────────────────────────────────────────────────────────
async function drawCartouche(pdf: jsPDF, project: Project, plan: Plan, tileLabel?: string): Promise<void> {
  const cx = CART_X, CW = CART_W, CH = TABLOID_H

  // Fond blanc global
  pdf.setFillColor(255, 255, 255); pdf.rect(cx, 0, CW, CH, 'F')

  // ── SECTION SUPÉRIEURE : LÉGENDE ─────────────────────────────────────────────
  const legendH = 92
  {
    const LX  = cx, LY = 0, LW = CW
    const PAD = 2.5
    const LH  = 5.2
    const FS  = 5
    const C1  = 34

    const divider = (yy: number) => {
      pdf.setDrawColor(180, 180, 180); pdf.setLineWidth(0.2)
      pdf.line(LX, yy, LX + LW, yy)
    }
    const secTitle = (label: string, yy: number): number => {
      pdf.setFillColor(245, 247, 250); pdf.rect(LX, yy, LW, 5.5, 'F')
      divider(yy); divider(yy + 5.5)
      pdf.setFontSize(FS); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(30, 41, 59)
      pdf.text(label, LX + PAD, yy + 3.8)
      return yy + 5.5
    }

    let ly = LY

    // Titre
    pdf.setFillColor(30, 41, 59); pdf.rect(LX, ly, LW, 6.5, 'F')
    pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(255, 255, 255)
    pdf.text('L É G E N D E', LX + LW / 2, ly + 4.5, { align: 'center' })
    ly += 6.5

    // Section 1 : ÉPINGLE DE TRAVAIL
    ly = secTitle('ÉPINGLE DE TRAVAIL', ly)

    const mCX  = LX + PAD
    const mCW  = 28, mBW = 6, mHDR = 10, mPH = 6
    const mTOT = mHDR + mPH
    const mY   = ly + 2

    pdf.setFillColor(255, 255, 255); pdf.setDrawColor(27, 79, 138); pdf.setLineWidth(0.5)
    pdf.rect(mCX, mY, mCW, mTOT, 'FD')

    pdf.setFillColor(27, 79, 138); pdf.rect(mCX, mY, mBW, mHDR, 'F')
    pdf.setTextColor(255, 255, 255); pdf.setFontSize(7); pdf.setFont('helvetica', 'bold')
    pdf.text('N°', mCX + mBW / 2, mY + mHDR / 2 + 2, { align: 'center' })

    pdf.setTextColor(30, 41, 59); pdf.setFontSize(4.2); pdf.setFont('helvetica', 'bold')
    pdf.text('SYSTÈME', mCX + mBW + 1, mY + 3.5)
    pdf.setFont('helvetica', 'normal'); pdf.setTextColor(90, 90, 90)
    pdf.text('composante', mCX + mBW + 1, mY + 7.5)

    pdf.setDrawColor(200, 200, 200); pdf.setLineWidth(0.25)
    pdf.line(mCX, mY + mHDR, mCX + mCW, mY + mHDR)
    pdf.setFontSize(3.8); pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(29, 78, 216)
    pdf.text('Av : P-001', mCX + 1, mY + mHDR + 2.5)
    pdf.setTextColor(15, 118, 110)
    pdf.text('Ap : P-002', mCX + 1, mY + mHDR + 5.2)

    const dX  = mCX + mCW + 3
    const dW  = LW - mCW - PAD - 4
    const dFS = 4.5

    const descRows: [string, string, boolean][] = [
      ['N°', 'Numéro de travail',       true],
      ['Av', 'Photos avant nettoyage',  true],
      ['Ap', 'Photos après nettoyage',  true],
    ]
    let dy = mY + 2
    descRows.forEach(([key, val]) => {
      pdf.setFontSize(dFS); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(30, 41, 59)
      pdf.text(key, dX, dy)
      pdf.setFont('helvetica', 'normal'); pdf.setTextColor(70, 70, 70)
      pdf.text(val, dX + 5, dy, { maxWidth: dW - 5 })
      dy += 4.5
    })

    ly += mTOT + 4
    divider(ly)

    // Section 2 : OUVERTURES DE SERVICE
    ly = secTitle('OUVERTURES DE SERVICE', ly)

    const doorDefs: [string, [number, number, number]][] = [
      ["Portes d'accès", [29,  78, 216]],
      ['Architecturale', [15, 118, 110]],
      ['Plaque',         [180, 83,   9]],
    ]
    const tabW = C1 - PAD - 1, tabH = LH - 1.2, tabB = tabW * 0.12
    doorDefs.forEach(([label, [pr, pg, pb]]) => {
      const rowY = ly + 0.6
      pdf.setFillColor(255, 255, 255); pdf.setDrawColor(pr, pg, pb); pdf.setLineWidth(0.3)
      pdf.rect(LX + PAD, rowY, tabW, tabH, 'FD')
      pdf.setFillColor(pr, pg, pb); pdf.rect(LX + PAD, rowY, tabB, tabH, 'F')
      pdf.setFontSize(4); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(30, 41, 59)
      pdf.text('PA-##', LX + PAD + tabB + 1, rowY + tabH / 2 + 1.2)
      pdf.setFontSize(FS); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(30, 41, 59)
      pdf.text(label, LX + C1 + 1, rowY + tabH / 2 + FS / 2.835 * 0.4)
      ly += LH
    })

    ly += 0.5
    pdf.setFillColor(16, 185, 129); pdf.circle(LX + PAD + tabW / 2, ly + LH / 2, 1.8, 'F')
    pdf.setFontSize(FS); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(30, 41, 59)
    pdf.text('Porte existante avant travaux', LX + C1 + 1, ly + LH / 2 + FS / 2.835 * 0.4)
    ly += LH + 1

    // Section 3 : COULEURS DES ÉPINGLES
    divider(ly)
    ly = secTitle('COULEURS DES ÉPINGLES', ly)

    const groupDefs: [string, [number, number, number]][] = [
      ['Alimentation', [37,  99, 235]],
      ['Retour',       [5,  150, 105]],
      ['Évacuation',   [220, 38,  38]],
      ['Autre',        [100, 116, 139]],
    ]
    const swatchW = 5, swatchH = LH * 0.7
    groupDefs.forEach(([label, [pr, pg, pb]]) => {
      const rowY = ly + (LH - swatchH) / 2
      pdf.setFillColor(pr, pg, pb); pdf.rect(LX + PAD, rowY, swatchW, swatchH, 'F')
      pdf.setFontSize(FS); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(30, 41, 59)
      pdf.text(label, LX + PAD + swatchW + 2, ly + LH / 2 + FS / 2.835 * 0.4)
      ly += LH
    })

    // Bordure de la section légende
    pdf.setDrawColor(30, 41, 59); pdf.setLineWidth(0.5)
    pdf.line(LX, legendH, LX + LW, legendH)
  }

  // ── SECTION INFÉRIEURE : INFORMATIONS CARTOUCHE ────────────────────────────
  const revH   = 28, clientH = 22, compH = 35, nrH = 10, projLH = 8, botH = 63
  const availH = CH - legendH
  const projH  = availH - revH - clientH - compH - nrH - projLH - botH

  const yRev    = legendH
  const yClient = yRev    + revH
  const yComp   = yClient + clientH
  const yNR     = yComp   + compH
  const yProjL  = yNR     + nrH
  const yProj   = yProjL  + projLH
  const yBot    = yProj   + projH

  // Révisions
  pdf.setFillColor(...BLUE); pdf.rect(cx, yRev, CW, 7, 'F')
  pdf.setTextColor(255, 255, 255); pdf.setFontSize(7); pdf.setFont('helvetica', 'bold')
  pdf.text('RÉVISIONS', cx + CW / 2, yRev + 5.2, { align: 'center' })
  const hCols = [
    { x: 0,  w: 12,       label: 'No' },
    { x: 12, w: 20,       label: 'Rév.' },
    { x: 32, w: CW - 32,  label: 'Description' },
  ]
  pdf.setFillColor(...LBLUE); pdf.setTextColor(0, 0, 0); pdf.setFontSize(5.5)
  pdf.setLineWidth(0.25); pdf.setDrawColor(0, 0, 0)
  for (const c of hCols) {
    pdf.rect(cx + c.x, yRev + 7, c.w, 6, 'FD')
    pdf.text(c.label, cx + c.x + c.w / 2, yRev + 11.2, { align: 'center' })
  }
  const eRowH = (revH - 13) / 3
  pdf.setFillColor(255, 255, 255)
  for (let i = 0; i < 3; i++) pdf.rect(cx, yRev + 13 + i * eRowH, CW, eRowH, 'D')

  // Client
  pdf.rect(cx, yClient, CW, clientH, 'D')
  pdf.setTextColor(...LGRAY); pdf.setFontSize(5.5); pdf.setFont('helvetica', 'bold')
  pdf.text('CLIENT', cx + 2, yClient + 4.5)
  const logoClientSrc = project.logoClient
  const clientName = safe(project.client)
  if (logoClientSrc) {
    const maxLW = 22, maxLH = clientH - 8
    try {
      const fmt = imgFmt(logoClientSrc)
      const { w: iw, h: ih } = await loadImgDims(logoClientSrc)
      const { w: lw, h: lh } = fitInBox(iw, ih, maxLW, maxLH)
      pdf.addImage(logoClientSrc, fmt, cx + 2, yClient + 5 + (maxLH - lh) / 2, lw, lh)
    } catch { /* fallback */ }
    if (clientName) {
      pdf.setTextColor(0, 0, 0); pdf.setFontSize(8); pdf.setFont('helvetica', 'bold')
      const lines = (pdf.splitTextToSize(clientName, CW - maxLW - 7) as string[]).slice(0, 3)
      const lineH  = 4
      const startY = yClient + (clientH - lines.length * lineH) / 2 + lineH
      lines.forEach((line, i) => pdf.text(line, cx + maxLW + 4, startY + i * lineH))
    }
  } else if (clientName) {
    pdf.setTextColor(0, 0, 0); pdf.setFontSize(9); pdf.setFont('helvetica', 'bold')
    const cl     = (pdf.splitTextToSize(clientName, CW - 6) as string[]).slice(0, 3)
    const lineH  = 4.5
    const startY = yClient + (clientH - cl.length * lineH) / 2 + lineH
    cl.forEach((line, i) => pdf.text(line, cx + CW / 2, startY + i * lineH, { align: 'center' }))
  }

  // Logo / Entreprise SDC
  pdf.rect(cx, yComp, CW, compH, 'D')
  const logoSrc = project.logo
  if (logoSrc) {
    try {
      const fmt      = imgFmt(logoSrc)
      const maxLogoW = CW - 10, maxLogoH = compH - 10
      const { w: iw, h: ih } = await loadImgDims(logoSrc)
      const { w: lw, h: lh } = fitInBox(iw, ih, maxLogoW, maxLogoH)
      pdf.addImage(logoSrc, fmt, cx + 5 + (maxLogoW - lw) / 2, yComp + 4 + (maxLogoH - lh) / 2, lw, lh)
    } catch {
      pdf.setTextColor(...BLUE); pdf.setFontSize(18); pdf.setFont('helvetica', 'bold')
      pdf.text('SDC', cx + CW / 2, yComp + compH / 2, { align: 'center' })
    }
  } else {
    pdf.setTextColor(...BLUE); pdf.setFontSize(18); pdf.setFont('helvetica', 'bold')
    pdf.text('SDC', cx + CW / 2, yComp + compH / 2 - 2, { align: 'center' })
    pdf.setTextColor(22, 163, 74); pdf.setFontSize(6); pdf.setFont('helvetica', 'bold')
    pdf.text('TRAVAUX SPÉCIALISÉS', cx + CW / 2, yComp + compH / 2 + 7, { align: 'center' })
  }
  pdf.setTextColor(...LGRAY); pdf.setFontSize(5); pdf.setFont('helvetica', 'normal')
  pdf.text('8610 Du Creusot, St-Léonard, Qc, H1P2A7', cx + CW / 2, yComp + compH - 3, { align: 'center' })

  // No. Contrat
  pdf.setFillColor(...LBLUE); pdf.setDrawColor(0, 0, 0); pdf.setLineWidth(0.25)
  pdf.rect(cx, yNR, CW, nrH, 'FD')
  pdf.setTextColor(...LGRAY); pdf.setFontSize(5); pdf.setFont('helvetica', 'bold')
  pdf.text('NO. CONTRAT', cx + 2, yNR + 3.5)
  const contratVal = safe(project.contrat)
  if (contratVal) {
    pdf.setTextColor(...BLUE); pdf.setFontSize(7.5)
    pdf.text(contratVal, cx + CW / 2, yNR + nrH - 2, { align: 'center' })
  }

  // Label PROJET
  pdf.setFillColor(...LBLUE); pdf.rect(cx, yProjL, CW, projLH, 'FD')
  pdf.setTextColor(...BLUE); pdf.setFontSize(7); pdf.setFont('helvetica', 'bold')
  pdf.text('PROJET', cx + 3, yProjL + projLH / 2 + 2.5)

  // Nom du projet + Mandat + Adresse
  pdf.setFillColor(255, 255, 255); pdf.rect(cx, yProj, CW, projH, 'D')
  const projName  = safe(project.name)
  const mandatVal = safe(project.mandat)
  const addr      = projectAdresse(project)
  let curY = yProj + 7
  if (projName) {
    pdf.setTextColor(...BLUE); pdf.setFontSize(8.5); pdf.setFont('helvetica', 'bold')
    const nameLines = (pdf.splitTextToSize(projName, CW - 6) as string[]).slice(0, 2)
    nameLines.forEach((line, i) => pdf.text(line, cx + CW / 2, curY + i * 4.5, { align: 'center' }))
    curY += nameLines.length * 4.5
  }
  if (mandatVal) {
    pdf.setTextColor(55, 65, 81); pdf.setFontSize(7); pdf.setFont('helvetica', 'bold')
    const mandatLines = (pdf.splitTextToSize(mandatVal, CW - 6) as string[]).slice(0, 2)
    mandatLines.forEach((line, i) => pdf.text(line, cx + CW / 2, curY + 2 + i * 4, { align: 'center' }))
    curY += mandatLines.length * 4 + 2
  }
  if (addr) {
    pdf.setTextColor(107, 114, 128); pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal')
    const addrLines = (pdf.splitTextToSize(addr, CW - 6) as string[]).slice(0, 3)
    addrLines.forEach((line, i) => pdf.text(line, cx + CW / 2, curY + 2 + i * 3.8, { align: 'center' }))
  }

  // Grille bas (7 lignes)
  const botRowH = botH / 7
  const col2x   = Math.floor(CW * 0.52)
  const dateStr = safe(project.dateDebut)
  const tech    = safe(project.technicien)
  const verif   = safe(project.verificateur)

  pdf.setFillColor(255, 255, 255); pdf.setDrawColor(0, 0, 0); pdf.setLineWidth(0.25)

  type BotRow =
    | { split: true; labels: [string, string]; values: [string, string] }
    | { split?: false; label: string; value: string }

  const botRows: BotRow[] = [
    { label: 'TITRE DU PLAN', value: tileLabel ? `${safe(plan.name)} — ${tileLabel}` : safe(plan.name) },
    { label: 'NO. DESSIN',    value: safe((plan as any).drawingNumber) },
    { label: 'DATE',          value: dateStr },
    { label: 'ÉCHELLE',       value: 'sans' },
    { label: 'PRÉPARÉ PAR',   value: tech },
    { label: 'VÉRIFIÉ PAR',   value: verif },
    { split: true, labels: ['RÉVISION', 'ÉMIS POUR'], values: ['01', 'Nettoyage'] },
  ]

  botRows.forEach((row, i) => {
    const ry = yBot + i * botRowH
    if ('split' in row && row.split) {
      pdf.rect(cx, ry, col2x, botRowH, 'D')
      pdf.rect(cx + col2x, ry, CW - col2x, botRowH, 'D')
      pdf.setTextColor(...LGRAY); pdf.setFontSize(4.5); pdf.setFont('helvetica', 'bold')
      pdf.text(row.labels[0], cx + 2, ry + 3.5)
      pdf.text(row.labels[1], cx + col2x + 2, ry + 3.5)
      pdf.setTextColor(0, 0, 0); pdf.setFontSize(7)
      if (row.values[0]) pdf.text(row.values[0], cx + 2, ry + botRowH - 2)
      if (row.values[1]) pdf.text(row.values[1], cx + col2x + 2, ry + botRowH - 2)
    } else {
      pdf.rect(cx, ry, CW, botRowH, 'D')
      pdf.setTextColor(...LGRAY); pdf.setFontSize(4.5); pdf.setFont('helvetica', 'bold')
      pdf.text((row as any).label, cx + 2, ry + 3.5)
      if ((row as any).value) {
        pdf.setTextColor(0, 0, 0); pdf.setFontSize(7)
        pdf.text((row as any).value, cx + 2, ry + botRowH - 2)
      }
    }
  })

  pdf.setLineWidth(0.7); pdf.setDrawColor(0, 0, 0)
  pdf.rect(cx, 0, CW, CH, 'D')
}

// ─────────────────────────────────────────────────────────────────────────────
// EN-TÊTE SECTION A4 — même design inspection, "RAPPORT DE NETTOYAGE" en bleu
// ─────────────────────────────────────────────────────────────────────────────
export async function drawSectionPageHeader(pdf: jsPDF, project: Project, boxLabel = 'RAPPORT DE NETTOYAGE'): Promise<void> {
  const x = S_ML, y = S_MT, w = S_UW, h = S_HDR_H
  const logoW = 52

  const logoSrc = project.logo
  if (logoSrc) {
    try {
      const fmt = imgFmt(logoSrc)
      const { w: iw, h: ih } = await loadImgDims(logoSrc)
      const { w: lw, h: lh } = fitInBox(iw, ih, logoW - 4, h - 4)
      pdf.addImage(logoSrc, fmt, x + (logoW - 4 - lw) / 2, y + 1 + (h - 4 - lh) / 2, lw, lh)
    } catch {
      pdf.setTextColor(...BLUE); pdf.setFontSize(14); pdf.setFont('helvetica', 'bold')
      pdf.text('SDC', x + logoW / 2, y + h / 2 + 3, { align: 'center' })
    }
  } else {
    pdf.setTextColor(...BLUE); pdf.setFontSize(14); pdf.setFont('helvetica', 'bold')
    pdf.text('SDC', x + logoW / 2, y + h / 2 + 3, { align: 'center' })
    pdf.setTextColor(22, 163, 74); pdf.setFontSize(6); pdf.setFont('helvetica', 'bold')
    pdf.text('TRAVAUX SPÉCIALISÉS', x + logoW / 2, y + h / 2 + 9, { align: 'center' })
  }

  pdf.setDrawColor(200, 200, 200); pdf.setLineWidth(0.3)
  pdf.line(x + logoW, y + 2, x + logoW, y + h - 2)

  const infoX   = x + logoW + 4
  const infoW   = 78
  const LABEL_W = 16
  const VAL_W   = infoW - LABEL_W - 2

  const infoRows: [string, string][] = [
    ['Projet:',  safe(project.name)],
    ['Mandat:',  safe(project.mandat)],
    ['Client:',  safe(project.client)],
    ['Adresse:', projectAdresse(project)],
    ['Contrat:', safe(project.contrat)],
  ]
  pdf.setFontSize(6.5)
  let curInfoY = y + 5
  for (const [label, value] of infoRows) {
    if (!value) continue
    pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...LGRAY)
    pdf.text(label, infoX, curInfoY)
    pdf.setFont('helvetica', 'normal'); pdf.setTextColor(0, 0, 0)
    const lines = (pdf.splitTextToSize(value, VAL_W) as string[]).slice(0, 2)
    lines.forEach((line, li) => pdf.text(line, infoX + LABEL_W, curInfoY + li * 4))
    curInfoY += lines.length > 1 ? 9 : 5
  }

  const rBx = infoX + infoW + 3
  const rBw = (x + w) - rBx
  pdf.setFillColor(...BLUE); pdf.rect(rBx, y, rBw, h, 'F')

  const bx   = rBx + rBw / 2
  const midY = y + h / 2
  const dateStr = project.dateDebut
    ? new Date(project.dateDebut).toLocaleDateString('fr-CA')
    : new Date().toLocaleDateString('fr-CA')

  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9)
  pdf.text(boxLabel, bx, midY - 1, { align: 'center' })
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8)
  pdf.text(dateStr, bx, midY + 7, { align: 'center' })

  pdf.setDrawColor(...BLUE); pdf.setLineWidth(0.8)
  pdf.line(x, y + h, x + w, y + h)
}

// ─────────────────────────────────────────────────────────────────────────────
// PIED DE PAGE SECTION — identique à l'inspection
// ─────────────────────────────────────────────────────────────────────────────
export function drawSectionPageFooter(pdf: jsPDF): void {
  const x = S_ML, y = S_PH - S_MB - S_FTR_H, w = S_UW
  pdf.setDrawColor(...BLUE); pdf.setLineWidth(0.5)
  pdf.line(x, y, x + w, y)
  pdf.setFontSize(6); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...LGRAY)
  pdf.text('8610 rue du Creusot, St-Léonard (Montréal), Qc  H1P 2A7', x, y + 4)
  pdf.text('Tél.: 514 727-3415  |  www.sdconline.com  |  info@sdconline.com', x, y + 8.5)
  pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...BLUE)
  pdf.text('ISO 9001  ·  ISO 14001  ·  ISO 45001', x + w, y + 4, { align: 'right' })
  pdf.text('NADCA  ·  IICRC  |  RBQ: 8315-1835-55', x + w, y + 8.5, { align: 'right' })
}

// ─────────────────────────────────────────────────────────────────────────────
// EN-TÊTE RAPPORT ÉCRIT — même design inspection, titre nettoyage
// ─────────────────────────────────────────────────────────────────────────────
export async function drawTextPageHeader(
  pdf: jsPDF, project: Project, pageNum = 0,
  reportLabel = 'Rapport de nettoyage — conduits de ventilation',
): Promise<void> {
  const x       = S_ML
  const y       = S_MT
  const rightX  = x + S_UW
  const halfW   = (S_UW - 10) / 2
  const contrat = safe(project.contrat)
  const sdcText = contrat ? `N° SDC : ${contrat}` : ''

  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(0, 0, 0)
  pdf.text(safe(project.client).toUpperCase(), x, y + 5)
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5)
  const addrLines = pdf.splitTextToSize(projectAdresse(project), halfW) as string[]
  addrLines.slice(0, 3).forEach((line, i) => pdf.text(line, x, y + 5 + (i + 1) * 5))

  let ry = y + 5
  if (sdcText) {
    pdf.setFont('helvetica', 'bold')
    pdf.text(sdcText, rightX, ry, { align: 'right' })
    pdf.setFont('helvetica', 'normal')
    ry += 5
  }
  pdf.text(reportLabel, rightX, ry, { align: 'right' })
  ry += 5
  if (project.name) {
    const nameLines = pdf.splitTextToSize(safe(project.name), halfW) as string[]
    nameLines.slice(0, 2).forEach(line => {
      if (ry < y + 20) { pdf.text(line, rightX, ry, { align: 'right' }); ry += 5 }
    })
  }

  const lineY = y + 22
  pdf.setDrawColor(0, 0, 0); pdf.setLineWidth(0.4)
  pdf.line(x, lineY, rightX, lineY)
  if (pageNum > 0) {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(0, 0, 0)
    pdf.text(`Page | ${pageNum}`, rightX, lineY - 2, { align: 'right' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE INTERCALAIRE — ANNEXE (même style que l'inspection)
// ─────────────────────────────────────────────────────────────────────────────
async function drawAnnexeSeparatorPage(pdf: jsPDF, project: Project, title: string): Promise<void> {
  pdf.addPage('a4', 'p')
  const PW = 210, PH = 297

  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, 0, PW, PH, 'F')

  pdf.setFillColor(...BLUE)
  pdf.rect(0, 0, 18, PH, 'F')

  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(255, 255, 255)
  pdf.text('ANNEXE', 14, PH / 2, { angle: 90, align: 'center' })

  const zoneTop = PH * 0.38, zoneH = 66
  pdf.setFillColor(...BLUE)
  pdf.rect(18, zoneTop, PW - 18, 2, 'F')
  pdf.rect(18, zoneTop + zoneH - 2, PW - 18, 2, 'F')
  pdf.setFillColor(...LBLUE)
  pdf.rect(18, zoneTop + 2, PW - 18, zoneH - 4, 'F')

  const titleLines = pdf.splitTextToSize(title.toUpperCase(), PW - 46) as string[]
  const lineH = 13, totalH = titleLines.length * lineH
  const textStartY = zoneTop + 2 + (zoneH - 4) / 2 - totalH / 2 + 9
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(17); pdf.setTextColor(...BLUE)
  titleLines.forEach((line, i) => pdf.text(line, 18 + (PW - 18) / 2, textStartY + i * lineH, { align: 'center' }))

  const infoY  = zoneTop + zoneH + 12
  const infoXC = 18 + (PW - 18) / 2
  const infoMaxW = PW - 46
  let infoOffset = 0

  // Nom du projet
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(...DGRAY)
  pdf.text(safe(project.name), infoXC, infoY, { align: 'center' })
  infoOffset += 7

  // Mandat
  const mandatVal = safe(project.mandat)
  if (mandatVal) {
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(...BLUE)
    const mandatLines = pdf.splitTextToSize(mandatVal, infoMaxW) as string[]
    mandatLines.slice(0, 2).forEach((line, i) =>
      pdf.text(line, infoXC, infoY + infoOffset + i * 5.5, { align: 'center' })
    )
    infoOffset += mandatLines.slice(0, 2).length * 5.5 + 1
  }

  // Adresse
  const addrVal = projectAdresse(project)
  if (addrVal) {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(...DGRAY)
    const addrLines = pdf.splitTextToSize(addrVal, infoMaxW) as string[]
    addrLines.slice(0, 2).forEach((line, i) =>
      pdf.text(line, infoXC, infoY + infoOffset + i * 5, { align: 'center' })
    )
    infoOffset += addrLines.slice(0, 2).length * 5 + 1
  }

  // Client
  if (project.client) {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...LGRAY)
    pdf.text(safe(project.client), infoXC, infoY + infoOffset, { align: 'center' })
  }

  const logoSrc = (project as any)?.logo as string | undefined
  if (logoSrc) {
    try {
      const fmt = imgFmt(logoSrc)
      const { w: iw, h: ih } = await loadImgDims(logoSrc)
      const { w: lw, h: lh } = fitInBox(iw, ih, 50, 22)
      pdf.addImage(logoSrc, fmt, 22, 12, lw, lh)
    } catch { /* skip */ }
  }

  const ftrY = PH - 14
  pdf.setDrawColor(...BLUE); pdf.setLineWidth(0.5)
  pdf.line(22, ftrY, PW - 10, ftrY)
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(...LGRAY)
  const dateStr = new Date(project.dateDebut ?? '').toLocaleDateString('fr-CA')
  pdf.text(`${safe(project.name)}  ·  ${safe(project.client)}  ·  ${dateStr}`, 22 + (PW - 32) / 2, ftrY + 6, { align: 'center' })
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE SOUS-SECTION — séparateur entre "sur plan" et "sans plan"
// ─────────────────────────────────────────────────────────────────────────────
async function drawSubSectionDivider(
  pdf: jsPDF,
  project: Project,
  title: string,      // ex. "Sections sur plan"
  count: number,
  colorRgb: [number, number, number],
): Promise<void> {
  pdf.addPage('a4', 'p')
  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, 0, S_PW, S_PH, 'F')

  await drawSectionPageHeader(pdf, project)
  drawSectionPageFooter(pdf)

  const bandY = S_PH * 0.42, bandH = 42
  pdf.setFillColor(...colorRgb)
  pdf.rect(S_ML, bandY, S_UW, bandH, 'F')

  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8)
  pdf.text('RAPPORT DE NETTOYAGE', S_PW / 2, bandY + 10, { align: 'center' })

  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16)
  pdf.text(title.toUpperCase(), S_PW / 2, bandY + 26, { align: 'center' })
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE SÉPARATRICE PAR SYSTÈME — insérée avant les fiches de chaque système
// ─────────────────────────────────────────────────────────────────────────────
async function drawSystemDividerPage(
  pdf: jsPDF,
  project: Project,
  systemLabel: string,
  travailCount: number,
): Promise<void> {
  pdf.addPage('a4', 'p')
  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, 0, S_PW, S_PH, 'F')

  await drawSectionPageHeader(pdf, project)
  drawSectionPageFooter(pdf)

  const bandY = S_PH * 0.42, bandH = 50
  pdf.setFillColor(...BLUE)
  pdf.rect(S_ML, bandY, S_UW, bandH, 'F')

  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9)
  pdf.text('SYSTÈME', S_PW / 2, bandY + 15, { align: 'center' })

  pdf.setFontSize(18)
  const labelLines = (pdf.splitTextToSize(systemLabel.toUpperCase(), S_UW - 16) as string[]).slice(0, 2)
  const lh = 9
  const startY = bandY + bandH / 2 - ((labelLines.length - 1) * lh) / 2 + 4
  labelLines.forEach((line, i) => pdf.text(line, S_PW / 2, startY + i * lh, { align: 'center' }))
}

// ─────────────────────────────────────────────────────────────────────────────
// SOMMAIRE (TOC) — adapté de l'inspection, palette bleue nettoyage
// ─────────────────────────────────────────────────────────────────────────────
function drawTocNettoyagePage(
  pdf: jsPDF,
  project: Project,
  entries: { title: string; page: number; type: 'section' | 'subtitle' | 'annexe' | 'annexe-sub' }[],
): void {
  const ML = S_ML, UW = S_UW, PW = S_PW, PH = 297
  const RIGHT_X = ML + UW
  const projName = safe((project as any).name)

  const mainEntries = entries.filter((e) => e.type === 'section' || e.type === 'subtitle')
  const annexes     = entries.filter((e) => e.type === 'annexe')

  const HDR_H = 13, PROJ_H = projName ? 12 : 0, GAP_AFTER = 8
  let entriesH = mainEntries.reduce((h, e) => h + (e.type === 'section' ? 8 : 6.5), 0)
  const annexeSubs = entries.filter((e) => e.type === 'annexe-sub')
  if (annexes.length > 0) entriesH += 14 + annexes.length * 7.5 + annexeSubs.length * 6
  const totalH = HDR_H + PROJ_H + GAP_AFTER + entriesH
  const startY = Math.max(15, (PH - totalH) / 2)

  pdf.setFillColor(...BLUE)
  pdf.rect(ML, startY, UW, HDR_H, 'F')
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13); pdf.setTextColor(255, 255, 255)
  pdf.text('SOMMAIRE', ML + UW / 2, startY + 9, { align: 'center' })

  let y = startY + HDR_H
  if (projName) {
    y += 7
    pdf.setFont('times', 'italic'); pdf.setFontSize(9); pdf.setTextColor(...LGRAY)
    pdf.text(projName, ML + UW / 2, y, { align: 'center' })
    y += 5
  }
  y += GAP_AFTER

  const stripLeadingNum = (t: string) => t.replace(/^\d+(\.\d+)*\.?\s*/, '')

  let secNum = 0, subNum = 0, annexNum = 0

  for (const entry of mainEntries) {
    if (y > 250) break
    if (entry.type === 'section') {
      const hasNum = /^\d+\./.test(entry.title)
      if (hasNum) { secNum++; subNum = 0 }
      const label = hasNum ? `${secNum}.` : '', labelW = hasNum ? 10 : 0
      const titleX = ML + labelW, maxW = UW - labelW - 14
      if (hasNum && secNum % 2 === 0) { pdf.setFillColor(245, 248, 253); pdf.rect(ML, y - 5, UW, 8, 'F') }
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(...BLUE)
      if (label) pdf.text(label, ML, y)
      pdf.setFont('times', 'bold'); pdf.setFontSize(10); pdf.setTextColor(...DGRAY)
      const titleLines = pdf.splitTextToSize(stripLeadingNum(entry.title), maxW) as string[]
      pdf.text(titleLines[0], titleX, y)
      const pageStr = String(entry.page)
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(...BLUE)
      pdf.text(pageStr, RIGHT_X, y, { align: 'right' })
      const endX = titleX + pdf.getTextWidth(titleLines[0]) + 2
      const startPageX = RIGHT_X - pdf.getTextWidth(pageStr) - 2
      if (startPageX > endX + 4) {
        pdf.setFont('times', 'normal'); pdf.setFontSize(8); pdf.setTextColor(190, 190, 190)
        const dotW = pdf.getTextWidth('.')
        for (let dx = endX; dx + dotW < startPageX; dx += dotW + 0.5) pdf.text('.', dx, y - 0.5)
      }
      y += 8
    } else {
      subNum++
      const INDENT = 12, label = `${secNum}.${subNum}`, labelW = 14, titleX = ML + INDENT + labelW, maxW = UW - INDENT - labelW - 14
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5); pdf.setTextColor(...LGRAY)
      pdf.text(label, ML + INDENT, y)
      pdf.setFont('times', 'italic'); pdf.setFontSize(8.5); pdf.setTextColor(...DGRAY)
      const subLines = pdf.splitTextToSize(stripLeadingNum(entry.title), maxW) as string[]
      pdf.text(subLines[0], titleX, y)
      const pageStr = String(entry.page)
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(...LGRAY)
      pdf.text(pageStr, RIGHT_X, y, { align: 'right' })
      const endX = titleX + pdf.getTextWidth(subLines[0]) + 2
      const startPageX = RIGHT_X - pdf.getTextWidth(pageStr) - 2
      if (startPageX > endX + 4) {
        pdf.setFont('times', 'normal'); pdf.setFontSize(7); pdf.setTextColor(210, 210, 210)
        const dotW = pdf.getTextWidth('.')
        for (let dx = endX; dx + dotW < startPageX; dx += dotW + 0.5) pdf.text('.', dx, y - 0.5)
      }
      y += 6.5
    }
  }

  if (annexes.length > 0) {
    y += 4
    pdf.setDrawColor(200, 210, 230); pdf.setLineWidth(0.3)
    pdf.line(ML, y - 2, ML + UW, y - 2)
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5); pdf.setTextColor(...LGRAY)
    pdf.text('ANNEXES', ML, y + 4)
    y += 10

    type AnnexeGroup = { entry: typeof annexes[0]; subs: typeof annexes }
    const annexeGroups: AnnexeGroup[] = []
    let lastGroup: AnnexeGroup | null = null
    for (const e of entries) {
      if (e.type === 'annexe') { lastGroup = { entry: e, subs: [] }; annexeGroups.push(lastGroup) }
      else if (e.type === 'annexe-sub' && lastGroup) lastGroup.subs.push(e)
    }

    const MAX_TOC_SUBS = 4
    for (const group of annexeGroups) {
      if (y > 283) break
      annexNum++
      const letter = String.fromCharCode(64 + annexNum)
      const annexLabel = `Annexe ${letter}`
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(...LGRAY)
      const labelW = pdf.getTextWidth(annexLabel) + 5
      const titleX = ML + labelW, maxW = UW - labelW - 14
      pdf.setFillColor(250, 250, 252); pdf.rect(ML, y - 4.5, UW, 7, 'F')
      pdf.text(annexLabel, ML, y)
      pdf.setFont('times', 'italic'); pdf.setFontSize(9); pdf.setTextColor(...DGRAY)
      const titleLines = pdf.splitTextToSize(group.entry.title.replace(/^Annexe\s*[—-]\s*/i, ''), maxW) as string[]
      pdf.text(titleLines[0], titleX, y)
      const pageStr = String(group.entry.page)
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(...LGRAY)
      pdf.text(pageStr, RIGHT_X, y, { align: 'right' })
      const endX = titleX + pdf.getTextWidth(titleLines[0]) + 2
      const startPageX = RIGHT_X - pdf.getTextWidth(pageStr) - 2
      if (startPageX > endX + 4) {
        pdf.setFont('times', 'normal'); pdf.setFontSize(7); pdf.setTextColor(200, 200, 200)
        const dotW = pdf.getTextWidth('.')
        for (let dx = endX; dx + dotW < startPageX; dx += dotW + 0.5) pdf.text('.', dx, y - 0.5)
      }
      y += 7.5

      for (let si = 0; si < group.subs.length; si++) {
        if (y > 277) break
        if (si >= MAX_TOC_SUBS) {
          const remain = group.subs.length - MAX_TOC_SUBS
          pdf.setFont('times', 'italic'); pdf.setFontSize(7); pdf.setTextColor(...LGRAY)
          pdf.text(`... et ${remain} autre${remain > 1 ? 's' : ''}`, ML + 13, y)
          y += 5.5
          break
        }
        const sub = group.subs[si]
        const SUB_INDENT = 10, subTitleX = ML + SUB_INDENT + 3, subMaxW = UW - SUB_INDENT - 3 - 14
        pdf.setFont('times', 'italic'); pdf.setFontSize(7.5); pdf.setTextColor(...LGRAY)
        const subTitle = sub.title.replace(/^Système\s*:\s*/i, '')
        const subLines = pdf.splitTextToSize(`– ${subTitle}`, subMaxW) as string[]
        pdf.text(subLines[0], subTitleX, y)
        const subPageStr = String(sub.page)
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5)
        pdf.text(subPageStr, RIGHT_X, y, { align: 'right' })
        const subEndX = subTitleX + pdf.getTextWidth(subLines[0]) + 2
        const subStartPX = RIGHT_X - pdf.getTextWidth(subPageStr) - 2
        if (subStartPX > subEndX + 4) {
          pdf.setFontSize(6); pdf.setTextColor(215, 215, 215)
          const dotW = pdf.getTextWidth('.')
          for (let dx = subEndX; dx + dotW < subStartPX; dx += dotW + 0.5) pdf.text('.', dx, y - 0.5)
        }
        y += 6
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REGROUPEMENT DES TRAVAUX PAR SYSTÈME
// ─────────────────────────────────────────────────────────────────────────────
function groupTravauxBySysteme(
  travaux: TravailNettoyage[],
  systemes: Systeme[],
): { systemeId: string; label: string; travaux: TravailNettoyage[] }[] {
  const sysOrder = systemes.map((s) => s.id)
  const map = new Map<string, TravailNettoyage[]>()
  for (const t of travaux) {
    const key = sysOrder.includes(t.systemeId) ? t.systemeId : '__autre__'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(t)
  }
  const groups: { systemeId: string; label: string; travaux: TravailNettoyage[] }[] = []
  for (const sysId of sysOrder) {
    if (map.has(sysId)) {
      const sys = systemes.find((s) => s.id === sysId)
      groups.push({ systemeId: sysId, label: sys?.nom ?? sysId, travaux: map.get(sysId)! })
    }
  }
  const autres = map.get('__autre__')
  if (autres?.length) groups.push({ systemeId: '__autre__', label: 'Sans système', travaux: autres })
  return groups
}

// ─────────────────────────────────────────────────────────────────────────────
// SOMMAIRE DES NETTOYAGES — même structure, palette bleue
// ─────────────────────────────────────────────────────────────────────────────
function drawSommaireNettoyage(
  pdf: jsPDF,
  project: Project,
  plans: Plan[],
  travaux: TravailNettoyage[],
  systemes: Systeme[],
): void {
  const PW = 297, PH = 210, PML = 10, PMR = 10, PMB = 8, PUW = PW - PML - PMR
  const HDR_H2  = 11, SUB_H = 11, COL_HDR_H = 6
  const TOP_AREA = HDR_H2 + 1 + SUB_H + 1 + COL_HDR_H
  const FTR_AREA = PMB + 8
  const AVAIL_H  = PH - TOP_AREA - FTR_AREA
  const ROW_H    = 10

  // # | Système | Composante | Zone/Secteur | Localisation | Date | Photos | Ouv. service | Anomalies | Plans/Réf. | Notes
  const colDefs = [
    { label: '#',                         w: 10 },
    { label: 'Système',                   w: 20 },
    { label: 'Composante',                w: 30 },
    { label: 'Zone / Secteur',            w: 22 },
    { label: 'Localisation',              w: 22 },
    { label: 'Date',                      w: 18 },
    { label: 'Photos',                    w: 35 },
    { label: 'Ouv. de service installée', w: 32 },
    { label: 'Anomalies observées',       w: 28 },
    { label: 'Plans / Réf.',              w: 28 },
    { label: 'Notes / Particularités',    w: 0  },
  ]
  const fixedW = colDefs.slice(0, -1).reduce((s, c) => s + c.w, 0)
  colDefs[colDefs.length - 1].w = PUW - fixedW
  let cxAcc = PML
  const colX = colDefs.map(c => { const px = cxAcc; cxAcc += c.w; return px })

  const planIds = new Set(plans.map((p) => p.id))
  const avecPlan = travaux.filter((t) => t.planId && planIds.has(t.planId))
  const sansPlan = travaux.filter((t) => !t.planId || !planIds.has(t.planId))

  function paginate(list: TravailNettoyage[]): TravailNettoyage[][] {
    const pages: TravailNettoyage[][] = []
    let cur: TravailNettoyage[] = [], curH = 0
    for (const t of list) {
      if (curH + ROW_H > AVAIL_H && cur.length > 0) { pages.push(cur); cur = []; curH = 0 }
      cur.push(t); curH += ROW_H
    }
    if (cur.length) pages.push(cur)
    if (!pages.length) pages.push([])
    return pages
  }

  function renderGroup(groupTravaux: TravailNettoyage[], groupTitle: string) {
    if (groupTravaux.length === 0) return
    const pages = paginate(groupTravaux)

    pages.forEach((pageRows, pageIdx) => {
      pdf.addPage('a4', 'l')

      // Bandeau titre
      pdf.setFillColor(...BLUE); pdf.rect(0, 0, PW, HDR_H2, 'F')
      pdf.setTextColor(255, 255, 255); pdf.setFontSize(8.5); pdf.setFont('helvetica', 'bold')
      pdf.text('RÉSUMÉ DES TRAVAUX DE NETTOYAGE', PW / 2, 7.5, { align: 'center' })

      // Sous-titre
      const SUB_Y = HDR_H2 + 1
      pdf.setFillColor(...LBLUE); pdf.rect(PML, SUB_Y, PUW, SUB_H, 'F')
      pdf.setTextColor(...DGRAY); pdf.setFontSize(6); pdf.setFont('helvetica', 'normal')
      pdf.text(
        `Projet: ${safe(project.name)}   |   Client: ${safe(project.client)}   |   Page ${pageIdx + 1} / ${pages.length}`,
        PW / 2, SUB_Y + 4, { align: 'center' }
      )
      const infoLine2Parts: string[] = []
      if (project.mandat)  infoLine2Parts.push(`Mandat N° : ${safe(project.mandat)}`)
      if (project.contrat) infoLine2Parts.push(`Contrat SDC : ${safe(project.contrat)}`)
      if (infoLine2Parts.length) {
        pdf.setFont('helvetica', 'bold')
        pdf.text(infoLine2Parts.join('   |   '), PW / 2, SUB_Y + 8.5, { align: 'center' })
      }

      // En-tête de groupe (barre verte/grise)
      const GRP_Y = SUB_Y + SUB_H + 1
      const isAvec = groupTitle.includes('plan')
      const grpColor: [number,number,number] = isAvec ? [22, 101, 52] : [75, 85, 99]
      pdf.setFillColor(...grpColor); pdf.rect(PML, GRP_Y, PUW, 5, 'F')
      pdf.setTextColor(255, 255, 255); pdf.setFontSize(6); pdf.setFont('helvetica', 'bold')
      pdf.text(groupTitle.toUpperCase(), PML + 2, GRP_Y + 3.5)

      // En-tête colonnes
      const COL_HDR_Y = GRP_Y + 5
      pdf.setFillColor(...BLUE); pdf.rect(PML, COL_HDR_Y, PUW, COL_HDR_H, 'F')
      pdf.setTextColor(255, 255, 255); pdf.setFontSize(5.5); pdf.setFont('helvetica', 'bold')
      colDefs.forEach((col, i) => pdf.text(col.label, colX[i] + 1.5, COL_HDR_Y + 4.2))

      let ry = COL_HDR_Y + COL_HDR_H
      pageRows.forEach((t, ri) => {
        const sys  = systemes.find((s) => s.id === t.systemeId)
        const plan = plans.find((p) => p.id === t.planId)
        const bg: [number,number,number] = ri % 2 === 0 ? [255, 255, 255] : [235, 242, 250]
        pdf.setFillColor(...bg); pdf.rect(PML, ry, PUW, ROW_H, 'F')
        pdf.setDrawColor(220, 220, 220); pdf.setLineWidth(0.2)
        pdf.line(PML, ry + ROW_H, PML + PUW, ry + ROW_H)

        const color = travailColor(t)
        pdf.setFillColor(...color); pdf.circle(colX[0] + 4, ry + ROW_H / 2, 3, 'F')
        pdf.setTextColor(255, 255, 255); pdf.setFontSize(5.5); pdf.setFont('helvetica', 'bold')
        pdf.text(String(t.numero), colX[0] + 4, ry + ROW_H / 2 + 1.5, { align: 'center' })

        const ty = ry + ROW_H / 2 + 1.5
        pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...DGRAY)

        pdf.text(safe(sys?.nom ?? '—'), colX[1] + 1.5, ty, { maxWidth: colDefs[1].w - 3 })

        const compLabel = t.typeComposante ? COMPOSANTES_CVAC[t.typeComposante].label : '—'
        pdf.text(compLabel, colX[2] + 1.5, ty, { maxWidth: colDefs[2].w - 3 })

        pdf.text(safe(t.location ?? '—'), colX[3] + 1.5, ty, { maxWidth: colDefs[3].w - 3 })
        pdf.text(safe(t.zoneDesservie ?? '—'), colX[4] + 1.5, ty, { maxWidth: colDefs[4].w - 3 })
        pdf.text(safe(t.dateDebut ?? t.dateFin ?? '—').substring(0, 10), colX[5] + 1.5, ty)

        const avRefs = (t.photosAvant ?? []).map((p) => p.ref).filter(Boolean).join(' ')
        const apRefs = (t.photosApres ?? []).map((p) => p.ref).filter(Boolean).join(' ')
        const phX = colX[6] + 1.5, phMaxW = colDefs[6].w - 3
        if (avRefs) {
          pdf.setFont('helvetica', 'bold'); pdf.setTextColor(249, 115, 22)
          pdf.text('Av :', phX, ry + 4.2)
          pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...DGRAY)
          pdf.text(avRefs, phX + 7, ry + 4.2, { maxWidth: phMaxW - 7 })
        }
        if (apRefs) {
          pdf.setFont('helvetica', 'bold'); pdf.setTextColor(22, 163, 74)
          pdf.text('Ap :', phX, ry + 8)
          pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...DGRAY)
          pdf.text(apRefs, phX + 7, ry + 8, { maxWidth: phMaxW - 7 })
        }

        // col[7] — Ouvertures de service installées
        const isSansPlan = !t.planId || !planIds.has(t.planId)
        const doorLines: { label: string; color: [number,number,number] }[] = []
        if (isSansPlan) {
          const PREFIX: Record<string, string> = { acces: 'PA', architectural: 'P.Ar.', plaque: 'PL' }
          const COLOR:  Record<string, [number,number,number]> = { acces: [29,78,216], architectural: [15,118,110], plaque: [180,83,9] }
          for (const p of (t.portesInstalleesLibres ?? [])) {
            const suffix = p.statut === 'existante' ? ' (Ex.)' : ''
            doorLines.push({ label: `${PREFIX[p.type] ?? p.type} · ${p.dimensions}${suffix}`, color: COLOR[p.type] ?? [29,78,216] })
          }
        } else {
          const allPlanDoors = plans.flatMap((p) => p.accessDoors ?? [])
          const usedDoors    = allPlanDoors.filter((d) => (t.portesUtilisees ?? []).includes(d.id))
          const COL_ACCES: [number,number,number] = [29, 78, 216]
          for (const d of usedDoors) {
            doorLines.push({ label: `${d.numero}${d.dimensions ? ` (${d.dimensions})` : ''}`, color: COL_ACCES })
          }
        }
        if (doorLines.length > 0) {
          const doorX    = colX[7] + 1.5
          const doorMaxW = colDefs[7].w - 3
          let doorLine   = ry + 3.5
          for (const { label, color } of doorLines) {
            if (doorLine >= ry + ROW_H - 1) break
            const dlines = (pdf.splitTextToSize(label, doorMaxW) as string[]).slice(0, 1)
            pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...color)
            dlines.forEach((line) => { if (doorLine < ry + ROW_H - 1) { pdf.text(line, doorX, doorLine); doorLine += 3.4 } })
          }
          pdf.setFont('helvetica', 'normal')
        }

        // col[8] — Anomalies observées
        const ANOM_COLOR: Record<string, [number,number,number]> = {
          corrosion:   [249, 115,  22],
          moisissure:  [ 22, 163,  74],
          fuite:       [ 29,  78, 216],
          deformation: [147,  51, 234],
          obstruction: [217, 119,   6],
          autre:       [107, 114, 128],
        }
        const anomalies = t.anomalies ?? []
        if (anomalies.length > 0) {
          const anomX    = colX[8] + 1.5
          const anomMaxW = colDefs[8].w - 3
          let anomLine   = ry + 3.5
          for (const an of anomalies) {
            if (anomLine >= ry + ROW_H - 1) break
            const label = ANOMALIE_LABELS[an.type] ?? an.type
            pdf.setFont('helvetica', 'bold')
            pdf.setTextColor(...(ANOM_COLOR[an.type] ?? ANOM_COLOR.autre))
            pdf.text(label, anomX, anomLine, { maxWidth: anomMaxW })
            anomLine += 3.4
          }
          pdf.setFont('helvetica', 'normal')
        }

        // col[9] — Plans / Réf.
        pdf.setFont('helvetica', 'normal')
        if (plan) {
          pdf.setTextColor(...DGRAY)
          pdf.text(safe(plan.name), colX[9] + 1.5, ry + 4.2, { maxWidth: colDefs[9].w - 3 })
          if (safe(plan.drawingNumber)) {
            pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...BLUE)
            pdf.text(`N° ${safe(plan.drawingNumber)}`, colX[9] + 1.5, ry + 8, { maxWidth: colDefs[9].w - 3 })
            pdf.setFont('helvetica', 'normal')
          }
        } else {
          pdf.setTextColor(...LGRAY)
          pdf.text('Sans plan', colX[9] + 1.5, ty)
        }

        // col[10] — Notes / Particularités
        const obsText  = (t.observationsAvant ?? '').trim()
        const notesCol = colX[10] + 1.5
        const notesMaxW = colDefs[10].w - 3
        let noteLine   = ry + 3.5

        if (obsText) {
          const lines = (pdf.splitTextToSize(safe(obsText), notesMaxW) as string[]).slice(0, 2)
          pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...DGRAY)
          lines.forEach((line) => { if (noteLine < ry + ROW_H - 1) { pdf.text(line, notesCol, noteLine); noteLine += 3.4 } })
        }

        ry += ROW_H
      })

      pdf.setDrawColor(...BLUE); pdf.setLineWidth(0.4)
      pdf.rect(PML, COL_HDR_Y, PUW, ry - COL_HDR_Y, 'D')
      pdf.setDrawColor(200, 200, 200); pdf.setLineWidth(0.2)
      colDefs.slice(0, -1).forEach((_, i) => pdf.line(colX[i + 1], COL_HDR_Y, colX[i + 1], ry))

      const FTR_Y = PH - PMB - 5
      pdf.setDrawColor(...BLUE); pdf.setLineWidth(0.4); pdf.line(PML, FTR_Y, PW - PMR, FTR_Y)
      pdf.setFontSize(6); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...LGRAY)
      pdf.text('Tél.: 514 727-3415  |  www.sdconline.com  |  info@sdconline.com', PML, FTR_Y + 3.5)
      pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...BLUE)
      pdf.text('NADCA · IICRC | RBQ: 8315-1835-55', PW - PMR, FTR_Y + 3.5, { align: 'right' })
    })
  }

  renderGroup(avecPlan, 'Sections sur plan')
  renderGroup(sansPlan, 'Sections sans plan')
}

// ─────────────────────────────────────────────────────────────────────────────
// FICHE TRAVAIL — 2 par page A4, même structure que drawPinCard inspection
// ─────────────────────────────────────────────────────────────────────────────
async function drawFicheTravail(
  pdf: jsPDF,
  travail: TravailNettoyage,
  plan: Plan | undefined,
  project: Project,
  systeme: Systeme | undefined,
  cardX: number, cardY: number, cardW: number, cardH: number,
  photosAvant: string[],
  photosApres: string[],
  allPlans: Plan[],
): Promise<void> {
  const DRPH   = 4.5
  const HDH    = 7
  // 38 % pour les données, 62 % pour les photos — photos nettement plus lisibles
  const INFO_W  = Math.floor(cardW * 0.38)
  const PHOTO_W = cardW - INFO_W
  const LVAL_X  = cardX + 28   // début colonne valeur (28 mm pour libellé)
  const LVAL_W  = INFO_W - 30  // largeur disponible pour la valeur

  // ── GAUCHE : données ─────────────────────────────────────────────────────
  let ly = cardY
  const headerColor = composanteRGB(travail.typeComposante)

  pdf.setFillColor(...headerColor); pdf.rect(cardX, ly, INFO_W, HDH, 'F')
  pdf.setTextColor(255, 255, 255); pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold')
  pdf.text(`Travail #${travail.numero}`, cardX + 2, ly + 5)
  ly += HDH

  // Numéros de photos
  const avantRefs = (travail.photosAvant ?? []).map((p) => p.ref).filter(Boolean).join(', ')
  const apresRefs = (travail.photosApres ?? []).map((p) => p.ref).filter(Boolean).join(', ')

  // Portes/ouvertures de service — sans-plan : portesInstalleesLibres ; sur-plan : portesUtilisees
  const PREFIX_PDF: Record<string, string> = { acces: 'PA', architectural: 'P.Ar.', plaque: 'PL' }
  const isSansPlanFiche = !plan
  let doorRows: [string, string][]
  if (isSansPlanFiche) {
    doorRows = (travail.portesInstalleesLibres ?? []).map((p, i) => [
      i === 0 ? 'Ouv. service' : '',
      `${PREFIX_PDF[p.type] ?? p.type} · ${p.dimensions}`,
    ])
  } else {
    const doorIds   = travail.portesUtilisees ?? []
    const doorPool  = (plan.accessDoors ?? []).concat(allPlans.flatMap((p2) => p2.id !== plan.id ? (p2.accessDoors ?? []) : []))
    const usedDoors = doorPool.filter((d) => doorIds.includes(d.id))
    doorRows = usedDoors.map((d, i) => [
      i === 0 ? 'Porte(s)' : '',
      `${d.numero}${d.dimensions ? ` · ${d.dimensions}` : ''}`,
    ])
  }

  const descRows = ([
    ['Système',      systeme?.nom ?? ''],
    ['Composante',   travail.typeComposante ? COMPOSANTES_CVAC[travail.typeComposante].label : ''],
    ['Localisation', travail.location ?? ''],
    ['Zone',         travail.zoneDesservie ?? ''],
    ['Plan',         plan?.name ?? ''],
    ['Méthode',      travail.methode ? METHODES_NETTOYAGE[travail.methode] : ''],
    ['Technicien',   travail.technicien ?? ''],
    ['Date début',   travail.dateDebut ?? ''],
    ['Date fin',     travail.dateFin ?? ''],
    ['Durée',        travail.dureeHeures ? `${travail.dureeHeures}h` : ''],
    ...doorRows,
    avantRefs ? ['Réf. avant',  avantRefs] : null,
    apresRefs ? ['Réf. après',  apresRefs] : null,
  ] as ([string, string] | null)[]).filter((r): r is [string, string] => r !== null && !!r[1])

  descRows.forEach(([label, value], i) => {
    const ry     = ly + i * DRPH
    if (ry + DRPH > cardY + cardH - 2) return
    const isRef  = label.startsWith('Réf.')
    const isDoor = label === 'Porte(s)' || (i > 0 && label === '' && descRows[i - 1]?.[0] === 'Porte(s)')
    if (isRef) {
      pdf.setFillColor(220, 235, 255)
    } else if (isDoor) {
      pdf.setFillColor(219, 234, 254)   // bleu porte
    } else if (i % 2 === 0) {
      pdf.setFillColor(...LBLUE)
    } else {
      pdf.setFillColor(255, 255, 255)
    }
    pdf.rect(cardX, ry, INFO_W, DRPH, 'F')
    pdf.setFontSize(5.5); pdf.setFont('helvetica', 'bold')
    if (isDoor) {
      pdf.setTextColor(29, 78, 216)
    } else {
      pdf.setTextColor(isRef ? 27 : 80, isRef ? 79 : 80, isRef ? 138 : 80)
    }
    if (label) pdf.text(label + ':', cardX + 2, ry + DRPH - 1)
    pdf.setFont('helvetica', isDoor || isRef ? 'bold' : 'normal')
    if (isDoor) {
      pdf.setTextColor(29, 78, 216)
    } else {
      pdf.setTextColor(isRef ? 27 : 0, isRef ? 79 : 0, isRef ? 138 : 0)
    }
    const vl = pdf.splitTextToSize(value, LVAL_W) as string[]
    pdf.text(vl[0] || '', label ? LVAL_X : cardX + 2, ry + DRPH - 1)
  })
  ly += descRows.length * DRPH

  // Anomalies
  if (travail.anomalies.length > 0) {
    const anomH = Math.min(HDH, cardY + cardH - ly - 2)
    if (anomH > 3) {
      pdf.setFillColor(254, 243, 199); pdf.rect(cardX, ly, INFO_W, anomH, 'F')
      pdf.setTextColor(146, 64, 14); pdf.setFontSize(5.5); pdf.setFont('helvetica', 'bold')
      const anomText = travail.anomalies.slice(0, 3).map(a => ANOMALIE_LABELS[a.type] ?? a.type).join(' · ')
      pdf.text(anomText, cardX + 2, ly + anomH - 1.5, { maxWidth: INFO_W - 4 })
      ly += anomH
    }
  }

  // Observations
  const obs = (travail.observationsAvant ?? '').trim() || (travail.observationsApres ?? '').trim()
  if (obs && ly < cardY + cardH - 10) {
    pdf.setFillColor(220, 228, 240); pdf.rect(cardX, ly, INFO_W, 5, 'F')
    pdf.setTextColor(...DGRAY); pdf.setFontSize(5.5); pdf.setFont('helvetica', 'bold')
    pdf.text('Observations', cardX + 2, ly + 3.5)
    ly += 5
    const remaining = cardY + cardH - ly - 2
    if (remaining > 4) {
      pdf.setTextColor(0, 0, 0); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(5.5)
      const lines = (pdf.splitTextToSize(obs, INFO_W - 4) as string[]).slice(0, Math.floor(remaining / 3.5))
      if (lines.length) pdf.text(lines, cardX + 2, ly + 3.5)
    }
  }

  // ── DROITE : 2 colonnes (AVANT / APRÈS) × 2 photos empilées ─────────────
  const phX        = cardX + INFO_W
  const halfW      = Math.floor(PHOTO_W / 2)
  const pad        = 2
  const labelH     = 7
  const photoAreaH = cardH - labelH
  const slotGap    = 1
  const slotH      = Math.floor((photoAreaH - slotGap) / 2)

  type PhotoCol = { photos: string[]; label: string; xOff: number; color: [number,number,number] }
  const columns: PhotoCol[] = [
    { photos: photosAvant, label: 'AVANT',  xOff: 0,     color: [245, 158, 11] },
    { photos: photosApres, label: 'APRÈS',  xOff: halfW, color: BLUE            },
  ]

  for (const { photos, label, xOff, color } of columns) {
    const zoneX = phX + xOff
    const zoneW = xOff === 0 ? halfW : PHOTO_W - halfW

    if (xOff > 0) {
      pdf.setDrawColor(200, 200, 200); pdf.setLineWidth(0.3)
      pdf.line(zoneX, cardY, zoneX, cardY + cardH)
    }

    // Barre de titre de la colonne
    pdf.setFillColor(...color)
    pdf.rect(zoneX, cardY, zoneW, labelH, 'F')
    pdf.setTextColor(255, 255, 255); pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold')
    pdf.text(label, zoneX + zoneW / 2, cardY + 5, { align: 'center' })

    // Deux emplacements photo empilés
    for (let si = 0; si < 2; si++) {
      const slotY    = cardY + labelH + si * (slotH + slotGap)
      const photoUrl = photos[si]

      // Séparateur entre les deux emplacements
      if (si === 1) {
        pdf.setDrawColor(200, 200, 200); pdf.setLineWidth(0.2)
        pdf.line(zoneX, slotY, zoneX + zoneW, slotY)
      }

      if (photoUrl) {
        try {
          const { w: iw, h: ih } = await loadImgDims(photoUrl)
          const { w: fw, h: fh } = fitInBox(iw, ih, zoneW - 2 * pad, slotH - 2 * pad)
          const ix = zoneX + (zoneW - fw) / 2
          const iy = slotY + (slotH - fh) / 2
          pdf.addImage(photoUrl, imgFmt(photoUrl), ix, iy, fw, fh)
        } catch { /* skip */ }
      } else {
        pdf.setFillColor(242, 242, 242)
        pdf.rect(zoneX + pad, slotY + pad, zoneW - 2 * pad, slotH - 2 * pad, 'F')
        if (photos.length === 0 && si === 0) {
          pdf.setTextColor(180, 180, 180); pdf.setFontSize(5.5); pdf.setFont('helvetica', 'normal')
          pdf.text('Aucune photo', zoneX + zoneW / 2, slotY + slotH / 2, { align: 'center' })
        }
      }
    }
  }

  // Cadre + séparateurs verticaux
  pdf.setDrawColor(180, 180, 180); pdf.setLineWidth(0.4)
  pdf.rect(cardX, cardY, cardW, cardH, 'D')
  pdf.setLineWidth(0.3)
  pdf.line(cardX + INFO_W, cardY, cardX + INFO_W, cardY + cardH)
  pdf.line(cardX + INFO_W + halfW, cardY, cardX + INFO_W + halfW, cardY + cardH)
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGES DU RAPPORT ÉCRIT — même design que l'inspection
// ─────────────────────────────────────────────────────────────────────────────
async function drawRapportEcritPages(
  pdf: jsPDF,
  project: Project,
  sections: ReportSection[],
  onSection?: (title: string, page: number, type?: 'section' | 'subtitle') => void,
): Promise<void> {
  if (!sections.length) return

  const BODY_ML  = S_ML + 6
  const BODY_UW  = S_UW - 6
  const BODY_TOP = S_MT + S_HDR_H + 3
  const BODY_BOT = S_PH - S_MB - S_FTR_H - 2

  let pageIndex = 0
  let y = BODY_TOP

  const newPage = async () => {
    pdf.addPage('a4', 'p')
    pageIndex++
    await drawTextPageHeader(pdf, project, pageIndex)
    drawSectionPageFooter(pdf)
    y = BODY_TOP
  }
  await newPage()

  const drawTitle = (title: string) => {
    pdf.setFillColor(...BLUE); pdf.rect(S_ML, y - 1, 3, 6, 'F')
    pdf.setTextColor(...BLUE); pdf.setFontSize(11); pdf.setFont('times', 'bold')
    const tl = pdf.splitTextToSize(title, S_UW - 6) as string[]
    tl.forEach((line, i) => pdf.text(line, S_ML + 6, y + 3.5 + i * 6))
    y += 6 + (tl.length - 1) * 6 + 5
  }

  for (const section of sections) {
    if (section.type === 'subtitle') {
      if (!section.title.trim()) continue
      if (y + 18 + LINE_H * 3 > BODY_BOT) await newPage()
      onSection?.(section.title, pdf.getNumberOfPages(), 'section')
      if (y > BODY_TOP) y += 8
      pdf.setFont('times', 'bold'); pdf.setFontSize(14); pdf.setTextColor(...BLUE)
      const stl = pdf.splitTextToSize(section.title, S_UW) as string[]
      stl.forEach((line, i) => pdf.text(line, S_ML, y + i * 8))
      y += stl.length * 8 + 2
      pdf.setDrawColor(...BLUE); pdf.setLineWidth(0.6)
      pdf.line(S_ML, y, S_ML + S_UW, y)
      y += 7
    }

    else if (section.type === 'text') {
      const raw = (section as TextReportSection).content?.trim()
      if (!raw) continue
      if (section.title.trim() && y + 7 + LINE_H * 4 > BODY_BOT && y > BODY_TOP + 20) await newPage()
      if (section.title.trim()) {
        onSection?.(section.title, pdf.getNumberOfPages(), 'subtitle')
        drawTitle(section.title)
      }

      const fixChars = (s: string) => s
        .replace(/μ/g, 'µ')
        .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/≠/g, '!=')
        .replace(/×/g, 'x').replace(/÷/g, '/').replace(/±/g, '+/-')
        .replace(/°/g, String.fromCharCode(176))
        .replace(/Δ/g, 'D').replace(/α/g, 'a').replace(/β/g, 'B').replace(/γ/g, 'g')
        .replace(/θ/g, 'th').replace(/Ω/g, 'O').replace(/π/g, 'pi')

      const renderListEl = async (listEl: Element, ordered: boolean, depth: number): Promise<void> => {
        let idx = 1
        for (const child of Array.from(listEl.children)) {
          if (child.tagName.toLowerCase() !== 'li') continue
          let directText = ''
          let isBold = false
          for (const node of Array.from(child.childNodes)) {
            const nodeName = (node as Element).tagName?.toLowerCase()
            if ((node as any).nodeType === 3) {
              directText += node.textContent ?? ''
            } else if (nodeName === 'strong' || nodeName === 'b') {
              directText += (node as Element).textContent ?? ''
              isBold = true
            } else if (nodeName !== 'ul' && nodeName !== 'ol') {
              directText += (node as Element).textContent ?? ''
            }
          }
          directText = fixChars(directText.trim())
          const INDENT = BODY_ML + depth * 7
          const MAX_W  = BODY_UW - depth * 7 - 5
          if (directText) {
            if (y + LINE_H > BODY_BOT) await newPage()
            pdf.setFontSize(11); pdf.setFont('times', isBold ? 'bold' : 'normal'); pdf.setTextColor(...DGRAY)
            if (ordered) {
              pdf.text(`${idx}.`, INDENT, y)
            } else {
              pdf.setFillColor(...DGRAY)
              pdf.circle(INDENT + 1.5, y - 1.5, depth === 0 ? 0.9 : 0.6, 'F')
            }
            const wl = pdf.splitTextToSize(directText, MAX_W) as string[]
            for (const wline of wl) {
              if (y + LINE_H > BODY_BOT) {
                await newPage()
                pdf.setFontSize(11); pdf.setFont('times', isBold ? 'bold' : 'normal'); pdf.setTextColor(...DGRAY)
              }
              pdf.text(wline, INDENT + 5, y); y += LINE_H
            }
            idx++
          }
          for (const nestedEl of Array.from(child.children)) {
            const nt = nestedEl.tagName.toLowerCase()
            if (nt === 'ul' || nt === 'ol') await renderListEl(nestedEl, nt === 'ol', depth + 1)
          }
        }
      }

      const parser = new DOMParser()
      const dom = parser.parseFromString(`<body>${raw.startsWith('{') ? '' : raw}</body>`, 'text/html')

      for (const el of Array.from(dom.body.children)) {
        const tag = (el as HTMLElement).tagName.toLowerCase()
        const txt = fixChars(((el as HTMLElement).textContent ?? '').trim())
        if (!txt) continue
        if (y + LINE_H > BODY_BOT) await newPage()

        if (tag === 'h1' || tag === 'h2') {
          pdf.setFont('times', 'bold'); pdf.setFontSize(12); pdf.setTextColor(...BLUE)
          const hl = pdf.splitTextToSize(txt, S_UW) as string[]
          hl.forEach(line => { if (y + LINE_H > BODY_BOT) return; pdf.text(line, S_ML, y); y += 7 })
          y += 2
        } else if (tag === 'h3' || tag === 'h4') {
          pdf.setFont('times', 'bold'); pdf.setFontSize(11); pdf.setTextColor(...BLUE)
          pdf.text(txt, S_ML, y); y += 6
        } else if (tag === 'p') {
          pdf.setFont('times', 'normal'); pdf.setFontSize(11); pdf.setTextColor(...DGRAY)
          const lines = pdf.splitTextToSize(txt, BODY_UW) as string[]
          for (const line of lines) {
            if (y + LINE_H > BODY_BOT) { await newPage(); pdf.setFont('times', 'normal'); pdf.setFontSize(11); pdf.setTextColor(...DGRAY) }
            pdf.text(line, BODY_ML, y); y += LINE_H
          }
          y += 1.5
        } else if (tag === 'ul' || tag === 'ol') {
          await renderListEl(el, tag === 'ol', 0)
          y += 2
        } else if (tag === 'table') {
          const rows = Array.from(el.querySelectorAll('tr'))
          if (rows.length > 0) {
            const firstRow = rows[0]
            const colCount = firstRow.querySelectorAll('th, td').length
            if (colCount > 0) {
              const colW  = BODY_UW / colCount
              const HDR_H = 8, ROW_H = 9
              if (y + HDR_H > BODY_BOT) await newPage()
              pdf.setFillColor(...BLUE)
              pdf.rect(BODY_ML, y, BODY_UW, HDR_H, 'F')
              pdf.setTextColor(255, 255, 255); pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold')
              Array.from(firstRow.querySelectorAll('th, td')).forEach((cell, ci) => {
                const hLines = (pdf.splitTextToSize(fixChars((cell as HTMLElement).textContent?.trim() ?? ''), colW - 4) as string[]).slice(0, 2)
                hLines.forEach((hl, li) => pdf.text(hl, BODY_ML + ci * colW + 2, y + 5 + li * 3.5))
              })
              y += HDR_H
              for (let ri = 1; ri < rows.length; ri++) {
                const cells = Array.from(rows[ri].querySelectorAll('td, th'))
                if (!cells.length) continue
                if (y + ROW_H > BODY_BOT) await newPage()
                const even = ri % 2 === 0
                pdf.setFillColor(even ? 245 : 255, even ? 249 : 255, even ? 253 : 255)
                pdf.setDrawColor(200, 210, 220); pdf.setLineWidth(0.2)
                pdf.rect(BODY_ML, y, BODY_UW, ROW_H, 'FD')
                pdf.setTextColor(...DGRAY); pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal')
                cells.forEach((cell, ci) => {
                  const cLines = (pdf.splitTextToSize(fixChars((cell as HTMLElement).textContent?.trim() ?? ''), colW - 4) as string[]).slice(0, 2)
                  cLines.forEach((cl, li) => pdf.text(cl, BODY_ML + ci * colW + 2, y + 4.5 + li * 4))
                })
                y += ROW_H
              }
              y += 5
            }
          }
        }
      }
      y += 3
    }

    else if (section.type === 'equipment_list') {
      const eq = section as EquipmentListReportSection
      if (!eq.items.length) continue
      if (section.title.trim()) drawTitle(section.title)
      const EQ_COL_W = [20, 38, 32, 28, BODY_UW - 20 - 38 - 32 - 28]
      const COL_H2 = 6.5, HDR_H3 = 7
      const headers = ['No. Système', 'Composante', 'Zone', 'État', 'Observations']
      const fields  = ['systeme', 'composante', 'zone', 'etat', 'observations'] as const
      pdf.setFillColor(...BLUE)
      let ecx = BODY_ML
      for (let ci = 0; ci < headers.length; ci++) {
        pdf.rect(ecx, y, EQ_COL_W[ci], HDR_H3, 'F')
        pdf.setTextColor(255, 255, 255); pdf.setFontSize(7); pdf.setFont('helvetica', 'bold')
        pdf.text(headers[ci], ecx + 1.5, y + 5)
        ecx += EQ_COL_W[ci]
      }
      y += HDR_H3
      eq.items.forEach((item, ri) => {
        if (y + COL_H2 > BODY_BOT) return
        pdf.setFillColor(ri % 2 === 0 ? 255 : 235, ri % 2 === 0 ? 255 : 242, ri % 2 === 0 ? 255 : 250)
        ecx = BODY_ML
        for (let ci = 0; ci < fields.length; ci++) {
          pdf.rect(ecx, y, EQ_COL_W[ci], COL_H2, 'FD')
          pdf.setTextColor(...DGRAY); pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal')
          pdf.text(safe(item[fields[ci]]), ecx + 1.5, y + 4.5)
          ecx += EQ_COL_W[ci]
        }
        y += COL_H2
      })
      y += 5
    }

    else if (section.type === 'observations') {
      const obs = section as ObservationsReportSection
      if (!obs.items.length) continue
      if (section.title.trim()) drawTitle(section.title)

      const SEV_COLORS: Record<string, [number,number,number]> = {
        info:      [59, 130, 246],
        attention: [234, 179, 8],
        critique:  [239, 68, 68],
      }
      const SEV_BG: Record<string, [number,number,number]> = {
        info:      [239, 246, 255],
        attention: [254, 252, 232],
        critique:  [254, 242, 242],
      }
      const SEV_LABELS: Record<string, string> = { info: 'Info', attention: 'Attention', critique: 'Critique' }

      // Colonnes : Réf | Sévérité | Description
      const hasRefs = obs.items.some((i) => !!i.ref)
      const COL_REF  = hasRefs ? 14 : 0
      const COL_SEV  = 22
      const COL_DESC = BODY_UW - COL_REF - COL_SEV
      const ROW_PAD  = 2.5
      const COL_H_HDR = 6

      // En-tête du tableau
      if (hasRefs) {
        pdf.setFillColor(50, 50, 60)
        pdf.rect(BODY_ML, y, BODY_UW, COL_H_HDR, 'F')
        pdf.setTextColor(255, 255, 255); pdf.setFontSize(7); pdf.setFont('helvetica', 'bold')
        if (hasRefs) pdf.text('Réf.', BODY_ML + COL_REF / 2, y + 4.2, { align: 'center' })
        pdf.text('Sévérité', BODY_ML + COL_REF + COL_SEV / 2, y + 4.2, { align: 'center' })
        pdf.text('Localisation · Anomalie · Description', BODY_ML + COL_REF + COL_SEV + 3, y + 4.2)
        y += COL_H_HDR
      }

      for (const item of obs.items) {
        if (!item.text.trim() && !item.photos.length) continue

        // Calcul hauteur de la ligne
        const lines = item.text.trim().split('\n').filter(Boolean)
        // Ligne 1 = titre (système), lignes suivantes = détail
        const titleLine = lines[0] ?? ''
        const detailLines = lines.slice(1)
        const titleW = COL_DESC - 4
        const titleWrapped = pdf.splitTextToSize(titleLine, titleW) as string[]
        const detailWrapped: string[][] = detailLines.map((l) => pdf.splitTextToSize(l, titleW) as string[])
        const totalTextLines = titleWrapped.length + detailWrapped.flat().length
        const rowH = Math.max(totalTextLines * LINE_H + ROW_PAD * 2, hasRefs ? 10 : 8)

        if (y + rowH + (item.photos.length > 0 ? 52 : 0) > BODY_BOT) await newPage()

        const sc   = SEV_COLORS[item.severity] ?? LGRAY
        const bgc  = SEV_BG[item.severity] ?? [250, 250, 250]

        // Fond de la ligne
        pdf.setFillColor(...bgc)
        pdf.rect(BODY_ML, y, BODY_UW, rowH, 'F')

        // Bordure gauche colorée (accent)
        pdf.setFillColor(...sc)
        pdf.rect(BODY_ML, y, 1.5, rowH, 'F')

        // Séparateurs verticaux
        pdf.setDrawColor(210, 210, 220); pdf.setLineWidth(0.15)
        if (hasRefs) pdf.line(BODY_ML + COL_REF, y, BODY_ML + COL_REF, y + rowH)
        pdf.line(BODY_ML + COL_REF + COL_SEV, y, BODY_ML + COL_REF + COL_SEV, y + rowH)

        // Cellule Réf.
        if (hasRefs && item.ref) {
          pdf.setTextColor(...sc); pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold')
          pdf.text(item.ref, BODY_ML + COL_REF / 2, y + rowH / 2 + 2.5, { align: 'center' })
        }

        // Cellule Sévérité
        pdf.setFillColor(...sc)
        const badgeX = BODY_ML + COL_REF + 2
        const badgeW = COL_SEV - 4
        const badgeY = y + rowH / 2 - 2.5
        pdf.roundedRect(badgeX, badgeY, badgeW, 5, 1, 1, 'F')
        pdf.setTextColor(255, 255, 255); pdf.setFontSize(6); pdf.setFont('helvetica', 'bold')
        pdf.text(SEV_LABELS[item.severity] ?? 'Info', badgeX + badgeW / 2, badgeY + 3.5, { align: 'center' })

        // Cellule Description
        const dx = BODY_ML + COL_REF + COL_SEV + 3
        let ty = y + ROW_PAD + LINE_H - 1
        // Ligne titre (gras)
        pdf.setTextColor(...DGRAY); pdf.setFontSize(8); pdf.setFont('helvetica', 'bold')
        for (const l of titleWrapped) { pdf.text(l, dx, ty); ty += LINE_H }
        // Lignes détail (normal)
        pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(80, 80, 90)
        for (const group of detailWrapped) {
          for (const l of group) { pdf.text(l, dx, ty); ty += LINE_H }
        }

        y += rowH

        // Photos (si présentes)
        if (item.photos.length > 0) {
          if (y + 52 > BODY_BOT) await newPage()
          let px = BODY_ML + (hasRefs ? COL_REF + COL_SEV + 3 : COL_SEV + 3)
          pdf.setFillColor(245, 245, 248)
          pdf.rect(BODY_ML, y, BODY_UW, 52, 'F')
          for (const photoUrl of item.photos.slice(0, 3)) {
            try {
              const dims = await loadImgDims(photoUrl)
              const { w, h } = fitInBox(dims.w, dims.h, 46, 42)
              pdf.setDrawColor(200, 200, 210); pdf.setLineWidth(0.3)
              pdf.rect(px, y + 4, 46, 42, 'D')
              pdf.addImage(photoUrl, imgFmt(photoUrl), px + (46 - w) / 2, y + 4 + (42 - h) / 2, w, h)
            } catch { /* skip */ }
            px += 50
          }
          y += 52
        }

        // Ligne séparatrice
        pdf.setDrawColor(210, 210, 220); pdf.setLineWidth(0.15)
        pdf.line(BODY_ML, y, BODY_ML + BODY_UW, y)
        y += 2
      }

      // Bordure extérieure du tableau
      if (hasRefs) {
        pdf.setDrawColor(180, 180, 195); pdf.setLineWidth(0.3)
        // pas de rect car y a avancé — juste laisser la ligne finale
      }
      y += 3
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ANNEXE PORTES D'ACCÈS — plan brut + marqueurs dessinés programmatiquement
// ─────────────────────────────────────────────────────────────────────────────
async function drawPortesAccesAnnex(
  pdf: jsPDF,
  project: Project,
  plans: Plan[],
  rawPlanImages: Record<string, string>,
  travaux: TravailNettoyage[],
  systemes: Systeme[],
): Promise<void> {
  const COL_ACCES: [number, number, number] = [29,  78, 216]
  const COL_ARCH:  [number, number, number] = [15, 118, 110]
  const COL_PL:   [number, number, number] = [180, 83,   9]

  function doorCol(type: string): [number, number, number] {
    if (type === 'acces')         return COL_ACCES
    if (type === 'architectural') return COL_ARCH
    return COL_PL
  }

  const plansWithDoors = plans.filter((p) => (p.accessDoors?.length ?? 0) > 0 && rawPlanImages[p.id])
  const planIdSetDoors = new Set(plans.map((p) => p.id))
  const sansPlanLibresTravaux = travaux.filter((t) => !t.planId || !planIdSetDoors.has(t.planId))
  const hasSansPlanDoors = sansPlanLibresTravaux.some((t) => (t.portesInstalleesLibres ?? []).length > 0)
  if (plansWithDoors.length === 0 && !hasSansPlanDoors) return

  // ── Page récapitulatif par système ───────────────────────────────────────────
  {
    // Construire doorId → {plan, door}
    type DoorEntry = { planName: string; door: NonNullable<Plan['accessDoors']>[0] }
    const doorById = new Map<string, DoorEntry>()
    for (const plan of plansWithDoors) {
      for (const door of (plan.accessDoors ?? [])) {
        doorById.set(door.id, { planName: plan.name, door })
      }
    }

    // Grouper par système via portesUtilisees
    const groups: { sysNom: string; doors: DoorEntry[] }[] = []
    const usedDoorIds = new Set<string>()
    for (const sys of systemes) {
      const sysTravaux = travaux.filter((t) => t.systemeId === sys.id)
      const doors: DoorEntry[] = []
      for (const t of sysTravaux) {
        for (const doorId of (t.portesUtilisees ?? [])) {
          const entry = doorById.get(doorId)
          if (entry && !doors.some((d) => d.door.id === doorId)) {
            doors.push(entry)
            usedDoorIds.add(doorId)
          }
        }
      }
      if (doors.length > 0) groups.push({ sysNom: sys.nom, doors })
    }
    // Portes non associées à un système
    const unlinked: DoorEntry[] = []
    for (const entry of doorById.values()) {
      if (!usedDoorIds.has(entry.door.id)) unlinked.push(entry)
    }
    if (unlinked.length > 0) groups.push({ sysNom: 'Non assigne', doors: unlinked })

    const TYPE_LBL: Record<string, string> = {
      acces: "P. d'acces", architectural: 'P. architecturale', plaque: 'Plaque',
    }
    const STAT_LBL: Record<string, string> = {
      existante: 'Existante', ajoutee: 'Ajoutee', requise: 'Requise',
    }
    // Colonnes : N°(14) | Plan(42) | Type(38) | Dimensions(28) | Statut(24) | Remarques(40) = 186
    const COLS    = [14, 42, 38, 28, 24, 40] as const
    const HDRS    = ['N°', 'Plan', 'Type', 'Dimensions', 'Statut', 'Remarques']
    const ROW_H   = 7, SYS_H = 8, HDR_ROW_H = 6
    const PAGE_BOT = 282

    pdf.addPage('a4', 'p')
    pdf.setFillColor(255, 255, 255)
    pdf.rect(0, 0, S_PW, 297, 'F')
    let ry = 14

    // Titre
    pdf.setFillColor(...BLUE)
    pdf.rect(S_ML, ry, S_UW, 11, 'F')
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5); pdf.setTextColor(255, 255, 255)
    pdf.text('RECAPITULATIF DES OUVERTURES DE SERVICE PAR SYSTEME', S_ML + S_UW / 2, ry + 7.5, { align: 'center' })
    ry += 16

    // Info projet
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(...LGRAY)
    pdf.text(`Projet : ${safe(project.name)}   |   Client : ${safe(project.client)}`, S_ML, ry)
    ry += 8

    for (const grp of groups) {
      if (grp.doors.length === 0) continue
      if (ry + SYS_H + HDR_ROW_H + ROW_H > PAGE_BOT) {
        pdf.addPage('a4', 'p'); pdf.setFillColor(255, 255, 255); pdf.rect(0, 0, S_PW, 297, 'F'); ry = 15
      }
      // Sous-titre système
      pdf.setFillColor(...LBLUE)
      pdf.rect(S_ML, ry, S_UW, SYS_H, 'F')
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5); pdf.setTextColor(...BLUE)
      pdf.text(grp.sysNom, S_ML + 3, ry + 5.8)
      ry += SYS_H

      // En-têtes colonnes
      let cx = S_ML
      pdf.setFillColor(30, 41, 59)
      for (let i = 0; i < COLS.length; i++) {
        pdf.rect(cx, ry, COLS[i], HDR_ROW_H, 'F')
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6); pdf.setTextColor(255, 255, 255)
        pdf.text(HDRS[i], cx + 1.5, ry + 4.2)
        cx += COLS[i]
      }
      ry += HDR_ROW_H

      // Lignes données
      for (let ri = 0; ri < grp.doors.length; ri++) {
        if (ry + ROW_H > PAGE_BOT) {
          pdf.addPage('a4', 'p'); pdf.setFillColor(255, 255, 255); pdf.rect(0, 0, S_PW, 297, 'F'); ry = 15
        }
        const { planName, door } = grp.doors[ri]
        const even = ri % 2 === 0
        pdf.setFillColor(even ? 245 : 255, even ? 249 : 255, even ? 253 : 255)
        pdf.setDrawColor(200, 210, 220); pdf.setLineWidth(0.15)
        pdf.rect(S_ML, ry, S_UW, ROW_H, 'FD')
        const vals = [
          door.numero,
          planName,
          TYPE_LBL[door.type] ?? door.type,
          door.dimensions ?? '—',
          STAT_LBL[door.statut] ?? door.statut,
          door.remarques?.trim() ?? '',
        ]
        cx = S_ML
        for (let i = 0; i < COLS.length; i++) {
          pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(...DGRAY)
          const cell = (pdf.splitTextToSize(vals[i], COLS[i] - 3) as string[])[0] ?? ''
          pdf.text(cell, cx + 1.5, ry + 4.7)
          cx += COLS[i]
        }
        ry += ROW_H
      }
      ry += 5
    }

    // Groupe — Sections sans plan
    type SPEntry = { travailNumero: number; sysNom: string; type: string; dimensions: string; statut: string }
    const spEntries: SPEntry[] = []
    for (const t of sansPlanLibresTravaux) {
      const sys = systemes.find((s) => s.id === t.systemeId)
      for (const p of (t.portesInstalleesLibres ?? [])) {
        spEntries.push({ travailNumero: t.numero, sysNom: sys?.nom ?? '—', type: p.type, dimensions: p.dimensions, statut: p.statut ?? 'ajoutee' })
      }
    }

    if (spEntries.length > 0) {
      if (ry + SYS_H + HDR_ROW_H + ROW_H > PAGE_BOT) {
        pdf.addPage('a4', 'p'); pdf.setFillColor(255, 255, 255); pdf.rect(0, 0, S_PW, 297, 'F'); ry = 15
      }
      pdf.setFillColor(75, 85, 99)
      pdf.rect(S_ML, ry, S_UW, SYS_H, 'F')
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5); pdf.setTextColor(255, 255, 255)
      pdf.text('SECTIONS SANS PLAN', S_ML + 3, ry + 5.8)
      ry += SYS_H

      let cx = S_ML
      pdf.setFillColor(30, 41, 59)
      const SP_HDRS = ['Trav.', 'Système', 'Type', 'Dimensions', 'Statut', 'Notes']
      for (let i = 0; i < COLS.length; i++) {
        pdf.rect(cx, ry, COLS[i], HDR_ROW_H, 'F')
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6); pdf.setTextColor(255, 255, 255)
        pdf.text(SP_HDRS[i], cx + 1.5, ry + 4.2)
        cx += COLS[i]
      }
      ry += HDR_ROW_H

      for (let ri = 0; ri < spEntries.length; ri++) {
        if (ry + ROW_H > PAGE_BOT) {
          pdf.addPage('a4', 'p'); pdf.setFillColor(255, 255, 255); pdf.rect(0, 0, S_PW, 297, 'F'); ry = 15
        }
        const e = spEntries[ri]
        const even = ri % 2 === 0
        pdf.setFillColor(even ? 245 : 255, even ? 249 : 255, even ? 253 : 255)
        pdf.setDrawColor(200, 210, 220); pdf.setLineWidth(0.15)
        pdf.rect(S_ML, ry, S_UW, ROW_H, 'FD')
        const vals = [
          `#${e.travailNumero}`, e.sysNom,
          TYPE_LBL[e.type] ?? e.type, e.dimensions ?? '—',
          STAT_LBL[e.statut] ?? e.statut, '',
        ]
        cx = S_ML
        for (let i = 0; i < COLS.length; i++) {
          pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(...DGRAY)
          const cell = (pdf.splitTextToSize(vals[i], COLS[i] - 3) as string[])[0] ?? ''
          pdf.text(cell, cx + 1.5, ry + 4.7)
          cx += COLS[i]
        }
        ry += ROW_H
      }
      ry += 5
    }

    // Total
    const nbTotal = [...doorById.values()].length + spEntries.length
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5); pdf.setTextColor(...BLUE)
    pdf.text(`Total : ${nbTotal} ouverture${nbTotal > 1 ? 's' : ''} de service`, S_ML, ry + 4)
  }

  for (const plan of plansWithDoors) {
    const imgData = rawPlanImages[plan.id]
    const { w: iw, h: ih } = await loadImgDims(imgData)
    const { w: pw, h: ph } = fitInBox(iw, ih, PLAN_W, PLAN_H)
    const px0 = PLAN_X + (PLAN_W - pw) / 2
    const py0 = PLAN_Y + (PLAN_H - ph) / 2

    pdf.addPage([TABLOID_W, TABLOID_H], 'landscape')
    pdf.setFillColor(255, 255, 255)
    pdf.rect(0, 0, TABLOID_W, TABLOID_H, 'F')
    if (iw > 0) pdf.addImage(imgData, imgFmt(imgData), px0, py0, pw, ph)
    await drawCartouche(pdf, project, { ...plan, name: `${plan.name} — Portes d'accès` } as Plan)

    if (iw <= 0 || ih <= 0) continue

    const scaleX = pw / iw
    const scaleY = ph / ih
    const DR = 2.5

    const doors = plan.accessDoors ?? []

    for (const door of doors) {
      const col = doorCol(door.type)
      const mx  = px0 + door.x * scaleX
      const my  = py0 + door.y * scaleY

      // Cercle principal
      pdf.setFillColor(...col)
      pdf.setDrawColor(255, 255, 255)
      pdf.setLineWidth(0.35)
      pdf.circle(mx, my, DR, 'FD')

      // Anneau pointillé = porte existante
      if ((door as any).statut === 'existante' || !(door as any).statut) {
        pdf.setDrawColor(255, 255, 255)
        pdf.setLineWidth(0.25)
        pdf.setLineDashPattern([0.9, 0.7], 0)
        pdf.circle(mx, my, DR * 0.65, 'D')
        pdf.setLineDashPattern([], 0)
      }

      // Numéro
      pdf.setTextColor(255, 255, 255)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(3.5)
      pdf.text(door.numero, mx, my + 1.2, { align: 'center' })

      // Étiquette dimensions
      if (door.dimensions) {
        const DW = 16, DH = 3.8
        const dx = mx - DW / 2, dy = my + DR + 1.2
        pdf.setFillColor(255, 255, 255)
        pdf.setDrawColor(...col)
        pdf.setLineWidth(0.25)
        pdf.roundedRect(dx, dy, DW, DH, 0.5, 0.5, 'FD')
        pdf.setTextColor(...col)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(3)
        pdf.text(door.dimensions, mx, dy + 2.7, { align: 'center' })
      }
    }

    // ── Remplacer la section LÉGENDE de la cartouche par la légende portes ───
    const LEGEND_H = 92  // hauteur de la section légende dans drawCartouche
    const cartX    = CART_X, cartW = CART_W
    // Effacement de l'ancienne légende
    pdf.setFillColor(255, 255, 255)
    pdf.rect(cartX, 0, cartW, LEGEND_H, 'F')

    // En-tête
    pdf.setFillColor(30, 41, 59)
    pdf.rect(cartX, 0, cartW, 6.5, 'F')
    pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7)
    pdf.text("L É G E N D E  —  P O R T E S", cartX + cartW / 2, 4.5, { align: 'center' })

    const LEG_ITEMS: Array<{ col: [number,number,number]; label: string; desc: string }> = [
      { col: COL_ACCES, label: 'P.A.',  desc: "Porte d'accès conduit" },
      { col: COL_ARCH,  label: 'P.Ar.', desc: 'Porte architecturale' },
      { col: COL_PL,    label: 'PL',    desc: 'Plaque' },
    ]
    const hasExistante = doors.some((d) => !(d as any).statut || (d as any).statut === 'existante')
    const CR = 3.5, CLX = cartX + 7
    let ly = 6.5 + 5

    for (const { col, label, desc } of LEG_ITEMS) {
      pdf.setFillColor(...col)
      pdf.circle(CLX, ly + CR, CR, 'F')
      pdf.setDrawColor(200, 200, 200); pdf.setLineWidth(0.2)
      pdf.circle(CLX, ly + CR, CR, 'D')
      pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(3.5)
      pdf.text(label, CLX, ly + CR + 1.3, { align: 'center' })
      pdf.setTextColor(30, 41, 59); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(5.5)
      pdf.text(desc, CLX + CR + 2.5, ly + CR + 1.5, { maxWidth: cartW - CR - 12 })
      ly += CR * 2 + 6
    }

    if (hasExistante) {
      ly += 2
      pdf.setDrawColor(180, 180, 180); pdf.setLineWidth(0.2)
      pdf.line(cartX + 4, ly, cartX + cartW - 4, ly)
      ly += 3
      pdf.setFillColor(100, 116, 139)
      pdf.circle(CLX, ly + CR, CR, 'F')
      pdf.setDrawColor(255, 255, 255); pdf.setLineWidth(0.3)
      pdf.setLineDashPattern([0.9, 0.7], 0)
      pdf.circle(CLX, ly + CR, CR * 0.65, 'D')
      pdf.setLineDashPattern([], 0)
      pdf.setTextColor(30, 41, 59); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(5)
      const lines = pdf.splitTextToSize('Porte existante\n(anneau pointillé)', cartW - CR - 12) as string[]
      lines.forEach((line, i) => pdf.text(line, CLX + CR + 2.5, ly + CR + 1.5 + i * 5.5, { maxWidth: cartW - CR - 12 }))
    }

    // Ligne séparatrice bas de la légende
    pdf.setDrawColor(30, 41, 59); pdf.setLineWidth(0.5)
    pdf.line(cartX, LEGEND_H, cartX + cartW, LEGEND_H)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FONCTION PRINCIPALE — même ordre que l'inspection
// ─────────────────────────────────────────────────────────────────────────────
export async function generateReport(
  project: Project,
  plans: Plan[],
  travaux: TravailNettoyage[],
  reportSections: ReportSection[],
  planImages: Record<string, string>,
  travailPhotos: Record<string, string>,
  zones: ZoneConduit[] = [],
  interventions: Intervention[] = [],
  interventionPhotos: Record<string, string> = {},
  rawPlanImages: Record<string, string> = {},
): Promise<void> {
  const pdf      = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const systemes = (project.systemes ?? []) as Systeme[]

  function resolvePhotos(photos: { ref: string; starred?: boolean }[], maxCount = 2): string[] {
    // Priorité aux photos étoilées ; fallback sur les premières disponibles
    const starred = photos.filter((ph) => ph.starred)
    const pool    = starred.length > 0 ? starred : photos
    const results: string[] = []
    for (const ph of pool) {
      if (results.length >= maxCount) break
      const url = travailPhotos[`${project.id}_${ph.ref}`]
      if (url) results.push(url)
    }
    return results
  }

  // ── Tracking pour le sommaire ────────────────────────────────────────────
  const tocEntries: { title: string; page: number; type: 'section' | 'subtitle' | 'annexe' | 'annexe-sub' }[] = []
  const trackToc = (title: string, page: number, type: 'section' | 'subtitle' | 'annexe' | 'annexe-sub' = 'section') => {
    tocEntries.push({ title, page, type })
  }

  // 1. Page de couverture
  await drawCoverPage(pdf, project)

  // 2. Page d'identification (info projet + signatures)
  await drawIdentificationPage(pdf, project)

  // 3. Page Sommaire (réservée — dessinée en dernier)
  pdf.addPage('a4', 'p')
  const TOC_PAGE = pdf.getNumberOfPages()

  // 4. Rapport écrit — rendu pur, sections déjà construites par l'appelant
  if (reportSections.length > 0) {
    await drawRapportEcritPages(pdf, project, reportSections, (title, page, type) => {
      trackToc(title, page, type ?? 'section')
    })
  }

  // ── ANNEXE A : Résumé des travaux de nettoyage ───────────────────────────
  if (travaux.length > 0) {
    await drawAnnexeSeparatorPage(pdf, project, 'Résumé des travaux de nettoyage')
    trackToc('Résumé des travaux de nettoyage', pdf.getNumberOfPages(), 'annexe')
    drawSommaireNettoyage(pdf, project, plans, travaux, systemes)
  }

  // ── ANNEXE B : Rapport de nettoyage (fiches par système) ───────────────────
  // Seuls les travaux avec includeInReport !== false sont inclus dans les fiches
  const ficheTravaux = travaux.filter((t) => t.includeInReport !== false)
  if (ficheTravaux.length > 0) {
    await drawAnnexeSeparatorPage(pdf, project, 'Rapport de nettoyage')
    trackToc('Rapport de nettoyage', pdf.getNumberOfPages(), 'annexe')

    // ── Note au lecteur — dessinée sur la page séparatrice juste créée ──────
    {
      const NX = 22, NW = 210 - 22 - 10
      const NY = 235
      // Cadre fond jaune clair
      pdf.setFillColor(255, 251, 235); pdf.setDrawColor(217, 119, 6)
      pdf.setLineWidth(0.5)
      pdf.roundedRect(NX, NY, NW, 46, 2, 2, 'FD')
      // Barre gauche orange
      pdf.setFillColor(217, 119, 6)
      pdf.rect(NX, NY, 3, 46, 'F')
      // Icône ⓘ
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(217, 119, 6)
      pdf.text('i', NX + 8.5, NY + 8, { align: 'center' })
      // Titre
      pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(120, 53, 15)
      pdf.text('NOTE AU LECTEUR — RAPPORT REPRÉSENTATIF', NX + 14, NY + 8)
      // Corps
      const noteBody = [
        'Ce rapport de nettoyage présente une sélection représentative et sommaire des travaux effectués.',
        'Il ne comprend pas nécessairement l\'ensemble des interventions réalisées sur le projet.',
        '',
        'Pour un portrait complet des travaux, veuillez consulter :',
        '  • Le Résumé des travaux de nettoyage (Annexe A) — tableau exhaustif de toutes les sections,',
        '  • Le dossier photographique complet inclus dans les fiches de travaux.',
      ]
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(92, 45, 5)
      noteBody.forEach((line, i) => pdf.text(line, NX + 14, NY + 15 + i * 5))
    }

    const CARDS_PER_PAGE = 2
    const AVAIL_H2 = S_PH - S_MT - S_HDR_H - 3 - S_MB - S_FTR_H - 2 - 2
    const CARD_H   = Math.floor((AVAIL_H2 - (CARDS_PER_PAGE - 1) * 2) / CARDS_PER_PAGE)

    const planIds = new Set(plans.map((p) => p.id))
    const ficheAvecPlan = ficheTravaux.filter((t) => t.planId && planIds.has(t.planId))
    const ficheSansPlan = ficheTravaux.filter((t) => !t.planId || !planIds.has(t.planId))

    async function renderFicheGroup(group: TravailNettoyage[]) {
      for (const sysGroup of groupTravauxBySysteme(group, systemes)) {
        await drawSystemDividerPage(pdf, project, sysGroup.label, sysGroup.travaux.length)
        trackToc(`Système : ${sysGroup.label}`, pdf.getNumberOfPages(), 'annexe-sub')

        let cardOnPage = 0
        for (const t of sysGroup.travaux) {
          if (cardOnPage === 0 || cardOnPage >= CARDS_PER_PAGE) {
            pdf.addPage('a4', 'p')
            await drawSectionPageHeader(pdf, project)
            drawSectionPageFooter(pdf)
            cardOnPage = 0
          }
          const plan = plans.find((p) => p.id === t.planId)
          const sys  = systemes.find((s) => s.id === t.systemeId)
          const cardY = S_CARDS_Y + cardOnPage * (CARD_H + 2)
          await drawFicheTravail(
            pdf, t, plan, project, sys,
            S_ML, cardY, S_UW, CARD_H,
            resolvePhotos(t.photosAvant),
            resolvePhotos(t.photosApres),
            plans,
          )
          cardOnPage++
        }
      }
    }

    if (ficheAvecPlan.length > 0) {
      await drawSubSectionDivider(pdf, project, 'Sections sur plan', ficheAvecPlan.length, [22, 101, 52])
      trackToc('Sections sur plan', pdf.getNumberOfPages(), 'annexe-sub')
      await renderFicheGroup(ficheAvecPlan)
    }

    if (ficheSansPlan.length > 0) {
      await drawSubSectionDivider(pdf, project, 'Sections sans plan', ficheSansPlan.length, [75, 85, 99])
      trackToc('Sections sans plan', pdf.getNumberOfPages(), 'annexe-sub')
      await renderFicheGroup(ficheSansPlan)
    }
  }

  // ── ANNEXE C : Plans annotés de nettoyage ────────────────────────────────
  const plansWithImages = plans.filter((p) => planImages[p.id])
  if (plansWithImages.length > 0) {
    await drawAnnexeSeparatorPage(pdf, project, 'Plans annotés de nettoyage')
    trackToc('Plans annotés de nettoyage', pdf.getNumberOfPages(), 'annexe')

  for (const plan of plansWithImages) {
    const imgData = planImages[plan.id]  // snapshot Konva : plan + épingles + zones
    const { w: iw, h: ih } = await loadImgDims(imgData)
    const { w: pw, h: ph } = fitInBox(iw, ih, PLAN_W, PLAN_H)
    const px0 = PLAN_X + (PLAN_W - pw) / 2
    const py0 = PLAN_Y + (PLAN_H - ph) / 2

    pdf.addPage([TABLOID_W, TABLOID_H], 'landscape')
    pdf.setFillColor(200, 200, 200); pdf.rect(0, 0, TABLOID_W, TABLOID_H, 'F')
    pdf.addImage(imgData, imgFmt(imgData), px0, py0, pw, ph)
    await drawCartouche(pdf, project, plan)
  }
  } // fin plansWithImages

  // ── ANNEXE D : Rapport d'intervention — secteur appartements ────────────────
  if (interventions.length > 0) {
    await drawAnnexeSeparatorPage(pdf, project, 'Rapport d\'intervention — Secteur appartements')
    trackToc('Rapport d\'intervention — Secteur appartements', pdf.getNumberOfPages(), 'annexe')

    // Tableau récapitulatif (paysage A4)
    await appendInterventionTableau(pdf, project, interventions, interventionPhotos)
  }

  // ── DERNIÈRE ANNEXE : Plans des ouvertures de service ───────────────────────────────
  const plansWithDoors = plans.filter((p) => (p.accessDoors?.length ?? 0) > 0)
  if (plansWithDoors.length > 0 && Object.keys(rawPlanImages).length > 0) {
    await drawAnnexeSeparatorPage(pdf, project, "Plans des ouvertures de service")
    trackToc("Plans des ouvertures de service", pdf.getNumberOfPages(), 'annexe')
    await drawPortesAccesAnnex(pdf, project, plans, rawPlanImages, travaux, systemes)
  }

  // ── Sommaire — dessiné sur la page réservée (page TOC_PAGE) ──────────────
  pdf.setPage(TOC_PAGE)
  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, 0, S_PW, 297, 'F')
  drawTocNettoyagePage(pdf, project, tocEntries)

  pdf.save(`rapport-nettoyage-${safe(project.name).replace(/\s+/g, '-').toLowerCase()}.pdf`)
}
