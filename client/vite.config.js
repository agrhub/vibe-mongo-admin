import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const apiUrl = env.VITE_API_URL || 'http://localhost:1234';

  return {
    plugins: [vue()],
    envDir: '../',
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true
        }
      }
    }
  };
});
