///// BaseGrid
<script setup>
import { useComStore } from "@/stores/comStore";
import {
  computed,
  getCurrentInstance,
  nextTick,
  onBeforeMount,
  onBeforeUnmount,
  ref,
} from "vue";
// import { useRoute } from 'vue-router';
import { merge } from "lodash";
import VirtualScroll from "el-table-virtual-scroll-next";
import cloneDeep from "lodash/cloneDeep";
import get from "lodash/get";
import set from "lodash/set";

const comStore = useComStore();
const $utils = inject("$utils");
const $stringUtils = inject("$stringUtils");
// const route = useRoute();

/**
 * ※ column type
 *
 * rowNumber: 행번호
 * selectbox: 셀렉트박스
 * rowCheckbox: 행 체크박스
 * icon: 아이콘(div)
 * button: 버튼
 * datePickerType(변수): 데이트피커
 * file: 파일 다운로드
 * html: 인풋박스 textarea
 * radio: 라디오
 * textSearch: 텍스트 + 돋보기 (아이콘)
 * inputSearch: 인풋박스 + 돋보기 (아이콘)
 * text: 텍스트
 * number
 *
 * ※ etc
 * edit: true
 * 인풋박스 (type: text, number)
 * 추후 속도 이슈가 없을경우 focus 추가 // focus 개선방안 필요
 */

const props = defineProps({
  /**
   * headerFilterId 유무 (= 그리드 열필터링 사용여부)
   * 스토어에 그리드 열필터링 상태를 저장할 때 사용 (comStore - headerFilterState)
   * 스토어에 저장된 그리드 열필터링 상태로 인해 그리드 칼럼이 제대로 안나오는 경우 localStorage의 hfs를 제거 후 새로고침
   */
  headerFilterId: { type: String },
  header: { type: Array, default: () => [] },
  data: { type: Array, default: () => [] },
  singleSelect: { type: Boolean, default: false },
  selectedData: { type: Array }, // 체크박스 비활성화할 행 id 목록
  selectedIdList: { type: Array }, // 체크박스 체크할 행 id 목록
  selectGroup: { type: String, default: "" },
  rowClickCheckBox: { type: Boolean, default: false },
  inputType: { type: String, default: "text" },
  disabledAllSelect: { type: Boolean, default: false },
  itemSize: { type: Number, default: 32 },
  rowHeightClass: { type: Number, default: "" },
  remain: { type: Number, default: 20 },
});

const CONTEXT_MENU_EVENT = "base-grid-context-menu-opened";
const datePickerType = [
  "year",
  "years",
  "month",
  "months",
  "date",
  "dates",
  "datetime",
  "week",
  "datetimerange",
  "daterange",
  "monthrange",
  "yearrange",
];

const tableRef = ref(null);
const virtualList = ref([]);
const selectedIds = ref([]); // 선택된 Id
const mainData = ref([]);
const originalData = ref([]); // Sort 되돌릴 때 사용

// 전체/부분 선택
const selectableRow = computed(() => {
  return props.data
    ?.filter((row) => !(props.selectedData ?? []).includes(row.id))
    .map((row) => row.id);
});

const isAllSelected = computed(
  () =>
    selectableRow.value.length > 0 &&
    selectedIds.value.length === selectableRow.value.length
);

const isSomeSelected = computed(
  () =>
    selectedIds.value.length > 0 && selectedIds.value.length < props.data.lenth
);

const isSelectedAllDisabled = computed(() => {
  return (props.selectedData?.length ?? 0) >= (props.data?.length ?? 0);
});

// select 만들기
const toggleAllSelection = (checked) => {
  const selectedRows = props.data.filter(
    (row) => !(props.selectedData ?? []).includes(row.id)
  );
  selectedIds.value = checked ? selectedRows.map((r) => r.id) : [];

  const selRows = props.data.filter((r) => selectedIds.value.includes(r.id));
  emit("select-all", selRows);
  emit("selection-change", selRows);
};

const rowSelection = (row, checked) => {
  // 1. Group 설정이 되어있으면 같은 그룹 전체를 뽑아준다
  const keysToToggle = props.selectGroup
    ? props.data
        .filter((r) => r[props.selectGroup] === row[props.selectGroup])
        .map((r) => r.id)
    : [row.id];
  // 2. checked가 true면 그룹 전체를 selectedids에 추가 els면 그룹전체 제거
  if (checked) {
    // 단일 체크일때
    if (props.singleSelect) {
      selectedIds.value = [];
      clearSelection();
      tableRef.value?.toggleRowSelection(row, true, false);
      selectedIds.value.push(row.id);
    } else {
      // 다중 체크
      keysToToggle.forEach((id) => {
        if (!selectedIds.value.includes(id)) {
          selectedIds.value.push(id);
        }
      });
    }
  } else {
    selectedIds.value = selectedIds.value.filter(
      (id) => !keysToToggle.includes(id)
    );
  }

  // 3. UI 동기화: 보이는 것에 한정
  nextTick(() => {
    virtualList.value.forEach((r) => {
      const should = selectedIds.value.includes(r.id);
      tableRef.value?.toggleRowSelection(r, should, false);
    });
  });

  // 4. 부모에 선택된 행 전체 전달
  const selRows = props.data.filter((r) => selectedIds.value.includes(r.id));
  emit("select", selRows, row);
  emit("selection-change", selRows);
};

// 칼럼 설정 - props의 columns를 내부 상태로 복사
const allColumns = ref(
  props.header.length
    ? cloneDeep(props.header.filter((col) => !col.hidden))
    : []
);

// 컨텍스트 메뉴 관련
const contextMenuVisible = ref(false);
const contextMenuPosition = ref({ x: 0, y: 0 });

// 편집 중인 셀 정보
const editingCell = ref({ rowIndex: -1, prop: "" });

/**
 * 캐싱(Computed)을 활용하여 헤더 필터링 상태 계산을 최적화
 * allColumns가 변경되지 않으면 캐시된 값(cachedHeaderFilterState)을 재사용
 */
const cachedHeaderFilterState = computed(() => {
  return allColumns.value
    .filter(
      (col) =>
        !col.hidden && col.label && col.key !== "no" && col.type !== "checkbox"
    )
    .map((col) => {
      const result = {
        label: col.label,
        key: col.key,
        visible: col.visible,
      };

      if (col.children) {
        result.children = col.children.map((child) => {
          const childResult = {
            label: child.label,
            key: child.key,
            visible: child.visible,
          };
          if (child.children) {
            childResult.children = child.children.map((gc) => ({
              label: gc.label,
              key: gc.key,
              visible: gc.visible,
            }));
          }
          return childResult;
        });
      }
      return result;
    });
});

