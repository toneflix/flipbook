import { defineConfig } from 'vitepress'
import react from '@vitejs/plugin-react'

export default defineConfig({
  title: 'Toneflix Flipbook',
  description:
    'A photo book you can hold, for the web, Vue, React and React Native: peel-and-fold page turns, printed photos and paper textures.',
  base: process.env.DOCS_BASE ?? '/flipbook/',
  cleanUrls: true,
  head: [
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400&display=swap',
      },
    ],
  ],
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Playground', link: '/playground' },
      { text: 'API', link: '/api/options' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting started', link: '/guide/getting-started' },
          { text: 'Books and pages', link: '/guide/books' },
          { text: 'Paper, frames and covers', link: '/guide/printing' },
          { text: 'Turning pages', link: '/guide/turning' },
          { text: 'Phones and landscape', link: '/guide/landscape' },
          { text: 'Building an editor', link: '/guide/editor' },
        ],
      },
      {
        text: 'Frameworks',
        items: [
          { text: 'React', link: '/frameworks/react' },
          { text: 'Vue', link: '/frameworks/vue' },
          { text: 'Vanilla JS', link: '/frameworks/vanilla' },
          { text: 'React Native', link: '/frameworks/react-native' },
        ],
      },
      {
        text: 'API',
        items: [
          { text: 'Viewer options', link: '/api/options' },
          { text: 'Core', link: '/api/core' },
        ],
      },
      { text: 'Playground', link: '/playground' },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/toneflix/flipbook' }],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Made for Toneflix Photos',
    },
    search: { provider: 'local' },
  },
  vite: {
    plugins: [react()],
    ssr: { noExternal: [/^@toneflix\/flipbook/] },
  },
})
