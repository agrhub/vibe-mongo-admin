<template>
  <div class="app-wrapper">
    <!-- Full-screen login layout -->
    <template v-if="$route.name === 'Login'">
      <router-view />
    </template>

    <!-- Master Dashboard Layout -->
    <template v-else>
      <div class="app-container">
        <!-- Explorer Sidebar -->
        <Sidebar />

        <!-- Main Panel -->
        <div class="main-content">
          <!-- Top Header Navigation -->
          <header class="navbar-header">
            <!-- Breadcrumbs -->
            <div class="breadcrumb-container">
              <span class="crumb root-crumb" @click="$router.push('/')">
                <el-icon><HomeFilled /></el-icon>
                {{ store.t('Connections') }}
              </span>
              
              <template v-if="store.activeConnection">
                <el-icon class="breadcrumb-separator"><ArrowRight /></el-icon>
                <span class="crumb" @click="$router.push(`/${store.activeConnection}`)">
                  {{ store.activeConnection }}
                </span>
              </template>

              <template v-if="store.activeDb">
                <el-icon class="breadcrumb-separator"><ArrowRight /></el-icon>
                <span class="crumb" @click="$router.push(`/${store.activeConnection}/${store.activeDb}`)">
                  {{ store.activeDb }}
                </span>
              </template>

              <template v-if="store.activeColl">
                <el-icon class="breadcrumb-separator"><ArrowRight /></el-icon>
                <span class="crumb active-crumb">
                  {{ store.activeColl }}
                </span>
              </template>
            </div>

            <!-- Top Header Action widgets -->
            <div class="header-widgets">
              <!-- Real-time performance chart link -->
              <el-button 
                v-if="store.activeConnection && $route.name !== 'Monitoring'"
                type="primary" 
                link
                :icon="DataLine"
                @click="$router.push(`/${store.activeConnection}/monitoring`)"
              >
                {{ store.t('Metrics') }}
              </el-button>

              <!-- Theme selector dropdown -->
              <el-dropdown trigger="click" @command="handleThemeChange" size="small" class="header-theme-dropdown">
                <span class="locale-trigger-btn">
                  <el-icon>
                    <Sunny v-if="store.theme === 'light'" />
                    <Moon v-else-if="store.theme === 'dark'" />
                    <Monitor v-else />
                  </el-icon>
                  {{ store.t(themeLabel) }}
                </span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="light" :class="{ 'is-active': store.theme === 'light' }">
                      <el-icon><Sunny /></el-icon> {{ store.t('Light') }}
                    </el-dropdown-item>
                    <el-dropdown-item command="dark" :class="{ 'is-active': store.theme === 'dark' }">
                      <el-icon><Moon /></el-icon> {{ store.t('Dark') }}
                    </el-dropdown-item>
                    <el-dropdown-item command="system" :class="{ 'is-active': store.theme === 'system' }">
                      <el-icon><Monitor /></el-icon> {{ store.t('System') }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>

              <!-- Language selector dropdown -->
              <el-dropdown trigger="click" @command="handleLocaleChange" size="small" class="header-locale-dropdown">
                <span class="locale-trigger-btn">
                  <el-icon><Location /></el-icon>
                  {{ store.activeLocale.toUpperCase() }}
                </span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item 
                      v-for="(label, code) in availableLocales" 
                      :key="code" 
                      :command="code"
                      :class="{ 'is-active': store.activeLocale === code }"
                    >
                      {{ label }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>

              <!-- Connection details indicator -->
              <el-tag v-if="store.activeConnection" type="success" size="small" effect="plain" class="connection-badge">
                {{ store.t('Connected') }}
              </el-tag>

              <!-- Logout button -->
              <el-button 
                v-if="store.passwordRequired" 
                type="danger" 
                plain
                size="small"
                :icon="SwitchButton" 
                @click="handleLogout"
              >
                {{ store.t('Logout') }}
              </el-button>
            </div>
          </header>

          <!-- Main viewport body -->
          <div class="viewport-body">
            <router-view v-slot="{ Component }">
              <transition name="fade" mode="out-in">
                <component :is="Component" />
              </transition>
            </router-view>
          </div>
        </div>
        
        <!-- Floating Chatbot Sidebar Panel -->
        <AgentChatSidebar />
      </div>
    </template>
  </div>
</template>

<script setup>
import { onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { store } from './stores';
import Sidebar from './components/Sidebar.vue';
import AgentChatSidebar from './components/chat/AgentChatSidebar.vue';
import { HomeFilled, ArrowRight, DataLine, SwitchButton, Location, Sunny, Moon, Monitor } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

const themeLabel = computed(() => {
  if (store.theme === 'light') return 'Light';
  if (store.theme === 'dark') return 'Dark';
  return 'System';
});

const handleThemeChange = (theme) => {
  store.setTheme(theme);
  ElMessage.success(store.t('Theme changed successfully'));
};

const router = useRouter();

const availableLocales = {
  en: 'English',
  de: 'Deutsch',
  es: 'Español',
  ru: 'Русский',
  'zh-cn': '简体中文',
  it: 'Italiano',
  fa: 'فارسی',
  vi: 'Tiếng Việt'
};

onMounted(async () => {
  // Pre-load localization dictionaries and connection details
  store.loading = true;
  await store.fetchLocales();
  await store.fetchConnections();
  store.loading = false;
});

const handleLocaleChange = (locale) => {
  store.setLocale(locale);
  ElMessage.success(store.t('Language changed successfully'));
};

const handleLogout = async () => {
  const result = await store.logout();
  if (result.success) {
    ElMessage.success(store.t('Logged out successfully'));
    router.push('/login');
  } else {
    ElMessage.error(store.t('Logout failed'));
  }
};
</script>

<style scoped>
.app-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.app-container {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background-color: var(--bg-primary);
}

.navbar-header {
  height: 64px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 2rem;
  flex-shrink: 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
}

.breadcrumb-container {
  display: flex;
  align-items: center;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.crumb {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: color var(--transition-fast);
}

.crumb:hover {
  color: var(--color-brand);
}

.root-crumb {
  color: var(--text-muted);
}

.breadcrumb-separator {
  margin: 0 8px;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.active-crumb {
  color: var(--text-primary);
  font-weight: 600;
  cursor: default;
}

.active-crumb:hover {
  color: var(--text-primary);
}

.header-widgets {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.header-locale-dropdown, .header-theme-dropdown {
  cursor: pointer;
}

.locale-trigger-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  transition: all 0.2s ease;
}

.locale-trigger-btn:hover {
  color: var(--color-brand);
  border-color: var(--color-brand-light);
}

.connection-badge {
  font-weight: 600;
  letter-spacing: 0.02em;
}

.viewport-body {
  flex: 1;
  overflow-y: auto;
  position: relative;
}
</style>
