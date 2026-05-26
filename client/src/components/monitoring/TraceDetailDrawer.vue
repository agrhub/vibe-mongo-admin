<template>
  <el-drawer
    v-model="visible"
    direction="rtl"
    :size="store.chatSidebarOpen ? '100%' : '82%'"
    :with-header="false"
    custom-class="phoenix-drawer"
    :modal-class="store.chatSidebarOpen ? 'drawer-with-chatbot' : ''"
  >
    <div v-if="span" class="phoenix-drawer-container">
      <!-- Header -->
      <div class="phoenix-drawer-header">
        <div class="drawer-title">
          <el-icon style="margin-right: 8px; color: #60a5fa;"><DataAnalysis /></el-icon>
          <span style="color: #9ca3af; margin-right: 8px;">{{ store.t('Trace') }}</span>
          <el-tag size="small" type="primary">ID {{ span.traceId || 'N/A' }}</el-tag>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <!-- <el-button round type="danger" icon="Tools" @click="triggerSelfHealing">
            {{ store.t('Self-Healing (Auto-Fix)') }}
          </el-button> -->
          <el-button round type="success" icon="Star" @click="runEvaluation">
            {{ store.t('AI Judge Evaluate') }}
          </el-button>
          <el-button round icon="ChatLineRound" type="primary" @click="askAiToOptimize">
            {{ store.t('Ask AI to Optimize') }}
          </el-button>
          <el-button @click="visible = false" text circle icon="Close" />
        </div>
      </div>

      <!-- Top Stats -->
      <div class="phoenix-drawer-stats">
        <div class="stat-item">
          <div class="stat-label">{{ store.t('STATUS') }}</div>
          <div class="stat-value">
            <el-tag :type="span.statusCode === 'ERROR' ? 'danger' : 'success'" size="small">{{ span.statusCode || 'OK' }}</el-tag>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-label">{{ store.t('TOTAL COST') }}</div>
          <div class="stat-value">
            <el-tag type="primary" size="small">{{ estimatedCost }}</el-tag>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-label">{{ store.t('LATENCY') }}</div>
          <div class="stat-value">
            <el-tag type="primary" size="small"><el-icon style="font-size: 0.85rem;"><Timer /></el-icon>{{ formatLatency(span.durationMs) }}</el-tag>
          </div>
        </div>
      </div>

      <div class="phoenix-drawer-body">
        <!-- LEFT: Span Tree using el-tree -->
        <div class="span-tree-panel">
          <div class="tree-header">
            <el-input v-model="treeFilter" :placeholder="store.t('filter condition')" size="small" clearable>
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
          </div>
          <div class="tree-content">
            <el-tree
              ref="treeRef"
              :data="treeData"
              node-key="id"
              default-expand-all
              highlight-current
              :expand-on-click-node="false"
              :filter-node-method="filterNode"
              @node-click="handleNodeClick"
              class="span-tree-container"
              style="background: transparent;"
            >
              <template #default="{ node, data }">
                <div class="custom-tree-node">
                  <span class="node-icon" :class="data.iconClass">
                    <el-icon><component :is="data.icon || Coin" /></el-icon>
                  </span>
                  <span class="node-label">{{ data.label }}</span>
                  <span class="node-duration">{{ formatLatency(data.durationMs) }}</span>
                </div>
              </template>
            </el-tree>
          </div>
        </div>

        <!-- RIGHT: Details Panel -->
        <div class="span-details-panel" v-if="activeNode">
          <!-- Details header (changes with selected node) -->
          <div class="details-header">
            <el-tag :type="activeNode.kind === 'chain' ? 'primary' : activeNode.kind === 'llm' ? 'danger' : 'success'">{{ activeNode.kind || 'retriever' }}</el-tag>
            <span class="span-name-title">{{ activeNode.label }}</span>
            <el-tag :type="activeNode.rawSpan?.status_code === 'ERROR' ? 'danger' : 'success'">{{ activeNode.rawSpan?.status_code || 'OK' }}</el-tag>
          </div>
          <div class="details-meta">
            <el-tag type="primary">ID {{ activeNode.id }}</el-tag>
            <el-tag type="success"><el-icon><Timer /></el-icon> {{ formatLatency(activeNode.durationMs) }}</el-tag>
            <el-tag type="info">at {{ formatTime(activeNode.rawSpan?.start_time ?? activeNode.rawSpan?.startTime) }}</el-tag>
          </div>

          <!-- Tabs using el-tabs -->
          <div class="details-content-tabs">
            <el-tabs v-model="activeTab" class="details-tabs-container">
              <el-tab-pane name="info">
                <template #label>
                  <span>{{ store.t('Info') }}</span>
                </template>
                
                <div class="collapsible-section" style="margin-top: 1rem; cursor: pointer;" @click="inputCollapsed = !inputCollapsed">
                  <div class="section-title">
                    <el-icon :style="{ transform: inputCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s ease' }">
                      <ArrowDown />
                    </el-icon> 
                    {{ store.t('Input') }}
                  </div>
                  <div class="section-actions" @click.stop>
                    <el-dropdown trigger="click" @command="(cmd) => inputFormat = cmd">
                      <el-button size="small">
                        {{ inputFormat === 'json' ? 'JSON' : 'Text' }} <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                      </el-button>
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item command="json">JSON</el-dropdown-item>
                          <el-dropdown-item command="text">Text</el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                    <el-button size="small" @click="copyToClipboard(inputFormat === 'json' ? inputJson : inputRaw)"><el-icon><CopyDocument /></el-icon></el-button>
                  </div>
                </div>
                <pre class="json-viewer" v-show="!inputCollapsed" v-if="inputFormat === 'json'" v-html="highlightJson(inputJson)"></pre>
                <pre class="json-viewer" v-show="!inputCollapsed" v-else>{{ inputRaw }}</pre>

                <div class="collapsible-section" style="margin-top: 20px; cursor: pointer;" @click="outputCollapsed = !outputCollapsed">
                  <div class="section-title">
                    <el-icon :style="{ transform: outputCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s ease' }">
                      <ArrowDown />
                    </el-icon> 
                    {{ store.t('Output') }}
                  </div>
                  <div class="section-actions" @click.stop>
                    <el-dropdown trigger="click" @command="(cmd) => outputFormat = cmd">
                      <el-button size="small">
                        {{ outputFormat === 'json' ? 'JSON' : 'Text' }} <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                      </el-button>
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item command="json">JSON</el-dropdown-item>
                          <el-dropdown-item command="text">Text</el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                    <el-button size="small" @click="copyToClipboard(outputFormat === 'json' ? outputJson : outputRaw)"><el-icon><CopyDocument /></el-icon></el-button>
                  </div>
                </div>
                <pre class="json-viewer" v-show="!outputCollapsed" v-if="outputFormat === 'json'" v-html="highlightJson(outputJson)"></pre>
                <pre class="json-viewer" v-show="!outputCollapsed" v-else>{{ outputRaw }}</pre>
              </el-tab-pane>

              <el-tab-pane name="annotations">
                <template #label>
                  <span>{{ store.t('Annotations') }}</span>
                  <el-badge :value="annotationsList.length" class="tab-badge" :type="annotationsList.length ? 'primary' : 'info'" style="margin-left: 6px; transform: scale(0.85);" />
                </template>
                <el-table
                  v-if="annotationsList.length"
                  :data="annotationsList"
                  size="small"
                  border
                  style="width: 100%; margin-top: 1rem;"
                >
                  <el-table-column prop="name" :label="store.t('Name')" width="160" show-overflow-tooltip />
                  <el-table-column prop="annotator_kind" :label="store.t('Annotator')" width="100" show-overflow-tooltip />
                  <el-table-column prop="result" :label="store.t('Result')" show-overflow-tooltip>
                    <template #default="{ row }">
                      <span style="font-family: monospace; color: var(--color-success);">{{ row.result?.label || row.result?.score || JSON.stringify(row.result) }}</span>
                    </template>
                  </el-table-column>
                </el-table>
                <div v-else class="empty-tab-state">
                  <el-icon style="font-size: 2rem; color: #4b5563;"><Star /></el-icon>
                  <p>{{ store.t('No annotations on this span yet.') }}</p>
                </div>
              </el-tab-pane>

              <el-tab-pane name="attributes">
                <template #label>
                  <span>{{ store.t('Attributes') }}</span>
                  <el-badge :value="attributesList.length" class="tab-badge" type="primary" style="margin-left: 6px; transform: scale(0.85);" />
                </template>
                <el-table
                  v-if="attributesList.length"
                  :data="attributesList"
                  size="small"
                  border
                  style="width: 100%; margin-top: 1rem;"
                >
                  <el-table-column prop="key" :label="store.t('Key')" width="220" show-overflow-tooltip />
                  <el-table-column prop="value" :label="store.t('Value')" show-overflow-tooltip>
                    <template #default="{ row }">
                      <span style="font-family: monospace; color: var(--color-success);">{{ row.value }}</span>
                    </template>
                  </el-table-column>
                </el-table>
                <div v-else class="empty-tab-state">
                  <p>{{ store.t('No attributes available.') }}</p>
                </div>
              </el-tab-pane>

              <el-tab-pane name="events">
                <template #label>
                  <span>{{ store.t('Events') }}</span>
                  <el-badge :value="eventsList.length" class="tab-badge" :type="eventsList.length ? 'primary' : 'info'" style="margin-left: 6px; transform: scale(0.85);" />
                </template>
                <el-table
                  v-if="eventsList.length"
                  :data="eventsList"
                  size="small"
                  border
                  style="width: 100%; margin-top: 1rem;"
                >
                  <el-table-column prop="name" :label="store.t('Event')" width="200" show-overflow-tooltip />
                  <el-table-column prop="time" :label="store.t('Time')" width="180" show-overflow-tooltip>
                    <template #default="{ row }">
                      <span>{{ new Date(row.time).toLocaleString() }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column prop="attributes" :label="store.t('Attributes')" show-overflow-tooltip>
                    <template #default="{ row }">
                      <span style="font-family: monospace; color: var(--color-success);">{{ JSON.stringify(row.attributes || {}) }}</span>
                    </template>
                  </el-table-column>
                </el-table>
                <div v-else class="empty-tab-state">
                  <el-icon style="font-size: 2rem; color: #4b5563;"><Bell /></el-icon>
                  <p>{{ store.t('No events on this span.') }}</p>
                </div>
              </el-tab-pane>

              <!-- WATERFALL TAB -->
              <el-tab-pane name="waterfall">
                <template #label>
                  <span>{{ store.t('Waterfall') }}</span>
                </template>
                <div ref="waterfallChartRef" style="width:100%; height:420px; margin-top:8px;"></div>
              </el-tab-pane>
            </el-tabs>
          </div>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { Connection, DataAnalysis, Close, Timer, Search, ArrowDown, Coin, CopyDocument, Star, Bell, ChatLineRound, Tools } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { store } from '../../stores';
import axios from 'axios';
import * as echarts from 'echarts';

const visible = defineModel('visible', { type: Boolean, default: false });

const props = defineProps({
  span: { type: Object, default: null },
  conn: { type: String, default: '' },
});

// Tree and Loading state
const treeRef          = ref(null);
const treeFilter       = ref('');
const activeNodeId     = ref('');
const activeNode       = ref(null);
const activeTab        = ref('info');
const inputFormat      = ref('json');
const outputFormat     = ref('json');
const inputCollapsed   = ref(false);
const outputCollapsed  = ref(false);
const traceSpans       = ref([]);
const loadingTrace     = ref(false);
const loadingEval      = ref(false);
const waterfallChartRef = ref(null);
let   _waterfallChart  = null;

async function fetchTraceDetails() {
  if (!props.span?.traceId) return;
  loadingTrace.value = true;
  try {
    const res = await axios.get(`/api/${props.conn}/monitoring/trace/${props.span.traceId}`);
    if (res.data?.success && res.data.trace) {
      traceSpans.value = res.data.trace.spans || [];
      const root = treeData.value[0];
      if (root) selectNode(root);
      await nextTick();
      if (activeTab.value === 'waterfall') renderWaterfall();
    }
  } catch (err) {
    console.error('Failed to load trace details:', err);
    ElMessage.error('Failed to load trace details');
  } finally {
    loadingTrace.value = false;
  }
}

// Build child nodes dynamically from online span data
const treeData = computed(() => {
  if (traceSpans.value.length === 0) {
    if (!props.span) return [];
    return [{
      id: props.span.spanId || 'root',
      label: props.span.name || 'root',
      durationMs: props.span.durationMs || 0,
      kind: props.span.kind || 'chain',
      icon: Connection,
      iconClass: 'root-icon',
      children: [],
      rawSpan: props.span
    }];
  }

  const map = {};
  const rootNodes = [];

  traceSpans.value.forEach(s => {
    const spanId = s.spanId ?? s.span_id ?? s.context?.span_id ?? s.id;
    const durationMs = formatDuration(s);
    const kind = (s.span_kind ?? s.kind ?? 'chain').toLowerCase();
    
    let icon = Coin;
    let iconClass = 'db-icon';
    if (kind === 'chain') {
      icon = Connection;
      iconClass = 'root-icon';
    } else if (kind === 'llm') {
      icon = Connection;
      iconClass = 'llm-icon';
    } else if (kind === 'tool') {
      icon = Coin;
      iconClass = 'tool-icon';
    } else if (kind === 'retriever') {
      icon = Coin;
      iconClass = 'retriever-icon';
    }

    map[spanId] = {
      id: spanId,
      label: s.name || 'unknown',
      durationMs,
      kind,
      icon,
      iconClass,
      children: [],
      rawSpan: s
    };
  });

  traceSpans.value.forEach(s => {
    const spanId = s.spanId ?? s.span_id ?? s.context?.span_id ?? s.id;
    const parentId = s.parent_span_id ?? s.parentSpanId ?? s.parent_id ?? s.context?.parent_span_id;
    const node = map[spanId];
    if (parentId && map[parentId]) {
      map[parentId].children.push(node);
    } else {
      rootNodes.push(node);
    }
  });

  const getStartTimeMs = (node) => {
    const ts = node.rawSpan?.start_time ?? node.rawSpan?.startTime;
    if (!ts) return 0;
    return new Date(ts).getTime();
  };

  // Sort child nodes chronologically
  Object.values(map).forEach((node) => {
    node.children.sort((a, b) => getStartTimeMs(a) - getStartTimeMs(b));
  });

  // Sort root nodes chronologically
  rootNodes.sort((a, b) => getStartTimeMs(a) - getStartTimeMs(b));

  return rootNodes;
});

function formatDuration(s) {
  if (typeof s.duration === 'number') return s.duration;
  if (typeof s.durationMs === 'number') return s.durationMs;
  if (typeof s.latencyMs === 'number') return s.latencyMs;
  const start = new Date(s.start_time ?? s.startTime).getTime();
  const end = new Date(s.end_time ?? s.endTime).getTime();
  if (!isNaN(start) && !isNaN(end)) {
    return Math.max(0, end - start);
  }
  return 0;
}

watch(treeFilter, (val) => {
  treeRef.value?.filter(val);
});

const filterNode = (value, data) => {
  if (!value) return true;
  return data.label?.toLowerCase().includes(value.toLowerCase());
};

const attributesList = computed(() => {
  const attrs = activeNode.value?.rawSpan?.attributes || {};
  return Object.entries(attrs).map(([key, value]) => ({
    key,
    value: typeof value === 'object' ? JSON.stringify(value) : String(value)
  }));
});

const annotationsList = computed(() => {
  return activeNode.value?.rawSpan?.annotations || [];
});

const eventsList = computed(() => {
  return activeNode.value?.rawSpan?.events || [];
});

const estimatedCost = computed(() => {
  if (!props.span) return '$0.00000';
  const spans = traceSpans.value.length ? traceSpans.value : [props.span];
  let totalMs = 0;
  let docsExamined = 0;
  spans.forEach(s => {
    totalMs += formatDuration(s);
    const attrs = s.attributes || {};
    const docs = attrs["mongodb.docs_examined"] ?? attrs["db.mongodb.docs_examined"] ?? attrs["docsExamined"] ?? 0;
    docsExamined += Number(docs);
  });
  
  // If it is a COLLSCAN (sequential collection scan) or a query without indexes, assume substantial document scans
  if (docsExamined === 0 && props.span?.name?.toLowerCase().includes('collscan')) {
    docsExamined = 1250;
  }
  
  // Estimate using MongoDB Atlas serverless read pricing ($0.15 per million reads) and duration resource factor
  const cost = (docsExamined * 0.00000015) + (totalMs * 0.00000008);
  return `$${cost.toFixed(5)}`;
});

watch([visible, () => props.span], () => {
  if (visible.value && props.span) {
    // Reset state
    traceSpans.value = [];
    activeNode.value = {
      id: props.span.spanId || 'root',
      label: props.span.name || 'root',
      durationMs: props.span.durationMs || 0,
      kind: props.span.kind || 'chain',
      rawSpan: props.span
    };
    activeNodeId.value = props.span.spanId || 'root';
    fetchTraceDetails();
  }
}, { immediate: true });

function handleNodeClick(data) {
  selectNode(data);
}

function selectNode(node) {
  activeNodeId.value = node.id;
  activeNode.value = node;
  activeTab.value = 'info';
}

// JSON content for active node
const inputJson = computed(() => {
  if (!activeNode.value) return '{}';
  const rawSpan = activeNode.value.rawSpan || {};
  const attrs = rawSpan.attributes || {};
  
  const val = attrs["input.value"] ?? attrs["db.statement"];
  if (val) {
    try {
      if (typeof val === 'string' && (val.trim().startsWith('{') || val.trim().startsWith('['))) {
        return JSON.stringify(JSON.parse(val), null, 2);
      }
    } catch (e) {}
    if (typeof val === 'object') return JSON.stringify(val, null, 2);
    return String(val);
  }
  
  return JSON.stringify({
    name: rawSpan.name,
    kind: rawSpan.span_kind ?? rawSpan.kind,
    attributes: attrs
  }, null, 2);
});

const outputJson = computed(() => {
  if (!activeNode.value) return '{}';
  const rawSpan = activeNode.value.rawSpan || {};
  const attrs = rawSpan.attributes || {};
  
  const val = attrs["output.value"];
  if (val) {
    try {
      if (typeof val === 'string' && (val.trim().startsWith('{') || val.trim().startsWith('['))) {
        return JSON.stringify(JSON.parse(val), null, 2);
      }
    } catch (e) {}
    if (typeof val === 'object') return JSON.stringify(val, null, 2);
    return String(val);
  }
  
  return JSON.stringify({
    status: rawSpan.status_code ?? rawSpan.status,
    status_message: rawSpan.status_message || ''
  }, null, 2);
});

const inputRaw = computed(() => {
  if (!activeNode.value) return '';
  const rawSpan = activeNode.value.rawSpan || {};
  const attrs = rawSpan.attributes || {};
  return attrs["input.value"] ?? attrs["db.statement"] ?? '';
});

const outputRaw = computed(() => {
  if (!activeNode.value) return '';
  const rawSpan = activeNode.value.rawSpan || {};
  const attrs = rawSpan.attributes || {};
  return attrs["output.value"] ?? '';
});

function highlightJson(raw) {
  if (!raw) return '';
  return raw
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"([^"]+)":/g, '<span class="syntax-key">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span class="syntax-string">"$1"</span>')
    .replace(/: (true|false|null)/g, ': <span class="syntax-bool">$1</span>')
    .replace(/: (\d+)/g, ': <span class="syntax-number">$1</span>')
    .replace(/([{}[\]])/g, '<span class="syntax-bracket">$1</span>');
}

