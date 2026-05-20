import { defineStore, createPinia } from 'pinia';
import { ref, reactive, watch, computed } from 'vue';
import axios from 'axios';
import { i18n } from '../locales/index.js';

axios.defaults.withCredentials = true;

// Create Pinia instance
export const pinia = createPinia();

export const useAppStore = defineStore('app', {
  state: () => ({
    // Connection & Navigation States
    connections: {},
    activeConnection: '',
    activeDb: '',
    activeColl: '',
    sidebarList: {},
    locales: {},
    activeLocale: 'en',
    loggedIn: false,
    passwordRequired: false,
    loading: false,
    theme: 'system',

    // New globally managed database, collections, users, and backups states
    databasesList: [],
    collectionsList: [],
    usersList: [],
    backupsList: [],
    serverInfo: null
  }),

  actions: {
    // Translation helper proxy to vue-i18n
    t(key) {
      if (!key) return '';
      try {
        return i18n.global.t(key);
      } catch (e) {
        return key;
      }
    },

    async fetchAuthStatus() {
      try {
        const res = await axios.get('/api/auth/status');
        this.loggedIn = res.data.loggedIn;
        this.passwordRequired = res.data.passwordRequired;
        return res.data;
      } catch (e) {
        console.error('Error fetching auth status:', e);
        // Secure fallback: if auth check fails, assume password is required
        this.passwordRequired = true;
        this.loggedIn = false;
        return { passwordRequired: true, loggedIn: false };
      }
    },

    async login(password) {
      try {
        await axios.post('/api/auth/login', { password });
        this.loggedIn = true;
        return { success: true };
      } catch (e) {
        const msg = e.response && e.response.data && e.response.data.msg
          ? e.response.data.msg
          : 'Error logging in';
        return { success: false, msg };
      }
    },

    async logout() {
      try {
        await axios.post('/api/auth/logout');
        this.loggedIn = false;
        return { success: true };
      } catch (e) {
        console.error('Error logging out:', e);
        return { success: false };
      }
    },

    async fetchLocales() {
      // Locales are now statically bundled with vite in i18n.js
      // Just sync the activeLocale state with cookies/localStorage
      const savedLocale = localStorage.getItem('vibe_mongo_locale');
      if (savedLocale) {
        this.activeLocale = savedLocale;
        i18n.global.locale.value = savedLocale;
      } else {
        this.activeLocale = 'en';
        i18n.global.locale.value = 'en';
      }
      document.cookie = `vibe_mongo_locale=${this.activeLocale}; path=/; max-age=31536000; SameSite=Lax`;
    },

    setLocale(locale) {
      this.activeLocale = locale;
      i18n.global.locale.value = locale;
      localStorage.setItem('vibe_mongo_locale', locale);
      // Save cookie so Express backend receives it automatically (if ever needed)
      document.cookie = `vibe_mongo_locale=${locale}; path=/; max-age=31536000; SameSite=Lax`;
    },

    async fetchConnections() {
      try {
        const res = await axios.get('/api/connections');
        this.connections = res.data.connections || {};
      } catch (e) {
        console.error('Error fetching connections:', e);
      }
    },

    async fetchSidebar() {
      if (!this.activeConnection) return;
      try {
        const res = await axios.get(`/api/${this.activeConnection}/sidebar`);
        this.sidebarList = res.data.sidebar_list || {};
      } catch (e) {
        console.error('Error fetching sidebar list:', e);
      }
    },

    setConnection(connName) {
      if (this.activeConnection !== connName) {
        this.activeConnection = connName;
        this.activeDb = '';
        this.activeColl = '';
        this.sidebarList = {};
        this.fetchSidebar();
      }
    },

    setDatabase(dbName) {
      this.activeDb = dbName;
      this.activeColl = '';
    },

    setCollection(collName) {
      this.activeColl = collName;
    },

    initTheme() {
      this.theme = localStorage.getItem('vibe_mongo_theme') || 'system';
      this.applyTheme();

      // Listen for system theme changes
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.removeEventListener('change', this._themeListener);
      this._themeListener = () => {
        if (this.theme === 'system') {
          this.applyTheme();
        }
      };
      mediaQuery.addEventListener('change', this._themeListener);
    },

    setTheme(theme) {
      this.theme = theme;
      localStorage.setItem('vibe_mongo_theme', theme);
      this.applyTheme();
    },

    applyTheme() {
      const resolvedTheme = this.theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : this.theme;

      if (resolvedTheme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
      }
    }
  }
});

// Instance store proxy to support 100% backward compatibility with active components
export const store = useAppStore(pinia);

// Setup interceptors to handle 401 Unauthorized globally
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      store.loggedIn = false;
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
