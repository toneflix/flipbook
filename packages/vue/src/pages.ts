import { defineComponent, h, onMounted, ref, watch, type PropType } from 'vue'
import {
  renderCover,
  renderPage,
  type FlipbookBook,
  type FlipbookPage,
  type FrameStyle,
  type PaperColor,
  type PhotoPosition,
  type Side,
} from '@toneflix/flipbook'

/** Keeps an element's content in step with its props by rebuilding it. */
const useRendered = (render: () => Node, sources: () => unknown) => {
  const el = ref<HTMLElement>()
  const paint = () => {
    const focused = el.value?.contains(document.activeElement)

    el.value?.replaceChildren(render())
    if (focused) el.value?.querySelector<HTMLElement>('.fb-positioning')?.focus()
  }

  onMounted(paint)
  watch(sources, paint, { deep: true })

  return el
}

/**
 * The inside of one book page, e.g. for an editor or a thumbnail. It fills its parent, which
 * sets the page's size.
 */
export const PageView = defineComponent({
  name: 'FlipbookPageView',
  props: {
    page: { type: Object as PropType<FlipbookPage>, required: true },
    paper: { type: String as PropType<PaperColor>, default: 'ivory' },
    frame: { type: String as PropType<FrameStyle>, default: 'none' },
    number: Number,
    side: String as PropType<Side>,
    showImages: { type: Boolean, default: true },
    /** Editor: the highlighted slot. Listening to `slotClick` makes slots clickable. */
    activeSlot: Number,
    editable: Boolean,
    /** Editor: lets people move and zoom the photo in the active slot, emitting `photoPosition`. */
    positioning: Boolean,
  },
  emits: { slotClick: (_slot: number) => true, photoPosition: (_slot: number, _position: PhotoPosition) => true },
  setup(props, { emit }) {
    const el = useRendered(
      () =>
        renderPage(
          props.page,
          { paper: props.paper, frame: props.frame },
          {
            number: props.number,
            side: props.side,
            showImages: props.showImages,
            activeSlot: props.activeSlot,
            onSlotClick: props.editable ? (slot) => emit('slotClick', slot) : undefined,
            onPhotoPosition: props.positioning ? (slot, position) => emit('photoPosition', slot, position) : undefined,
          },
        ),
      () => ({ ...props }),
    )

    return () => h('div', { ref: el, style: { position: 'relative', width: '100%', height: '100%', containerType: 'size' } })
  },
})

/** A book's front cover, e.g. for a shelf. It fills its parent. */
export const CoverView = defineComponent({
  name: 'FlipbookCoverView',
  props: {
    book: { type: Object as PropType<FlipbookBook>, required: true },
    showImages: { type: Boolean, default: true },
  },
  setup(props) {
    const el = useRendered(
      () => renderCover(props.book, props.showImages),
      () => ({ ...props }),
    )

    return () => h('div', { ref: el, style: { position: 'relative', width: '100%', height: '100%', containerType: 'size' } })
  },
})
