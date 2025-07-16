<script setup>
import BaseGrid from "./components/BaseGrid.vue"; // 경로는 실제 위치에 맞게
import { ref } from "vue";
import { gridHdrMpng } from "./utils.js";
import { rowData } from "./data.js";

const rowDatas = ref(rowData);

// Value Customize
const valueNumFormatter = (val) => {
  //
  return "$" + val.value;
};
const modelList = [
  { value: "1", label: "Celica" },
  { value: "2", label: "Boxster" },
  { value: "3", label: "Sonata" },
];

// Select label Value 설정을 위해서 필요
// 추후 Enter버전이 들어오면 변경될 수 있음
const selectFormatter = ({ value }) => {
  const matched = modelList.find((item) => item.value === value);
  return matched ? matched.label : value;
};

// Select label Value 설정을 위해서 필요
// 추후 Enter버전이 들어오면 변경될 수 있음
const selectParser = ({ newValue }) => {
  const matched = modelList.find((item) => item.label === newValue);
  return matched ? matched.value : newValue;
};

// 컬럼 예시
const columnDefs = [
  // Checkbox 생성해주는것 index 선택용
  gridHdrMpng("", "", "checkbox", "", {
    filter: false,
    sortable: false,
    checkboxSelection: true,
    headerCheckboxSelection: true,
    width: 50,
    fixed: true,
  }),

  // Merge 예시 (Input)

  gridHdrMpng("make", "Make", "", "", { fixed: true }),
  // Selectbox 예시
  gridHdrMpng("model", "Model", "selectbox", "", {
    merge: true,
    spanKey: "keyData",
    edit: true,
    list: modelList,
    valueFormatter: selectFormatter,
    valueParser: selectParser,
  }),
  // Input 예시
  gridHdrMpng("price", "Price", "number", "", {
    // fixed: true,
    edit: true,
    valueFormatter: valueNumFormatter,
  }),
  // 3단 헤더 예시
  gridHdrMpng("", "제품정보", "", [
    gridHdrMpng("", "상세", "", [
      gridHdrMpng("category", "카테고리"),
      gridHdrMpng("", "브랜드/코드", "", [
        gridHdrMpng("brand", "브랜드", "selectbox", "", {
          edit: true,
          list: ["Toyota", "Hyundai"],
        }),
        gridHdrMpng("prodCode", "상품코드"),
      ]),
    ]),
  ]),
  gridHdrMpng("buttonText", "버튼", "button", "", {
    text: "버튼Label",
    rightText: "우측글씨",
  }),
  // 2차 depth
  gridHdrMpng("", "Athlete Details", "", [
    gridHdrMpng("year", "year", "year", "", { edit: true }),
    gridHdrMpng("month", "month", "month", "", { edit: true }),
    gridHdrMpng("day", "day", "day", "", { edit: true }),
    gridHdrMpng("date", "date", "date", "", { edit: true }),
    gridHdrMpng("datetime", "datetime", "datetime", "", { edit: true }),
    gridHdrMpng("athlete", "athlete", "", [], { visible: false }),
    gridHdrMpng("age", "age", "shaded"),
    gridHdrMpng("country", "country"),
    gridHdrMpng("sport", "sport"),
    gridHdrMpng("gold", "gold"),
    gridHdrMpng("silver", "silver"),
    gridHdrMpng("bronze", "bronze"),
    gridHdrMpng("total", "total"),
  ]),
];

// mergeKeys, mergeTextFields 등은 필요하면 전달
const columnTypes = ref({
  shaded: {
    cellClass: "shaded-class",
  },
});
</script>

<template>
  <BaseGrid
    headerFilterId="demo"
    :header="columnDefs"
    :data="rowDatas"
    :singleSelect="false"
    :rowNumbers="true"
    :columnTypes="columnTypes"
    @cell-input-change="
      (row, col, val) => console.log('선택 변경:', row, col, val)
    "
    @cell-select-change="
      (row, col, val) => console.log('select-change:', row, col, val)
    "
    @selection-change="
      (row, col, v) => console.log('selectbox Change', row, col, v)
    "
    @cell-click="(...args) => console.log('셀 클릭:', ...args)"
    @cell-date-picker-change="
      (row, col, val) => console.log('cell-date-picker-change:', row, col, val)
    "
    @cell-btn-click="
      (row, col, val) => console.log('cell-btn-click', row, col, v)
    "
  />
</template>
