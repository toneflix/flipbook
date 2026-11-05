type Attrs = { style?: Record<string, string>; [name: string]: string | number | boolean | null | undefined | Record<string, string> }
type Child = Node | string | null | undefined | false

/** Creates an element. Strings become text, so book content is never parsed as HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)

  for (const [name, value] of Object.entries(attrs)) {
    if (name === 'style') Object.assign(el.style, value)
    else if (value !== null && value !== undefined && value !== false) el.setAttribute(name, value === true ? '' : String(value))
  }
  append(el, children)

  return el
}

export function append(el: Element, children: Child[]) {
  for (const child of children) if (child) el.append(child)
}

/** Builds trusted, static SVG markup (icons and ornaments shipped with the package). */
export function svg(markup: string): SVGSVGElement {
  const template = document.createElement('template')

  template.innerHTML = markup.trim()

  return template.content.firstElementChild as SVGSVGElement
}
