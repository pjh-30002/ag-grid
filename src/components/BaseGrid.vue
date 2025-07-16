<script setup>
import { AgGridVue } from "ag-grid-vue3";
import { onMounted, ref } from "vue";
import dayjs from "dayjs";
import GridButton from "./GridButton.vue";
import { getCurrentInstance } from "vue";

const internalInstance = getCurrentInstance();
const vueThis = internalInstance?.proxy;

const props = defineProps({
  data: { type: Object }, // 부모에서 받은 데이터
  header: { type: Array, default: () => [] }, // 부모에서 받은 헤더
  singleSelect: { type: Boolean, default: false }, // 단일선택
  selectedData: { type: Array }, // 체크박스 비활성화할 행 id 목록
  selectedIdList: { type: Array }, // 체크박스 체크할 행 id 목록
  selectGroup: { type: String, default: "" }, // 그룹으로 묶인경우 하나 선택해도 해당하는것 전체가 선택되어야함
  disabledAllSelect: { type: Boolean, default: false },
  sortable: { type: Boolean, defaul: true }, // Sorting
  filter: { type: Boolean, defaul: true }, // Filtering
  sideBar: { type: Boolean, defaul: true }, // 사이드바가 나오게 하는 옵션
  rowNumbers: { type: Boolean, default: true }, // Id 값이 나오는 옵션
  columnTypes: { type: Object, default: [] }, // Column Type 설정
});

const gridApi = ref(null);
const gridData = ref([]);
const emit = defineEmits([
  // Cell 이벤트
  "cell-click",
  "cell-dblclick",
  "cell-contextmenu",
  "cell-mouse-enter",
  "cell-mouse-leave",

  // Cell value & editing
  "cell-input-change",
  "cell-value-changed",
  "cell-editing-started",
  "cell-editing-stopped",

  // 특수 타입별
  "cell-date-picker-change",
  "cell-select-change",
  "cell-check-click",
  "cell-radio-change",
  "cell-text-download",
  "cell-icon-click",
  "cell-search-click",
  "cell-html-change",

  // Row 이벤트
  "row-click",
  "row-dblclick",
  "row-contextmenu",

  // Header & 컬럼 이벤트
  "header-click",

  // 정렬/필터 등
  "sort-change",
  "filter-change",
  "selection-change",
]);

const datePickerType = [
  "dateString",
  "yearOnly",
  "monthOnly",
  "dayOnly",
  "dateTimeString",
];

