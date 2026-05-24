<template>
  <!-- Quick statistics summary -->
  <el-row :gutter="20" class="stats-indicators-row" v-if="history.length > 0">
    <el-col :xs="24" :sm="8">
      <el-card class="stat-indicator-card">
        <span class="lbl">{{ store.t('Peak Memory (Resident)') }}</span>
        <span class="val text-danger">{{ formatMb(peakResident) }}</span>
      </el-card>
    </el-col>
    <el-col :xs="24" :sm="8">
      <el-card class="stat-indicator-card">
        <span class="lbl">{{ store.t('Average Connections') }}</span>
        <span class="val text-brand">{{ avgConnections }}</span>
      </el-card>
    </el-col>
    <el-col :xs="24" :sm="8">
      <el-card class="stat-indicator-card">
        <span class="lbl">{{ store.t('Metrics Sample count') }}</span>
        <span class="val">{{ history.length }}</span>
      </el-card>
    </el-col>
  </el-row>

  <!-- Empty state -->
  <div v-if="history.length === 0 && !loading" class="empty-metrics-box">
    <el-icon class="empty-icon"><DataAnalysis /></el-icon>
    <h3>{{ store.t('Collecting Metrics...') }}</h3>
    <p>{{ store.t('The monitoring thread has started. Please wait a few moments and click refresh to load data.') }}</p>
  </div>

  <!-- Charts -->
  <el-row :gutter="24" class="charts-row" v-show="history.length > 0">
    <el-col :xs="24" :lg="12" class="chart-col">
      <el-card class="chart-card">
        <template #header>
          <div class="chart-header-title">
            <el-icon class="card-chart-icon"><Cpu /></el-icon>
            <span>{{ store.t('Resident vs Virtual Memory (MB)') }}</span>
          </div>
        </template>
        <div class="canvas-viewport">
          <canvas ref="memoryChartRef"></canvas>
        </div>
      </el-card>
    </el-col>
    <el-col :xs="24" :lg="12" class="chart-col">
      <el-card class="chart-card">
        <template #header>
          <div class="chart-header-title">
            <el-icon class="card-chart-icon"><Connection /></el-icon>
            <span>{{ store.t('Active Database Connections count') }}</span>
          </div>
        </template>
        <div class="canvas-viewport">
          <canvas ref="connChartRef"></canvas>
        </div>
      </el-card>
    </el-col>
  </el-row>
</template>

<script setup>
import { ref, watch, onBeforeUnmount, computed } from 'vue';
import { Cpu, Connection, DataAnalysis } from '@element-plus/icons-vue';
import { store } from '../../stores';
import Chart from 'chart.js/auto';

const props = defineProps({
  history: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
});

const memoryChartRef = ref(null);
const connChartRef   = ref(null);
let memoryChart = null;
let connChart   = null;

const peakResident = computed(() => Math.max(0, ...props.history.map(p => p.resident ?? 0)));
const avgConnections = computed(() => {
  if (!props.history.length) return 0;
  const sum = props.history.reduce((s, p) => s + (p.connections ?? 0), 0);
  return Math.round(sum / props.history.length);
});

const formatMb = (mb) => mb ? `${parseFloat(mb.toFixed(1))} MB` : '0 MB';

function renderCharts() {
  const GRID = '#f1f5f9';
  const labels = props.history.map(pt => {
    const d = new Date(pt.timestamp);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  });

  if (memoryChart) { memoryChart.destroy(); memoryChart = null; }
  if (connChart)   { connChart.destroy();   connChart   = null; }

  if (memoryChartRef.value) {
    memoryChart = new Chart(memoryChartRef.value, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: store.t('Resident Memory (MB)'), data: props.history.map(p => p.resident),
            borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.3, borderWidth: 2 },
          { label: store.t('Virtual Memory (MB)'),  data: props.history.map(p => p.virtual),
            borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.05)', fill: true, tension: 0.3, borderWidth: 2 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { font: { family: 'Outfit' } } } },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: false, grid: { color: GRID } } },
      },
    });
  }

  if (connChartRef.value) {
    connChart = new Chart(connChartRef.value, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: store.t('Active Connections count'), data: props.history.map(p => p.connections),
            borderColor: '#0d9488', backgroundColor: 'rgba(13,148,136,0.1)', fill: true, tension: 0.3, borderWidth: 2 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { font: { family: 'Outfit' } } } },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: GRID } } },
      },
    });
  }
}

watch(() => props.history, (v) => { if (v.length) setTimeout(renderCharts, 50); }, { deep: true });
onBeforeUnmount(() => { memoryChart?.destroy(); connChart?.destroy(); });
</script>

<style scoped>
.stats-indicators-row { margin-bottom: 2.5rem; }
.stat-indicator-card { display: flex; flex-direction: column; justify-content: center; height: 90px; padding: 0.5rem 1rem; }
.stat-indicator-card .lbl { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em; margin-bottom: 4px; }
.stat-indicator-card .val { font-size: 1.35rem; font-weight: 700; color: var(--text-primary); }
.text-danger { color: var(--color-danger); }
.text-brand  { color: var(--color-brand); }
.empty-metrics-box { text-align: center; padding: 6rem 2rem; background: var(--bg-secondary); border: 1px dashed var(--border-color); border-radius: var(--radius-md); margin-top: 2rem; }
.empty-icon { font-size: 3.5rem; color: var(--text-muted); margin-bottom: 1.5rem; }
.empty-metrics-box h3 { font-size: 1.25rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem; }
.empty-metrics-box p  { font-size: 0.875rem; color: var(--text-secondary); }
.charts-row { margin-top: 1rem; }
.chart-col  { margin-bottom: 2rem; }
.chart-card { border-radius: var(--radius-sm) !important; }
.chart-header-title { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 1rem; color: var(--text-primary); }
.card-chart-icon { color: var(--color-brand); }
.canvas-viewport { height: 320px; position: relative; width: 100%; }
</style>