function formatLatency(ms) {
  if (!ms) return '0ms';
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function formatTime(ts) {
  if (!ts) return new Date().toLocaleString();
  return new Date(ts).toLocaleString();
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success('Copied!');
  } catch {
    ElMessage.error('Copy failed');
  }
}

// ---- Waterfall ECharts (Gantt-style) ----
function renderWaterfall() {
  const el = waterfallChartRef.value;
  if (!el) return;

  const rawSpans = traceSpans.value.length ? traceSpans.value : (props.span ? [props.span] : []);
  if (!rawSpans.length) return;

  if (!_waterfallChart) {
    _waterfallChart = echarts.init(el);
  }

  const spans = rawSpans
    .map(s => ({
      name:   (s.name ?? 'span').slice(0, 50),
      dur:    formatDuration(s),
      start:  new Date(s.start_time ?? s.startTime ?? 0).getTime(),
      status: (s.status_code ?? s.statusCode ?? 'OK').toUpperCase(),
      kind:   (s.span_kind ?? s.kind ?? 'chain').toLowerCase(),
    }))
    .filter(s => s.start > 0 || s.dur > 0)
    .sort((a, b) => a.start - b.start);

  if (!spans.length) {
    _waterfallChart.setOption({ title: { text: 'No span timing data available', textStyle: { color: '#9ca3af', fontSize: 14 }, left: 'center', top: 'middle' } });
    return;
  }

  const t0     = Math.min(...spans.map(s => s.start));
  const bottleneckIdx = spans.reduce((bi, s, i) => s.dur > spans[bi].dur ? i : bi, 0);
  const kindColor = { chain: '#6366f1', llm: '#0ea5e9', tool: '#f59e0b', retriever: '#10b981' };
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  const seriesData = spans.map((s, i) => {
    const isBottleneck = i === bottleneckIdx;
    const isError = s.status === 'ERROR';
    const color = isError ? '#ef4444' : isBottleneck ? '#f97316' : (kindColor[s.kind] ?? '#6366f1');
    const label = s.dur >= 1000 ? `${(s.dur/1000).toFixed(1)}s${isBottleneck ? ' 🔥' : ''}` : `${s.dur}ms${isBottleneck ? ' 🔥' : ''}`;
    return {
      value: [i, s.start - t0, s.start - t0 + s.dur, s.dur, isBottleneck ? 1 : 0],
      itemStyle: { color, borderRadius: 3 },
      label: { show: true, position: 'insideLeft', formatter: label, color: '#fff', fontSize: 11, fontWeight: isBottleneck ? 'bold' : 'normal' },
    };
  });

  const axisColor  = isDark ? '#6b7280' : '#9ca3af';
  const labelColor = isDark ? '#d1d5db' : '#374151';

  _waterfallChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter(params) {
        const s = spans[params.dataIndex];
        const btl = params.dataIndex === bottleneckIdx ? '<b style="color:#f97316"> 🔥 BOTTLENECK</b>' : '';
        const dur = s.dur >= 1000 ? `${(s.dur/1000).toFixed(2)}s` : `${s.dur}ms`;
        return `<b>${s.name}</b>${btl}<br/>Kind: ${s.kind}<br/>Latency: ${dur}<br/>Status: ${s.status}`;
      }
    },
    grid: { left: 16, right: 24, top: 8, bottom: 32, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { color: axisColor, formatter: v => v >= 1000 ? `${(v/1000).toFixed(1)}s` : `${v}ms` },
      splitLine: { lineStyle: { color: isDark ? '#1f2937' : '#f3f4f6' } },
    },
    yAxis: {
      type: 'category',
      data: spans.map((s, i) => i === bottleneckIdx ? `🔥 ${s.name}` : s.name),
      axisLabel: { color: labelColor, fontSize: 11, fontFamily: 'monospace', width: 200, overflow: 'truncate' },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: isDark ? '#374151' : '#e5e7eb' } },
      inverse: false,
    },
    series: [{
      type: 'custom',
      renderItem(params, api) {
        const idx   = api.value(0);
        const s0    = api.coord([api.value(1), idx]);
        const s1    = api.coord([api.value(2), idx]);
        const h     = api.size([0, 1])[1] * 0.55;
        return {
          type: 'rect',
          shape: { x: s0[0], y: s0[1] - h / 2, width: Math.max(s1[0] - s0[0], 4), height: h },
          style: api.style(),
          emphasis: { style: api.styleEmphasis() },
        };
      },
      data: seriesData,
      encode: { x: [1, 2], y: 0 },
    }],
  }, { notMerge: true });

  _waterfallChart.resize();
  window.addEventListener('resize', () => _waterfallChart?.resize());
}

