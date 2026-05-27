<template>
  <div class="monitoring-view page-body" v-loading="loading">

    <MonitoringHeader
      :active-connection="store.activeConnection"
      @refresh="fetchAll"
    />

    <!-- Premium SRE Health Index Hero Section -->
    <el-card class="sre-health-hero-card" style="margin-top: 1.5rem; background: linear-gradient(135deg, var(--bg-secondary) 0%, rgba(13, 148, 136, 0.05) 100%); border: 1px solid var(--border-color);">
      <el-row :gutter="20" align="middle">
        <el-col :xs="24" :sm="8" class="score-circle-col" style="text-align: center;">
          <div class="score-circle-wrapper">
            <el-progress 
              type="circle" 
              :percentage="healthScore" 
              :color="healthScore >= 90 ? '#10b981' : (healthScore >= 70 ? '#f59e0b' : '#ef4444')" 
              :stroke-width="12"
              :width="110"
            >
              <template #default="{ percentage }">
                <div class="score-percentage-value">{{ percentage }}%</div>
                <div class="score-percentage-label">HEALTH INDEX</div>
              </template>
            </el-progress>
          </div>
        </el-col>
        <el-col :xs="24" :sm="16" style="padding-left: 2rem;">
          <div class="sre-info-header" style="display: flex; align-items: center; gap: 10px; margin-bottom: 0.5rem;">
            <h4 style="margin: 0; font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">
              Autonomous SRE Health Assessment
            </h4>
            <el-tag :type="healthStatus.type" effect="dark" size="small" style="font-weight: 700;">
              {{ healthStatus.label }}
            </el-tag>
          </div>
          <p style="margin: 0 0 1rem 0; font-size: 0.9rem; color: var(--text-secondary);">
            {{ healthStatus.desc }} Telemetry is processed live through high-fidelity Phoenix trace logs and container resource counters.
          </p>
          <el-row :gutter="10">
            <el-col :xs="8" :sm="8">
              <div class="mini-kpi">
                <span class="kpi-label">P99 LATENCY</span>
                <span class="kpi-val">{{ phoenixFullMetrics?.latencyP99 || '0.0s' }}</span>
              </div>
            </el-col>
            <el-col :xs="8" :sm="8">
              <div class="mini-kpi">
                <span class="kpi-label">ACTIVE ALERTS</span>
                <span class="kpi-val" :class="{ 'text-warning': phoenixAlerts?.slowQueries?.length }">
                  {{ phoenixAlerts?.slowQueries?.length || 0 }}
                </span>
              </div>
            </el-col>
            <el-col :xs="8" :sm="8">
              <div class="mini-kpi">
                <span class="kpi-label">RESOURCE COST</span>
                <span class="kpi-val text-brand">{{ totalCumulativeCost }}</span>
              </div>
            </el-col>
          </el-row>
        </el-col>
      </el-row>
    </el-card>

    <el-tabs v-model="activeTab" class="monitoring-tabs" style="margin-top: 1.5rem;">
      <!-- Tab 1: Metrics -->
      <el-tab-pane :label="store.t('Metrics')" name="metrics">
        <!-- Node.js System Metrics -->
        <NodeSystemMetrics :history="metricsHistory" :loading="loading" />

        <!-- Phoenix Metrics Section -->
        <div style="margin-top: 3rem; border-top: 1px solid var(--border-color); padding-top: 2rem;">
          <h3 style="margin-bottom: 1.5rem; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
            <span style="width: 8px; height: 16px; background-color: var(--color-brand); border-radius: 4px;"></span>
            Arize Phoenix Observability Telemetry
          </h3>
          <PhoenixObservability
            :metrics="phoenixFullMetrics"
            :data-source="phoenixDataSource"
            :show-metrics="true"
            :show-table="false"
          />
        </div>
      </el-tab-pane>

      <!-- Tab 2: Traces -->
      <el-tab-pane :label="store.t('Traces')" name="traces">
        <PhoenixObservability
          v-model:currentPage="tracesCurrentPage"
          v-model:pageSize="tracesPageSize"
          :spans="phoenixSpansData"
          :next-cursor="nextCursor"
          :show-metrics="false"
          :show-table="true"
          @open-span="openSpan"
          @filter-change="handleFilterChange"
          @load-more="loadMoreSpans"
        />
      </el-tab-pane>
      
      <!-- Tab 3: Alerts -->
      <el-tab-pane :label="store.t('Alerts')" name="alerts">
        <PhoenixAlertBanner
          :alerts="phoenixAlerts"
          :active-trace-id="activeTraceId"
          :conn="String(route.params.conn)"
          @analyze="handleAnalyze"
          @close-trace="activeTraceId = null"
        />
      </el-tab-pane>
    </el-tabs>

    <TraceDetailDrawer
      v-model:visible="traceDrawerVisible"
      :span="selectedSpan"
      :conn="String(route.params.conn)"
    />

  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { store } from '../stores';
