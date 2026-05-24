<template>
  <div class="monitoring-view page-body" v-loading="loading">

    <MonitoringHeader
      :active-connection="store.activeConnection"
      @refresh="fetchAll"
    />

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
          :spans="phoenixSpansData"
          :show-metrics="false"
          :show-table="true"
          @open-span="openSpan"
        />
      </el-tab-pane>

      <!-- Tab 3: Alerts -->
      <el-tab-pane :label="store.t('Alerts')" name="alerts">
        <PhoenixAlertBanner
          :alerts="phoenixAlerts"
          :active-trace-id="activeTraceId"
          @analyze="(id) => activeTraceId = id"
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
import { ref, onMounted } from 'vue';
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

const traceDrawerVisible = ref(false);
const selectedSpan       = ref(null);

// ---- Actions ----
function openSpan(row) {
  selectedSpan.value = row;
  traceDrawerVisible.value = true;
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

async function fetchPhoenixHealth() {
  const conn = route.params.conn;
  if (!conn) return;
  try {
    const res = await axios.get(`/api/${conn}/monitoring/phoenix`);
    if (res.data?.success) {
      if (res.data.alerts)  phoenixAlerts.value = res.data.alerts;
      if (res.data.metrics) {
        phoenixFullMetrics.value = res.data.metrics;
        phoenixDataSource.value  = res.data.source ?? 'unknown';
      }
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

function fetchAll() {
  fetchMetrics();
  fetchPhoenixHealth();
}

onMounted(fetchAll);
</script>

<style scoped>
.monitoring-view { background: var(--bg-primary); }
</style>