// Re-render when switching to waterfall tab
watch(activeTab, async (tab) => {
  if (tab === 'waterfall') {
    await nextTick();
    renderWaterfall();
  }
});

// ---- Ask AI to Optimize ----
function askAiToOptimize() {
  const spans = traceSpans.value.length ? traceSpans.value : (props.span ? [props.span] : []);
  const sorted = [...spans]
    .map(s => ({ name: s.name ?? 'span', dur: formatDuration(s), kind: (s.span_kind ?? s.kind ?? 'chain') }))
    .sort((a, b) => b.dur - a.dur);

  const bottleneck = sorted[0];
  const spanLines  = sorted.slice(0, 15).map(s => {
    const d = s.dur >= 1000 ? `${(s.dur/1000).toFixed(2)}s` : `${s.dur}ms`;
    return `  - [${s.kind}] ${s.name}: ${d}`;
  }).join('\n');

  const rootName = props.span?.name ?? 'unknown';
  const rootMs   = formatLatency(props.span?.durationMs);
  const btlName  = bottleneck?.name ?? 'N/A';
  const btlMs    = bottleneck ? (bottleneck.dur >= 1000 ? `${(bottleneck.dur/1000).toFixed(2)}s` : `${bottleneck.dur}ms`) : 'N/A';

  const prompt =
`Analyze this slow trace from Phoenix monitoring and suggest optimizations:

**Trace ID**: ${props.span?.traceId ?? 'N/A'}
**Root span**: ${rootName} — total latency: ${rootMs}
**Bottleneck span**: ${btlName} (${btlMs})

**All spans (slowest first)**:
${spanLines}

Please:
1. Identify the root cause and suggest concrete optimizations (MongoDB indexes, prompt size reduction, caching strategies, parallel execution, etc.).
2. Perform a **Predictive Performance Bottleneck Analysis & Trend Analysis**:
   - Forecast how this bottleneck will behave if database/collection size scales 10x or 100x (especially in case of COLLSCAN).
   - Predict the latency growth rate and tell if it will breach critical latency (>3 seconds) soon under concurrent production traffic.`;

  store.openChatWithCommand(prompt, '', true);
}

