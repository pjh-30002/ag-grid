import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

import { AllCommunityModule, ModuleRegistry,provideGlobalGridOptions, themeQuartz } from 'ag-grid-community'; 

// Mark all grids as using legacy themes
// themeQuartz + 커스텀
const myTheme = themeQuartz.withParams({
  accentColor: "#087AD1",
  backgroundColor: "#FFFFFF",
  borderColor: "#D7E2E6",
  borderRadius: 2,
  browserColorScheme: "light",
  cellHorizontalPaddingScale: 0.7,
  chromeBackgroundColor: { ref: "backgroundColor" },
  columnBorder: false,
  fontFamily: { googleFont: "Roboto" },
  fontSize: 11,
  foregroundColor: "#555B62",
  headerBackgroundColor: "#FFFFFF",
  headerFontFamily: { googleFont: "Roboto" },
  headerFontSize: 13,
  headerFontWeight: 500,
  headerTextColor: "#84868B",
  rowBorder: true,
  rowVerticalPaddingScale: 0.8,
  sidePanelBorder: true,
  spacing: 4,
  wrapperBorder: false,
  wrapperBorderRadius: 2
})

provideGlobalGridOptions({ theme: myTheme });
// Register all Community features
ModuleRegistry.registerModules([AllCommunityModule]);
const app = createApp(App)
const pinia = createPinia()
app.use(pinia)          // ← 이게 반드시 있어야 함!
app.mount('#app')
