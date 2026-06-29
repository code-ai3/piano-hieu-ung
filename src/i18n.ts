import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN'
import en from './locales/en'

const STORAGE_KEY = 'app-locale'
const LOCALES = ['zh-CN', 'en'] as const

function detectLocale(): string {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && (LOCALES as readonly string[]).includes(stored)) return stored
  return navigator.language.startsWith('en') ? 'en' : 'zh-CN'
}

const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'zh-CN',
  messages: { 'zh-CN': zhCN, en },
})

export function switchLocale(locale: string) {
  i18n.global.locale.value = locale as 'zh-CN' | 'en'
  localStorage.setItem(STORAGE_KEY, locale)
  document.documentElement.lang = locale === 'en' ? 'en' : 'zh'
}

export const locales = LOCALES

export default i18n
