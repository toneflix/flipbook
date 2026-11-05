import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import ReactIsland from './ReactIsland.vue'
import VanillaDemo from './VanillaDemo.vue'
import VueDemo from './VueDemo.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ReactIsland', ReactIsland)
    app.component('VueDemo', VueDemo)
    app.component('VanillaDemo', VanillaDemo)
  },
} satisfies Theme
