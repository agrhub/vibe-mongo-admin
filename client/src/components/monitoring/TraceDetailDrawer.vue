<template>
  <el-drawer
    v-model="visible"
    direction="rtl"
    size="82%"
    :with-header="false"
    custom-class="phoenix-drawer"
  >
    <div v-if="span" class="phoenix-drawer-container">
      <!-- Header -->
      <div class="phoenix-drawer-header">
        <div class="drawer-title">
          <el-icon style="margin-right: 8px; color: #60a5fa;"><DataAnalysis /></el-icon>
          <span style="color: #9ca3af; margin-right: 8px;">{{ store.t('Trace') }}</span>
          <el-tag size="small" type="primary">ID {{ span.traceId || 'N/A' }}</el-tag>
        </div>
        <el-button @click="visible = false" text style="color: #9ca3af;">
          <el-icon><Close /></el-icon>
        </el-button>
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
            <el-tag type="primary" size="small">$0</el-tag>
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
        <div class="span-details-panel">
          <!-- Details header (changes with selected node) -->
          <div class="details-header">
            <el-tag type="success">{{ activeNode.kind || 'retriever' }}</el-tag>
            <span class="span-name-title">{{ activeNode.name || 'mongodb.listDatabases' }}</span>
            <el-tag type="info">Unset</el-tag>
          </div>
          <div class="details-meta">
            <el-tag type="primary">ID {{ activeNode.id || '6041f5c395376399' }}</el-tag>
            <el-tag type="success"><el-icon><Timer /></el-icon> {{ formatLatency(activeNode.durationMs) }}</el-tag>
            <el-tag type="info">at {{ new Date(span.startTime || Date.now()).toLocaleString() }}</el-tag>
          </div>

          <!-- Tabs using el-tabs -->
          <div class="details-content-tabs" style="padding: 10px 24px 0;">
            <el-tabs v-model="activeTab" class="details-tabs-container">
              <el-tab-pane name="info">
                <template #label>
                  <span>{{ store.t('Info') }}</span>
                </template>
                
                <div class="collapsible-section" style="margin-top: 1rem;">
                  <div class="section-title"><el-icon><ArrowDown /></el-icon> {{ store.t('Input') }}</div>
                  <div class="section-actions">
                    <el-button size="small">{{ store.t('Text') }} <el-icon><ArrowDown /></el-icon></el-button>
                    <el-button size="small" @click="copyToClipboard(inputJson)"><el-icon><CopyDocument /></el-icon></el-button>
                  </div>
                </div>
                <pre class="json-viewer" v-html="highlightJson(inputJson)"></pre>

                <div class="collapsible-section" style="margin-top: 20px;">
                  <div class="section-title"><el-icon><ArrowDown /></el-icon> {{ store.t('Output') }}</div>
                  <div class="section-actions">
                    <el-button size="small">{{ store.t('Text') }} <el-icon><ArrowDown /></el-icon></el-button>
                    <el-button size="small" @click="copyToClipboard(outputJson)"><el-icon><CopyDocument /></el-icon></el-button>
                  </div>
                </div>
                <pre class="json-viewer" v-html="highlightJson(outputJson)"></pre>
              </el-tab-pane>

              <el-tab-pane name="annotations">
                <template #label>
                  <span>{{ store.t('Annotations') }}</span>
                  <el-badge :value="0" class="tab-badge" type="info" style="margin-left: 6px; transform: scale(0.85);" />
                </template>
                <div class="empty-tab-state">
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
                  <el-badge :value="0" class="tab-badge" type="info" style="margin-left: 6px; transform: scale(0.85);" />
                </template>
                <div class="empty-tab-state">
                  <el-icon style="font-size: 2rem; color: #4b5563;"><Bell /></el-icon>
                  <p>{{ store.t('No events on this span.') }}</p>
                </div>
              </el-tab-pane>
            </el-tabs>
          </div>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { Connection, DataAnalysis, Close, Timer, Search, ArrowDown, Coin, CopyDocument, Star, Bell } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { store } from '../../stores';

const visible = defineModel('visible', { type: Boolean, default: false });

const props = defineProps({
  span: { type: Object, default: null },
  conn: { type: String, default: '' },
});