// ---- Run AI Judge Evaluation ----
function runEvaluation() {
  if (!props.span?.traceId) return;
  
  const rootName = props.span?.name ?? 'unknown';
  const rootMs   = formatLatency(props.span?.durationMs);
  
  const node = activeNode.value ? activeNode.value : { rawSpan: props.span };
  const attrs = node.rawSpan?.attributes || {};
  const inputStr = attrs["input.value"] ?? attrs["db.statement"] ?? 'Không có dữ liệu input';
  const outputStr = attrs["output.value"] ?? 'Không có dữ liệu output';

  const lang = store.activeLocale === 'vn' ? 'Vietnamese' : 'English';
  const prompt =
`I want you to act as an **AI Judge** to evaluate this database trace.

**Trace ID**: ${props.span?.traceId ?? 'N/A'}
**Root span**: ${rootName} (duration: ${rootMs})
**Current span**: ${node.label || rootName}

**Input**: 
\`\`\`
${inputStr}
\`\`\`

**Output**: 
\`\`\`
${outputStr}
\`\`\`

Please explain step-by-step:
1. What does this input mean and what is the system trying to execute?
2. What does the output mean?
3. Evaluate and score this operation's safety and performance on a scale from 0 to 100 (e.g., **Score: 92/100**). Explain if it is SAFE, OPTIMAL, or SUBOPTIMAL and provide the reasoning behind the score.
4. Perform a **Security & Privacy Audit (NoSQL Injection & PII Leakage Detection)**:
   - Analyze if there are signs of NoSQL injection bypass, malicious query payload, schema extraction, or data leakage risks (e.g. passwords, API keys, credentials).
   - Display a **Security Status** (e.g., SECURE, WARNING, or VULNERABLE).

Note: Please explain in detail and in a way that is easy for a non-technical person to understand.
IMPORTANT: You MUST reply entirely in ${lang}.`;

  store.openChatWithCommand(prompt, '', true);
}

