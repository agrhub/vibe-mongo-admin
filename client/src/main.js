import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import App from './App.vue';
import router from './router';
import './assets/index.css';

import { i18n } from './locales';
import { pinia, store } from './stores';

// Initialize Theme
store.initTheme();

const app = createApp(App);
app.use(pinia);

// Register all Element Plus icons globally
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.use(i18n);
app.use(ElementPlus);
app.use(router);

app.mount('#app');
