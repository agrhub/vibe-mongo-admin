<template>
  <template v-if="showMetrics">
    <!-- Quick Stats -->
    <el-row :gutter="20" class="stats-indicators-row" v-if="metrics">
      <el-col :xs="24" :sm="8">
        <el-card class="stat-indicator-card" style="background: rgba(14,165,233,0.05); border-color: rgba(14,165,233,0.2);">
          <span class="lbl" style="color: #0ea5e9;">{{ store.t('Total Traces (Last 24h)') }}</span>
          <span class="val">{{ metrics.totalTraces }}</span>
          <el-tag v-if="dataSource" size="small"
            :type="dataSource === 'stored' ? 'success' : dataSource === 'live_fallback' ? 'warning' : 'info'"
            style="margin-top: 8px;">
            {{ dataSource === 'stored' ? '● Live DB' : dataSource === 'live_fallback' ? '⚡ MCP' : '◌ Simulated' }}
          </el-tag>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="8">
        <el-card class="stat-indicator-card" style="background: rgba(234,179,8,0.05); border-color: rgba(234,179,8,0.2);">
          <span class="lbl" style="color: #eab308;">{{ store.t('Latency P50') }}</span>
          <span class="val">{{ metrics.latencyP50 }}</span>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="8">
        <el-card class="stat-indicator-card" style="background: rgba(239,68,68,0.05); border-color: rgba(239,68,68,0.2);">
          <span class="lbl" style="color: #ef4444;">{{ store.t('Latency P99') }}</span>
          <span class="val">{{ metrics.latencyP99 }}</span>
        </el-card>
      </el-col>
    </el-row>

    <!-- Charts grid -->
    <PhoenixMetricCharts :metrics="metrics" />
  </template>

  <!-- Root Spans Table -->
  <el-card v-if="showTable" class="chart-card" style="margin-top: 1.5rem;">
    <template #header>
      <div class="spans-table-header">
        <div class="chart-header-title">
          <el-icon class="card-chart-icon" style="color: #10b981;"><DataBoard /></el-icon>
          <span>{{ store.t('Spans') }}</span>
          <el-tag size="small" type="info" style="margin-left: 8px;">{{ filteredSpans.length }}</el-tag>
        </div>
        <!-- Search + Filter bar (mimics Phoenix) -->
        <div class="spans-search-bar">
          <el-input
            v-model="searchText"
            :placeholder="store.t('filter condition (e.g. span_kind == \'LLM\')')"
            clearable size="small" style="width: 380px;"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-select v-model="filterStatus" size="small" style="width: 120px;" :placeholder="store.t('Status')">
            <el-option :label="store.t('All')" value="" />
            <el-option label="OK" value="OK" />
            <el-option label="ERROR" value="ERROR" />
          </el-select>
          <el-select v-model="filterKind" size="small" style="width: 120px;" :placeholder="store.t('Kind')">
            <el-option :label="store.t('All kinds')" value="" />
            <el-option label="chain" value="chain" />
            <el-option label="llm" value="llm" />
            <el-option label="tool" value="tool" />
            <el-option label="retriever" value="retriever" />
          </el-select>
        </div>
      </div>
    </template>

    <el-table
      :data="pagedSpans"
      style="width: 100%" size="small"
      @row-click="(row) => $emit('openSpan', row)"
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
          <span class="kind-chip" :class="row.kind || 'chain'">{{ row.kind || 'chain' }}</span>
        </template>
      </el-table-column>

      <!-- Name -->
      <el-table-column :label="store.t('name')" min-width="100" max-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="span-name-link">{{ row.name }}</span>
        </template>
      </el-table-column>

      <!-- Input -->
      <el-table-column :label="store.t('input')" width="160" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="truncated-json" :title="row.input">{{ row.input || '{"method":"GET","url":...' }}</span>
        </template>
      </el-table-column>

      <!-- Output -->
      <el-table-column :label="store.t('output')" width="160" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="truncated-json" :title="row.output">{{ row.output || '--' }}</span>
        </template>
      </el-table-column>

      <!-- Annotations -->
      <el-table-column :label="store.t('Annotations')" width="110" align="center" show-overflow-tooltip>
        <template #default>
          <span class="annotation-dash">--</span>
        </template>
      </el-table-column>

      <!-- Start time -->
      <el-table-column :label="store.t('start time')" width="160" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="meta-text">{{ formatTime(row.startTime) }}</span>
        </template>
      </el-table-column>

      <!-- Latency -->
      <el-table-column :label="store.t('latency')" width="110" align="right">
        <template #default="{ row }">
          <span class="latency-badge" :class="{ slow: row.durationMs > 1000 }">
            <el-icon style="font-size: 0.75rem;"><Timer /></el-icon>
            {{ formatLatency(row.durationMs) }}
          </span>
        </template>
      </el-table-column>

      <!-- Total tokens -->
      <el-table-column :label="store.t('total tokens')" width="110" align="right">
        <template #default="{ row }">
          <span class="tokens-badge">
            <el-icon style="font-size: 0.75rem;"><Coin /></el-icon>
            {{ row.totalTokens ?? 0 }}
          </span>
        </template>
      </el-table-column>
    </el-table>

    <!-- Pagination -->
    <div class="pagination-bar">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50]"
        :total="filteredSpans.length"
        layout="total, sizes, prev, pager, next"
        background
        small
      />
    </div>
  </el-card>
