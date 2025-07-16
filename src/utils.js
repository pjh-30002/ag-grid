///// utils.js
// import * as XLSX from 'xlsx-js-style';
import dayjs from "dayjs";

const commonFont = { name: "Arial", size: 10, bold: false };
const headerFont = { name: "Arial", size: 10, bold: true };

/**
 * 데이터 값 확인
 * @param value
 * @returns 값이 없을 시 true, 있을 시 false 리턴
 */
export const isEmpty = (value) => {
  const obj = String(value);

  if (
    obj == null ||
    obj == undefined ||
    obj == "null" ||
    obj == "undefined" ||
    obj == "" ||
    obj == "NaN"
  ) {
    return true;
  } else {
    return false;
  }
};

/**
 * checkBox 전체 선택 및 해제
 * @param {object} options 체크박스 옵션
 * @returns 체크박스 전체 선택 및 해제 시 사용되는 데이터
 */

export const useCheckboxGroup = (options) => {
  const checkAll = ref(false);
  const checkedOptions = ref([]);

  const handleCheckAllChange = (val) => {
    if (val) {
      options.value.forEach((item) => {
        if (!item.disabled) checkedOptions.value.push(item.value);
      });
    } else {
      checkedOptions.value = [];
    }
  };

  const handleCheckedOptionsChange = (value) => {
    const checkedCount = options.value.filter((item) => !item.disabled).length;
    if (value.length === checkedCount) checkAll.value = true;
    else checkAll.value = false;
  };

  return {
    checkAll,
    checkedOptions,
    handleCheckAllChange,
    handleCheckedOptionsChange,
  };
};
/**
 * checkBox 단일 선택
 * @returns 체크박스 단일 데이터 선택 시
 */

export const useSingleCheckbox = () => {
  const selectedValue = ref([]);

  const handleCheckboxChange = (value) => {
    selectedValue.value = [value[value.length - 1]];
  };

  return {
    selectedValue,
    handleCheckboxChange,
  };
};

/**
 * 최대 헤더 깊이를 재귀적으로 계산 (header.visible===false 또는 header.excel===false인 경우 건너뜀)
 * (엑셀다운로드 함수내에서 사용)
 * @param {*} headers
 * @param {*} depth
 * @returns
 */
const getMaxDepth = (headers, depth = 1) => {
  let max = depth;
  headers.forEach((header) => {
    if (header.excel === false) return;
    if (header.children && header.children.length > 0) {
      max = Math.max(max, getMaxDepth(header.children, depth + 1));
    }
  });
  return max;
};

/**
 * 해당 헤더의 leaf(최종 칼럼) 개수 계산
 * (엑셀다운로드 함수내에서 사용)
 * @param {*} headers
 * @returns
 */
const getLeafCount = (header) => {
  if (!header.children || header.children.length === 0) {
    return 1;
  }
  let count = 0;
  header.children.forEach((child) => {
    if (child.visible === false || child.excel === false) return;
    count += getLeafCount(child);
  });
  return count;
};

/**
 * 헤더 정보를 재귀적으로 순회하여 각 셀의 할당 영역 정보를 생성
 * (엑셀다운로드 함수내에서 사용)
 * @param {*} headers
 * @param {*} row
 * @param {*} startCol
 * @param {*} maxRow
 * @param {*} headerCells
 * @param {*} leafHeaders
 * @param {*} currentDepth
 * @param {*} parentStartCol
 * @returns
 */
