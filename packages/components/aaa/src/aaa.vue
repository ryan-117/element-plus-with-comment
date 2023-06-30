<template>
  <div>
    <h1>aaa</h1>
  </div>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue'
import { aaaProps } from './aaa'

defineOptions({
  name: 'ElAaa',
})

const props = defineProps(aaaProps)

onMounted(() => {
  console.log('mounted')
})

// init here
</script>
