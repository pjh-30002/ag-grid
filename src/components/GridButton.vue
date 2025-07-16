<script setup>
import { onBeforeMount } from "vue";
import { ref } from "vue";

const props = defineProps({ params: Object });
const emit = defineEmits(["cell-btn-click"]);

console.log(props.params);
</script>

<template>
  <button
    :disabled="params.colDef?.disabled"
    @click="
      () =>
        params.context.vue.$emit('cell-btn-click', params.data, params.colDef)
    "
  >
    {{ props.params.colDef.text }}
  </button>
</template>