// ---- DB-Guardian Autonomous Self-Healing ----
async function triggerSelfHealing() {
  const node = activeNode.value ? activeNode.value : { rawSpan: props.span };
  const attrs = node.rawSpan?.attributes || {};
  
  const dbName = attrs["db.name"] ?? attrs["database"] ?? store.activeDb ?? 'admin';
  const collName = attrs["db.mongodb.collection"] ?? attrs["mongodb.collection"] ?? attrs["db.collection"] ?? store.activeColl ?? 'users';
  
  let suggestedKeys = '{"_id": 1}';
  try {
    const statement = attrs["db.statement"] ?? attrs["input.value"];
    if (statement) {
      let queryObj = {};
      if (typeof statement === 'string') {
        queryObj = JSON.parse(statement);
      } else if (typeof statement === 'object') {
        queryObj = statement;
      }
      
      // Handle standard MongoDB queries
      let filterObj = queryObj;
      if (queryObj.find && queryObj.filter) {
        filterObj = queryObj.filter;
      } else if (queryObj.query) {
        filterObj = queryObj.query;
      }
      
      const keys = Object.keys(filterObj).filter(k => !k.startsWith('$'));
      if (keys.length > 0) {
        const indexObj = {};
        keys.forEach(k => { indexObj[k] = 1; });
        suggestedKeys = JSON.stringify(indexObj, null, 2);
      }
    }
  } catch (e) {
    console.error('Failed to parse suggested index keys:', e);
  }

  try {
    const { value: keysInput } = await ElMessageBox.prompt(
      `DB-Guardian SRE detected a sub-optimal query trace. We recommend creating an index to resolve the bottleneck.\n\nDatabase: **${dbName}**\nCollection: **${collName}**\n\nPlease confirm the index keys:`,
      'DB-Guardian Autonomous Self-Healing',
      {
        confirmButtonText: 'Create Index & Fix',
        cancelButtonText: 'Cancel',
        inputValue: suggestedKeys,
        inputPlaceholder: '{"field": 1}',
        inputValidator: (val) => {
          try {
            JSON.parse(val);
            return true;
          } catch (e) {
            return 'Please enter a valid JSON format for the index keys';
          }
        }
      }
    );

    if (!keysInput) return;

    ElMessage.info('Executing self-healing auto-fix...');

    const res = await axios.post(`/api/${props.conn}/${dbName}/${collName}/index/create`, {
      keys: keysInput,
      unique: false,
      sparse: false
    });

    if (res.status === 200) {
      ElMessage.success(`Self-Healing success! Index successfully created on ${dbName}.${collName}! 🚀`);
      // Update AI Agent with context
      const healingLog = `[SRE Action] DB-Guardian successfully performed self-healing. Automatically created index: ${keysInput} on collection "${dbName}.${collName}" to resolve query bottleneck.`;
      store.openChatWithCommand(healingLog, '', false);
    }
  } catch (err) {
    if (err !== 'cancel') {
      console.error('Self-healing failed:', err);
      ElMessage.error(err.response?.data?.msg || 'Self-healing failed to create index');
    }
  }
}
</script>

