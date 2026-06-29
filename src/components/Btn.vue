<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  // 按钮类型 primary
  type: {
    type: String,
    default: 'primary',
  },
  // 按钮状态 normal disabled loading
  status: {
    type: String,
    default: 'normal',
  },
  // 形状 circle square
  shape: {
    type: String,
    default: 'square',
  },
  // 是否为浮动按钮
  float: {
    type: Boolean,
    default: false,
  },
})

const emits = defineEmits(['click'])

const isDisabled = computed(() => props.status === 'disabled')
const isLoading = computed(() => props.status === 'loading')
</script>

<template>
  <button
    class="flex justify-center items-center content-center cursor-pointer transition-all duration-300 ease relative overflow-hidden font-medium gap-1.5"
    :class="[
      props.type,
      // 基础样式
      props.float ? 'm-0' : 'm-0.5',
      props.float ? 'w-12 min-w-12 h-12 rounded-glass-lg max-xl:w-9 max-xl:min-w-9 max-xl:h-9' : 'h-10 min-w-16 rounded-glass',
      props.float && shape === 'circle' ? 'rounded-full' : '',
      !props.float && shape === 'circle' ? 'w-24 h-12 rounded-full' : '',
      !props.float && shape === 'square' ? 'pl-3 pr-3' : '',

      // 颜色和阴影
      'bg-[rgba(255,255,255,0.4)] border border-[rgba(255,255,255,0.5)] shadow-glass-light text-[#191c1e]',
      'dark:bg-[rgba(255,255,255,0.1)] dark:border-[rgba(255,255,255,0.1)] dark:shadow-none dark:text-white/85',

      // 状态样式
      {
        'opacity-50 cursor-not-allowed transform-none !bg-[rgba(255,255,255,0.08)] !border-[rgba(255,255,255,0.08)] !shadow-none dark:!bg-[rgba(255,255,255,0.05)] dark:!border-[rgba(255,255,255,0.05)]': isDisabled,
        'opacity-60 cursor-wait transform-none': isLoading,
        'hover:-translate-y-px hover:bg-[rgba(255,255,255,0.5)] hover:border-[rgba(255,255,255,0.5)] hover:shadow-glass-hover-light active:translate-y-0 active:bg-[rgba(255,255,255,0.3)] active:border-[rgba(255,255,255,0.3)] active:shadow-glass-active-light': !isDisabled && !isLoading && !props.float,
        'hover:-translate-y-0.5 hover:scale-105 hover:bg-[rgba(255,255,255,0.5)] hover:border-[rgba(255,255,255,0.5)] hover:shadow-glass-hover-light active:translate-y-0 active:scale-95 active:bg-[rgba(255,255,255,0.3)] active:border-[rgba(255,255,255,0.3)] active:shadow-glass-active-light': !isDisabled && !isLoading && props.float,
        'dark:hover:bg-[rgba(255,255,255,0.15)] dark:hover:border-[rgba(255,255,255,0.15)] dark:active:bg-[rgba(255,255,255,0.08)] dark:active:border-[rgba(255,255,255,0.08)]': !isDisabled && !isLoading
      }
    ]"
    :disabled="isDisabled || isLoading"
    @click="$emit('click')"
  >
    <slot></slot>
  </button>
</template>

