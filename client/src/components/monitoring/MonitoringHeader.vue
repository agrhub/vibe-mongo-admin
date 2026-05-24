<template>
  <div class="monitor-header-row">
    <div>
      <h2 class="section-title">
        <el-icon class="title-icon"><DataLine /></el-icon>
        {{ store.t('Real-Time Metrics') }}
      </h2>
      <p class="section-desc">
        {{ activeConnection }} — {{ store.t('Historical server usage analytics from local NeDB charts scheduler') }}
      </p>
    </div>
    <div class="header-action-group">
      <el-button :icon="Refresh" type="primary" round @click="$emit('refresh')">
        {{ store.t('Refresh') }}
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { DataLine, Refresh } from '@element-plus/icons-vue';
import { store } from '../../stores';

defineProps({
  activeConnection: { type: String, default: '' },
});
defineEmits(['refresh']);
</script>

<style scoped>
.monitor-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}
.section-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.03em;
  display: flex;
  align-items: center;
  gap: 8px;
}
.title-icon { color: var(--color-brand); }
.section-desc {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
}
.header-action-group { display: flex; gap: 12px; }
</style>
