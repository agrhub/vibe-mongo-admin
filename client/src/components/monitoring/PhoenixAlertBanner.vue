<template>
  <div class="phoenix-alerts-tab-view">

    <!-- Alert summary banner -->
    <el-alert
      v-if="alerts?.slowQueries?.length"
      type="error"
      show-icon
      :closable="false"
      style="margin-bottom: 1.25rem; border-left: 4px solid var(--color-danger);"
    >
      <template #title>
        <div style="font-weight: 600; font-size: 1rem;">{{ store.t('Phoenix DB-Guardian Alert') }}</div>
      </template>
      <div style="margin-top: 4px; color: #fca5a5;">
        {{ alerts.traceSummary || store.t('Critical slow queries detected on MongoDB connection.') }}
      </div>
    </el-alert>

    <!-- Slow spans table (same style as Traces tab) -->
    <el-card v-if="alerts?.slowQueries?.length" class="alert-table-card">
      <template #header>
        <div class="alert-table-header">
          <div class="chart-header-title">
            <el-icon style="color: #ef4444;"><Warning /></el-icon>
            <span>{{ store.t('Slow Spans') }}</span>
            <el-tag size="small" type="danger" style="margin-left: 8px;">{{ alerts.slowQueries.length }}</el-tag>
            <el-tag size="small" type="info" style="margin-left: 4px;">≥ 1000ms</el-tag>
          </div>
        </div>
      </template>

      <el-table
        :data="pagedSlowSpans"
        style="width: 100%"
        size="small"
        @row-click="(row) => $emit('analyze', row.traceId)"
        row-class-name="span-table-row"
        :header-cell-style="{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }"
      >
        <!-- Status -->
        <el-table-column :label="store.t('status')" width="72" align="center">
          <template #default="{ row }">
            <el-icon :style="{ color: row.statusCode === 'ERROR' ? '#ef4444' : '#10b981', fontSize: '1rem' }">
              <component :is="row.statusCode === 'ERROR' ? CircleClose : CircleCheck" />
            </el-icon>
          </template>
        </el-table-column>

        <!-- Kind -->
        <el-table-column :label="store.t('kind')" width="100">
          <template #default="{ row }">
            <span class="kind-chip" :class="row.operation || 'chain'">{{ row.operation || 'chain' }}</span>
          </template>
        </el-table-column>

        <!-- Name -->
        <el-table-column :label="store.t('name')" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="span-name-link">{{ row.name }}</span>
          </template>
        </el-table-column>

        <!-- Start time -->
        <el-table-column :label="store.t('start time')" width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="meta-text">{{ formatTime(row.startTime) }}</span>
          </template>
        </el-table-column>

        <!-- Latency -->
        <el-table-column :label="store.t('latency')" width="120" align="right">
          <template #default="{ row }">
            <span class="latency-badge slow">
              <el-icon style="font-size: 0.75rem;"><Timer /></el-icon>
              {{ formatLatency(row.durationMs) }}
            </span>
          </template>
        </el-table-column>

        <!-- Analyze action -->
        <el-table-column :label="store.t('action')" width="100" align="center">
          <template #default="{ row }">
            <el-button
              size="small" type="danger" plain
              @click.stop="$emit('analyze', row.traceId)"
            >
              {{ store.t('Analyze') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- Pagination -->
      <div class="pagination-bar" v-if="alerts.slowQueries.length > pageSize">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          :total="alerts.slowQueries.length"
          layout="total, sizes, prev, pager, next"
          background
          small
        />
      </div>
    </el-card>

    <!-- Empty state -->
    <div v-else class="empty-alerts-box">
      <el-icon class="empty-icon text-success"><CircleCheck /></el-icon>
      <h3>{{ store.t('No active alerts') }}</h3>
      <p>{{ store.t('All queries are running optimally. No slow queries detected.') }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { DataAnalysis, CircleCheck, CircleClose, Timer, Warning, ChatLineRound } from '@element-plus/icons-vue';
import { store } from '../../stores';
import axios from 'axios';

const props = defineProps({
  alerts: { type: Object, default: null },
  activeTraceId: { type: String, default: null },
  conn: { type: String, default: '' },
});
const emit = defineEmits(['analyze', 'closeTrace']);

// ---- Pagination ----
const currentPage = ref(1);
const pageSize    = ref(20);

const pagedSlowSpans = computed(() => {
  const list = props.alerts?.slowQueries ?? [];
  const start = (currentPage.value - 1) * pageSize.value;
  return list.slice(start, start + pageSize.value);
});

// ---- Waterfall state ----
const waterfallSpans  = ref([]);
const waterfallLoading = ref(false);

// Fetch real trace spans when activeTraceId changes
watch(() => props.activeTraceId, async (traceId) => {
  if (!traceId || !props.conn) { waterfallSpans.value = []; return; }
  waterfallLoading.value = true;
  try {
    const res = await axios.get(`/api/${props.conn}/monitoring/trace/${traceId}`);
    if (res.data?.success && res.data.trace?.spans?.length) {
      waterfallSpans.value = res.data.trace.spans;
    } else if (res.data?.trace) {
      // trace might be the span array directly or wrapped
      const raw = Array.isArray(res.data.trace) ? res.data.trace : [res.data.trace];
      waterfallSpans.value = raw;
    } else {
      waterfallSpans.value = [];
    }
  } catch (e) {
    console.warn('[Waterfall] Failed to fetch trace:', e.message);
    waterfallSpans.value = [];
  } finally {
    waterfallLoading.value = false;
  }
}, { immediate: true });

// Compute waterfall bars relative to total duration
const waterfallBars = computed(() => {
  const spans = waterfallSpans.value;
  if (!spans.length) return [];
  const maxDur = Math.max(...spans.map(s => s.durationMs ?? s.latencyMs ?? 0), 1);
  const minStart = Math.min(...spans.map(s => new Date(s.startTime ?? s.start_time ?? 0).getTime()), Date.now());

  return spans.map(s => {
    const dur  = s.durationMs ?? s.latencyMs ?? 0;
    const start = new Date(s.startTime ?? s.start_time ?? 0).getTime();
    const offsetPct = maxDur > 0 ? ((start - minStart) / maxDur) * 100 : 0;
    const widthPct  = maxDur > 0 ? (dur / maxDur) * 100 : 0;
    const isError   = (s.statusCode ?? '').toUpperCase() === 'ERROR';
    const isSlow    = dur >= 1000;
    const color = isError ? '#ef4444' : isSlow ? '#f59e0b' : '#10b981';
    return {
      label: s.name ?? s.spanName ?? 'span',
      dur,
      offsetPct: Math.min(offsetPct, 95),
      widthPct: Math.max(widthPct, 2),
      color,
      kind: s.kind ?? 'chain',
    };
  });
});

// ---- Ask AI to Optimize ----
function askAiToOptimize() {
  const span = props.alerts?.slowQueries?.find(q => q.traceId === props.activeTraceId);
  const name = span?.name ?? props.activeTraceId ?? 'unknown';
  const ms   = span?.durationMs ?? 0;
  const traceSummary = waterfallBars.value
    .map(b => `  - ${b.label} (${b.dur}ms)`)
    .join('\n') || '  (no span detail available)';

  const prompt =
`Analyze this slow trace from Phoenix monitoring and suggest optimizations:

**Trace ID**: ${props.activeTraceId}
**Slowest span**: ${name} — ${ms}ms

**Spans in trace**:
${traceSummary}

Please identify the bottleneck and suggest how to optimize the performance.`;

  store.openChatWithCommand(prompt, '', true);
}

// ---- Helpers ----
function formatTime(ts) {
  if (!ts) return '--';
  return new Date(ts).toLocaleString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

function formatLatency(ms) {
  if (!ms) return '0ms';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}
</script>

<style scoped>
.chart-header-title {
  display: flex; align-items: center; gap: 8px;
  font-weight: 600; font-size: 1rem; color: var(--text-primary);
}
.card-chart-icon { color: var(--color-brand); }
.alert-table-header {
  display: flex; align-items: center; justify-content: space-between;
}
.alert-table-card { border-radius: var(--radius-sm) !important; }

/* Kind chips */
.kind-chip {
  display: inline-block; padding: 2px 10px; border-radius: 12px;
  font-size: 0.78rem; font-weight: 500;
}
.kind-chip.chain     { background: rgba(99,102,241,0.18); color: #818cf8; }
.kind-chip.llm       { background: rgba(14,165,233,0.18); color: #38bdf8; }
.kind-chip.tool      { background: rgba(245,158,11,0.18); color: #fbbf24; }
.kind-chip.retriever { background: rgba(52,211,153,0.18); color: #34d399; }

.span-name-link { color: #60a5fa; font-size: 0.85rem; cursor: pointer; font-family: 'Fira Code', monospace; }
.span-name-link:hover { text-decoration: underline; }
.meta-text { font-size: 0.8rem; color: var(--text-secondary); }

/* Latency */
.latency-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 0.82rem; }
.latency-badge.slow { color: #ef4444; font-weight: 600; }

/* Pagination */
.pagination-bar { display: flex; justify-content: flex-end; padding: 16px 0 4px 0; }

/* Row cursor */
:deep(.span-table-row) { cursor: pointer; }
:deep(.span-table-row:hover td) { background: var(--bg-secondary) !important; }

/* Waterfall */
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

/* Empty state */
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
