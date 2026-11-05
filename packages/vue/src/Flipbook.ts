import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue'
import {
  Flipbook as VanillaFlipbook,
  type FlipbookBook,
  type FlipbookLabels,
  type FlipbookOptions,
  type FlipbookPlace,
  type GripOptions,
  type TurnPhysics,
} from '@toneflix/flipbook'

/** Vue makes absent booleans false; `undefined` lets the viewer's own defaults apply. */
const flag = { type: Boolean, default: undefined }

export const flipbookProps = {
  book: { type: Object as PropType<FlipbookBook>, required: true },
  /** Open at this page (1-based) instead of the cover. Read once, when mounted. */
  startPage: Number,
  layout: String as PropType<'auto' | 'spread' | 'single'>,
  controls: flag,
  autoHide: { type: [Number, Boolean] as PropType<number | false>, default: undefined },
  thumbnails: flag,
  soundButton: flag,
  sound: flag,
  fullscreenButton: flag,
  fullscreenPrompt: flag,
  landscape: flag,
  keyboard: { type: [Boolean, String] as PropType<boolean | 'global'>, default: undefined },
  stiffCovers: flag,
  physics: Object as PropType<Partial<TurnPhysics>>,
  grip: Object as PropType<Partial<GripOptions>>,
  shading: Number,
  background: String,
  labels: Object as PropType<Partial<FlipbookLabels>>,
}

/** A photo book that opens across two pages. Give it a sized parent. */
export const Flipbook = defineComponent({
  name: 'Flipbook',
  props: flipbookProps,
  emits: {
    pageChange: (_place: FlipbookPlace) => true,
    flip: () => true,
  },
  setup(props, { emit, expose }) {
    const el = ref<HTMLElement>()
    let flipbook: VanillaFlipbook | null = null

    const options = (): FlipbookOptions => ({ ...props }) as FlipbookOptions

    onMounted(() => {
      flipbook = new VanillaFlipbook(el.value!, {
        ...options(),
        onPageChange: (place) => emit('pageChange', place),
        onFlip: () => emit('flip'),
      })
    })

    watch(
      () => ({ ...props }),
      () => flipbook?.update(options()),
      { deep: true },
    )

    onBeforeUnmount(() => flipbook?.destroy())

    expose({
      next: () => flipbook?.next(),
      prev: () => flipbook?.prev(),
      go: (flipped: number) => flipbook?.go(flipped),
      goToPage: (page: number) => flipbook?.goToPage(page),
      instance: () => flipbook,
    })

    return () => h('div', { ref: el, class: 'fb-vue', style: { width: '100%', height: '100%' } })
  },
})

export type FlipbookExposed = {
  next(): void
  prev(): void
  go(flipped: number): void
  goToPage(page: number): void
  instance(): VanillaFlipbook | null
}
