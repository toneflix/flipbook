import { createContext, useContext, type ReactNode } from 'react'
import type { FrameStyle, PaperColor } from '@toneflix/flipbook-core'

export interface BookLook {
  paper: PaperColor
  frame: FrameStyle
}

const BookLookContext = createContext<BookLook>({ paper: 'ivory', frame: 'none' })

/** The paper and default frame for every page rendered inside. The viewer sets it from the book. */
export function BookLookProvider({ paper = 'ivory', frame = 'none', children }: Partial<BookLook> & { children: ReactNode }) {
  return <BookLookContext.Provider value={{ paper, frame }}>{children}</BookLookContext.Provider>
}

export const useBookLook = () => useContext(BookLookContext)