const processHeaders = (
  headers,
  row,
  startCol,
  maxRow,
  headerCells,
  leafHeaders,
  currentDepth = 1,
  parentStartCol = null
) => {
  let colIndex = startCol;
  headers.forEach((header, headerIndex) => {
    if (header.visible === false || header.excel === false) return;
    const isLeaf = !header.children || header.children.length === 0;
    const leafCount = getLeafCount(header);
    // 기본: 자식이 없으면 할당 영역은 (maxRow - row + 1)행, 자식이 있으면 1행만 사용
    const rowSpan = isLeaf ? maxRow - row + 1 : 1;

    // 그룹 시작 여부 결정 (2단계 이상에서 유용)
    const isGroupStart = parentStartCol === null || colIndex === parentStartCol;

    const cellInfo = {
      label: header.label,
      row: row,
      startCol: colIndex,
      endCol: colIndex + leafCount - 1,
      rowSpan: rowSpan,
      width: header.width,
      align: header.align || "left",
      depth: currentDepth,
      isLeaf: isLeaf,
      isGroupStart: isGroupStart,
    };
    headerCells.push(cellInfo);
    if (!isLeaf) {
      processHeaders(
        header.children,
        row + 1,
        colIndex,
        maxRow,
        headerCells,
        leafHeaders,
        currentDepth + 1,
        colIndex
      );
    } else {
      leafHeaders.push(header);
    }
    colIndex += leafCount;
  });
};

/**
 * 0이상 최대 999범위의 정수를 한글로 읽어준다
 * 예 : 0->"영" 5->"오" 12->"십이" 5400=>"오천사백"
 */