<style scoped>
/* Container */
.phoenix-drawer-container {
  display: flex; flex-direction: column; height: 100%;
  /* background-color: #0f1115; 
  color: #e5e7eb; 
  padding: 0; */
  /* font-family: 'Inter', 'Outfit', sans-serif; */
}

/* Header */
.phoenix-drawer-header {
  display: flex; 
  justify-content: space-between; 
  align-items: center;
  padding: 14px 24px; 
  /* background-color: #1a1d24;  */
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}
.drawer-title { 
  display: flex; 
  align-items: center; 
  font-size: 1rem; 
  font-weight: 600; 
  color: #f3f4f6; 
}
.trace-id { 
  background: #2d333b; 
  padding: 3px 10px; 
  border-radius: 6px; 
  font-size: 0.82rem; 
  color: #9ca3af; 
  font-family: monospace; 
}

/* Stats bar */
.phoenix-drawer-stats {
  display: flex; 
  gap: 36px; 
  padding: 10px 24px;
  border-bottom: 1px solid var(--border-color); 
  flex-shrink: 0;
}
.stat-item { 
  display: flex; 
  flex-direction: column; 
  gap: 3px; 
}
.stat-label { 
  font-size: 0.7rem; 
  color: #6b7280; 
  text-transform: uppercase; 
  letter-spacing: 0.08em; 
}
.stat-value { 
  font-size: 0.9rem; 
  font-weight: 600; 
  display: flex; 
  align-items: center; 
  gap: 5px; 
  color: #f3f4f6; 
}
.status-pill.ok    { 
  background: rgba(16,185,129,0.15); 
  color: #10b981; 
  padding: 2px 10px; 
  border-radius: 12px; 
  font-size: 0.78rem; 
  border: 1px solid rgba(16,185,129,0.3); 
}
.status-pill.error { 
  background: rgba(239,68,68,0.15);  color: #ef4444; 
  padding: 2px 10px; 
  border-radius: 12px; font-size: 0.78rem; 
  border: 1px solid rgba(239,68,68,0.3); 
}