// 현재 칼럼 가시성 상태를 스토어에 저장 및 반환하는 함수
const getHeaderFilterState = () => {
  const state = cachedHeaderFilterState.value;

  // '현재 그리드 열필터링 상태'를 메뉴와 headerFilterId를 depth로 구성한 object 구조로 세팅
  if (props.headerFilterId) {
    const headerFilterState =
      comStore.getHeaderFilterState !== ""
        ? comStore.getHeaderFilterState
        : "{}";
    const result = JSON.parse(headerFilterState);
    set(result, pathArr.value, state);

    // 열필터링 상태를 저장
    comStore.setHeaderFilterState(result);
  }

  return state;
};

// 열필터링 상태를 적용
const setHeaderFilterState = () => {
  if (comStore.getHeaderFilterState) {
    const headerFilterState = JSON.parse(comStore.getHeaderFilterState);

    const curTabHeaderFilterState = get(headerFilterState, pathArr.value);
    if (curTabHeaderFilterState) {
      const instance = getCurrentInstance();
      const app = instance?.appContext?.app;
      const originalWarnHandler = app?.config?.warnHandler;
      const originalConsoleWarn = console.warn;

      // warn 출력안되게 처리
      if (app?.config) app.config.warnHandler = () => {};
      console.warn = () => {};

      try {
        // visible 덮어쓰기
        merge(
          props.header.filter(
            (col) =>
              !col.hidden &&
              col.label &&
              col.key !== "no" &&
              col.type !== "checkbox"
          ),
          curTabHeaderFilterState
        );
      } finally {
        // warn 정상적으로 출력되게 처리
        if (app?.config && originalWarnHandler)
          app.config.warnHandler = originalWarnHandler;
        if (originalConsoleWarn) console.warn = originalConsoleWarn;
      }
    }
  }
};

// 헤더 그룹 체크박스가 indeterminate 상태인지 확인
const isIndeterminate = (column) => {
  if (!column.children) return false;

  const childrenCount = column.children.filter((child) => !child.hidden).length;
  const visibleCount = column.children
    .filter((child) => !child.hidden)
    .filter((child) => child.visible).length;

  return visibleCount > 0 && visibleCount < childrenCount;
};

// 부모 체크박스 변경 시 모든 자식 상태 업데이트
const handleParentCheckChange = (parentCol, checked) => {
  // 2단 자식 업데이트
  if (parentCol.children) {
    parentCol.children
      .filter((child) => !child.hidden)
      .forEach((child) => {
        child.visible = checked;

        // 3단 자식이 있다면 업데이트
        if (child.children) {
          child.children.forEach((grandChild) => {
            grandChild.visible = checked;
          });
        }
      });
  }

  emit("header-filter-change", getHeaderFilterState());
};

// 중간 레벨(2단) 체크박스 변경 시 그 아래 자식들 상태 업데이트
const handleChildCheckChange = (childCol, checked) => {
  if (childCol.children) {
    childCol.children.forEach((grandChild) => {
      grandChild.visible = checked;
    });
  }
  updateParentVisibility();

  emit("header-filter-change", getHeaderFilterState());
};

// 그리드가이드 페이지는 현재탭으로 처리하지 않는다.
const pathArr = computed(() => {
  // if (route.path === '/guideGrid') {
  //   return ['guideGrid', props.headerFilterId];
  // } else {
  let arr = comStore.getCurTab.replace("/om", "").substring(1).split("/");
  arr.push(props.headerFilterId);
  return arr;
  // }
});

// 자식 체크박스 변경 시 부모 상태 업데이트
const updateParentVisibility = () => {
  // 모든 컬럼 순회하며 부모-자식 관계 업데이트
  allColumns.value.forEach((col) => {
    if (col.children) {
      // 2단 헤더의 visible 상태 업데이트
      col.visible = col.children.some((child) => child.visible);

      // 3단 헤더의 visible 상태 업데이트
      col.children.forEach((childCol) => {
        if (childCol.children) {
          childCol.visible = childCol.children.some(
            (grandChild) => grandChild.visible
          );
        }
      });
    }
  });

  emit("header-filter-change", getHeaderFilterState());
};

const vFocus = {
  mounted(el) {
    el.querySelector("input").focus();
  },
};

// 편집모드 시작
const startEditMode = (row, col) => {
  if (row?.id || row.id === 0 || row.id === "0") {
    const rowIndex = Number(row.id) - 1;
    const prop = col.property || col.key;

    editingCell.value = { rowIndex, prop };
  } else {
    console.log(`row.id : ${row?.id} 확인필요`);
  }
};

// 편집모드 종료
const endEditMode = () => {
  const prevCell = { ...editingCell.value };
  editingCell.value = { rowIndex: -1, prop: "" };

  if (prevCell.rowIndex !== -1) {
    emit(
      "cell-edit",
      prevCell.rowIndex,
      prevCell.prop,
      props.data[prevCell.rowIndex]
    );
  }
};

// 셀 더블클릭 핸들러
const handleCellDblClick = (row, column, cell, event) => {
  startEditMode(row, column);
  emit("cell-dblclick", row, column, cell, event);
};

// 헤더 우클릭 핸들러
const handleHeaderContextmenu = (column, event) => {
  event.preventDefault();

  endEditMode();

  // 먼저 모든 컨텍스트 메뉴 닫기 위한 전역 이벤트 발생
  window.dispatchEvent(new CustomEvent(CONTEXT_MENU_EVENT));

  setTimeout(() => {
    const domEl = tableRef.value?.$el?.parentElement;

    if (domEl && typeof domEl.getBoundingClientRect === "function") {
      const tableRect = domEl.getBoundingClientRect();
      contextMenuPosition.value = {
        x: event.clientX - tableRect.left,
        y: event.clientY - tableRect.top,
      };
      contextMenuVisible.value = true;

      emit("header-contextmenu", column, event);
    }
  }, 10);
};

// 선택된 체크박스 비활성화
const selectable = (row) => {
  return !(props.selectedData ?? []).includes(row.id);
};

const tableRowClass = ({ row }) => {
  if (row.status === "gray") {
    return "row-gray";
  } else {
    return selectedIds.value.includes(row.id) ? "row-selected" : "";
  }
};

const isCellDisabled = (row, col) => {
  return row.selectDisabledList?.[col.key] ?? false;
};

