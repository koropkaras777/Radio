import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

const ukSidebar = [
  {
    text: 'Початок',
    items: [
      { text: 'Огляд', link: '/' },
      { text: 'Свій клієнт за 15 хвилин', link: '/guide/quickstart-client' },
      { text: 'Свій адмінський клієнт', link: '/guide/admin-client' },
      { text: 'Адмінський редактор пісень', link: '/guide/admin-song-editor' },
      { text: 'Решта адмінських сценаріїв', link: '/guide/admin-workflows' },
      { text: 'Живий ефір: послідовності', link: '/guide/live-broadcast' },
      { text: 'Запуск власного сервера', link: '/guide/self-hosting' },
      { text: 'Повна конфігурація', link: '/guide/full-configuration' },
    ],
  },
  {
    text: 'Протокол',
    items: [
      { text: 'Токени і доступ', link: '/protocol/tokens' },
      { text: 'Режими програвання', link: '/protocol/playback-modes' },
      { text: 'Формат повідомлень та i18n', link: '/protocol/messages' },
      { text: 'Стабільність і сумісність', link: '/protocol/stability' },
    ],
  },
  {
    text: 'Довідник',
    items: [
      { text: 'REST API', link: '/reference/rest' },
      { text: 'Події Socket.io', link: '/reference/socket-events' },
      { text: 'Привілеї', link: '/reference/privileges' },
    ],
  },
];

const SITE_URL = 'https://docs.radiosmihun.com';

// ─── Shared head tags ─────────────────────────────────────────────────────────
const sharedHead = [
  ['meta', { name: 'theme-color', content: '#000000' }],
  ['meta', { property: 'og:type', content: 'website' }],
  ['meta', { property: 'og:site_name', content: 'Radio Smihun' }],
  ['meta', { property: 'og:image', content: `${SITE_URL}/icon-smihun-192.png` }],
  ['meta', { name: 'twitter:card', content: 'summary' }],
];

export default withMermaid(defineConfig({
  title: 'Радіо Сміхун',
  description: 'Документація Радіо Сміхун: протокол синхронного онлайн-радіо, REST API, Socket.io події та інструкції для власного клієнта чи сервера.',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: false,

  sitemap: { hostname: SITE_URL },
  head: sharedHead,

  srcExclude: ['**/generated/**/*.md'],

  locales: {
    root: {
      label: 'Українська',
      lang: 'uk',
      title: 'Радіо Сміхун - документація',
      description: 'Документація Радіо Сміхун: протокол синхронного онлайн-радіо, REST API, Socket.io події та інструкції для власного клієнта чи сервера.',
      themeConfig: {
        nav: [
          { text: 'Посібник', link: '/guide/quickstart-client' },
          { text: 'Довідник', link: '/reference/rest' },
        ],
        sidebar: ukSidebar,
        outline: { label: 'На цій сторінці', level: [2, 3] },
        docFooter: { prev: 'Назад', next: 'Далі' },
        lastUpdatedText: 'Оновлено',
        darkModeSwitchLabel: 'Тема',
        returnToTopLabel: 'Вгору',
      },
    },
    en: {
      label: 'English',
      lang: 'en',
      link: '/en/',
      title: 'Radio Smihun - documentation',
      description: 'Radio Smihun documentation (docs): protocol reference for the synchronized online radio — REST API, Socket.io events, and guides for building your own client or server.',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/en/guide/quickstart-client' },
          { text: 'Reference', link: '/en/reference/rest' },
        ],
        sidebar: [
          {
            text: 'Getting started',
            items: [
              { text: 'Overview', link: '/en/' },
              { text: 'Build a client in 15 minutes', link: '/en/guide/quickstart-client' },
              { text: 'Build an admin client', link: '/en/guide/admin-client' },
              { text: 'The admin song editor', link: '/en/guide/admin-song-editor' },
              { text: 'The rest of the admin workflows', link: '/en/guide/admin-workflows' },
              { text: 'Live broadcast walkthrough', link: '/en/guide/live-broadcast' },
              { text: 'Running your own server', link: '/en/guide/self-hosting' },
              { text: 'Full configuration', link: '/en/guide/full-configuration' },
            ],
          },
          {
            text: 'Protocol',
            items: [
              { text: 'Tokens and access', link: '/en/protocol/tokens' },
              { text: 'Playback modes', link: '/en/protocol/playback-modes' },
              { text: 'Message format and i18n', link: '/en/protocol/messages' },
              { text: 'Stability and compatibility', link: '/en/protocol/stability' },
            ],
          },
          {
            text: 'Reference',
            items: [
              { text: 'REST API', link: '/en/reference/rest' },
              { text: 'Socket.io events', link: '/en/reference/socket-events' },
              { text: 'Privileges', link: '/en/reference/privileges' },
            ],
          },
        ],
        outline: { label: 'On this page', level: [2, 3] },
      },
    },
  },

  themeConfig: {
    search: { provider: 'local' },
    socialLinks: [],
  },
}));