const eventHandlers = {
  onCellClicked: (event) => {
    console.log(event);
    emit("cell-click", event.data, event.colDef, event.value, event.event);
  },
  onCellDoubleClicked: (event) =>
    emit("cell-dblclick", event.data, event.colDef, event.value, event.event),
  onCellContextMenu: (event) =>
    emit(
      "cell-contextmenu",
      event.data,
      event.colDef,
      event.value,
      event.event
    ),
  onRowClicked: (event) =>
    emit("row-click", event.data, event.colDef, event.event),
  onRowDoubleClicked: (event) =>
    emit("row-dblclick", event.data, event.colDef, event.event),
  onRowContextMenu: (event) =>
    emit("row-contextmenu", event.data, event.colDef, event.event),
  onColumnHeaderClicked: (event) =>
    emit("header-click", event.column, event.event),
  // onCellMouseOver: (event) => emit("cell-mouse-enter", event.data, event.colDef, event.event),
  // onCellMouseOut: (event) => emit("cell-mouse-leave", event.data, event.colDef, event.event),
  onCellBtnClick: (event) => {
    emit("cell-btn-click", event.data, event.colDef, event.newValue);
  },
  onCellValueChanged: (event) => {
    console.log(event.colDef);
    if (datePickerType.includes(event.colDef.cellDataType)) {
      console.log("cellDataType");
      emit("cell-date-picker-change", event.data, event.colDef, event.newValue);
    } else if (
      event.colDef.cellDataType === "checkbox" ||
      event.colDef.cellDataType === "rowCheckbox"
    ) {
      emit("cell-check-click", event.data, event.colDef, event.newValue);
    } else if (
      event.colDef.cellDataType === "radio" ||
      event.colDef.cellDataType === "radio-group"
    ) {
      emit("cell-radio-change", event.data, event.colDef, event.newValue);
    } else if (event.colDef.cellDataType === "file") {
      emit("cell-text-download", event.data, event.colDef, event.newValue);
    } else if (event.colDef.cellDataType === "icon") {
      emit("cell-icon-click", event.data, event.colDef, event.newValue);
    } else if (event.colDef.cellDataType === "textSearch") {
      emit("cell-search-click", event.data, event.colDef, event.newValue);
    } else if (event.colDef.cellDataType === "inputSearch") {
      emit("cell-input-change", event.data, event.colDef, event.newValue);
      emit("cell-search-click", event.data, event.colDef, event.newValue);
    } else if (
      event.colDef.cellDataType === "text" ||
      event.colDef.cellDataType === "input"
    ) {
      if (event.colDef.cellEditor === "agSelectCellEditor") {
        emit("cell-select-change", event.data, event.colDef, event.newValue);
      } else {
        emit("cell-input-change", event.data, event.colDef, event.newValue);
      }
    } else if (event.colDef.cellDataType === "html") {
      emit("cell-html-change", event.data, event.colDef, event.newValue);
    } else {
      console.log(event);
      emit("cell-input-change", event.data, event.colDef, event.newValue);
    }
  },
  // blur
  onCellEditingStarted: (event) =>
    emit("cell-editing-started", event.data, event.colDef),
  // edit 종료
  onCellEditingStopped: (event) =>
    emit("cell-editing-stopped", event.data, event.colDef),
  onSelectionChanged: (event) => {
    console.log(event);
    emit(
      "selection-change",
      event.data,
      event.colDef,
      event.newValue,
      event.api.getSelectedRows()
    );
  },
};

const pad = (n) => (n < 10 ? `0${n}` : n);
const dateTimeRegex =
  /(\d{2})\/(\d{2})\/(\d{4})[\sT]{1,2}(\d{2}):(\d{2}):(\d{2})/;