/* Body split */
.phoenix-drawer-body { 
  display: flex; 
  flex: 1; 
  overflow: hidden; 
}

/* Span tree */
.span-tree-panel { 
  width: 320px; 
  border-right: 1px solid var(--border-color);
  display: flex; 
  flex-direction: column; 
  flex-shrink: 0; 
}
.tree-header { 
  padding: 12px; 
  border-bottom: 1px solid var(--border-color); 
}
.tree-content { 
  flex: 1; 
  overflow-y: auto; 
  padding: 4px 8px; 
}
.custom-tree-node {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
  width: 100%;
  padding-right: 8px;
}
.node-icon { 
  width: 22px; 
  height: 22px; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  border-radius: 4px; 
  font-size: 0.8rem; 
  font-weight: bold; 
  flex-shrink: 0; 
}
.root-icon { 
  background-color: var(--el-color-primary); 
  color: white; 
  font-size: 0.75rem; 
}
.db-icon { 
  color: #10b981; 
  background-color: rgba(16,185,129,0.12); 
}
.node-label { 
  font-family: 'Fira Code', monospace; 
  white-space: nowrap; 
  overflow: hidden; 
  text-overflow: ellipsis; 
  max-width: 150px;
  color: var(--text-primary);
}
.node-duration { 
  font-size: 0.75rem; 
  color: #6b7280; 
  margin-left: auto;
}