</template>

<script setup>
import { ref, computed } from 'vue';
import { DataBoard, CircleCheck, CircleClose, Search, Timer, Coin } from '@element-plus/icons-vue';
import { store } from '../../stores';
import PhoenixMetricCharts from './PhoenixMetricCharts.vue';

const props = defineProps({
  metrics:    { type: Object,  default: null },
  spans:      { type: Array,   default: () => [] },
  dataSource: { type: String,  default: '' },
  showMetrics:{ type: Boolean, default: true },
  showTable:  { type: Boolean, default: true },
});
defineEmits(['openSpan']);

// Search / filter state
const searchText   = ref('');
const filterStatus = ref('');
const filterKind   = ref('');
const currentPage  = ref(1);
const pageSize     = ref(20);

const filteredSpans = computed(() => {
  return props.spans.filter(s => {
    const matchText   = !searchText.value || s.name?.toLowerCase().includes(searchText.value.toLowerCase());
    const matchStatus = !filterStatus.value || (s.statusCode ?? 'OK') === filterStatus.value;
    const matchKind   = !filterKind.value  || (s.kind ?? 'chain') === filterKind.value;
    return matchText && matchStatus && matchKind;
  });
});

const pagedSpans = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredSpans.value.slice(start, start + pageSize.value);
});

function formatTime(ts) {
  if (!ts) return new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return new Date(ts).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatLatency(ms) {
  if (!ms) return '0ms';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}
</script>

<style scoped>
.stats-indicators-row { margin-bottom: 2.5rem; }
.stat-indicator-card { display: flex; flex-direction: column; justify-content: center; height: 90px; padding: 0.5rem 1rem; }
.stat-indicator-card .lbl { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
.stat-indicator-card .val { font-size: 1.35rem; font-weight: 700; color: var(--text-primary); }
.chart-card { border-radius: var(--radius-sm) !important; }

/* Table header */
.spans-table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.spans-search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.chart-header-title { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 1rem; color: var(--text-primary); }
.card-chart-icon { color: var(--color-brand); }

/* Kind chips */
.kind-chip {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 0.78rem;
  font-weight: 500;
}
.kind-chip.chain     { background: rgba(99,102,241,0.18); color: #818cf8; }
.kind-chip.llm       { background: rgba(14,165,233,0.18); color: #38bdf8; }
.kind-chip.tool      { background: rgba(245,158,11,0.18); color: #fbbf24; }
.kind-chip.retriever { background: rgba(52,211,153,0.18); color: #34d399; }

/* Span name */
.span-name-link { color: #60a5fa; font-size: 0.85rem; cursor: pointer; font-family: 'Fira Code', monospace; }
.span-name-link:hover { text-decoration: underline; }

/* Truncated JSON preview */
.truncated-json {
  font-family: monospace;
  font-size: 0.78rem;
  color: var(--text-secondary);
  display: block;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.annotation-dash { color: var(--text-muted); }
.meta-text { font-size: 0.8rem; color: var(--text-secondary); }

/* Latency */
.latency-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 0.82rem; color: var(--text-primary); }
.latency-badge.slow { color: #ef4444; font-weight: 600; }

/* Tokens */
.tokens-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 0.82rem; color: var(--text-secondary); }

/* Pagination */
.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding: 16px 0 4px 0;
}

/* Row cursor */
:deep(.span-table-row) { cursor: pointer; }
:deep(.span-table-row:hover td) { background: var(--bg-secondary) !important; }
</style>
