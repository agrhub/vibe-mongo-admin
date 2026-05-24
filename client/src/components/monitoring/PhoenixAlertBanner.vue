<template>
  <div class="phoenix-alerts-tab-view">
    <div v-if="alerts?.slowQueries?.length" class="phoenix-alert-container">
      <el-alert type="error" show-icon :closable="false"
        style="margin-bottom: 2rem; border-left: 4px solid var(--color-danger);">
        <template #title>
          <div style="font-weight: 600; font-size: 1rem;">{{ store.t('Phoenix DB-Guardian Alert') }}</div>
        </template>
        <div style="margin-top: 8px;">
          <p>{{ alerts.traceSummary || store.t('Critical slow queries detected on MongoDB connection.') }}</p>
          <div style="margin-top: 10px; display: flex; gap: 10px; flex-wrap: wrap;">
            <el-button
              v-for="q in alerts.slowQueries"
              :key="q.traceId"
              size="small" type="danger" plain
              @click="$emit('analyze', q.traceId)"
            >
              {{ store.t('Analyze') }} {{ q.collection }} ({{ q.durationMs }}ms)
            </el-button>
          </div>
        </div>
      </el-alert>
    </div>

    <div v-else class="empty-alerts-box">
      <el-icon class="empty-icon text-success"><CircleCheck /></el-icon>
      <h3>{{ store.t('No active alerts') }}</h3>
      <p>{{ store.t('All queries are running optimally. No slow queries detected.') }}</p>
    </div>

    <!-- Trace Waterfall quick viewer -->
    <el-card v-if="activeTraceId" class="trace-visualizer-card" style="margin-top: 1.5rem; margin-bottom: 2rem;">
      <template #header>
        <div class="chart-header-title">
          <el-icon class="card-chart-icon" style="color: #0ea5e9;"><DataAnalysis /></el-icon>
          <span>{{ store.t('Trace Waterfall') }} - {{ activeTraceId }}</span>
          <el-button size="small" type="primary" text style="margin-left: auto;"
            @click="$emit('closeTrace')">{{ store.t('Close') }}</el-button>
        </div>
      </template>
      <div class="waterfall-container">
        <div class="waterfall-row">
          <div class="w-label">Agent Orchestrator</div>
          <div class="w-bar-container">
            <div class="w-bar" style="left: 0%; width: 100%; background: #0ea5e9;">2.15s</div>
          </div>
        </div>
        <div class="waterfall-row">
          <div class="w-label">MongoDB query (find)</div>
          <div class="w-bar-container">
            <div class="w-bar" style="left: 10%; width: 85%; background: #ef4444;">1.85s (COLLSCAN)</div>
          </div>
        </div>
        <div class="waterfall-row">
          <div class="w-label">Network/IO</div>
          <div class="w-bar-container">
            <div class="w-bar" style="left: 95%; width: 5%; background: #10b981;">100ms</div>
          </div>
        </div>
        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border-color); text-align: right;">
          <el-button size="small" type="primary" @click="store.sidebarOpen = true">
            {{ store.t('Ask AI to Optimize') }}
          </el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { DataAnalysis, CircleCheck } from '@element-plus/icons-vue';
import { store } from '../../stores';

defineProps({
  alerts: { type: Object, default: null },
  activeTraceId: { type: String, default: null },
});
defineEmits(['analyze', 'closeTrace']);
</script>

<style scoped>
.chart-header-title {
  display: flex; align-items: center; gap: 8px;
  font-weight: 600; font-size: 1rem; color: var(--text-primary);
}
.card-chart-icon { color: var(--color-brand); }
.waterfall-container { display: flex; flex-direction: column; gap: 12px; }
.waterfall-row { display: flex; align-items: center; gap: 16px; }
.w-label {
  width: 200px; font-size: 0.85rem; font-weight: 500;
  color: var(--text-secondary); white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
.w-bar-container {
  flex: 1; height: 24px; background-color: var(--bg-secondary);
  border-radius: 4px; position: relative; overflow: hidden;
}
.w-bar {
  position: absolute; height: 100%; border-radius: 4px;
  display: flex; align-items: center; padding: 0 8px;
  color: #fff; font-size: 0.75rem; font-weight: 600;
  white-space: nowrap; overflow: hidden;
}
.empty-alerts-box {
  text-align: center; padding: 5rem 2rem; background: var(--bg-secondary);
  border: 1px dashed var(--border-color); border-radius: var(--radius-md);
  margin-top: 1rem;
}
.empty-icon { font-size: 3.5rem; color: var(--text-muted); margin-bottom: 1.2rem; }
.text-success { color: var(--color-success) !important; }
.empty-alerts-box h3 { font-size: 1.25rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem; }
.empty-alerts-box p { font-size: 0.875rem; color: var(--text-secondary); }
</style>
