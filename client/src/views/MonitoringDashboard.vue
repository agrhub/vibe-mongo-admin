<template>
  <div class="monitoring-view page-body" v-loading="loading">
    <div class="monitor-header-row">
      <div>
        <h2 class="section-title">
          <el-icon class="title-icon"><DataLine /></el-icon>
          {{ store.t('Real-Time Metrics') }}
        </h2>
        <p class="section-desc">
          {{ store.activeConnection }} — {{ store.t('Historical server usage analytics from local NeDB charts scheduler') }}
        </p>
      </div>
      <div class="header-action-group">
        <el-button :icon="Refresh" type="primary" round @click="fetchMetrics" size="">
          {{ store.t('Refresh') }}
        </el-button>
      </div>
    </div>

    <!-- Quick statistics summary indicators -->
    <el-row :gutter="20" class="stats-indicators-row" v-if="metricsHistory.length > 0">
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
          <span class="val">{{ metricsHistory.length }}</span>
        </el-card>
      </el-col>
    </el-row>

    <!-- Empty state prompts -->
    <div v-if="metricsHistory.length === 0 && !loading" class="empty-metrics-box">
      <el-icon class="empty-icon"><DataAnalysis /></el-icon>
      <h3>{{ store.t('Collecting Metrics...') }}</h3>
      <p>{{ store.t('The monitoring thread has started. Please wait a few moments and click refresh to load data.') }}</p>
    </div>

    <!-- Canvas layouts for ChartJS -->
    <el-row :gutter="24" class="charts-row" v-show="metricsHistory.length > 0">
      <!-- Memory Chart -->
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

      <!-- Connections Chart -->
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
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { store } from '../stores';
import { DataLine, Refresh, Cpu, Connection, DataAnalysis } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import axios from 'axios';
import Chart from 'chart.js/auto';

const route = useRoute();

const loading = ref(false);
const metricsHistory = ref([]);

const memoryChartRef = ref(null);
const connChartRef = ref(null);

let memoryChartInstance = null;
let connChartInstance = null;

// Derived statistical metrics
const peakResident = ref(0);
const avgConnections = ref(0);

onMounted(() => {
  fetchMetrics();
});

onBeforeUnmount(() => {
  // Dispose of charts
  if (memoryChartInstance) memoryChartInstance.destroy();
  if (connChartInstance) connChartInstance.destroy();
});

const formatMb = (mb) => {
  if (!mb) return '0 MB';
  return `${parseFloat(mb.toFixed(1))} MB`;
};

const fetchMetrics = async () => {
  const conn = route.params.conn;
  if (!conn) return;

  loading.value = true;
  try {
    const res = await axios.get(`/api/${conn}/monitoring`);
    const rawData = res.data.data;
    const ptsCount = (rawData && rawData.connectionsCurrent) ? rawData.connectionsCurrent.length : 0;

    const history = [];
    for (let i = 0; i < ptsCount; i++) {
      const timestamp = rawData.connectionsCurrent[i].x;
      const connections = rawData.connectionsCurrent[i].y || 0;
      const resident = (rawData.memoryCurrent && rawData.memoryCurrent[i]) ? rawData.memoryCurrent[i].y : 0;
      const virtual = (rawData.memoryVirtual && rawData.memoryVirtual[i]) ? rawData.memoryVirtual[i].y : 0;
      
      history.push({
        timestamp,
        connections,
        resident,
        virtual
      });
    }
    metricsHistory.value = history;
    
    if (metricsHistory.value.length > 0) {
      calculateAggregates();
      
      // Allow DOM to update canvas reference then draw
      setTimeout(() => {
        renderMemoryChart();
        renderConnChart();
      }, 50);
    }
  } catch (e) {
    ElMessage.error(store.t('Error loading monitoring metrics'));
  } finally {
    loading.value = false;
  }
};

const calculateAggregates = () => {
  let totalConn = 0;
  let maxRes = 0;
  
  metricsHistory.value.forEach(pt => {
    if (pt.resident > maxRes) maxRes = pt.resident;
    totalConn += pt.connections || 0;
  });
  
  peakResident.value = maxRes;
  avgConnections.value = Math.round(totalConn / metricsHistory.value.length);
};

// ================= CHART RENDERING =================

const renderMemoryChart = () => {
  if (memoryChartInstance) {
    memoryChartInstance.destroy();
  }

  const canvas = memoryChartRef.value;
  if (!canvas) return;

  // Prepare data arrays
  const labels = metricsHistory.value.map(pt => {
    const d = new Date(pt.timestamp);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  });
  
  const residentData = metricsHistory.value.map(pt => pt.resident);
  const virtualData = metricsHistory.value.map(pt => pt.virtual);

  memoryChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: store.t('Resident Memory (MB)'),
          data: residentData,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.3,
          borderWidth: 2
        },
        {
          label: store.t('Virtual Memory (MB)'),
          data: virtualData,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.05)',
          fill: true,
          tension: 0.3,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { family: 'Outfit' }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false }
        },
        y: {
          beginAtZero: false,
          grid: { color: '#f1f5f9' }
        }
      }
    }
  });
};

const renderConnChart = () => {
  if (connChartInstance) {
    connChartInstance.destroy();
  }

  const canvas = connChartRef.value;
  if (!canvas) return;

  const labels = metricsHistory.value.map(pt => {
    const d = new Date(pt.timestamp);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  });
  
  const connData = metricsHistory.value.map(pt => pt.connections);

  connChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: store.t('Active Connections count'),
          data: connData,
          borderColor: '#0d9488',
          backgroundColor: 'rgba(13, 148, 136, 0.1)',
          fill: true,
          tension: 0.3,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { family: 'Outfit' }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
          grid: { color: '#f1f5f9' }
        }
      }
    }
  });
};
</script>

<style scoped>
.monitoring-view {
  background: var(--bg-primary);
}

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

.title-icon {
  color: var(--color-brand);
}

.section-desc {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
}

.header-action-group {
  display: flex;
  gap: 12px;
}

/* Statistics summary row */
.stats-indicators-row {
  margin-bottom: 2.5rem;
}

.stat-indicator-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 90px;
  padding: 0.5rem 1rem;
}

.stat-indicator-card .lbl {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.stat-indicator-card .val {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--text-primary);
}

.text-danger {
  color: var(--color-danger);
}

.text-brand {
  color: var(--color-brand);
}

/* Empty monitoring state */
.empty-metrics-box {
  text-align: center;
  padding: 6rem 2rem;
  background: var(--bg-secondary);
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-md);
  margin-top: 2rem;
}

.empty-icon {
  font-size: 3.5rem;
  color: var(--text-muted);
  margin-bottom: 1.5rem;
}

.empty-metrics-box h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.empty-metrics-box p {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

/* Chart Canvas rows */
.charts-row {
  margin-top: 1rem;
}

.chart-col {
  margin-bottom: 2rem;
}

.chart-card {
  border-radius: var(--radius-sm) !important;
}

.chart-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 1rem;
  color: var(--text-primary);
}

.card-chart-icon {
  color: var(--color-brand);
}

.canvas-viewport {
  height: 320px;
  position: relative;
  width: 100%;
}
</style>