const numberToKorean = (num) => {
  const digits = ["영", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
  const units = ["", "십", "백", "천"];
  const s = String(num);
  let res = "";
  for (let i = 0; i < s.length; i++) {
    const d = Number(s[s.length - 1 - i]);
    if (d === 0) continue;
    const kor = digits[d];
    const unit = units[i];
    res = (kor === "일" && unit === "십" ? unit : kor + unit) + res;
  }
  return res || digits[0];
};

/**
 * 숫자를 억/만 단위로 한글 읽기 (소수점 이하 최대 3자리)
 * @param {number|string} input 예 : 123.4567
 * @returns {string} 예 : "일백이십삼억사천오백육십만"
 */
export const numToKorean = (input) => {
  const num = typeof input === "string" ? parseFloat(input) : input;

  if (isNaN(num)) return "";
  // 1) 억 단위
  const eokNum = Math.floor(num);
  const eokKor = numberToKorean(eokNum) + "억";

  // 2) 만 단위 (소수부 최대 3자리)
  const manNum = Math.round((num - eokNum) * 10000);
  let manKor = "";
  if (manNum > 0) {
    manKor = numberToKorean(manNum) + "만";
    ("");
  }
  return eokKor + manKor + "원";
};

/**
 * 엑셀 파일 생성 및 다운로드
 * 제목 영역은 2~3행에 병합, 헤더는 5행, 데이터는 6행부터 출력
 * @param {Object} gridObj - { header: [...], data: [...] }
 * @param {string} fileName - 예: "export.xlsx" (확장자 포함)
 * @param {string} title - 2~3행에 출력될 제목
 * @param {number} titleIndex - 제목 영역의 시작 위치 (0이면 A2:B3, 1이면 B2:C3, …)
 */
export const gridExcelDown = async (
  gridObj,
  fileName,
  title,
  titleIndex = 0
) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sheet1");

  // [A] 제목 영역: 2~3행에 병합하여 출력
  const titleStartCol = titleIndex + 1;
  const titleEndCol = titleStartCol + 1;
  worksheet.mergeCells(2, titleStartCol, 3, titleEndCol);
  const titleCell = worksheet.getCell(2, titleStartCol);
  titleCell.value = title;
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.font = commonFont;
  const titleBorderStyle = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };
  applyBorderToMergedCells(
    worksheet,
    2,
    titleStartCol,
    3,
    titleEndCol,
    titleBorderStyle
  );

  // [B] 헤더 영역: 5행부터 시작 (병합 적용)
  const headerStartRow = 5;
  const headerTreeDepth = getMaxDepth(gridObj.header);
  const absoluteHeaderMaxRow = headerStartRow + headerTreeDepth - 1;
  const headerCells = [];
  const leafHeaders = [];
  processHeaders(
    gridObj.header,
    headerStartRow,
    1,
    absoluteHeaderMaxRow,
    headerCells,
    leafHeaders
  );
  for (let r = headerStartRow; r <= absoluteHeaderMaxRow; r++) {
    worksheet.getRow(r);
  }
  headerCells.forEach((cellInfo) => {
    const cell = worksheet.getCell(cellInfo.row, cellInfo.startCol);
    cell.value = cellInfo.label;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFCCFFFF" },
    };
    cell.font = commonFont;
    const borderStyle = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
    cell.border = borderStyle;
    if (cellInfo.rowSpan > 1 || cellInfo.endCol > cellInfo.startCol) {
      worksheet.mergeCells(
        cellInfo.row,
        cellInfo.startCol,
        cellInfo.row + cellInfo.rowSpan - 1,
        cellInfo.endCol
      );
      applyBorderToMergedCells(
        worksheet,
        cellInfo.row,
        cellInfo.startCol,
        cellInfo.row + cellInfo.rowSpan - 1,
        cellInfo.endCol,
        borderStyle
      );
    }
  });
  leafHeaders.forEach((header, index) => {
    const col = worksheet.getColumn(index + 1);
    if (header.width) {
      const widthPx = parseInt(header.width, 10);
      col.width = Math.floor(widthPx / 10);
    } else {
      col.width = 30;
    }
  });
  // [C] 데이터 영역: 헤더 영역 아래 (absoluteHeaderMaxRow + 1행부터)
  gridObj.data.forEach((dataItem) => {
    const rowValues = [];

    leafHeaders.forEach((header) => {
      if (header.key in dataItem) {
        if (header.type === "button" || header.type === "icon") {
          rowValues.push("");
        } else if (header.type === "selectbox") {
          const result = header.list.filter(
            (item) => item.value !== "" && item.value === dataItem[header.key]
          );
          if (result.length > 0) {
            rowValues.push(result[0].label);
          } else {
            rowValues.push("");
          }
        } else if (dataItem[header.key]) {
          rowValues.push(dataItem[header.key]);
        } else {
          rowValues.push("");
        }
      } else {
        rowValues.push("");
      }
    });

    const row = worksheet.addRow(rowValues);
    row.eachCell((cell, colNumber) => {
      const header = leafHeaders[colNumber - 1];
      cell.alignment = {
        horizontal: header.align || "left",
        vertical: "middle",
      };
      cell.font = commonFont;
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    fileName
  );
};

/**
 * 엑셀 파일 생성 및 다운로드
 * 제목 영역은 없음, 헤더는 2행, 데이터는 3행부터 출력
 * 그리드 객체가 여러개인 경우 한칸 간격을 주고 출력
 * @param {Array} gridObjList - 예: [gridObj, gridObj]
 * @param {string} fileName - 예: "export.xlsx" (확장자 포함)
 */
export const multiGridExcelDown = async (gridObjList, fileName) => {
  if (!fileName.toLowerCase().endsWith(".xlsx")) {
    fileName += ".xlsx";
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sheet1");

  const printedDepth1Labels = new Set();
  let currentRow = 2; // 1행은 항상 빈 행

  for (const gridObj of gridObjList) {
    const headerStartRow = currentRow;
    const headerTreeDepth = getMaxDepth(gridObj.header);
    const absoluteHeaderMaxRow = headerStartRow + headerTreeDepth - 1;
    const headerCells = [];
    const leafHeaders = [];

    processHeaders(
      gridObj.header,
      headerStartRow,
      1,
      absoluteHeaderMaxRow,
      headerCells,
      leafHeaders
    );

    // header 스타일
    const depth2GroupStarts = new Map();
    headerCells
      .filter((cell) => cell.depth === 2 && !cell.isLeaf)
      .forEach((cell) => {
        const key = `${cell.label}_${cell.row}`;
        if (
          !depth2GroupStarts.has(key) ||
          depth2GroupStarts.get(key) > cell.startCol
        ) {
          depth2GroupStarts.set(key, cell.startCol);
        }
      });

    // 헤더 출력
    for (let r = headerStartRow; r <= absoluteHeaderMaxRow; r++) {
      worksheet.getRow(r);
    }

    const depth1Printed = new Set();

    headerCells.forEach((cellInfo) => {
      const bottomRow = cellInfo.row + cellInfo.rowSpan - 1;
      for (let r = cellInfo.row; r < cellInfo.row + cellInfo.rowSpan; r++) {
        for (let c = cellInfo.startCol; c <= cellInfo.endCol; c++) {
          const cell = worksheet.getCell(r, c);
          let text = "";

          if (cellInfo.depth === 1) {
            const centerRow =
              cellInfo.rowSpan % 2 === 1
                ? cellInfo.row + Math.floor(cellInfo.rowSpan / 2)
                : bottomRow;
            if (r === centerRow && !depth1Printed.has(cellInfo.label)) {
              text = cellInfo.label;
              depth1Printed.add(cellInfo.label);
            }
          } else if (cellInfo.depth === 2) {
            if (!cellInfo.isLeaf) {
              const key = `${cellInfo.label}_${cellInfo.row}`;
              const groupStartCol = depth2GroupStarts.get(key);
              text =
                r === cellInfo.row && c === groupStartCol ? cellInfo.label : "";
            } else {
              text = r === cellInfo.row ? cellInfo.label : "";
            }
          } else if (cellInfo.depth >= 3) {
            if (cellInfo.isLeaf && r === cellInfo.row) {
              text = cellInfo.label;
            }
          }

          cell.value = text;
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFC0C0C0" },
          };
          cell.font = headerFont;
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        }
      }
    });

    // 컬럼 너비
    leafHeaders.forEach((header, index) => {
      const col = worksheet.getColumn(index + 1);
      if (header.width) {
        const widthPx = parseInt(header.width, 10);
        col.width = Math.floor(widthPx / 14);
      } else {
        col.width = 10;
      }
    });

    // 데이터 출력
    gridObj.data.forEach((dataItem) => {
      const rowValues = [];
      leafHeaders.forEach((header) => {
        if (header.key in dataItem) {
          if (header.key === "deptHeadNm") {
            debugger;
          }
          if (header.type === "button" || header.type === "icon") {
            rowValues.push("");
          } else if (header.type === "selectbox") {
            const result = header.list.filter(
              (item) => item.value !== "" && item.value === dataItem[header.key]
            );
            if (result.length > 0) {
              rowValues.push(result[0].label);
            } else {
              rowValues.push("");
            }
          } else if (dataItem[header.key]) {
            rowValues.push(dataItem[header.key]);
          } else {
            rowValues.push("");
          }
        } else {
          rowValues.push("");
        }
      });
      const row = worksheet.addRow(rowValues);
      row.eachCell((cell, colNumber) => {
        const header = leafHeaders[colNumber - 1];
        cell.alignment = {
          horizontal: header.align || "left",
          vertical: "middle",
        };
        cell.font = commonFont;
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    // 다음 테이블 시작 위치: 마지막 데이터 행 + 2 (빈 줄 하나 삽입)
    currentRow = worksheet.lastRow.number + 2;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    fileName
  );
};

// [FUNC] 그리드가 Real Index를 볼 수 있도록 개선
const getRealIndex = (gridData, row, rowKey = "id") => {
  return gridData.findIndex((item) => item[rowKey] === row[rowKey]);
};

/**
 * 그리드 데이터 행병합
 * @param {Object} gridObj      헤더, 데이터를 포함한 그리드 객체
 * @param {Object} {}           그리드 row, column을 포함한 객체
 * @returns {Object} rowMerge
 */
export const rowMerge = (
  gridObj,
  { row, column, rowIndex, columnIndex },
  mergeKey
) => {
  const prop = column.property;

  const realIndex = getRealIndex(gridObj.data, row, "id");
  let currentColumn;
  if (column.type === "default" || column.type === "button") {
    column.type === "button"
      ? (currentColumn = findColumnByProp(gridObj, prop))
      : (currentColumn = gridObj.header.find((col) => col.key === ""));
    if (currentColumn && currentColumn.merge === true) {
      // 첫 번째 행이거나 현재 mergeKey값이 다를때
      if (
        realIndex === 0 ||
        gridObj.data[realIndex][mergeKey] !==
          gridObj.data[realIndex - 1][mergeKey]
      ) {
        // 아래로 몇 개의 행을 병합할지 계산
        let rowspan = 1;

        // 부모 칼럼이 있는 경우 부모 값도 체크
        const parentProp = currentColumn.mergeParent;

        for (let i = realIndex + 1; i < gridObj.data.length; i++) {
          // MergeKey가 있을경우
          const sameKey =
            !mergeKey ||
            gridObj.data[i][mergeKey] === gridObj.data[realIndex][mergeKey];
          if (sameKey) {
            rowspan++;
          } else {
            break;
          }
        }

        if (rowspan > 1) {
          return { rowspan, colspan: 1 };
        }
      } else {
        return { rowspan: 0, colspan: 0 };
      }
    }

    return { rowspan: 1, colspan: 1 };
  } else {
    currentColumn = findColumnByProp(gridObj, prop);
    // merge: true 속성이 있는 칼럼인 경우에만 병합 처리
    if (currentColumn && currentColumn.merge === true) {
      // 첫 번째 행이거나 현재 mergeKey값이 다를때
      if (
        realIndex === 0 ||
        gridObj.data[realIndex][mergeKey] !==
          gridObj.data[realIndex - 1][mergeKey]
      ) {
        // 아래로 몇 개의 행을 병합할지 계산
        let rowspan = 1;

        // 부모 칼럼이 있는 경우 부모 값도 체크
        const parentProp = currentColumn.mergeParent;

        for (let i = realIndex + 1; i < gridObj.data.length; i++) {
          // 현재 속성 값이 같아야 함
          const sameValue =
            gridObj.data[i][prop] === gridObj.data[realIndex][prop];

          // 부모 속성이 지정된 경우, 부모 값도 같아야 함
          const sameParent =
            !parentProp ||
            gridObj.data[i][parentProp] === gridObj.data[realIndex][parentProp];

          // MergeKey가 있을경우
          const sameKey =
            !mergeKey ||
            gridObj.data[i][mergeKey] === gridObj.data[realIndex][mergeKey];
          if (sameValue && sameParent && sameKey) {
            rowspan++;
          } else {
            break;
          }
        }

        if (rowspan > 1) {
          return { rowspan, colspan: 1 };
        }
      } else if (
        realIndex === 0 ||
        gridObj.data[realIndex][prop] !== gridObj.data[realIndex - 1][prop]
      ) {
        // 아래로 몇 개의 행을 병합할지 계산
        let rowspan = 1;

        // 부모 칼럼이 있는 경우 부모 값도 체크
        const parentProp = currentColumn.mergeParent;

        for (let i = realIndex + 1; i < gridObj.data.length; i++) {
          // 현재 속성 값이 같아야 함
          const sameValue =
            gridObj.data[i][prop] === gridObj.data[realIndex][prop];

          // 부모 속성이 지정된 경우, 부모 값도 같아야 함
          const sameParent =
            !parentProp ||
            gridObj.data[i][parentProp] === gridObj.data[realIndex][parentProp];

          if (sameValue && sameParent) {
            rowspan++;
          } else {
            break;
          }
        }

        if (rowspan > 1) {
          return { rowspan, colspan: 1 };
        }
      } else {
        // 이전 행과 값이 같으면 (이미 병합된 부분)
        // 부모 칼럼이 있는 경우 부모 값도 체크
        const parentProp = currentColumn.mergeParent;
        const sameParent =
          !parentProp ||
          gridObj.data[realIndex][parentProp] ===
            gridObj.data[realIndex - 1][parentProp];
        const samePrevKey =
          !mergeKey ||
          gridObj.data[realIndex][mergeKey] ===
            gridObj.data[realIndex - 1]?.[mergeKey];
        if (
          gridObj.data[realIndex][prop] ===
            gridObj.data[realIndex - 1]?.[prop] &&
          sameParent &&
          samePrevKey
        ) {
          return { rowspan: 0, colspan: 0 };
        }
      }
    }

    return { rowspan: 1, colspan: 1 };
  }
};

/**
 * key로 column찾기
 * ($utils.rowMerge() 내에서 사용)
 * @param {Object} gridObj
 * @param {Object} key
 * @returns {Object} column
 */
const findColumnByProp = (gridObj, key) => {
  // 1단 헤더에서 찾기
  const flatColumn = gridObj.header.find(
    (col) => col.key === key && !col.children
  );
  if (flatColumn) return flatColumn;

  // 2단, 3단 헤더에서 재귀적으로 찾기
  for (const parentCol of gridObj.header) {
    if (parentCol.children) {
      for (const childCol of parentCol.children) {
        // 2단 헤더에서 찾기
        if (childCol.key === key) return childCol;

        // 3단 헤더에서 찾기
        if (childCol.children) {
          const grandChildCol = childCol.children.find((gc) => gc.key === key);
          if (grandChildCol) return grandChildCol;
        }
      }
    }
  }

  return null;
};

/**
 * GridHeader 매핑
 * @param {*} key
 * @param {*} labelCd
 * @param {*} children
 * @param {*} type
 * @param {*} width
 * @param {*} sortable
 * @param {*} visible
 * @param {*} align
 * @param {*} edit
 * @param {*} fixed
 * @param {*} list
 * @returns GridData
 */

const gridHrdDefaultOptions = {
  width: null,
  align: "center",
  sortable: false,
  visible: true,
  edit: false,
  fixed: false,
  list: undefined,
  merge: false,
  hidden: false,
  excel: true,
  filterable: false,
  disabled: false,
  require: false,
  trueValue: true,
  falseValue: false,
  rowNum: 1,
  inputType: "text",
  color: "",
  cellEditor: null,
  spanKey: null,
  spanRows: null,
  valueFormatter: null,
  valueParser: undefined,
};

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
export const gridHdrMpng = (
  key,
  labelCd = [],
  type = "",
  children = "",
  options = {}
  // width = null,
  // sortable = false,
  // align = 'center',
  // visible = true,
  // edit = false,
  // fixed = false,
  // list = null,
  // merge,
  // hidden,
  // excel
) => {
  const config = { ...gridHrdDefaultOptions, ...options };

  // const comStore = useComStore();
  let label;

  if (typeof labelCd === "string") {
    label = labelCd;
  } else {
    // labelCd = labelCd.map((col) => comStore.t(col));
    label = labelCd.join("");
  }

  // 키를 가지고 있을때 머지 조건
  const customKeySpanFunc = ({ nodeA, nodeB, dataA, dataB }) => {
    return (
      nodeA.data[config.spanKey] !== undefined &&
      nodeB.data[config.spanKey] !== undefined &&
      nodeA.data[config.spanKey] === nodeB.data[config.spanKey] &&
      dataA === dataB
    );
  };
  // 키가 없을때 머지 조건
  const customSpanFunc = ({ nodeA, nodeB, valueA, valueB }) => {
    return valueA === valueB;
  };

  const cellDataType =
    type === "year" || type === "years"
      ? "yearOnly"
      : type === "month" || type === "months"
      ? "monthOnly"
      : type === "day" || type === "days"
      ? "dayOnly"
      : type === "datetime" || type === "datetimes"
      ? "dateTimeString"
      : "dateString";
  /////////////////////

  // Cell Edit 함수에 인입용
  // AG-Grid에서 제공하는것은 CellEditor의 형태로 나머지는 컴포넌트를 직접 짜야함
  const cellEditor =
    type === "selectbox"
      ? "agSelectCellEditor"
      : type === "number"
      ? "agNumberCellEditor"
      : type === "textarea" || config.inputType === "textarea"
      ? "agLargeTextCellEditor"
      : datePickerType.includes(type)
      ? "agDateCellEditor"
      : "agTextCellEditor";

  const selectValueList = config.list
    ? config.list.map((item) => item.value)
    : [];
  const columnOptions = {
    field: type === "checkbox" ? "" : key,
    headerName: label,
    filter: datePickerType.includes(type)
      ? "agDateColumnFilter"
      : config.filterable,
    cellDataType: datePickerType.includes(type) ? cellDataType : null,
    sortable: config.sortable,
    checkboxSelection: type === "checkbox",
    headerCheckboxSelection: type === "checkbox",
    width: config.width,
    editable: config.edit,
    cellEditor: cellEditor,
    cellEditorParams: {
      values: selectValueList, // 실제 value만 전달
      includeTime: type === "datetime" ? true : false,
    },
    hide: !config.visible,
    // cellEditorParams:
    //   type === "selectbox"
    //     ? {
    //         values: selectValueList,
    //       }
    //     : undefined, // Select 들어온것중 value만 매핑해서 사용 enter꺼인데 나중에 추후 확인
    pinned: config.fixed ? "left" : "",
    // disabled: config.disabled,
    suppressSizeToFit: true, // if you want this column's width to be fixed during 'size to fit' operations.
    spanRows: !config.merge
      ? null
      : config.spanKey === null
      ? customSpanFunc
      : customKeySpanFunc,
    children: children === "" || children === null ? undefined : children, // 그룹 헤더 설정
    // key: key,
    // label: label,
    // type: type,
    // children: children,
    // align: config.align,
    // visible: config.visible,
    // disabled: config.disabled,
    // list: config.list,
    // merge: config.merge,
    // rowNum: config.rowNum,
    // hidden: config.hidden,
    // excel: config.excel,
    // require: config.require,
    // inputType: config.inputType,
    // trueValue: config.trueValue,
    // falseValue: config.falseValue,
    // color: config.color,
  };
  if (!datePickerType.includes(type)) {
    console.log(type);
    // Date Type의 경우 따로 Grid에서 옵션을 주고있어서 컬럼에서 Formatter가 들어가면 안됨
    columnOptions.valueFormatter = config.valueFormatter;
  }

  return columnOptions;
};

/**
 * time 값 Format 설정
 * @param {*} data
 * @param {*} form // 형식
 * @param {*} fallback // 실패처리
 * @returns Change Form Time Data
 */

export const chgTimeForm = (data, form = "YYYYMMDD", fallback = "") => {
  if (!data) return fallback;
  const parsed = dayjs(data);
  if (!parsed.isValid()) return fallback;

  return parsed.format(form) || "";
};

/**
 * GridData Key "id" 추가
 * @param {*} data
 * @returns GridData
 */

export const gridDataIndexing = (data) => {
  if (data === null || data === undefined) {
    return [];
  } else {
    if (data.length > 0) {
      data.forEach((item, idx) => {
        item["id"] = idx + 1;
      });
    }
    return data;
  }
};

/**
 * text 파일 생성 및 다운로드
 * @param {Object} gridData - { gridObj.data }
 * @param {string} fileName - 예: "test.text" (확장자 포함)
 */
export const gridTextDownload = (data, filename) => {
  if (!data.length) return;
  const rows = data.map((row) => Object.values(row).join(" "));

  const textContent = rows.join("\n");

  const blob = new Blob([textContent], { type: "text/plain;charset=utf-8;" });
  saveAs(blob, filename);
};

/**
 * Html Decode 함수
 * @param {string} val html
 * @returns html 디코드 추출
 */
// [Func] html 디코드
export const htmlDecode = (val) => {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = val;
  return textarea.value;
};

/**
 * 사업자번호 폼 변환
 * @param {string} val 사업자번호
 * @returns 사업자번호 XXX-XX-XXXXX 형식으로 변경
 */
// [Func] html 디코드
export const chgBiznoForm = (val) => {
  // 숫자만 남기기
  const digits = String(val)
    .replace(/\D/g, "")
    .replace(/^(\d{3})(\d{2})(\d{5})$/, "$1-$2-$3");

  return digits;
};

/**
 * 현재 분기를 반환
 * @param
 * @returns {Number} 분기
 */
export const getCurrentQuarter = () => {
  const month = dayjs().month() + 1;
  if (month >= 1 && month <= 3) return 1;
  if (month >= 4 && month <= 6) return 2;
  if (month >= 7 && month <= 9) return 3;
  return 4;
};

/**
 * 현재 반기를 반환
 * @param
 * @returns {Number} 반기
 */
export const getCurrentHalf = () => {
  const month = dayjs().month() + 1;
  if (month >= 1 && month <= 6) return 1;
  return 2;
};

/**
 * 객체 데이터 세팅 (기존 데이터는 삭제)
 * @param {Object} obj
 * @param {Object} newObj
 *
 * 예시) const form = reactive({});
 *       $utils.setObj(form, res.data);
 */
export const setObj = (obj, newObj = {}) => {
  for (const key in obj) {
    delete obj[key];
  }

  Object.assign(obj, newObj);
};

/**
 * 객체 데이터 세팅 (해당 키에 맞는 데이터만 세팅)
 * @param {Object} obj
 * @param {Object} newObj
 *
 * 예시) const form = reactive({});
 *       $utils.setObj(form, res.data);
 */
export const setKeyObj = (obj, newObj = {}) => {
  for (const key in newObj) {
    if (obj.hasOwnProperty(key)) obj[key] = newObj[key];
  }
};

/**
 * 그리드 합계 footer
 * @param {string} 그리드 columns, data 리스트
 * @returns 각 row별 합계
 */

export const getSummary = (params, gridData) => {
  const cols = [];
  const data = gridData;
  const sums = new Array(cols.length).fill("");

  // 자식 노드가 있을 경우 컬럼 재정렬
  params.forEach((item) => {
    if (item.children) {
      item.children.forEach((item2) => {
        cols.push(item2);
      });
    } else {
      cols.push(item);
    }
  });

  cols.forEach((col, idx) => {
    // 합계 title 지정
    if (idx === 0) {
      sums[idx] = h("div", ["총 합계"]);
      return;
    }

    // col type이 sum일 경우에만 합계 계산 진행
    if (col.type === "sum") {
      const values = data
        //subTotal 사용시 제외하고 합계 계산
        .filter((row) => row.id !== "subTotal")
        .map((item) => Number(item[col.key]));

      if (!values.every((value) => isNaN(value))) {
        const total = values.reduce((prev, curr) => {
          const value = Number(curr);
          return isNaN(value) ? prev : prev + value;
        }, 0);

        // 숫자 포맷팅
        sums[idx] = `${stringUtils.formatComma(total)}`;
      }
    } else {
      sums[idx] = "";
    }
  });
  return sums;
};

/**
 * 숫자만 남도록 (Float 형태)
 * @param {string} 숫자 (문자도 가능하나 쵲오적으로 숫자로 return)
 * @returns 숫자
 */
export const extractNumber = (input) => {
  // \d+ 하나이상의 숫자
  // (?: 소수점 이하가 있을 수도 있고 없을 수 도 있다
  // \.\d+ '.' 뒤에 하나 이상의 숫자
  // )? 위 그룹 전체가 0번 또는 1번 등장
  const regexp = /\d+(?:\.\d+)?/;
  const match = input.match(regexp);
  return match ? Number(match[0]) : null;
};

/**
 * 숫자 형태의 평가율(rate)을 지정한 소수점 자리수까지 포맷하여
 * 퍼센트(%) 문자열로 반환합니다.
 * rate가 null 또는 undefined일 경우 공란 문자열('    ')을 반환합니다.
 *
 * @param {number|null|undefined} rate - 평가율 숫자 값 (null 가능)
 * @param {number} [decimalPlaces=2] - 표시할 소수점 자리수 (기본 2자리)
 * @returns {string} - 포맷된 평가율 문자열 (예: "12.5%"), null일 땐 공란
 */
export const formatRate = (rate, decimalPlaces = 2) => {
  if (rate == null) return "    "; // null 또는 undefined면 공란

  const fixed = Number(rate).toFixed(decimalPlaces);
  const trimmed = fixed.replace(/\.?0+$/, "");

  return `${trimmed}%`;
};
