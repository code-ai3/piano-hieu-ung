import './assets/tailwind.css'
import '@fortawesome/fontawesome-free/css/all.css'

import { createApp } from 'vue'
import App from './App.vue'
import i18n from './i18n'

window.addEventListener('vite:preloadError', (event: Event) => {
  event.preventDefault()
  const key = 'piano-hieu-ung:last-module-retry'
  let previous = 0
  try { previous = Number(sessionStorage.getItem(key) || '0') } catch { /* optional */ }
  if (Date.now() - previous > 60_000) {
    try { sessionStorage.setItem(key, String(Date.now())) } catch { /* optional */ }
    window.location.reload()
  } else {
    window.alert('Không tải được thành phần ứng dụng. Hãy tải lại trang bằng Ctrl + Shift + R.')
  }
})
const app = createApp(App)
app.use(i18n)
app.mount('#app')
