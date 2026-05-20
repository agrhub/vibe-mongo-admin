<template>
  <div class="login-wrapper">
    <el-card class="login-card">
      <div class="login-header">
        <div class="login-actions-container">
          <!-- Theme selector dropdown -->
          <el-dropdown trigger="click" @command="handleThemeChange" size="small">
            <span class="action-btn">
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
          <el-dropdown trigger="click" @command="handleLocaleChange" size="small">
            <span class="action-btn">
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
        </div>
        <div class="logo-circle">
          <el-icon class="logo-icon"><Grid /></el-icon>
        </div>
        <h1 class="logo-title">VibeMongo</h1>
        <p class="logo-subtitle">{{ store.t('Minimalist MongoDB Administration') }}</p>
      </div>

      <el-form :model="loginForm" @submit.prevent="handleLogin" label-position="top">
        <el-form-item :label="store.t('Password')">
          <el-input 
            v-model="loginForm.password" 
            type="password" 
            show-password 
            placeholder="••••••••"
            size="large"
            :prefix-icon="Lock"
          />
        </el-form-item>

        <div class="form-actions">
          <el-button 
            type="primary" 
            native-type="submit" 
            size="large" 
            :loading="loggingIn"
            class="submit-btn"
          >
            {{ store.t('Sign In') }}
          </el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { useRouter } from 'vue-router';
import { store } from '../stores';
import { Lock, Location, Grid, Sunny, Moon, Monitor } from '@element-plus/icons-vue';
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
const loggingIn = ref(false);

const loginForm = reactive({
  password: ''
});

const availableLocales = {
  en: 'English',
  de: 'Deutsch',
  es: 'Español',
  ru: 'Русский',
  'zh-cn': '简体中文',
  it: 'Italiano',
  fa: 'فارسی'
};

const handleLocaleChange = (locale) => {
  store.setLocale(locale);
  ElMessage.success(store.t('Language changed successfully'));
};

const handleLogin = async () => {
  if (!loginForm.password) {
    ElMessage.warning(store.t('Password is required'));
    return;
  }

  loggingIn.value = true;
  const result = await store.login(loginForm.password);
  loggingIn.value = false;

  if (result.success) {
    ElMessage.success(store.t('Logged in successfully'));
    router.push('/');
  } else {
    ElMessage.error(result.msg || store.t('Incorrect password'));
  }
};
</script>

<style scoped>
.login-wrapper {
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: var(--bg-primary);
  background-image: radial-gradient(circle at 10% 20%, rgba(13, 148, 136, 0.03) 0%, transparent 40%),
                    radial-gradient(circle at 90% 80%, rgba(13, 148, 136, 0.03) 0%, transparent 40%);
}

.login-card {
  width: 100%;
  max-width: 420px;
  padding: 1.5rem;
  border-radius: var(--radius-lg) !important;
  box-shadow: var(--shadow-lg) !important;
  background: var(--bg-secondary);
}

.login-card:hover {
  transform: none; /* Turn off float on hover for login card */
}

.login-header {
  text-align: center;
  margin-bottom: 2.5rem;
  position: relative;
}

.login-actions-container {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: -0.5rem;
  margin-right: -0.5rem;
  margin-bottom: 0.5rem;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  transition: all 0.2s ease;
}

.action-btn:hover {
  color: var(--color-brand);
  border-color: var(--color-brand-light);
}

.logo-circle {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--color-brand-light);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
}

.logo-icon {
  font-size: 2rem;
  color: var(--color-brand);
}

.logo-title {
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.logo-subtitle {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.submit-btn {
  width: 100%;
  margin-top: 1rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}
</style>

