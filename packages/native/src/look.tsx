import { createContext, useContext, type ReactNode } from 'react'
import { Platform, type ImageSourcePropType } from 'react-native'
import type { FrameStyle, PaperColor } from '@toneflix/flipbook-core'

/** How one paper colour prints: its ink, the tints frames mix with it, and its texture tiles. Mirrors the web's .fb-paper-* styles. */
export interface PaperLook {
  background: string
  /** Ink as r, g, b, so frames can print it at any strength. */
  ink: [number, number, number]
  frameTint: string
  plateTint: string
  plateLow: string
  plateHigh: string
  texture: ImageSourcePropType
  textureOpacity: number
  grain: ImageSourcePropType
  grainOpacity: number
  /** Soft light from the top left, and the darker edges of the sheet. */
  light: string
  vignette: string
}

const fine = { texture: require('../assets/textures/paper-fine@2x.webp'), grain: require('../assets/textures/grain-fine@2x.webp') }

const ivory: PaperLook = {
  background: '#fdf9f0',
  ink: [61, 55, 47],
  frameTint: 'rgba(255,255,255,0.4)',
  plateTint: 'rgba(90,70,40,0.03)',
  plateLow: 'rgba(90,70,40,0.12)',
  plateHigh: 'rgba(255,255,255,0.6)',
  ...fine,
  textureOpacity: 0.35,
  grainOpacity: 0.45,
  light: 'rgba(255,255,255,0.5)',
  vignette: 'rgba(110,90,60,0.08)',
}

export const PAPERS: Record<PaperColor, PaperLook> = {
  ivory,
  white: { ...ivory, background: '#ffffff', frameTint: 'rgba(150,125,90,0.08)' },
  kraft: {
    background: '#d8c4a2',
    ink: [61, 47, 29],
    frameTint: 'rgba(255,248,235,0.35)',
    plateTint: 'rgba(90,70,40,0.03)',
    plateLow: 'rgba(80,50,20,0.16)',
    plateHigh: 'rgba(255,245,225,0.35)',
    texture: require('../assets/textures/paper-kraft@2x.webp'),
    textureOpacity: 0.45,
    grain: require('../assets/textures/grain-kraft@2x.webp'),
    grainOpacity: 0.35,
    light: 'rgba(255,255,255,0.18)',
    vignette: 'rgba(80,50,20,0.12)',
  },
  charcoal: {
    background: '#2a2826',
    ink: [232, 226, 214],
    frameTint: 'rgba(255,255,255,0.07)',
    plateTint: 'rgba(0,0,0,0.08)',
    plateLow: 'rgba(0,0,0,0.35)',
    plateHigh: 'rgba(255,255,255,0.07)',
    texture: require('../assets/textures/paper-charcoal@2x.webp'),
    textureOpacity: 0.25,
    grain: require('../assets/textures/grain-charcoal@2x.webp'),
    grainOpacity: 0.22,
    light: 'rgba(255,255,255,0.05)',
    vignette: 'rgba(0,0,0,0.25)',
  },
}

/** The ink of a paper at a strength from 0 to 1. */
export const ink = (look: PaperLook, alpha = 1) => `rgba(${look.ink.join(',')},${alpha})`

/** Font families for page text. Leave out `serifItalic` to slant `serif` instead. */
export interface BookFonts {
  serif?: string
  serifItalic?: string
  sans?: string
}

const DEFAULT_SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' })

export interface BookLook {
  paper: PaperColor
  frame: FrameStyle
  fonts: BookFonts
}

const BookLookContext = createContext<BookLook>({ paper: 'ivory', frame: 'none', fonts: {} })

/** The paper, default frame and fonts for every page rendered inside. The viewer sets it from the book. */
export function BookLookProvider({ paper = 'ivory', frame = 'none', fonts = {}, children }: Partial<BookLook> & { children: ReactNode }) {
  return <BookLookContext.Provider value={{ paper, frame, fonts }}>{children}</BookLookContext.Provider>
}

export const useBookLook = () => useContext(BookLookContext)

export const usePaper = () => PAPERS[useBookLook().paper] ?? ivory

/** Text styles for the book's serif face, upright or italic. */
export function useSerif() {
  const { fonts } = useBookLook()
  const serif = fonts.serif ?? DEFAULT_SERIF

  return {
    upright: { fontFamily: serif },
    italic: fonts.serifItalic ? { fontFamily: fonts.serifItalic } : { fontFamily: serif, fontStyle: 'italic' as const },
  }
}