const eventHandlers = computed(() => {
  return {
    // select: (selection, row) => emit('select', selection, row),
    // 'selection-change': (newSelection) => emit('selection-change', newSelection),
    "cell-mouse-enter": (row, column, cell, event) =>
      emit("cell-mouse-enter", row, column, cell, event),
    "cell-mouse-leave": (row, column, cell, event) =>
      emit("cell-mouse-leave", row, column, cell, event),
    "cell-click": (row, column, cell, event) => {
      if (event.target?.className == "input-type-search textSearch") {
        return;
      }

      let cols, col;
      cols = props.header.filter((r) => r.key == column.property);

      if (cols.length > 0) {
        col = cols[0];

        if (!(col.edit && col.type == "text")) {
          startEditMode(row, column);
        }
      } else {
        startEditMode(row, column);
      }

      emit("cell-click", row, column, cell, event);
    },
    "cell-dblclick": (row, column, cell, event) => {
      startEditMode(row, column);
      handleCellDblClick(row, column, cell, event);
    },
    "cell-contextmenu": (row, column, cell, event) =>
      emit("cell-contextmenu", row, column, cell, event),
    "row-click": (row, column, event) => {
      if (
        column.type === "button" ||
        column.type === "selectbox" ||
        column.type === "inputSearch"
      )
        return;

      if (event.target?.className == "input-type-search textSearch") {
        return;
      }

      if (props.rowClickCheckBox && column.type !== "checkbox") {
        // 체크박스까지 한번 에 확인
        const isSelected = selectedIds.value.includes(row.id);
        rowSelection(row, !isSelected);
        emit("row-check-click", row, isSelected);
      } else {
        onRowClick(row);
        emit("row-click", row, column, event);
      }
    },
    "row-check-click": (row, column, event) => {
      const isSelected = selectedIds.value.includes(row.id);
      rowSelection(row, !isSelected);
      emit("row-check-click", row, isSelected);
    },
    "row-contextmenu": (row, column, event) =>
      emit("row-contextmenu", row, column, event),
    "row-dblclick": (row, column, event) => {
      if (column?.type == "selection") return;

      emit("row-dblclick", row, column, event);
    },
    "header-click": (column, event) => emit("header-click", column, event),
    "header-contextmenu": handleHeaderContextmenu,
    "sort-change": (data) => {
      handleSortChange(data);
      // emit('sort-change', data);
    },
    "filter-change": (newFilters) => emit("filter-change", newFilters),
    "current-change": (currentRow, oldCurrentRow) =>
      emit("current-change", currentRow, oldCurrentRow),
    "header-dragend": (newWidth, oldWidth, column, event) =>
      emit("header-dragend", newWidth, oldWidth, column, event),
    "expand-change": (row, expandedRows) =>
      emit("expand-change", row, expandedRows),
    scroll: (obj) => emit("scroll", obj),
    "select-all": (selection) => {
      const isCheckAll = selection.length > 0;
      if (!isCheckAll) {
        selectedIds.value = [];
      } else {
        selectedIds.value = props.data.map((r) => r.id);
      }

      nextTick(() => {
        virtualList.value.forEach((row) => {
          const should = selectedIds.value.includes(row.id);
          tableRef.value.toggleRowSelection(row, should, false);
        });
      });

      const payload = isCheckAll ? props.data : [];
      emit("select-all", payload);
      emit("selection-change", payload);
    },
    select: (selection, row) => {
      if (props.singleSelect) {
        // 같은 행을 선택했다면
        if (selectedIds.value[0] === row.id) {
          clearSelection();
          selectedIds.value = [];

          // 부모가 취소를 알 수 있도록
          emit("select-cancel", [], row);
          emit("selection-change", []);
        } else {
          // 다른 행을 클릭했으면 해당 행만 선택
          clearSelection();
          tableRef.value?.toggleRowSelection(row, true, false);
          selectedIds.value = [row.id];

          emit("select", [row], row);
          emit("selection-change", [row]);
        }
        return;
      } else {
        if (selectedIds.value.includes(row.id)) {
          selectedIds.value = selectedIds.value.filter((id) => id !== row.id);
        } else {
          selectedIds.value.push(row.id);
        }
        emit("select", selection, row);
        emit(
          "selection-change",
          props.data.filter((r) => selectedIds.value.includes(r.id))
        );
      }
    },
    "select-cancel": (selection, row) => {
      selectedIds.value = selectedIds.value.filter((id) => id !== row.id);
      emit("select-cancel", selection, row);
      emit("selection-change", selection);
    },
    clear: () => {
      clearSelection();
    },
    "cell-search-click": (row, col) => {
      emit("cell-search-click", row, col);
    },
  };
});

const emit = defineEmits([
  // El-Table Events
  "select",
  "select-all",
  "selection-change",
  "cell-mouse-enter",
  "cell-mouse-leave",
  "cell-click",
  "cell-dblclick",
  "cell-contextmenu",
  "row-click",
  "row-check-click",
  "row-contextmenu",
  "row-dblclick",
  "header-click",
  "header-contextmenu",
  "sort-change",
  "filter-change",
  "current-change",
  "header-dragend",
  "expand-change",
  "scroll",

  // 커스텀
  "header-filter-click",
  "header-filter-change",
  "cell-edit",
  "cell-select-change",
  "cell-icon-click",
  "cell-btn-click",
  "cell-check-click",
  "cell-date-picker-change",
  "cell-input-change",
  "cell-text-download",
  "cell-radio-change",
  "clear",
  "cell-search-click",
]);

const clearSelection = () => {
  tableRef.value.clearSelection();
  selectedIds.value = [];
};

const getSelectionRows = () => {
  const selRows = props.data.filter((r) => selectedIds.value.includes(r.id));
  return selRows;
};
const toggleRowSelection = (row, selected) =>
  tableRef.value?.toggleRowSelection(row, selected);
// const toggleAllSelection = () => tableRef.value?.toggleAllSelection();
const toggleRowExpansion = (row, expanded) =>
  tableRef.value?.toggleRowExpansion(row, expanded);
const setCurrentRow = (row) => tableRef.value?.setCurrentRow(row);
const clearSort = () => tableRef.value?.clearSort();
const clearFilter = (columnKeys) => tableRef.value?.clearFilter(columnKeys);
const doLayout = () => tableRef.value?.doLayout();
const sort = (prop, order) => tableRef.value?.sort(prop, order);
const scrollTo = (options, yCoord) => tableRef.value?.scrollTo(options, yCoord);
const setScrollTop = (top) => tableRef.value?.setScrollTop(top);
const columns = tableRef.value?.columns;
const updateKeyChildren = (key, data) =>
  tableRef.value?.updateKeyChildren(key, data);
const onRowClick = (row) => tableRef.value?.setCurrentRow(row);

defineExpose({
  // El-Table Expose
  clearSelection,
  getSelectionRows,
  toggleRowSelection,
  rowSelection,
  toggleAllSelection,
  toggleRowExpansion,
  setCurrentRow,
  clearSort,
  clearFilter,
  doLayout,
  sort,
  scrollTo,
  setScrollTop,
  columns,
  updateKeyChildren,

  // 컴포넌트 내부 상태 및 메서드
  allColumns,
  endEditMode,
  updateParentVisibility,
  getHeaderFilterState,
});

