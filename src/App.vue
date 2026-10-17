<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Btn from '@/components/Btn.vue'
import Modal from '@/components/Model.vue'
import PianoView from '@/views/PianoView.vue'
import { switchLocale } from './i18n'

const { t, locale } = useI18n()

const isDark = ref(false)
const showLang = ref(false)

function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  try { localStorage.setItem('theme', isDark.value ? 'dark' : 'light') } catch { /* optional */ }
}

onMounted(() => {
  let saved: string | null = null
  try { saved = localStorage.getItem('theme') } catch { /* optional */ }
  isDark.value = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.classList.toggle('dark', isDark.value)
  document.documentElement.lang = locale.value === 'zh-CN' ? 'zh-CN' : locale.value
})

const langs = computed(() => [
  { key: 'vi', label: 'Tiếng Việt' },
  { key: 'en', label: 'English' },
  { key: 'zh-CN', label: '中文' },
])

function pickLang(key: string) {
  switchLocale(key)
  showLang.value = false
}

// 顶部右下角浮动按钮：主题 + 语言
</script>

<template>
  <!-- 彩色底层 + 深色遮罩 -->
  <div class="fixed inset-0 pointer-events-none overflow-hidden z-0 dark:hidden" aria-hidden="true"
       style="background:
                      radial-gradient(ellipse at center, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.18) 100%),
                      radial-gradient(100% 100% at 10% 20%, rgba(96,99,238,0.40) 0%, transparent 55%),
                      radial-gradient(100% 100% at 80% 15%, rgba(253,86,167,0.30) 0%, transparent 50%),
                      radial-gradient(100% 100% at 85% 65%, rgba(52,152,219,0.25) 0%, transparent 50%),
                      radial-gradient(100% 100% at 40% 85%, rgba(78,222,163,0.25) 0%, transparent 50%),
                      radial-gradient(100% 100% at 50% 40%, rgba(241,196,15,0.12) 0%, transparent 40%),
                      #f7f9fb"></div>

  <!-- 主内容 -->
  <main class="relative z-10 min-h-screen flex flex-col items-center py-6">
    <PianoView />
  </main>

  <!-- 右下角浮动控制 -->
  <div class="fixed right-5 bottom-5 z-50 flex gap-2.5">
    <Btn shape="square" type="default" float :title="t('app.language')" @click="showLang = true">
      <i class="fas fa-language fa-lg"></i>
    </Btn>
    <Btn shape="square" type="default" float :title="t('app.theme')" @click="toggleTheme">
      <i :class="isDark ? 'fas fa-sun fa-lg' : 'fas fa-moon fa-lg'"></i>
    </Btn>
  </div>

  <!-- 语言选择 -->
  <Modal v-model:show="showLang" :title="t('app.language')">
    <div class="flex flex-col gap-2 p-4">
      <button
        v-for="l in langs" :key="l.key"
        @click="pickLang(l.key)"
        class="py-2.5 px-4 text-sm rounded-lg border border-black/10 dark:border-white/10 bg-white/40 dark:bg-white/[0.06] text-black/70 dark:text-white/70 cursor-pointer transition-all hover:bg-primary-500/[0.1] hover:border-primary-500/40 hover:text-primary-500 text-left"
        :class="locale === l.key ? 'border-primary-500/40 bg-primary-500/10 text-primary-500' : ''"
      >{{ l.label }}</button>
    </div>
  </Modal>
</template>