// Tree state
const treeRef      = ref(null);
const treeFilter   = ref('');
const activeNodeId = ref('root');
const activeNode   = ref({});
const activeTab    = ref('info');

// Build child nodes dynamically from span data
const childNodes = computed(() => {
  if (!props.span) return [];
  const nodes = [
    { id: 'mongo-status',    label: 'mongodb.serverStatus',   durationMs: 12, kind: 'tool', iconClass: 'db-icon', icon: Coin,
      attributes: { 'db.system': 'mongodb', 'db.operation': 'serverStatus', 'db.name': props.span.db || 'admin' } },
    { id: 'mongo-listdb',    label: 'mongodb.listDatabases',  durationMs: 56, kind: 'tool', iconClass: 'db-icon', icon: Coin,
      attributes: { 'db.system': 'mongodb', 'db.operation': 'listDatabases' } },
  ];
  if (props.span.name?.includes('POST') || props.span.name?.includes('find')) {
    nodes.push({ id: 'mongo-find', label: 'mongodb.find', durationMs: props.span.durationMs, kind: 'retriever', iconClass: 'db-icon', icon: Coin,
      attributes: { 'db.system': 'mongodb', 'db.operation': 'find', 'db.mongodb.collection': props.span.collection, 'db.name': props.span.db } });
  }
  if (props.span.name?.includes('aggregate')) {
    nodes.push({ id: 'mongo-agg', label: 'mongodb.aggregate', durationMs: props.span.durationMs, kind: 'retriever', iconClass: 'db-icon', icon: Coin,
      attributes: { 'db.system': 'mongodb', 'db.operation': 'aggregate' } });
  }
  return nodes;
});

const treeData = computed(() => {
  if (!props.span) return [];
  return [{
    id: 'root',
    label: props.span.name || 'root',
    durationMs: props.span.durationMs,
    kind: 'chain',
    icon: Connection,
    iconClass: 'root-icon',
    children: childNodes.value
  }];
});

watch(treeFilter, (val) => {
  treeRef.value?.filter(val);
});

const filterNode = (value, data) => {
  if (!value) return true;
  return data.label?.toLowerCase().includes(value.toLowerCase());
};

const attributesList = computed(() => {
  const attrs = activeNode.value.attributes || {};
  return Object.entries(attrs).map(([key, value]) => ({ key, value }));
});

watch([visible, () => props.span], () => {
  if (visible.value && props.span) {
    selectNode('root', props.span.name, props.span.durationMs, 'chain');
  }
}, { immediate: true });

function handleNodeClick(data) {
  selectNode(data.id, data.label, data.durationMs, data.kind);
}

function selectNode(id, name, durationMs, kind) {
  activeNodeId.value = id;
  const found = childNodes.value.find(n => n.id === id);
  activeNode.value = found
    ? { id, name, durationMs, kind, attributes: found.attributes || {} }
    : { id: 'root', name: props.span?.name, durationMs: props.span?.durationMs, kind: 'chain', attributes: {
        'span.kind': 'chain',
        'http.method': 'GET',
        'http.url': `/api/${props.conn}/${props.span?.db}/${props.span?.collection}`,
        'status.code': props.span?.statusCode || 'OK',
      }};
  activeTab.value = 'info';
}

// JSON content for active node
const inputJson = computed(() => {
  const s = props.span;
  if (!s) return '{}';
  return JSON.stringify({
    method: s.name?.startsWith('POST') ? 'POST' : 'GET',
    url: `/api/${props.conn}/${s.db || 'database'}/${s.collection || 'collection'}`,
    body: { query: s.filter || {} },
  }, null, 2);
});

const outputJson = computed(() => {
  const s = props.span;
  if (!s) return '{}';
  return JSON.stringify({
    success: s.statusCode !== 'ERROR',
    source: 'stored',
    latencyMs: s.durationMs,
  }, null, 2);
});

function highlightJson(raw) {
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

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success('Copied!');
  } catch {
    ElMessage.error('Copy failed');
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
.details-tabs-container {
  margin-top: 10px;
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
  border: 1px solid #2d333b; 
  border-radius: 8px;
  padding: 14px 16px; 
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 0.82rem; line-height: 1.6; overflow-x: auto; color: #d1d5db;
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