// [FUNC] Sort가 변경되었음을 감지
const handleSortChange = ({ column, prop, order }) => {
  // order : 'ascending', 'desending', 'null'

  if (!order) {
    // 정렬 해제
    mainData.value = originalData.value;
    return;
  }

  const sortData = [...mainData.value].sort((a, b) => {
    if (order === "ascending") {
      return a[prop] > b[prop] ? 1 : -1;
    } else {
      return a[prop] < b[prop] ? 1 : -1;
    }
  });
  mainData.value = sortData;

  nextTick(() => {
    tableRef.value?.resetScroll?.();
  });
};

// Virtual 스크롤에 필요한 데이터만 명시
const onVisibleChange = (renderData) => {
  endEditMode();
  virtualList.value = renderData;
};

// selectBox 옵션 가져오기
// Row별로 Selectbox가 다를때 옵션
// 사용법 : 해당 헤더의 key값과 동일한 데이터를 넣어준다
// heaedr = [ key: 'rtgSbjtCd', ... ]
// data = [{id: 1, rtgSbjtCd: 'A10', rtgSbjtCdOptions: [{label:'선택1', value: 'A'}]}]
const getRowOption = (row, col) => {
  const optionField = col.optionKey || `${col.key}Options`;
  return row[optionField] ?? col.list ?? [];
};

const formatData = (row, col, cellValue) => {
  if (typeof cellValue === "number") {
    return $stringUtils.formatComma(cellValue);
  }
  return cellValue;
};

watch(
  () => props.header,
  (newHeader) => {
    allColumns.value = newHeader.length
      ? cloneDeep(newHeader.filter((col) => !col.hidden))
      : [];
  },
  { deep: true }
);

watch(
  () => props.data,
  (data) => {
    if (data) {
      clearSelection();
      mainData.value = [...data];
      originalData.value = data;
    }
  },
  { deep: true }
);

watch(
  () => comStore.getCurTab,
  () => {
    if (props.headerFilterId) {
      setHeaderFilterState(); // 열필터링 상태를 적용
    }
  }
);

// 컬럼 선택하기 추가
watch(
  () => props.selectedIdList,
  async (ids) => {
    if (!ids || !tableRef.value) return;

    await nextTick(); // DOM/가상 리스트 렌더링 후 토글

    selectedIds.value = [...ids];

    props.data.forEach((row) => {
      const shouldSelect = selectedIds.value.includes(row.id);
      tableRef.value.toggleRowSelection(row, shouldSelect, false);
    });

    // 부모에 선택된 행 전체 전달
    // const selRows = props.data.filter((r) => selectedIds.value.includes(r.id));

    // emit('selection-change', selRows);
  },
  { deep: true }
);

const printSelectbox = (value, option = []) => {
  const arr = option.filter((r) => r.value == value);
  const result = arr.length > 0 ? arr[0].label : value;
  return result;
};

const printDate = (dateStr, type) => {
  // const datePickerType = [
  //    'year', 'years', 'month', 'months', 'date', 'dates', 'datetime',
  //   'week', 'datetimerange', 'daterange', 'monthrange', 'yearrange'
  // ];
  let result;

  if (dateStr) {
    switch (type) {
      case "year":
        result = $utils.chgTimeForm(dateStr, "YYYY");
        break;
      case "month":
        result = $utils.chgTimeForm(dateStr, "YYYY-MM");
        break;
      default: // 'date'
        result = $utils.chgTimeForm(dateStr, "YYYY-MM-DD");
        break;
    }
  } else {
    result = "";
  }

  return result;
};

const isDisabled = (row, col) => {
  const type = col.type;
  let result = false;

  if (datePickerType.includes(type)) {
    result = row.rowDisabled || col.disabled;
  } else if (type == "text" && col.edit) {
    result = row.rowDisabled || col.disabled || isCellDisabled(row, col);
  } else if (type == "selectbox") {
    result = row.rowDisabled || col.disabled || isCellDisabled(row, col);
  } else if (type == "radio") {
    result = row.rowDisabled || col.disabled || isCellDisabled(row, col);
  }

  return result;
};

const handleDocumentClick = (event) => {
  // 컨텍스트 메뉴 외부 클릭 시 닫기
  if (contextMenuVisible.value && !event.target.closest(".context-menu")) {
    contextMenuVisible.value = false;
  }

  // 캘린더 정상 동작안하는 현상 조치
  if (!event.target.closest(".base-date-picker")) {
    return;
  } else {
    // 테이블 외부 클릭 시 편집 모드 종료
    if (!event.target.closest(".el-table")) {
      endEditMode();
    }
  }
};

const closeContextMenu = () => (contextMenuVisible.value = false);

onBeforeMount(() => {
  document.addEventListener("click", handleDocumentClick);

  if (props.headerFilterId) {
    window.addEventListener(CONTEXT_MENU_EVENT, closeContextMenu); // 열필터링
    setHeaderFilterState(); // 열필터링 상태를 적용
  }
  mainData.value = [...props.data];
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleDocumentClick);

  if (props.headerFilterId) {
    window.removeEventListener(CONTEXT_MENU_EVENT, closeContextMenu); // 열필터링
  }
});
</script>