const gridOptions = ref({
  defaultColDef: {
    // Columns 옵션
    resizable: true, // resize 가능여부
    sortable: props.sortable, // Sort 가능여부
    filter: props.filter, // 필터 가능여부

    // floatingFilter: true // Filter가 나타나게하는여부
  },
  columnHoverHighlight: true,
  sideBar: props.sideBar,
  pagination: false,
  // paginationPageSize: 20,
  rowSelection: props.singleSelect ? "single" : "multiple",
  // rowNumbers: props.rowNumbers, // Id값이 나오게 하는 옵션 -> enter 모드
  columnTypes: props.columnTypes,
  enableCellSpan: true, // Merge옵션
  animateRows: true,
  // 날짜 정의
  dataTypeDefinitions: {
    // 🟢 일반 날짜
    dateString: {
      baseDataType: "dateString",
      extendsDataType: "dateString",

      valueParser: (params) => {
        if (params.newValue instanceof Date) {
          return dayjs(params.newValue).format("YYYY-MM-DD");
        }
        if (
          typeof params.newValue === "string" &&
          dayjs(params.newValue, "YYYY-MM-DD", true).isValid()
        ) {
          return dayjs(params.newValue).format("YYYY-MM-DD");
        }
        return null;
      },

      valueFormatter: (params) => {
        if (!params.value) return "";
        const d = dayjs(params.value);
        return d.isValid() ? d.format("YYYY-MM-DD") : "";
      },

      dateParser: (value) => {
        if (!value) return undefined;
        return dayjs(value, "YYYY-MM-DD", true).isValid()
          ? dayjs(value, "YYYY-MM-DD").toDate()
          : undefined;
      },

      dateFormatter: (date) => {
        return date ? dayjs(date).format("YYYY-MM-DD") : "";
      },
    },

    // 🟣 날짜 + 시간
    dateTimeString: {
      baseDataType: "dateTimeString",
      extendsDataType: "dateTimeString",

      valueParser: (params) => {
        // Date 객체로 들어올 수도 있음
        if (params.newValue instanceof Date) {
          const d = params.newValue;
          return `${pad(d.getDate())}/${pad(
            d.getMonth() + 1
          )}/${d.getFullYear()} ${pad(d.getHours())}:${pad(
            d.getMinutes()
          )}:${pad(d.getSeconds())}`;
        }
        // 문자열일 경우 정규식 매칭
        if (
          typeof params.newValue === "string" &&
          params.newValue.match(dateTimeRegex)
        ) {
          return params.newValue;
        }
        return null;
      },

      valueFormatter: (params) => {
        if (!params.value) return "";
        // Date 객체
        if (params.value instanceof Date) {
          const d = params.value;
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
            d.getDate()
          )} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(
            d.getSeconds()
          )}`;
        }
        // 문자열
        if (
          typeof params.value === "string" &&
          params.value.match(dateTimeRegex)
        ) {
          return params.value;
        }
        // Date 객체로 변환 시도 후 포맷
        const d = new Date(params.value);
        if (!isNaN(d.getTime())) {
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
            d.getDate()
          )} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(
            d.getSeconds()
          )}`;
        }
        return params.value;
      },

      // string → Date
      dateParser: (value) => {
        if (!value) return undefined;
        const match = value.match(dateTimeRegex);
        if (!match) return undefined;
        const [, dd, MM, yyyy, HH, mm, ss] = match;
        return new Date(
          parseInt(yyyy),
          parseInt(MM) - 1,
          parseInt(dd),
          parseInt(HH),
          parseInt(mm),
          parseInt(ss)
        );
      },

      // Date → string
      dateFormatter: (value) => {
        console.log(value);
        if (!value) return "";
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
          d.getDate()
        )} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      },
    },

    // 🔵 월 전용 (Custom Type)
    monthString: {
      baseDataType: "dateTimeString",
      extendsDataType: "dateTimeString",

      valueParser: (params) => {
        if (params.newValue instanceof Date) {
          return dayjs(params.newValue).format("YYYY-MM");
        }
        if (
          typeof params.newValue === "string" &&
          dayjs(params.newValue, "YYYY-MM", true).isValid()
        ) {
          return dayjs(params.newValue).format("YYYY-MM");
        }
        return null;
      },

      valueFormatter: (params) => {
        if (!params.value) return "";
        const d = dayjs(params.value, "YYYY-MM", true);
        return d.isValid() ? d.format("YYYY-MM") : "";
      },

      dateParser: (value) => {
        if (!value) return undefined;
        return dayjs(value, "YYYY-MM", true).isValid()
          ? dayjs(value, "YYYY-MM").toDate()
          : undefined;
      },

      dateFormatter: (date) => {
        return date ? dayjs(date).format("YYYY-MM") : "";
      },
    },
    // 🟦 연도만
    yearOnly: {
      baseDataType: "dateString",
      extendsDataType: "dateString",

      valueParser: (params) => {
        if (params.newValue instanceof Date) {
          return dayjs(params.newValue).format("YYYY");
        }
        if (
          typeof params.newValue === "string" &&
          /^\d{4}$/.test(params.newValue)
        ) {
          return params.newValue;
        }
        return null;
      },

      valueFormatter: (params) => {
        if (!params.value) return "";
        const d = dayjs(params.value, "YYYY", true);
        return d.isValid() ? d.format("YYYY") : "";
      },

      dateParser: (value) => {
        if (!value || !/^\d{4}$/.test(value)) return undefined;
        return dayjs(`${value}-01-01`).toDate();
      },

      dateFormatter: (date) => {
        return date ? dayjs(date).format("YYYY") : "";
      },
    },
    // 🟩 월만
    monthOnly: {
      baseDataType: "dateString",
      extendsDataType: "dateString",

      valueParser: (params) => {
        if (params.newValue instanceof Date) {
          return dayjs(params.newValue).format("MM");
        }
        if (
          typeof params.newValue === "string" &&
          /^\d{1,2}$/.test(params.newValue)
        ) {
          return pad(Number(params.newValue));
        }
        return null;
      },

      valueFormatter: (params) => {
        if (!params.value) return "";
        const n = Number(params.value);
        return !isNaN(n) && n >= 1 && n <= 12 ? pad(n) : "";
      },

      dateParser: (value) => {
        if (!value || !/^\d{1,2}$/.test(value)) return undefined;
        return dayjs(`1990-${pad(Number(value))}-01`).toDate();
      },

      dateFormatter: (date) => {
        return date ? dayjs(date).format("MM") : "";
      },
    },
    // 🟥 일만
    dayOnly: {
      baseDataType: "dateString",
      extendsDataType: "dateString",

      valueParser: (params) => {
        if (params.newValue instanceof Date) {
          return dayjs(params.newValue).format("DD");
        }
        if (
          typeof params.newValue === "string" &&
          /^\d{1,2}$/.test(params.newValue)
        ) {
          return pad(Number(params.newValue));
        }
        return null;
      },

      valueFormatter: (params) => {
        if (!params.value) return "";
        const n = Number(params.value);
        return !isNaN(n) && n >= 1 && n <= 31 ? pad(n) : "";
      },

      dateParser: (value) => {
        if (!value || !/^\d{1,2}$/.test(value)) return undefined;
        return dayjs(`1990-01-${pad(Number(value))}`).toDate();
      },

      dateFormatter: (date) => {
        return date ? dayjs(date).format("DD") : "";
      },
    },
  },
  context: {
    vue: vueThis, // 부모 컴포넌트의 this 넘기기 (이벤트 연동 시)
  },

  // statusBar: {
  //   statusPanels: [
  //     { statusPanel: 'agTotalRowCountComponent', align: 'left' },
  //     { statusPanel: 'agSelectedRowCountComponent', align: 'center' }
  //   ]
  // },
  // rowGroupPanelShow: 'always',
  // pivotPanelShow: 'always',
});

