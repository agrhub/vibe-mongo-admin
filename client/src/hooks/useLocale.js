/**
 * useLocale — Shared composable for locale switching logic.
 * Eliminates the availableLocales + handleLocaleChange duplication
 * across App.vue, Welcome.vue, and Guide.vue.
 */
import { store } from '../stores';
import { ElMessage } from 'element-plus';

export const AVAILABLE_LOCALES = {
  en: 'English',
  vi: 'Tiếng Việt',
  de: 'Deutsch',
  es: 'Español',
  ru: 'Русский',
  'zh-cn': '简体中文',
  it: 'Italiano',
  fa: 'فارسی'
};

export function useLocale() {
  const handleLocaleChange = (locale) => {
    store.setLocale(locale);
    ElMessage.success(store.t('Language changed successfully'));
  };

  return {
    availableLocales: AVAILABLE_LOCALES,
    handleLocaleChange
  };
}
