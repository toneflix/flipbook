import type { PaperColor } from '../book'
import type { Blend, PhotoTone, TextureName } from './types'

/** How one paper colour prints: its ink, the tints frames mix with it, its texture tiles and how photos are toned on it. */
export interface PaperLook {
  background: string
  /** Ink as r, g, b, so frames can print it at any strength. */
  ink: [number, number, number]
  /** How bands printed in colour mix with the paper. */
  inkBlend: Blend
  frameTint: string
  plateTint: string
  plateLow: string
  plateHigh: string
  texture: TextureName
  textureBlend: Blend
  grain: TextureName
  grainOpacity: number
  /** Soft light from the top left. */
  light: string
  /** The darker edges of the sheet, from `vignetteFrom` of the way out. */
  vignette: string
  vignetteFrom: number
  tone: PhotoTone
}

const ivory: PaperLook = {
  background: '#fdf9f0',
  ink: [61, 55, 47],
  inkBlend: 'multiply',
  frameTint: 'rgba(255,255,255,0.4)',
  plateTint: 'rgba(90,70,40,0.03)',
  plateLow: 'rgba(90,70,40,0.12)',
  plateHigh: 'rgba(255,255,255,0.6)',
  texture: 'paper-fine',
  textureBlend: 'multiply',
  grain: 'grain-fine',
  grainOpacity: 0.45,
  light: 'rgba(255,255,255,0.5)',
  vignette: 'rgba(110,90,60,0.08)',
  vignetteFrom: 0.6,
  tone: { sepia: 0.06, saturate: 0.94, contrast: 0.94, brightness: 1.01 },
}

export const PAPER_LOOKS: Record<PaperColor, PaperLook> = {
  ivory,
  white: { ...ivory, background: '#ffffff', frameTint: 'rgba(150,125,90,0.08)' },
  kraft: {
    ...ivory,
    background: '#d8c4a2',
    ink: [61, 47, 29],
    frameTint: 'rgba(255,248,235,0.35)',
    plateLow: 'rgba(80,50,20,0.16)',
    plateHigh: 'rgba(255,245,225,0.35)',
    texture: 'paper-kraft',
    grain: 'grain-kraft',
    grainOpacity: 0.35,
    light: 'rgba(255,255,255,0.18)',
    vignette: 'rgba(80,50,20,0.12)',
    tone: { sepia: 0.22, saturate: 0.88, contrast: 0.9, brightness: 0.98 },
  },
  charcoal: {
    background: '#2a2826',
    ink: [232, 226, 214],
    inkBlend: 'screen',
    frameTint: 'rgba(255,255,255,0.07)',
    plateTint: 'rgba(0,0,0,0.08)',
    plateLow: 'rgba(0,0,0,0.35)',
    plateHigh: 'rgba(255,255,255,0.07)',
    texture: 'paper-charcoal',
    textureBlend: 'soft-light',
    grain: 'grain-charcoal',
    grainOpacity: 0.22,
    light: 'rgba(255,255,255,0.05)',
    vignette: 'rgba(0,0,0,0.25)',
    vignetteFrom: 0.55,
    tone: { sepia: 0, saturate: 0.92, contrast: 0.94, brightness: 0.9 },
  },
}

/** A paper's ink at a strength from 0 to 1. */
export const inkOf = (look: PaperLook, alpha = 1) => `rgba(${look.ink.join(',')},${alpha})`
