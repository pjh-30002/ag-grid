<script setup>
import BaseGrid from './components/BaseGrid.vue' // 경로는 실제 위치에 맞게
import { ref } from 'vue'

// 컬럼 예시
const columnDefs = [
  {
    filter: false,
    sortable: false,
    checkboxSelection: true,
    headerCheckboxSelection: true,
    width: 50
  },
  {
    field: 'make',
    headerName: 'Make',
    spanRows: ({ nodeA, nodeB, dataA, dataB }) =>
      nodeA.data.keyData !== undefined &&
      nodeB.data.keyData !== undefined &&
      nodeA.data.keyData === nodeB.data.keyData &&
      dataA === dataB,
    pinned: 'left'
  },
  { field: 'model', headerName: 'Model', editable: true },
  { field: 'price', headerName: 'Price', 
        pinned: 'left' },

  // 3단 헤더 예시
  {
    headerName: "제품정보",
    children: [
      {
        headerName: "상세",
        children: [
          { field: "category", headerName: "카테고리" },
          {
            headerName: "브랜드/코드",
            children: [
              { field: "brand", headerName: "브랜드" , editable: true, cellEditor: 'agSelectCellEditor',  // 에디터 타입 지정
    cellEditorParams: {
      values: ['Toyota', 'Hyundai']
    }},
              { field: "prodCode", headerName: "상품코드" }
            ]
          }
        ]
      }
    ]
  },

  {
    headerName: "Athlete Details",
    children: [
      {
        field: "athlete",
        width: 150,
        suppressSizeToFit: true,
        enableRowGroup: true,
        rowGroupIndex: 0,
      },
      {
        field: "age",
        width: 90,
        minWidth: 75,
        maxWidth: 100,
        enableRowGroup: true,
      },
      {
        field: "country",
        enableRowGroup: true,
      },
      {
        field: "year",
        width: 90,
        enableRowGroup: true,
        pivotIndex: 0,
      },
      { field: "sport", width: 110, enableRowGroup: true },
      {
        field: "gold",
        enableValue: true,
        suppressHeaderMenuButton: true,
        filter: "agNumberColumnFilter",
        aggFunc: "sum",
      },
      {
        field: "silver",
        enableValue: true,
        suppressHeaderMenuButton: true,
        filter: "agNumberColumnFilter",
        aggFunc: "sum",
      },
      {
        field: "bronze",
        enableValue: true,
        suppressHeaderMenuButton: true,
        filter: "agNumberColumnFilter",
        aggFunc: "sum",
      },
      {
        field: "total",
        enableValue: true,
        suppressHeaderMenuButton: true,
        filter: "agNumberColumnFilter",
        aggFunc: "sum",
      },
    ],
  },
];

// 데이터 예시
const rowData = [
  {
    make: "Toyota",
    keyData: 'sss',
    model: "Celica",
    price: 35000,
    category: "승용차",
    brand: "Toyota",
    prodCode: "T-CEL-01",
    athlete: "Michael Phelps",
    age: 23,
    country: "USA",
    year: 2008,
    sport: "Swimming",
    gold: 8,
    silver: 0,
    bronze: 0,
    total: 8
  },
  {
    make: "Toyota",
    keyData: 'sss',
    model: "Celica",
    price: 40000,
    category: "승용차",
    brand: "Toyota",
    prodCode: "T-CEL-01",
    athlete: "Michael Phelps",
    age: 23,
    country: "USA",
    year: 2008,
    sport: "Swimming",
    gold: 8,
    silver: 0,
    bronze: 0,
    total: 8
  },
  {
    make: "Toyota",
    keyData: 'ss',
    model: "Celica",
    price: 40000,
    category: "SUV",
    brand: "Toyota",
    prodCode: "T-CEL-02",
    athlete: "Michael Phelps",
    age: 23,
    country: "USA",
    year: 2008,
    sport: "Swimming",
    gold: 8,
    silver: 0,
    bronze: 0,
    total: 8
  },
  {
    make: "Toyota",
    keyData: 'sss',
    model: "Celica",
    price: 40000,
    category: "승용차",
    brand: "Toyota",
    prodCode: "T-CEL-01",
    athlete: "Michael Phelps",
    age: 23,
    country: "USA",
    year: 2008,
    sport: "Swimming",
    gold: 8,
    silver: 0,
    bronze: 0,
    total: 8
  },
  {
    make: "Toyota",
    keyData: 'sss',
    model: "Celica",
    price: 40000,
    category: "승용차",
    brand: "Toyota",
    prodCode: "T-CEL-01",
    athlete: "Michael Phelps",
    age: 23,
    country: "USA",
    year: 2008,
    sport: "Swimming",
    gold: 8,
    silver: 0,
    bronze: 0,
    total: 8
  },
  {
    make: "Ford",
    model: "Mondeo",
    price: 32000,
    category: "SUV",
    brand: "Ford",
    prodCode: "F-MON-01",
    athlete: "Usain Bolt",
    age: 22,
    country: "Jamaica",
    year: 2008,
    sport: "Athletics",
    gold: 3,
    silver: 0,
    bronze: 0,
    total: 3
  },
  {
    make: "Porsche",
    model: "Boxster",
    price: 72000,
    category: "스포츠카",
    brand: "Porsche",
    prodCode: "P-BOX-01",
    athlete: "Kosuke Kitajima",
    age: 25,
    country: "Japan",
    year: 2008,
    sport: "Swimming",
    gold: 2,
    silver: 0,
    bronze: 0,
    total: 2
  },
  {
    make: "Hyundai",
    model: "Sonata",
    price: 25000,
    category: "승용차",
    brand: "Hyundai",
    prodCode: "H-SON-01",
    athlete: "Natalie Coughlin",
    age: 25,
    country: "USA",
    year: 2008,
    sport: "Swimming",
    gold: 1,
    silver: 2,
    bronze: 3,
    total: 6
  },
  {
    make: "Kia",
    model: "K5",
    price: 23000,
    category: "승용차",
    brand: "Kia",
    prodCode: "K-K5-01",
    athlete: "Leisel Jones",
    age: 22,
    country: "Australia",
    year: 2008,
    sport: "Swimming",
    gold: 1,
    silver: 2,
    bronze: 0,
    total: 3
  },
  {
    make: "Honda",
    model: "Civic",
    price: 21000,
    category: "승용차",
    brand: "Honda",
    prodCode: "H-CIV-01",
    athlete: "Ryan Lochte",
    age: 24,
    country: "USA",
    year: 2008,
    sport: "Swimming",
    gold: 2,
    silver: 0,
    bronze: 2,
    total: 4
  }
  // ... 이하 동일 패턴
];

// mergeKeys, mergeTextFields 등은 필요하면 전달
</script>

<template>
  <BaseGrid
    headerFilterId="demo"
    :header="columnDefs"
    :data="rowData"
    :singleSelect="false"
    @selection-change="rows => console.log('선택 변경:', rows)"
    @cell-click="(...args) => console.log('셀 클릭:', ...args)"
  />
</template>