import { ElMessage } from 'element-plus';
import axios from 'axios';

import MonitoringHeader    from '../components/monitoring/MonitoringHeader.vue';
import PhoenixAlertBanner  from '../components/monitoring/PhoenixAlertBanner.vue';
import NodeSystemMetrics   from '../components/monitoring/NodeSystemMetrics.vue';
import PhoenixObservability from '../components/monitoring/PhoenixObservability.vue';
import TraceDetailDrawer   from '../components/monitoring/TraceDetailDrawer.vue';

const route = useRoute();

// ---- State ----
const loading            = ref(false);
const activeTab          = ref('metrics');
const metricsHistory     = ref([]);

const phoenixAlerts      = ref(null);
const activeTraceId      = ref(route.query.traceId || null);
const phoenixFullMetrics = ref(null);
const phoenixSpansData   = ref([]);
const phoenixDataSource  = ref('');
const activeFilters      = ref({ search: '', status: '', kind: '' });
const nextCursor         = ref(null);
const tracesCurrentPage  = ref(1);
const tracesPageSize     = ref(20);

const traceDrawerVisible = ref(false);
const selectedSpan       = ref(null);

// ---- SRE Health Assessment & Financials ----
const healthScore = computed(() => {
  let score = 100;
  
  // 1. Connection Load penalty
  const connCount = metricsHistory.value[metricsHistory.value.length - 1]?.connections ?? 0;
  if (connCount > 100) score -= Math.min(25, (connCount - 100) * 0.5);
  
  // 2. Slow Span Alert penalty
  const slowQueriesCount = phoenixAlerts.value?.slowQueries?.length ?? 0;
  score -= Math.min(40, slowQueriesCount * 8);
  
  // 3. P99 Latency penalty
  const p99Str = phoenixFullMetrics.value?.latencyP99 || '0s';
  const p99Sec = parseFloat(p99Str);
  if (p99Sec > 1.0) {
    score -= Math.min(25, (p99Sec - 1.0) * 10);
  }
  
  // 4. Memory Resident Peak check
  const peakMem = Math.max(0, ...metricsHistory.value.map(p => p.resident ?? 0));
  if (peakMem > 800) score -= 10;
  
  return Math.max(15, Math.round(score));
});

const healthStatus = computed(() => {
  const hs = healthScore.value;
  if (hs >= 90) return { label: 'HEALTHY', type: 'success', desc: 'System is fully optimized and safe.', class: 'status-healthy' };
  if (hs >= 70) return { label: 'DEGRADED', type: 'warning', desc: 'Slight bottlenecks detected. Review slow trace recommendations.', class: 'status-degraded' };
  return { label: 'CRITICAL', type: 'danger', desc: 'Severe performance bottleneck detected! Action recommended.', class: 'status-critical' };
});

const totalCumulativeCost = computed(() => {
  if (!phoenixSpansData.value?.length) return '$0.00000';
  let totalMs = 0;
  let docsExamined = 0;
  phoenixSpansData.value.forEach(s => {
    totalMs += Number(s.durationMs ?? s.latencyMs ?? 0);
    const attrs = s.attributes || {};
    const docs = attrs["mongodb.docs_examined"] ?? attrs["db.mongodb.docs_examined"] ?? attrs["docsExamined"] ?? 0;
    docsExamined += Number(docs);
    if (docsExamined === 0 && s.name?.toLowerCase().includes('collscan')) {
      docsExamined += 1250;
    }
  });
  const cost = (docsExamined * 0.00000015) + (totalMs * 0.00000008);
  return `$${cost.toFixed(5)}`;
});

// ---- Actions ----
function openSpan(row) {
  selectedSpan.value = row;
  traceDrawerVisible.value = true;
}

function handleAnalyze(traceId) {
  activeTraceId.value = traceId;
  // Find matching span from Traces data, or build minimal span from alerts
  const found = phoenixSpansData.value.find(s => s.traceId === traceId);
  if (found) {
    openSpan(found);
    return;
  }
  // Fallback: build span from slowQueries list
  const slowSpan = phoenixAlerts.value?.slowQueries?.find(q => q.traceId === traceId);
  if (slowSpan) {
    openSpan({
      traceId:   slowSpan.traceId,
      spanId:    slowSpan.spanId || slowSpan.traceId,
      name:      slowSpan.name,
      durationMs: slowSpan.durationMs,
      statusCode: slowSpan.statusCode || 'OK',
      kind:      slowSpan.operation || 'chain',
      startTime: slowSpan.startTime || new Date().toISOString(),
    });
    return;
  }
  // Last resort: minimal object so drawer at least opens with traceId
  openSpan({ traceId, spanId: traceId, name: traceId, durationMs: 0, kind: 'chain' });
}

