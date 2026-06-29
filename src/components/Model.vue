<script setup lang="ts">
import { reactive, watch } from 'vue';

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '',
  },
  noScroll: {
    type: Boolean,
    default: false,
  },
})

const data = reactive({
  visiable: props.show,
  isAnimating: false
})

const emits = defineEmits<{
  (e: 'beforeClose'): boolean;
  (e: 'update:show', value: boolean): void;
}>();

function handleClose() {
  // 处理内部点击关闭事件
  emits('beforeClose');
  data.isAnimating = true;
  // 延迟关闭以播放动画
  setTimeout(() => {
    emits('update:show', false);
    data.isAnimating = false;
  }, 150);
}

watch(() => props.show, (val) => {
  // 控制状态
  data.visiable = val;
  if (val) {
    data.isAnimating = true;
    // 打开动画完成后重置动画状态
    setTimeout(() => {
      data.isAnimating = false;
    }, 150);
  }
})
</script>

<template>
  <div
    class="modal fixed inset-0 z-[1000] pointer-events-none transition-all duration-150"
    :class="{
      'modal-open': data.visiable && !data.isAnimating,
      'modal-opening': data.visiable && data.isAnimating,
      'modal-closing': !data.visiable && data.isAnimating
    }"
  >
    <!-- 遮罩 -->
    <div class="modal-backdrop fixed inset-0 bg-black/25 opacity-0 transition-opacity duration-150 backdrop-blur-sm" @click="handleClose"></div>
    <!-- 内容 -->
    <div class="modal-wrapper fixed inset-0 z-[999] flex justify-center items-center pointer-events-none">
      <div class="modal-content w-[480px] max-xl:w-[85vw] max-h-[85vh] max-xl:max-h-[90vh] max-[700px]:max-h-[95vh] opacity-0 transform scale-90 translate-y-5 transition-all duration-150 ease-smooth pointer-events-auto flex flex-col modal-glass dark:modal-glass-dark">
        <!-- 按钮 -->
        <div class="modal-header flex justify-between items-center px-6 pt-5 pb-3 max-xl:px-5 max-xl:pt-4 max-xl:pb-2">
          <h3 class="modal-title text-lg font-semibold text-black/85 dark:text-white/90 text-center flex-1">{{ title }}</h3>
          <div class="modal-close flex justify-center items-center cursor-pointer transition-all duration-200" @click="handleClose">
            <div class="modal-close-btn dark:modal-close-btn-dark">
              <i class="fas fa-times text-base text-black/60 dark:text-white/85"></i>
            </div>
          </div>
        </div>
        <!-- 内容 -->
        <div class="modal-body flex-1 px-6 pb-6 max-xl:px-5 max-xl:pb-5 min-h-[60px]" :class="noScroll ? '' : 'overflow-y-auto'">
          <slot></slot>
        </div>
      </div>
    </div>
  </div>
</template>