<template>
  <div class="base-grid table-container table-scroll-wrapper">
    <virtual-scroll
      class="scroller"
      key-prop="id"
      :data="mainData"
      :item-size="itemSize"
      :throttleTime="130"
      :buffer="130"
      @change="onVisibleChange"
      @sort-change="handleSortChange"
    >
      <el-table
        ref="tableRef"
        row-key="id"
        highlight-current-row
        v-bind="$attrs"
        v-on="eventHandlers"
        :border="true"
        :emptyText="comStore.t('GRID.NODATA')"
        :row-class-name="tableRowClass"
        :data="virtualList"
        :cell-class-name="rowHeightClass"
      >
        <template v-for="col in allColumns">
          <template v-if="col.visible && !col.hidden">
            <template v-if="!col.children">
              <template v-if="col.type === 'checkbox'">
                <el-table-column
                  header-align="center"
                  width="60"
                  :fixed="col.fixed"
                >
                  <template #header>
                    <el-checkbox
                      :model-value="isAllSelected"
                      :indeterminate="isSomeSelected"
                      :disabled="
                        isSelectedAllDisabled ||
                        singleSelect ||
                        disabledAllSelect
                      "
                      @change="toggleAllSelection"
                    ></el-checkbox>
                  </template>
                  <template #default="{ row }">
                    <el-checkbox
                      :model-value="selectedIds.includes(row.id)"
                      :disabled="selectedData?.includes(row.id) || false"
                      @change="(val) => rowSelection(row, val)"
                      @click.stop
                    ></el-checkbox>
                  </template>
                </el-table-column>
              </template>
              <template v-else>
                <el-table-column
                  header-align="center"
                  :prop="col.key"
                  :label="col.label"
                  :width="col.width"
                  :align="col.align"
                  :type="col.type"
                  :fixed="col.fixed"
                  :edit="col.edit"
                  :sortable="col.sortable === false ? false : true"
                  :selectable="selectable"
                  :formatter="formatData"
                >
                  <template #header>
                    <template v-if="col.type === 'headerFilter'">
                      <div
                        class="blue-color"
                        style="cursor: pointer; pointer-events: auto"
                        @click.stop="
                          (event) => emit('header-filter-click', col, event)
                        "
                      >
                        <span style="white-space: pre-line">{{
                          col.label
                        }}</span>
                      </div>
                    </template>
                    <div v-else :class="['cell', col.require ? 'req' : '']">
                      <span style="white-space: pre-line">{{ col.label }}</span>
                    </div>
                  </template>
                  <template #default="{ row }">
                    <template v-if="col.type == 'rowNumber'">
                      <span>{{ row.id }}</span>
                    </template>

                    <template v-else-if="col.type == 'selectbox'">
                      <el-select
                        v-if="
                          editingCell.rowIndex == Number(row.id) - 1 &&
                          editingCell.prop == col.key &&
                          !isDisabled(row, col)
                        "
                        v-model="row[col.key]"
                        :empty-values="[null, undefined]"
                        :filterable="col.filterable"
                        @change="
                          (value) => emit('cell-select-change', row, col, value)
                        "
                        @visible-change="
                          (visible) => {
                            if (!visible) {
                              endEditMode();
                            }
                          }
                        "
                      >
                        <el-option
                          v-for="item in getRowOption(row, col)"
                          :key="item.value"
                          :label="item.label"
                          :value="item.value"
                        />
                      </el-select>
                      <template v-else>
                        <span
                          style="cursor: pointer"
                          @click.stop="
                            () => {
                              if (isDisabled(row, col)) return;
                              startEditMode(row, col);
                            }
                          "
                        >
                          {{
                            printSelectbox(row[col.key], getRowOption(row, col))
                          }}
                        </span>
                        <div
                          class="icon-6-down"
                          style="cursor: pointer"
                          @click.stop="
                            () => {
                              if (isDisabled(row, col)) return;
                              startEditMode(row, col);
                            }
                          "
                        ></div>
                      </template>
                    </template>

                    <template v-else-if="col.type == 'rowCheckbox'">
                      <div :class="['cell', col.require ? 'req' : '']">
                        <el-checkbox
                          :checked="row[col.key] === col.trueValue"
                          :key="row.id + '_' + row[col.key]"
                          :disabled="col.disabled || row.rowDisabled"
                          :true-value="col.trueValue"
                          :false-value="col.falseValue"
                          @change="
                            (val) => {
                              row[col.key] = val;
                              emit('cell-check-click', row, col, val);
                            }
                          "
                        >
                        </el-checkbox>
                      </div>
                    </template>

                    <template v-else-if="col.type == 'icon'">
                      <div
                        :class="row[col.key].class"
                        :disabled="col.disabled || row.rowDisabled"
                        @click="() => emit('cell-icon-click', row, col)"
                      ></div>
                    </template>

                    <template v-else-if="col.type == 'button'">
                      <span v-if="row[col.key]?.leftText">{{
                        row[col.key].leftText
                      }}</span>
                      <el-button
                        v-if="row[col.key]?.text"
                        :class="row[col.key].class"
                        :disabled="
                          col.disabled ||
                          row.rowDisabled ||
                          row[col.key]?.disabled
                        "
                        @click="() => emit('cell-btn-click', row, col)"
                      >
                        {{ row[col.key]?.text }}
                      </el-button>
                      <span v-if="row[col.key]?.rightText">{{
                        row[col.key].rightText
                      }}</span>
                    </template>

                    <template v-else-if="datePickerType.includes(col.type)">
                      <BaseDatePicker
                        v-if="
                          editingCell.rowIndex === Number(row.id) - 1 &&
                          editingCell.prop === col.key &&
                          !isDisabled(row, col)
                        "
                        v-model="row[col.key]"
                        :type="col.type"
                        :pickerType="date"
                        placeholder="날짜선택"
                        @change="
                          (val) =>
                            emit('cell-date-picker-change', row, col, val)
                        "
                        @visible-change="
                          (visible) => {
                            if (!visible) {
                              endEditMode();
                            }
                          }
                        "
                      />
                      <template v-else>
                        <span
                          style="cursor: pointer"
                          @click.stop="
                            () => {
                              if (isDisabled(row, col)) return;
                              startEditMode(row, col);
                            }
                          "
                        >
                          {{ printDate(row[col.key], col.type) }}
                        </span>
                      </template>
                    </template>

                    <template v-else-if="col.type == 'file'">
                      <span
                        style="cursor: pointer; text-decoration: underline"
                        @click="() => emit('cell-text-download', row, col)"
                      >
                        {{ row[col.key] }}
                      </span>
                    </template>

                    <template v-else-if="col.type == 'html'">
                      <div
                        style="white-space: pre-wrap"
                        v-html="$utils.htmlDecode(row[col.key])"
                      ></div>
                    </template>

                    <template v-else-if="col.type == 'radio'">
                      <span v-if="row.replace">{{ row.replaceValue }}</span>
                      <div v-else class="radio-type-02">
                        <BaseField
                          type="radio-group"
                          v-model="row[col.key]"
                          :disabled="isDisabled(row, col)"
                          :options="col.list"
                          @change="
                            (val) => {
                              emit('cell-radio-change', row, col, val);
                            }
                          "
                        />
                      </div>
                    </template>

                    <template v-else-if="col.type == 'textSearch'">
                      <span>{{ row[col.key] }}</span>
                      <div
                        class="input-type-search textSearch"
                        @click="
                          () => {
                            emit('cell-search-click', row, col);
                          }
                        "
                      ></div>
                    </template>

                    <template v-else-if="col.type == 'inputSearch'">
                      <input
                        class="input-type-02"
                        :value="row[col.key] || ''"
                        :readOnly="true"
                        type="input"
                        :disabled="
                          isCellDisabled(row, col) ||
                          col.disabled ||
                          row.rowDisabled
                        "
                        @blur="endEditMode"
                        @keyup.enter="endEditMode"
                        @change="
                          (val) => {
                            row[col.key] = val.target.value;
                            emit('cell-input-change', row, col, val);
                          }
                        "
                      />
                      <div
                        class="input-type-search"
                        @click="row.clickSearch(row, col)"
                      ></div>
                    </template>

                    <template v-else-if="col.edit">
                      <el-input
                        v-if="
                          editingCell.rowIndex == Number(row.id) - 1 &&
                          editingCell.prop == col.key &&
                          !isDisabled(row, col)
                        "
                        v-model="row[col.key]"
                        v-focus
                        :type="col.inputType"
                        :class="['cell', col.require ? 'req' : '']"
                        @blur="endEditMode"
                        @keyup.enter="endEditMode"
                        @change="
                          (val) => emit('cell-input-change', row, col, val)
                        "
                      />

                      <template v-else>
                        <span
                          style="cursor: pointer"
                          @dblclick.stop="
                            () => {
                              if (isDisabled(row, col)) return;
                              startEditMode(row, col, col.edit);
                            }
                          "
                        >
                          {{ row[col.key] }}
                        </span>
                      </template>
                    </template>
                  </template>
                </el-table-column>
              </template>
            </template>

            <template v-else>
              <el-table-column
                header-align="center"
                :key="col.key"
                :label="col.label"
                :prop="col.key"
                :width="col.width"
                :align="col.align"
                :type="col.type"
                :fixed="col.fixed"
                :selectable="selectable"
                :formatter="formatData"
                :sortable="col.sortable === false ? false : true"
              >
                <template v-for="childCol in col.children">
                  <template v-if="childCol.visible && !childCol.hidden">
                    <template v-if="!childCol.children">
                      <template v-if="childCol.type === 'checkbox'">
                        <el-table-column header-align="center" width="60">
                          <template #header>
                            <el-checkbox
                              :model-value="isAllSelected"
                              :indeterminate="isSomeSelected"
                              :disabled="isSelectedAllDisabled"
                              @change="toggleAllSelection"
                            ></el-checkbox>
                          </template>
                          <template #default="{ row }">
                            <el-checkbox
                              :model-value="selectedIds.includes(row.id)"
                              @change="(val) => rowSelection(row, val)"
                            ></el-checkbox>
                          </template>
                        </el-table-column>
                      </template>
                      <template v-else>
                        <el-table-column
                          :key="childCol.key"
                          :prop="childCol.key"
                          :label="childCol.label"
                          :width="childCol.width"
                          :align="childCol.align"
                          :type="childCol.type"
                          :formatter="formatData"
                          :fixed="childCol.fixed"
                          :sortable="childCol.sortable === false ? false : true"
                          header-align="center"
                        >
                          <template #header>
                            <div :class="['cell', col.require ? 'req' : '']">
                              <span style="white-space: pre-line">{{
                                childCol.label
                              }}</span>
                            </div>
                          </template>
                          <template #default="{ row }">
                            <template v-if="childCol.type == 'selectbox'">
                              <el-select
                                v-if="
                                  editingCell.rowIndex == Number(row.id) - 1 &&
                                  editingCell.prop == childCol.key &&
                                  !isDisabled(row, childCol)
                                "
                                v-model="row[childCol.key]"
                                :empty-values="[null, undefined]"
                                :filterable="childCol.filterable"
                                @change="
                                  (value) =>
                                    emit(
                                      'cell-select-change',
                                      row,
                                      childCol,
                                      value
                                    )
                                "
                                @visible-change="
                                  (visible) => {
                                    if (!visible) {
                                      endEditMode();
                                    }
                                  }
                                "
                              >
                                <el-option
                                  v-for="item in getRowOption(row, childCol)"
                                  :key="item.value"
                                  :label="item.label"
                                  :value="item.value"
                                />
                              </el-select>
                              <template v-else>
                                <span
                                  style="cursor: pointer"
                                  @click.stop="
                                    () => {
                                      if (isDisabled(row, childCol)) return;
                                      startEditMode(row, childCol);
                                    }
                                  "
                                >
                                  {{
                                    printSelectbox(
                                      row[childCol.key],
                                      getRowOption(row, childCol)
                                    )
                                  }}
                                </span>
                                <div
                                  class="icon-6-down"
                                  style="cursor: pointer"
                                  @click.stop="
                                    () => {
                                      if (isDisabled(row, childCol)) return;
                                      startEditMode(row, childCol);
                                    }
                                  "
                                ></div>
                              </template>
                            </template>

                            <template
                              v-else-if="childCol.type == 'rowCheckbox'"
                            >
                              <el-checkbox
                                :checked="
                                  row[childCol.key] === childCol.trueValue
                                "
                                :key="row.id + '_' + row[childCol.key]"
                                :disabled="childCol.disabled || row.rowDisabled"
                                :true-value="childCol.trueValue"
                                :false-value="childCol.falseValue"
                                @change="
                                  (val) => {
                                    row[childCol.key] = val;
                                    emit(
                                      'cell-check-click',
                                      row,
                                      childCol,
                                      val
                                    );
                                  }
                                "
                              >
                              </el-checkbox>
                            </template>

                            <template v-else-if="childCol.type == 'icon'">
                              <div
                                :class="row[childCol.key].class"
                                :disabled="row[childCol.key].disabled"
                                @click="
                                  () => emit('cell-icon-click', row, childCol)
                                "
                              ></div>
                            </template>

                            <template v-else-if="childCol.type == 'button'">
                              <el-button
                                :class="row[childCol.key].class"
                                :disabled="
                                  childCol.disabled ||
                                  row.rowDisabled ||
                                  row[childCol.key]?.disabled
                                "
                                @click="
                                  () => emit('cell-btn-click', row, childCol)
                                "
                              >
                                {{ row[childCol.prop].text }}
                              </el-button>
                            </template>

                            <template
                              v-else-if="datePickerType.includes(childCol.type)"
                            >
                              <BaseDatePicker
                                v-if="
                                  editingCell.rowIndex === Number(row.id) - 1 &&
                                  editingCell.prop === childCol.key &&
                                  !isDisabled(row, childCol)
                                "
                                v-model="row[childCol.key]"
                                :type="childCol.type"
                                pickerType="date"
                                placeholder="날짜선택"
                                @change="
                                  (val) =>
                                    emit(
                                      'cell-date-picker-change',
                                      row,
                                      childCol,
                                      val
                                    )
                                "
                                @visible-change="
                                  (visible) => {
                                    if (!visible) {
                                      endEditMode();
                                    }
                                  }
                                "
                              />
                              <template v-else>
                                <span
                                  style="cursor: pointer"
                                  @click.stop="
                                    () => {
                                      if (isDisabled(row, childCol)) return;
                                      startEditMode(row, childCol);
                                    }
                                  "
                                >
                                  {{
                                    printDate(row[childCol.key], childCol.type)
                                  }}
                                </span>
                              </template>
                            </template>

                            <template v-else-if="childCol.type == 'file'">
                              <span
                                style="
                                  cursor: pointer;
                                  text-decoration: underline;
                                "
                                @click="
                                  () => emit('cell-text-download', row, col)
                                "
                              >
                                {{ row[childCol.key] }}
                              </span>
                            </template>

                            <template v-else-if="childCol.edit">
                              <el-input
                                v-if="
                                  editingCell.rowIndex == Number(row.id) - 1 &&
                                  editingCell.prop == childCol.key &&
                                  !isDisabled(row, childCol)
                                "
                                v-model="row[childCol.key]"
                                v-focus
                                :type="childCol.inputType"
                                :class="['cell', childCol.require ? 'req' : '']"
                                @blur="endEditMode"
                                @keyup.enter="endEditMode"
                                @change="
                                  (val) =>
                                    emit(
                                      'cell-input-change',
                                      row,
                                      childCol,
                                      val
                                    )
                                "
                              />

                              <template v-else>
                                <span
                                  style="cursor: pointer"
                                  @dblclick.stop="
                                    () => {
                                      if (isDisabled(row, childCol)) return;
                                      startEditMode(
                                        row,
                                        childCol,
                                        childCol.edit
                                      );
                                    }
                                  "
                                >
                                  {{ row[childCol.key] }}
                                </span>
                              </template>
                            </template>
                          </template>
                        </el-table-column>
                      </template>
                    </template>

                    <template v-else>
                      <el-table-column
                        header-align="center"
                        :key="childCol.key"
                        :label="childCol.label"
                        :prop="childCol.key"
                        :width="childCol.width"
                        :align="childCol.align"
                        :type="childCol.type"
                        :fixed="childCol.fixed"
                        :selectable="selectable"
                        :formatter="formatData"
                        :sortable="childCol.sortable === false ? false : true"
                      >
                        <template v-for="grandChildCol in childCol.children">
                          <template
                            v-if="
                              grandChildCol.visible && !grandChildCol.hidden
                            "
                          >
                            <template v-if="childCol.type === 'checkbox'">
                              <el-table-column header-align="center" width="60">
                                <template #header>
                                  <el-checkbox
                                    :model-value="isAllSelected"
                                    :indeterminate="isSomeSelected"
                                    :disabled="isSelectedAllDisabled"
                                    @change="toggleAllSelection"
                                  ></el-checkbox>
                                </template>
                                <template #default="{ row }">
                                  <el-checkbox
                                    :model-value="selectedIds.includes(row.id)"
                                    @change="(val) => rowSelection(row, val)"
                                  ></el-checkbox>
                                </template>
                              </el-table-column>
                            </template>

                            <template v-else>
                              <el-table-column
                                header-align="center"
                                :prop="grandChildCol.key"
                                :label="grandChildCol.label"
                                :width="grandChildCol.width"
                                :align="grandChildCol.align"
                                :type="grandChildCol.type"
                                :fixed="grandChildCol.fixed"
                                :formatter="formatData"
                                :sortable="
                                  grandChildCol.sortable === false
                                    ? false
                                    : true
                                "
                              >
                                <template #default="{ row }">
                                  <template
                                    v-if="grandChildCol.type == 'selectbox'"
                                  >
                                    <el-select
                                      v-if="
                                        editingCell.rowIndex ==
                                          Number(row.id) - 1 &&
                                        editingCell.prop == grandChildCol.key &&
                                        !isDisabled(row, grandChildCol)
                                      "
                                      v-model="row[grandChildCol.key]"
                                      :empty-values="[null, undefined]"
                                      :filterable="grandChildCol.filterable"
                                      @change="
                                        (value) =>
                                          emit(
                                            'cell-select-change',
                                            row,
                                            grandChildCol,
                                            value
                                          )
                                      "
                                      @visible-change="
                                        (visible) => {
                                          if (!visible) {
                                            endEditMode();
                                          }
                                        }
                                      "
                                    >
                                      <el-option
                                        v-for="item in getRowOption(
                                          row,
                                          grandChildCol
                                        )"
                                        :key="item.value"
                                        :label="item.label"
                                        :value="item.value"
                                      />
                                    </el-select>
                                    <template v-else>
                                      <span
                                        style="cursor: pointer"
                                        @click.stop="
                                          startEditMode(row, grandChildCol)
                                        "
                                      >
                                        {{
                                          selectboxOutput(
                                            getRowOption(row, grandChildCol),
                                            row[grandChildCol.key]
                                          )
                                        }}
                                        ▼
                                      </span>
                                    </template>
                                  </template>

                                  <template
                                    v-else-if="
                                      grandChildCol.type == 'rowCheckbox'
                                    "
                                  >
                                    <el-checkbox
                                      :checked="
                                        row[grandChildCol.key] ===
                                        grandChildCol.trueValue
                                      "
                                      :key="
                                        row.id + '_' + row[grandChildCol.key]
                                      "
                                      :disabled="
                                        grandChildCol.disabled ||
                                        row.rowDisabled
                                      "
                                      :true-value="grandChildCol.trueValue"
                                      :false-value="grandChildCol.falseValue"
                                      @change="
                                        (val) => {
                                          row[grandChildCol.key] = val;
                                          emit(
                                            'cell-check-click',
                                            row,
                                            grandChildCol,
                                            val
                                          );
                                        }
                                      "
                                    >
                                    </el-checkbox>
                                  </template>

                                  <template
                                    v-else-if="grandChildCol.type == 'icon'"
                                  >
                                    <div
                                      :class="row[grandChildCol.key].class"
                                      :disabled="
                                        row[grandChildCol.key].disabled
                                      "
                                      @click="
                                        () =>
                                          emit(
                                            'cell-icon-click',
                                            row,
                                            grandChildCol
                                          )
                                      "
                                    ></div>
                                  </template>

                                  <template
                                    v-else-if="grandChildCol.type == 'button'"
                                  >
                                    <el-button
                                      :class="row[grandChildCol.key].class"
                                      :disabled="
                                        grandChildCol.disabled ||
                                        row.rowDisabled ||
                                        row[grandChildCol.key]?.disabled
                                      "
                                      @click="
                                        () =>
                                          emit(
                                            'cell-btn-click',
                                            row,
                                            grandChildCol
                                          )
                                      "
                                    >
                                      {{ row[grandChildCol.key].text }}
                                    </el-button>
                                  </template>

                                  <template
                                    v-else-if="
                                      datePickerType.includes(
                                        grandChildCol.type
                                      )
                                    "
                                  >
                                    <BaseDatePicker
                                      v-if="
                                        editingCell.rowIndex ===
                                          Number(row.id) - 1 &&
                                        editingCell.prop ===
                                          grandChildCol.key &&
                                        !isDisabled(row, grandChildCol)
                                      "
                                      v-model="row[grandChildCol.key]"
                                      :type="grandChildCol.type"
                                      pickerType="date"
                                      placeholder="날짜선택"
                                      @change="
                                        (val) =>
                                          emit(
                                            'cell-date-picker-change',
                                            row,
                                            grandChildCol,
                                            val
                                          )
                                      "
                                      @visible-change="
                                        (visible) => {
                                          if (!visible) {
                                            endEditMode();
                                          }
                                        }
                                      "
                                    />
                                    <template v-else>
                                      <span
                                        style="cursor: pointer"
                                        @click.stop="
                                          () => {
                                            if (isDisabled(row, grandChildCol))
                                              return;
                                            startEditMode(row, grandChildCol);
                                          }
                                        "
                                      >
                                        {{
                                          printDate(
                                            row[grandChildCol.key],
                                            grandChildCol.type
                                          )
                                        }}
                                      </span>
                                    </template>
                                  </template>

                                  <template
                                    v-else-if="grandChildCol.type == 'file'"
                                  >
                                    <span
                                      style="
                                        cursor: pointer;
                                        text-decoration: underline;
                                      "
                                      @click="
                                        () =>
                                          emit('cell-text-download', row, col)
                                      "
                                    >
                                      {{ row[grandChildCol.key] }}
                                    </span>
                                  </template>

                                  <template v-else-if="grandChildCol.edit">
                                    <el-input
                                      v-if="
                                        editingCell.rowIndex ==
                                          Number(row.id) - 1 &&
                                        editingCell.prop == grandChildCol.key &&
                                        !isDisabled(row, grandChildCol)
                                      "
                                      v-model="row[grandChildCol.key]"
                                      v-focus
                                      :type="grandChildCol.inputType"
                                      :class="[
                                        'cell',
                                        grandChildCol.require ? 'req' : '',
                                      ]"
                                      @blur="endEditMode"
                                      @keyup.enter="endEditMode"
                                      @change="
                                        (val) =>
                                          emit(
                                            'cell-input-change',
                                            row,
                                            grandChildCol,
                                            val
                                          )
                                      "
                                    />

                                    <template v-else>
                                      <span
                                        style="cursor: pointer"
                                        @dblclick.stop="
                                          () => {
                                            if (isDisabled(row, grandChildCol))
                                              return;
                                            startEditMode(
                                              row,
                                              grandChildCol,
                                              grandChildCol.edit
                                            );
                                          }
                                        "
                                      >
                                        {{ row[grandChildCol.key] }}
                                      </span>
                                    </template>
                                  </template>
                                </template>
                              </el-table-column>
                            </template>
                          </template>
                        </template>
                      </el-table-column>
                    </template>
                  </template>
                </template>
              </el-table-column>
            </template>
          </template>
        </template>
      </el-table>
    </virtual-scroll>

    <!-- 컨텍스트 메뉴 -->
    <template v-if="headerFilterId">
      <div
        class="context-menu"
        v-show="contextMenuVisible"
        :style="{
          left: contextMenuPosition.x + 'px',
          top: contextMenuPosition.y + 'px',
        }"
      >
        <div class="context-menu-header">열 표시 / 숨김 설정</div>

        <div class="context-menu-content context-menu-group">
          <div
            v-for="col in allColumns"
            :key="col.key"
            class="context-menu-item"
          >
            <el-checkbox
              v-if="
                !col.hidden &&
                col.label &&
                col.key !== 'no' &&
                col.type !== 'checkbox' &&
                !col.children
              "
              v-model="col.visible"
              @change="updateParentVisibility"
            >
              {{ col.label }}
            </el-checkbox>

            <template v-if="col.children">
              <div class="context-menu-parent-item">
                <el-checkbox
                  v-model="col.visible"
                  :indeterminate="isIndeterminate(col)"
                  @change="(val) => handleParentCheckChange(col, val)"
                >
                  <strong>{{ col.label }}</strong>
                </el-checkbox>
              </div>

              <div
                class="context-menu-item context-menu-child-item"
                v-for="childCol in col.children"
                :key="childCol.key"
              >
                <template v-if="!childCol.hidden">
                  <el-checkbox
                    v-model="childCol.visible"
                    :indeterminate="
                      childCol.children && isIndeterminate(childCol)
                    "
                    @change="(val) => handleChildCheckChange(childCol, val)"
                  >
                    {{ childCol.label }}
                  </el-checkbox>
                </template>

                <div
                  class="context-menu-grandchild-items"
                  v-if="childCol.children"
                >
                  <div
                    class="context-menu-item context-menu-grandchild-item"
                    v-for="grandChildCol in childCol.children"
                    :key="grandChildCol.key"
                  >
                    <template v-if="!grandChildCol.hidden">
                      <el-checkbox
                        v-model="grandChildCol.visible"
                        @change="() => updateParentVisibility()"
                      >
                        {{ grandChildCol.label }}
                      </el-checkbox>
                    </template>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* .scroller {
  height: 600px;
  overflow-y: auto;
}

