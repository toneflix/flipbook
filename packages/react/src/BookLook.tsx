import { createContext, useContext, type ReactNode } from 'react'
import type { FrameStyle, PageShape, PaperColor } from '@toneflix/flipbook-core'

export interface BookLook {
  paper: PaperColor
  frame: FrameStyle
  shape: PageShape
}

const BookLookContext = createContext<BookLook>({ paper: 'ivory', frame: 'none', shape: 'portrait' })

/** The paper, default frame and page shape for every page rendered inside. The viewer sets it from the book. */
export function BookLookProvider({
  paper = 'ivory',
  frame = 'none',
  shape = 'portrait',
  children,
}: Partial<BookLook> & { children: ReactNode }) {
  return <BookLookContext.Provider value={{ paper, frame, shape }}>{children}</BookLookContext.Provider>
}

export const useBookLook = () => useContext(BookLookContext)
