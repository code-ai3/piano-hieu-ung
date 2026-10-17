import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN'
import en from './locales/en'
import vi from './locales/vi'
const STORAGE_KEY = 'app-locale'
export const locales = ['vi', 'en', 'zh-CN'] as const
export type AppLocale = typeof locales[number]
function isLocale(value: string): value is AppLocale {
  return (locales as readonly string[]).includes(value)
}
function detectLocale(): AppLocale {
  try { const stored = localStorage.getItem(STORAGE_KEY); if (stored && isLocale(stored)) return stored }
  catch { /* localStorage may be disabled */ }
  return 'vi'
}
const i18n = createI18n({
  legacy: false, locale: detectLocale(), fallbackLocale: 'vi',
  messages: { vi, en, 'zh-CN': zhCN },
})
export function switchLocale(value: string) {
  if (!isLocale(value)) return
  i18n.global.locale.value = value
  try { localStorage.setItem(STORAGE_KEY, value) } catch { /* optional */ }
  document.documentElement.lang = value === 'zh-CN' ? 'zh-CN' : value
}
export default i18n
