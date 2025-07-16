<script></script>
<template>
  <input
    class="input-type-02"
    :value="row[col.key] || ''"
    :readOnly="true"
    type="input"
    :disabled="isCellDisabled(row, col) || col.disabled || row.rowDisabled"
    @change="
      (val) => {
        row[col.key] = val.target.value;
        emit('cell-input-change', row, col, val);
      }
    "
  />
  <el-button
    class="input-type-search"
    @click="row.clickSearch(row, col)"
  ></el-button>
</template>