/* Details panel */
.span-details-panel { 
  flex: 1;  
  display: flex; 
  flex-direction: column; 
  overflow: hidden; 
}
.details-header { 
  padding: 20px 24px 8px; 
  display: flex; 
  align-items: center; 
  gap: 12px; 
  flex-shrink: 0; 
}
.kind-badge { 
  background: rgba(52,211,153,0.15); 
  color: #34d399; 
  padding: 3px 10px; 
  border-radius: 16px; 
  font-size: 0.78rem; 
  font-weight: 500; 
}
.span-name-title { 
  font-size: 1.15rem; 
  font-weight: 600; 
  color: var(--text-primary); 
  font-family: 'Fira Code', monospace; 
}
.unset-badge { 
  color: #9ca3af; 
  padding: 2px 8px; 
  border-radius: 12px; 
  font-size: 0.73rem; 
}
.details-meta { 
  padding: 0 24px 12px; 
  display: flex; 
  align-items: center; 
  gap: 14px; 
  color: #6b7280; 
  font-size: 0.8rem; 
  border-bottom: 1px solid var(--border-color); 
  flex-shrink: 0; 
}

/* Tabs */
.details-content-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 10px 24px 0;
}
.details-tabs-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin-top: 10px;
}
:deep(.el-tabs__content) {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 24px;
}
.tab-badge {
  vertical-align: middle;
}

/* Tab content */
.collapsible-section { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  margin-bottom: 12px; 
}
.section-title { 
  display: flex; 
  align-items: center; 
  gap: 8px; 
  font-size: 0.95rem; 
  font-weight: 600; 
  color: var(--text-primary); 
}
.section-actions { 
  display: flex; 
  gap: 6px; 
}

/* JSON viewer */
.json-viewer {
  background-color: #1a1d24; 
  border: 1px solid var(--border-color); 
  border-radius: 8px;
  padding: 14px 16px; 
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 0.82rem; 
  line-height: 1.6; 
  overflow-x: auto; 
  color: #d1d5db;
  white-space: pre-wrap; word-break: break-all;
}
:deep(.syntax-key)    { color: #93c5fd; }
:deep(.syntax-string) { color: #86efac; }
:deep(.syntax-bool)   { color: #fb923c; }
:deep(.syntax-number) { color: #f9a8d4; }
:deep(.syntax-bracket){ color: #d1d5db; }

/* Empty states */
.empty-tab-state { 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  justify-content: center; 
  padding: 4rem 1rem; 
  gap: 12px; 
  color: #4b5563; 
  font-size: 0.85rem; 
}

:deep(.el-drawer__body) { 
  padding: 0; 
  overflow: hidden; 
}
:deep(.el-tree-node__content) {
  height: 38px;
}
</style>

<style>
.drawer-with-chatbot {
  right: 400px !important;
}
</style>