function onGridReady(params) {
  gridApi.value = params.api;
  gridData.value = props.data;
}
</script>

<template>
  <ag-grid-vue
    style="width: 100%; height: 600px"
    class="ag-theme-alpine"
    :columnDefs="header"
    :rowData="gridData"
    :columnTypes="columnTypes"
    v-bind="gridOptions"
    :onCellClicked="eventHandlers.onCellClicked"
    :onCellDoubleClicked="eventHandlers.onCellDoubleClicked"
    :onCellContextMenu="eventHandlers.onCellContextMenu"
    :onRowClicked="eventHandlers.onRowClicked"
    :onRowDoubleClicked="eventHandlers.onRowDoubleClicked"
    :onRowContextMenu="eventHandlers.onRowContextMenu"
    :onColumnHeaderClicked="eventHandlers.onColumnHeaderClicked"
    :onSortChanged="eventHandlers.onSortChanged"
    :onFilterChanged="eventHandlers.onFilterChanged"
    :onCellValueChanged="eventHandlers.onCellValueChanged"
    :onCellEditingStarted="eventHandlers.onCellEditingStarted"
    :onCellEditingStopped="eventHandlers.onCellEditingStopped"
    :onSelectionChanged="eventHandlers.onSelectionChanged"
    @grid-ready="onGridReady"
  />
</template>

<style>
.shaded-class {
  background-color: #99999944;
}
</style>
