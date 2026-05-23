<template>
  <div class="document-result">
    <!-- MongoDB Query Viewer -->
    <!-- <div v-if="mongoQuery" class="query-viewer">
      <div class="query-viewer-header" @click="showQuery = !showQuery">
        <div class="query-header-left">
          <span class="query-icon">⌘</span>
          <span class="query-label">View MongoDB Query</span>
        </div>
        <div class="query-header-right">
          <button class="copy-btn" @click.stop="copyQuery" :title="store.t('Copy query')">
            <span>📋</span>
          </button>
          <span class="chevron" :class="{ 'is-open': showQuery }">›</span>
        </div>
      </div>
      <div v-if="showQuery" class="query-code-box">
        <pre class="query-pre"><code>{{ mongoQuery }}</code></pre>
      </div>
    </div> -->

    <!-- View Mode Toggle + Count -->
    <div class="result-toolbar">
      <div class="view-toggle">
        <button
          class="toggle-btn"
          :class="{ active: viewMode === 'table' }"
          @click="viewMode = 'table'"
        >
          ▦ Table
        </button>
        <button
          class="toggle-btn"
          :class="{ active: viewMode === 'list' }"
          @click="viewMode = 'list'"
        >
          ≡ JSON
        </button>
      </div>
      <span class="result-count">{{ documents?.length || 0 }} {{ store.t('documents') }}</span>
    </div>

    <!-- Table view (default) -->
    <div v-if="viewMode === 'table'" class="table-wrapper">
      <el-table
        :data="documents"
        style="width: 100%"
        stripe
        size="small"
        max-height="320"
        class="doc-table"
        :empty-text="store.t('No Data')"
      >
        <el-table-column
          v-for="col in columns"
          :key="col"
          :prop="col"
          :label="col"
          show-overflow-tooltip
          min-width="110"
        >
          <template #default="{ row }">
            <span :class="col === '_id' ? 'cell-id' : 'cell-val'">{{ formatCell(row[col]) }}</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- JSON list view -->
    <div v-else class="document-list">
      <div v-for="(doc, idx) in documents" :key="idx" class="doc-item">
        <div class="doc-item-header">
          <span class="doc-num">#{{ idx + 1 }}</span>
          <button class="doc-copy-btn" @click="handleCopyDoc(doc)" :title="store.t('Copy document')">
            📋
          </button>
        </div>
        <pre class="doc-pre"><code>{{ JSON.stringify(doc, null, 2) }}</code></pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { PropType } from 'vue';
import { store } from '../../stores';
import { ElMessage } from 'element-plus';

interface Document {
  [key: string]: any;
}

const props = defineProps({
  documents: {
    type: Array as PropType<Document[]>,
    default: () => []
  },
  mongoQuery: {
    type: String,
    default: ''
  }
});

// Default to table view
const viewMode = ref<'list' | 'table'>('table');
// const showQuery = ref(false);

// Compute column list from all documents (union of keys)
const columns = computed(() => {
  const cols = new Set<string>();
  props.documents.forEach(doc => {
    Object.keys(doc).forEach(k => cols.add(k));
  });
  // Put _id first if present
  const arr = Array.from(cols);
  const idIdx = arr.indexOf('_id');
  if (idIdx > 0) {
    arr.splice(idIdx, 1);
    arr.unshift('_id');
  }
  return arr;
});

function formatCell(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (value.$oid) return value.$oid;
    if (value.$date) return new Date(value.$date).toLocaleString();
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

// function copyQuery() {
//   if (!props.mongoQuery) return;
//   navigator.clipboard.writeText(props.mongoQuery).then(() => {
//     ElMessage.success(store.t('Query copied to clipboard!'));
//   }).catch(() => {
//     ElMessage.error(store.t('Failed to copy'));
//   });
// }

function handleCopyDoc(doc: any) {
  const text = JSON.stringify(doc, null, 2);
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success(store.t('Document copied to clipboard!'));
  }).catch(() => {
    ElMessage.error(store.t('Failed to copy'));
  });
}
</script>

<style scoped>
.document-result {
  font-size: 12.5px;
  color: #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Query Viewer */
.query-viewer {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(0, 242, 254, 0.15);
  border-radius: 6px;
  overflow: hidden;
}

.query-viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  cursor: pointer;
  transition: background 0.2s;
  user-select: none;
}

.query-viewer-header:hover {
  background: rgba(0, 242, 254, 0.06);
}

.query-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: #94a3b8;
  font-weight: 500;
}

.query-icon {
  color: #00f2fe;
  font-style: normal;
}

.query-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.copy-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
  opacity: 0.6;
  transition: opacity 0.2s, background 0.2s;
  line-height: 1;
}
.copy-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.08);
}

.chevron {
  color: #94a3b8;
  font-size: 16px;
  transition: transform 0.2s;
  display: inline-block;
}
.chevron.is-open {
  transform: rotate(90deg);
}

.query-code-box {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding: 8px 12px;
  max-height: 180px;
  overflow-y: auto;
}

.query-pre {
  margin: 0;
  font-family: 'Fira Code', 'Courier New', Courier, monospace;
  font-size: 11px;
  color: #38bdf8;
  white-space: pre-wrap;
  word-break: break-all;
}

/* Toolbar */
.result-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.view-toggle {
  display: flex;
  gap: 4px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 2px;
}

.toggle-btn {
  background: none;
  border: none;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 11px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
}
.toggle-btn.active {
  background: rgba(0, 242, 254, 0.15);
  color: var(--el-color-primary);
  font-weight: 600;
}

.result-count {
  font-weight: 500;
  font-size: 11px;
  color: #94a3b8;
}

/* Table */
.table-wrapper {
  overflow-x: auto;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.doc-table {
  --el-table-border-color: rgba(255, 255, 255, 0.06);
  --el-table-header-bg-color: rgba(0, 0, 0, 0.2);
  --el-table-row-hover-bg-color: rgba(0, 242, 254, 0.04);
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  background: transparent !important;
  font-size: 11.5px;
}

:deep(.doc-table .el-table__header-wrapper th) {
  background: rgba(0, 0, 0, 0.2) !important;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 600;
}

:deep(.doc-table .el-table__body-wrapper) {
  background: transparent;
}

.cell-id {
  font-family: 'Fira Code', monospace;
  color: #4facfe;
  font-size: 10.5px;
}
.cell-val {
  color: #d1d5db;
}

/* List */
.document-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.doc-item {
  background: rgba(255, 255, 255, 0.03);
  padding: 8px 10px;
  border-radius: 5px;
  overflow-x: auto;
  border: 1px solid rgba(255, 255, 255, 0.06);
  position: relative;
}

.doc-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.05);
}

.doc-num {
  font-size: 10px;
  color: #64748b;
  font-family: monospace;
}

.doc-copy-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 11px;
  opacity: 0.5;
  transition: opacity 0.2s;
  padding: 0 4px;
}
.doc-copy-btn:hover {
  opacity: 1;
}
.doc-pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: 'Fira Code', monospace;
  font-size: 11px;
  color: #38bdf8;
}
</style>