.item {
  height: 60;
  padding: 10px;
}
.table-container {
  position: relative;
}

.context-menu {
  position: absolute;
  min-width: 180px;
  max-height: 300px;
  background: white;
  border: 1px solid var(--border-color-06);
  border-radius: 5px;
  padding: 0px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
}

.context-menu-header {
  padding: 1rem;
  font-size: 1.3rem;
  color: var(--text-color-01);
  letter-spacing: -0.5px;
  border-bottom: 1px solid #e4e7ed;
  font-weight: bold;
  background-color: #f5f5f5;
  position: sticky;
  top: 0;
  z-index: 1;
}

.context-menu-content {
  overflow-y: auto;
  padding: 0px 10px;
  max-height: calc(500px -39px);
}
.context-menu-content::-webkit-scrollbar {
  width: 6px;
}
.context-menu-content::-webkit-scrollbar-thumb {
  background-color: #909090;
  border-radius: 3px;
}
.context-menu-group {
  margin-bottom: 5px;
}
.context-menu-item {
  padding: 1px 0;
  box-shadow: 0 0 0 0;
}
.context-menu-parent-item {
  padding: 4px 0;
  border-top: 1px solid #f0f0f0;
  margin-top: 4px;
}
.context-menu-child-item {
  margin-left: 14px;
}
.context-menu-grandchild-items {
  margin-left: 14px;
  margin-top: 4px;
}
.context-menu-grandchild-item {
  margin-left: 14px;
}

.table-scroll-wrapper {
  overflow-x: auto;
  position: relative;
  width: 100%;
}

::v-deep(.el-table__body-wrapper) {
  overflow-x: visible !important;
} */
</style>
