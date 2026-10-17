<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Btn from '@/components/Btn.vue'
import Modal from '@/components/Model.vue'
import PianoView from '@/views/PianoView.vue'
import '@/assets/melorix.css'
import { switchLocale } from './i18n'

const { t, locale } = useI18n()

const isDark = ref(true)
const showLang = ref(false)

function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  try { localStorage.setItem('theme', isDark.value ? 'dark' : 'light') } catch { /* optional */ }
}

onMounted(() => {
  let saved: string | null = null
  try { saved = localStorage.getItem('theme') } catch { /* optional */ }
  isDark.value = saved ? saved === 'dark' : true
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
  <main class="mx-root">
    <PianoView />
  </main>

  <!-- 右下角浮动控制 -->
  <div class="mx-global-tools">
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