function handleFilterChange(filters) {
  activeFilters.value = filters;
  tracesCurrentPage.value = 1;
  fetchPhoenixHealth(filters.search, filters.status, filters.kind);
}

async function fetchMetrics() {
  const conn = route.params.conn;
  if (!conn) return;
  loading.value = true;
  try {
    const res = await axios.get(`/api/${conn}/monitoring`);
    const rawData = res.data.data;
    const ptsCount = rawData?.connectionsCurrent?.length ?? 0;
    const history = [];
    for (let i = 0; i < ptsCount; i++) {
      history.push({
        timestamp:   rawData.connectionsCurrent[i].x,
        connections: rawData.connectionsCurrent[i].y || 0,
        resident:    rawData.memoryCurrent?.[i]?.y ?? 0,
        virtual:     rawData.memoryVirtual?.[i]?.y  ?? 0,
      });
    }
    metricsHistory.value = history;
  } catch {
    ElMessage.error(store.t('Error loading monitoring metrics'));
  } finally {
    loading.value = false;
  }
}

async function fetchPhoenixHealth(search = '', status = '', kind = '') {
  const conn = route.params.conn;
  if (!conn) return;
  try {
    const res = await axios.get(`/api/${conn}/monitoring/phoenix`, {
      params: {
        live: 'true',
        search,
        status,
        kind
      }
    });
    if (res.data?.success) {
      if (res.data.alerts)  phoenixAlerts.value = res.data.alerts;
      if (res.data.metrics) {
        phoenixFullMetrics.value = res.data.metrics;
        phoenixDataSource.value  = res.data.source ?? 'unknown';
      }
      nextCursor.value = res.data.nextCursor || null;
      if (res.data.spans?.length) {
        phoenixSpansData.value = res.data.spans;
      } else {
        phoenixSpansData.value = (res.data.alerts?.slowQueries || []).map((q) => ({
          traceId:    q.traceId,
          name:       `POST /api/${conn}/${q.db}/${q.collection}/${q.operation}`,
          durationMs: q.durationMs,
          statusCode: q.durationMs > 1000 ? 'ERROR' : 'OK',
          db:         q.db,
          collection: q.collection,
        }));
      }
    }
  } catch (e) {
    console.error('Failed to load Phoenix health traces', e);
  }
}

async function loadMoreSpans() {
  const conn = route.params.conn;
  if (!conn || !nextCursor.value) return;
  try {
    const res = await axios.get(`/api/${conn}/monitoring/phoenix`, {
      params: {
        live: 'true',
        cursor: nextCursor.value,
        search: activeFilters.value.search,
        status: activeFilters.value.status,
        kind: activeFilters.value.kind
      }
    });
    if (res.data?.success) {
      if (res.data.spans?.length) {
        const previousLength = phoenixSpansData.value.length;
        phoenixSpansData.value = [...phoenixSpansData.value, ...res.data.spans];
        
        // Calculate newly occupied page index and jump to it
        const newPage = Math.floor(previousLength / tracesPageSize.value) + 1;
        setTimeout(() => {
          tracesCurrentPage.value = newPage;
        }, 100);
      }
      nextCursor.value = res.data.nextCursor || null;
    }
  } catch (e) {
    console.error('Failed to load more Phoenix spans', e);
    ElMessage.error(store.t('Error loading more spans'));
  }
}

function fetchAll() {
  fetchMetrics();
  fetchPhoenixHealth(activeFilters.value.search, activeFilters.value.status, activeFilters.value.kind);
}

onMounted(fetchAll);
</script>

<style scoped>
.monitoring-view { 
  background: var(--bg-primary); 
  position: relative;
  height: 100%;
}
.sre-health-hero-card {
  border-radius: var(--radius-md) !important;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05) !important;
  transition: all 0.3s ease;
}
.sre-health-hero-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 15px 30px -5px rgba(0, 0, 0, 0.08), 0 10px 15px -6px rgba(0, 0, 0, 0.08) !important;
}
.score-circle-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0.5rem 0;
}
.score-percentage-value {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.2;
}
.score-percentage-label {
  font-size: 0.55rem;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.05em;
}
.mini-kpi {
  background: var(--bg-primary);
  padding: 0.6rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}
.mini-kpi .kpi-label {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  margin-bottom: 2px;
}
.mini-kpi .kpi-val {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
}
.text-warning {
  color: var(--color-warning) !important;
}
.text-brand {
  color: var(--color-brand) !important;
}
</style>
