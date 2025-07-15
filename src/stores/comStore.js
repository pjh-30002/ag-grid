// src/stores/comStore.js
import { defineStore } from 'pinia';

export const useComStore = defineStore('com', {
  state: () => ({
    getHeaderFilterState: '',  // JSON string of header visibility state
    getCurTab: '/guideGrid'    // current tab path
  }),
  actions: {
    setHeaderFilterState(state) {
      this.getHeaderFilterState = JSON.stringify(state);
    }
  }
});
