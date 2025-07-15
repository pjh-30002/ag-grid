


<script setup>
import { AgGridVue } from 'ag-grid-vue3'
import { ref } from 'vue';

const props = defineProps({
  data: {type: Object}, // 부모에서 받은 데이터
  header: {type: Array, default: () => []}, // 부모에서 받은 헤더
  singleSelect: {type: Boolean, default: false}, // 단일선택
  selectedData: {type: Array}, // 체크박스 비활성화할 행 id 목록
  selectedIdList: {type: Array}, // 체크박스 체크할 행 id 목록
  selectGroup: {type: String, default: ''}, // 그룹으로 묶인경우 하나 선택해도 해당하는것 전체가 선택되어야함
  disabledAllSelect: {type: Boolean, default: false},
  sortable: {type: Boolean, defaul: true}, // Sorting
  filter: {type: Boolean, defaul: true}, // Filtering
  sideBar: {type: Boolean, defaul: true}, // 사이드바가 나오게 하는 옵션
})
const gridOptions = ref({
  defaultColDef: { // Columns 옵션
    resizable: true, // resize 가능여부
    sortable: props.sortable, // Sort 가능여부
    filter: props.filter, // 필터 가능여부
    
    // floatingFilter: true // Filter가 나타나게하는여부
  },
  columnHoverHighlight: true,
  sideBar: props.sideBar,
  pagination: false,
  // paginationPageSize: 20,
  rowSelection: 'single',
  // statusBar: {
  //   statusPanels: [
  //     { statusPanel: 'agTotalRowCountComponent', align: 'left' },
  //     { statusPanel: 'agSelectedRowCountComponent', align: 'center' }
  //   ]
  // },
  // rowGroupPanelShow: 'always',
  // pivotPanelShow: 'always',
  enableCellSpan: true, // Merge옵션
  animateRows: true
  
});

</script>

<template>
  <ag-grid-vue
    style="width: 100%; height: 600px;"
    class="ag-theme-alpine"
    :columnDefs="header"
    :rowData="data"
    v-bind="gridOptions"
  />
</template>