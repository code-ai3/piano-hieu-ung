<script setup lang="ts">
const emit=defineEmits<{(e:'close'):void}>()
</script>
<template><div><button @click="emit('close')">Đóng</button></div></template>
