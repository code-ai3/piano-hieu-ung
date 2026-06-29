<script setup lang="ts">
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  label: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  block: {
    type: Boolean,
    default: false,
  },
})

const emits = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'change', value: boolean): void
}>()

function onChange(e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  emits('update:modelValue', checked)
  emits('change', checked)
}
</script>

<template>
  <label
    class="items-center gap-2.5 cursor-pointer select-none group !leading-none"
    :class="[
      disabled ? 'opacity-50 cursor-not-allowed' : '',
      block ? 'flex w-full' : 'inline-flex'
    ]"
  >
    <span
      class="relative w-[18px] h-[18px] rounded-[5px] border-2 flex-shrink-0 transition-all duration-200 flex items-center justify-center"
      :class="[
        modelValue
          ? 'bg-primary-500 border-primary-500 dark:bg-[#6fa9ff] dark:border-[#6fa9ff]'
          : 'border-black/30 dark:border-white/40 bg-white/50 dark:bg-white/10 group-hover:border-black/50 dark:group-hover:border-white/60',
        disabled ? '' : 'group-hover:shadow-[0_0_0_3px_rgba(66,133,244,0.15)] dark:group-hover:shadow-[0_0_0_3px_rgba(66,133,244,0.1)]'
      ]"
    >
      <!-- Checkmark SVG -->
      <svg
        v-if="modelValue"
        class="w-[11px] h-[11px] text-white"
        viewBox="0 0 12 12"
        fill="none"
      >
        <path
          d="M2 6L5 9L10 3"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </span>

    <!-- Hidden native checkbox for accessibility -->
    <input
      type="checkbox"
      class="absolute w-0 h-0 opacity-0 pointer-events-none"
      :checked="modelValue"
      :disabled="disabled"
      @change="onChange"
    />

    <span v-if="label" class="text-sm font-normal text-black/80 dark:text-white/90 leading-[1.2]">{{ label }}</span>
    <slot v-else></slot>
  </label>
</template>
