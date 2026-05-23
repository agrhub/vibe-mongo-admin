<template>
  <div class="collection-view page-body" v-loading="loading">
    <!-- Page header -->
    <div class="collection-header-row">
      <div>
        <h2 class="section-title">
          <el-icon class="title-icon"><Document /></el-icon>
          {{ store.activeColl }}
        </h2>
        <p class="section-desc">
          {{ store.activeConnection }} — {{ store.activeDb }} —
          <span class="text-brand"><strong>{{ totalDocs }}</strong> {{ store.t('Documents') }}</span>
        </p>
      </div>
      <div class="header-action-group">
        <el-button :icon="Download" round @click="handleExportCollection">
          {{ store.t('Export') }}
        </el-button>
        <el-button
          type="primary"
          :icon="Plus"
          round
          @click="$router.push(`/${store.activeConnection}/${store.activeDb}/${store.activeColl}/insert`)"
        >
          {{ store.t('New Document') }}
        </el-button>
      </div>
    </div>

    <!-- Tabbed content -->
    <el-tabs v-model="activeTab" class="collection-tabs">

      <!-- TAB 1: Documents Explorer -->
      <el-tab-pane name="documents">
        <template #label>
          <span class="tab-label">
            <el-icon><Document /></el-icon>
            {{ store.t('Documents') }}
          </span>
        </template>

        <!-- Query Console component -->
        <QueryConsole
          :documents="documents"
          :total-docs="totalDocs"
          v-model:query="queryString"
          v-model:docs-per-page="docsPerPage"
          :query-error="queryError"
          @search="searchDocuments"
          @reset="resetQuery"
          @mass-delete="handleMassDelete"
        />

        <!-- View mode toggle toolbar -->
        <div class="view-mode-toolbar" v-if="documents.length > 0">
          <span></span>
          <el-radio-group v-model="viewMode" size="small">
            <el-radio-button value="table">
              <el-icon style="vertical-align: middle; margin-right: 4px;"><Tickets /></el-icon>
              <span>{{ store.t('Table View') }}</span>
            </el-radio-button>
            <el-radio-button value="list">
              <el-icon style="vertical-align: middle; margin-right: 4px;"><Menu /></el-icon>
              <span>{{ store.t('List View') }}</span>
            </el-radio-button>
          </el-radio-group>
        </div>

        <!-- Bulk Actions Floating Bar -->
        <transition name="fade">
          <div v-if="selectedRows.length > 0 && viewMode === 'table'" class="bulk-actions-toolbar">
            <div class="bulk-info">
              <el-icon class="bulk-icon"><InfoFilled /></el-icon>
              <span>
                {{ store.t('Selected') }} <strong>{{ selectedRows.length }}</strong> {{ store.t('documents') }}
              </span>
            </div>
            <div class="bulk-buttons">
              <el-button 
                type="primary" 
                size="small" 
                plain round
                :icon="CopyDocument" 
                @click="bulkCopy(false)"
              >
                {{ store.t('Copy with _id') }}
              </el-button>
              <el-button 
                type="primary" 
                size="small" 
                plain round
                :icon="CopyDocument" 
                @click="bulkCopy(true)"
              >
                {{ store.t('Copy without _id') }}
              </el-button>
              <el-button 
                type="danger" 
                size="small" 
                round
                :icon="Delete" 
                @click="bulkDelete"
              >
                {{ store.t('Bulk Delete') }}
              </el-button>
              <el-button 
                type="info" 
                size="small" 
                link round
                @click="clearSelection"
              >
                {{ store.t('Clear') }}
              </el-button>
            </div>
          </div>
        </transition>

        <!-- Document card list / Table Grid -->
        <div class="documents-list-box">
          <div v-if="viewMode === 'list'">
            <DocumentCard
              v-for="doc in documents"
              :key="doc._id"
              :doc="doc"
              @delete="handleDeleteDoc"
            />
          </div>

          <div v-else-if="viewMode === 'table'" class="table-view-container">
            <el-table
              ref="tableRef"
              :data="filteredDocuments"
              style="width: 100%"
              stripe
              size="small"
              class="premium-docs-table"
              :empty-text="store.t('No matching documents found')"
              @sort-change="handleSortChange"
              @selection-change="handleSelectionChange"
            >
              <!-- Checkbox selection column -->
              <el-table-column type="selection" width="55" fixed="left" />

              <!-- Dynamic Columns -->
              <el-table-column
                v-for="col in tableColumns"
                :key="col"
                :prop="col"
                sortable="custom"
                min-width="150"
                show-overflow-tooltip
              >
                <template #header>
                  <div class="column-header-box">
                    <span class="column-name">{{ col }}</span>
                    <el-input
                      v-model="columnFilters[col]"
                      size="small"
                      :placeholder="store.t('Type to search...')"
                      clearable
                      class="col-search-input"
                      @click.stop
                    >
                      <template #prefix>
                        <el-icon class="el-input__icon"><Search /></el-icon>
                      </template>
                    </el-input>
                  </div>
                </template>
                <template #default="scope">
                  <span :class="{ 'doc-id-cell-text': col === '_id', 'cell-text-regular': col !== '_id' }">
                    {{ formatCellValue(scope.row[col]) }}
                  </span>
                </template>
              </el-table-column>

              <!-- Actions column -->
              <el-table-column :label="store.t('Actions')" width="130" fixed="right">
                <template #default="scope">
                  <div class="table-action-btns">
                    <el-tooltip :content="store.t('Copy (without _id)')" placement="top">
                      <el-button
                        type="primary"
                        link
                        size="small"
                        :icon="CopyDocument"
                        @click="copyDocWithoutId(scope.row)"
                      />
                    </el-tooltip>
                    <el-tooltip :content="store.t('Edit')" placement="top">
                      <el-button
                        type="primary"
                        link
                        size="small"
                        :icon="Edit"
                        @click="$router.push(`/${store.activeConnection}/${store.activeDb}/${store.activeColl}/edit/${formatDocIdRaw(scope.row._id)}`)"
                      />
                    </el-tooltip>
                    <el-tooltip :content="store.t('Delete')" placement="top">
                      <el-button
                        type="danger"
                        link
                        size="small"
                        :icon="Delete"
                        @click="handleDeleteDocTable(scope.row._id)"
                      />
                    </el-tooltip>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- Empty state -->
          <div v-if="documents.length === 0" class="empty-docs-box">
            <el-icon class="empty-docs-icon"><DocumentDelete /></el-icon>
            <h3>{{ store.t('No Documents Found') }}</h3>
            <p>{{ store.t('This collection does not contain any documents matching the query.') }}</p>
          </div>

          <!-- Pagination -->
          <div class="pagination-footer" v-if="totalDocs > 0">
            <el-pagination
              v-model:current-page="currentPage"
              :page-size="docsPerPage"
              background
              layout="prev, pager, next, total"
              :total="totalDocs"
              @current-change="handlePageChange"
            />
          </div>
        </div>
      </el-tab-pane>

      <!-- TAB 2: Indexes Manager -->
      <el-tab-pane name="indexes" lazy>
        <template #label>
          <span class="tab-label">
            <el-icon><Compass /></el-icon>
            {{ store.t('Indexes') }}
          </span>
        </template>
        <CollectionIndexes />
      </el-tab-pane>

      <el-tab-pane name="schema" lazy>
        <template #label>
          <span class="tab-label">
            <el-icon><Document /></el-icon>
            {{ store.t('Schema') }}
          </span>
        </template>
        <CollectionSchema />
      </el-tab-pane>

      <el-tab-pane name="analysis" lazy>
        <template #label>
          <span class="tab-label">
            <el-icon><DataAnalysis /></el-icon>
            {{ store.t('Analysis') }}
          </span>
        </template>
        <CollectionAnalysis />
      </el-tab-pane>

    </el-tabs>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useRoute } from 'vue-router';
import { store } from '../stores';
import DocumentCard      from '../components/collection/DocumentCard.vue';
import QueryConsole      from '../components/collection/QueryConsole.vue';
import CollectionIndexes from '../components/collection/CollectionIndexes.vue';
import CollectionSchema  from '../components/collection/CollectionSchema.vue';
import CollectionAnalysis from '../components/collection/CollectionAnalysis.vue';
import { Document, Download, Plus, Compass, DocumentDelete, DataAnalysis, CopyDocument, Edit, Delete, Menu, Tickets, Search, InfoFilled } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import axios from 'axios';

const route = useRoute();

const loading     = ref(false);
const activeTab   = ref('documents');

const documents   = ref([]);
const totalDocs   = ref(0);
const currentPage = ref(1);
const docsPerPage = ref(10);

const queryString = ref('');
const queryError  = ref('');

// Table/List view mode, sorting, filtering and checkbox selections
const viewMode      = ref('table');
const columnFilters = ref({});
const activeSort    = ref({});
const selectedRows  = ref([]);
const tableRef      = ref(null);

// Automatically reset column filters, sort, and selection when active connection/db/collection changes
watch(
  () => [route.params.conn, route.params.db, route.params.coll],
  () => {
    columnFilters.value = {};
    activeSort.value = {};
    selectedRows.value = [];
  }
);

// SYNC TAB from URL query param (for AI agent navigation)
watch(
  () => route.query.tab,
  (newTab) => {
    if (newTab && ['documents', 'indexes', 'schema', 'analysis'].includes(newTab)) {
      activeTab.value = newTab;
    }
  },
  { immediate: true }
);

// Watch for deep changes in columnFilters with a 450ms debounce for online filtering
let filterTimeout = null;
watch(
  () => columnFilters.value,
  () => {
    if (filterTimeout) clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => {
      currentPage.value = 1;
      loadDocuments();
    }, 450);
  },
  { deep: true }
);

// Get unique keys from the current documents page to build columns dynamically
const tableColumns = computed(() => {
  const keys = new Set();
  documents.value.forEach(doc => {
    Object.keys(doc).forEach(key => {
      if (key !== '_id') {
        keys.add(key);
      }
    });
  });
  return ['_id', ...Array.from(keys).sort()];
});

// Format dynamic cell values safely
const formatCellValue = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if (val.$oid) return val.$oid;
    if (val.$date) return val.$date;
    return JSON.stringify(val);
  }
  return String(val);
};

// Raw ID formatter for Edit/Delete actions
const formatDocIdRaw = (id) => {
  if (id === null || id === undefined) return '';
  if (id.$oid) return id.$oid;
  if (typeof id === 'object') return id.toString();
  return id;
};

// Filtered documents list (handled online on the database side; returns documents directly)
const filteredDocuments = computed(() => {
  return documents.value;
});

const copyDocWithoutId = (doc) => {
  const { _id, ...rest } = doc;
  navigator.clipboard.writeText(JSON.stringify(rest, null, 2));
  ElMessage.success(store.t('Copied without _id — paste into Insert form to duplicate'));
};

const handleDeleteDocTable = (docId) => {
  const rawId = formatDocIdRaw(docId);
  ElMessageBox.confirm(
    store.t('Delete this document? This action cannot be undone.'),
    store.t('Warning'),
    {
      confirmButtonText: store.t('Delete'),
      cancelButtonText: store.t('Cancel'),
      type: 'warning'
    }
  ).then(() => {
    handleDeleteDoc(rawId);
  }).catch(() => {});
};

const handleSortChange = ({ prop, order }) => {
  if (!order) {
    activeSort.value = {};
  } else {
    activeSort.value = {
      [prop]: order === 'ascending' ? 1 : -1
    };
  }
  currentPage.value = 1;
  loadDocuments();
};

const handleSelectionChange = (selection) => {
  selectedRows.value = selection;
};

const clearSelection = () => {
  if (tableRef.value) {
    tableRef.value.clearSelection();
  }
};

const bulkCopy = (excludeId) => {
  const dataToCopy = selectedRows.value.map(row => {
    if (excludeId) {
      const { _id, ...rest } = row;
      return rest;
    }
    return row;
  });
  navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2));
  ElMessage.success(
    excludeId 
      ? store.t('Copied selected documents to clipboard (without _id)')
      : store.t('Copied selected documents to clipboard')
  );
};

const bulkDelete = () => {
  ElMessageBox.confirm(
    store.t('Are you sure you want to delete {count} selected documents? This cannot be undone.')
      .replace('{count}', String(selectedRows.value.length)),
    store.t('Bulk Delete Warning'),
    {
      confirmButtonText: store.t('Delete All'),
      cancelButtonText: store.t('Cancel'),
      confirmButtonClass: 'el-button--danger',
      type: 'warning'
    }
  ).then(async () => {
    loading.value = true;
    try {
      const mappedIds = selectedRows.value.map(row => {
        if (row._id && typeof row._id === 'object') {
          if (row._id.$oid) return { $oid: row._id.$oid };
        }
        return row._id;
      });
      const queryStr = JSON.stringify({ _id: { $in: mappedIds } });
      const res = await axios.post(
        `/api/${store.activeConnection}/${store.activeDb}/${store.activeColl}/document/mass_delete`,
        { query: queryStr }
      );
      ElMessage.success(res.data.msg || store.t('Documents successfully deleted'));
      clearSelection();
      loadDocuments();
      store.fetchSidebar();
    } catch (e) {
      console.error(e);
      ElMessage.error(store.t('Error mass deleting selected documents'));
    } finally {
      loading.value = false;
    }
  }).catch(() => {});
};

// Reload when route params change
watch(
  () => [route.params.conn, route.params.db, route.params.coll],
  () => {
    currentPage.value = 1;
    queryString.value = '';
    queryError.value  = '';
    loadDocuments();
  },
  { immediate: true }
);

// ── Data loading ──────────────────────────────────────────────────
async function loadDocuments() {
  const { conn, db, coll } = route.params;
  if (!conn || !db || !coll) return;

  loading.value = true;
  try {
    const res = await axios.post(`/api/${conn}/${db}/${coll}/documents`, {
      page:        currentPage.value,
      docsPerPage: docsPerPage.value,
      query:       queryString.value,
      sort:        activeSort.value,
      columnFilters: columnFilters.value
    });
    documents.value = res.data.data || [];
    totalDocs.value = res.data.total_docs || 0;
    queryError.value = res.data.validQuery === false
      ? (res.data.queryMessage || store.t('Invalid MongoDB Query syntax'))
      : '';
  } catch (e) {
    console.error(e);
    ElMessage.error(store.t('Error loading documents'));
  } finally {
    loading.value = false;
  }
}

// ── Search / Pagination ───────────────────────────────────────────
const handlePageChange  = (page) => { currentPage.value = page; loadDocuments(); };
const searchDocuments   = ()     => { currentPage.value = 1;    loadDocuments(); };
const resetQuery        = ()     => { queryString.value = ''; queryError.value = ''; currentPage.value = 1; loadDocuments(); };

// ── Export ────────────────────────────────────────────────────────
const handleExportCollection = () => {
  const { conn, db, coll } = route.params;
  window.open(`/api/${conn}/${db}/${coll}/export?excludedID=false`, '_blank');
};

// ── Delete single document ────────────────────────────────────────
const handleDeleteDoc = async (docId) => {
  loading.value = true;
  try {
    await axios.post(
      `/api/${store.activeConnection}/${store.activeDb}/${store.activeColl}/document/delete`,
      { doc_id: docId }
    );
    ElMessage.success(store.t('Document successfully deleted'));
    loadDocuments();
    store.fetchSidebar();
  } catch (e) {
    ElMessage.error(store.t('Error deleting document'));
  } finally {
    loading.value = false;
  }
};

// ── Mass delete ───────────────────────────────────────────────────
const handleMassDelete = () => {
  ElMessageBox.prompt(
    store.t('Mass delete matching documents! Type DELETE to confirm deletion of documents matching active query filter:'),
    store.t('Mass Deletion Warning'),
    {
      confirmButtonText:  store.t('Mass Delete'),
      cancelButtonText:   store.t('Cancel'),
      confirmButtonClass: 'el-button--danger',
      inputPattern:       /^DELETE$/,
      inputErrorMessage:  store.t('Please type DELETE to confirm')
    }
  ).then(async () => {
    loading.value = true;
    try {
      const res = await axios.post(
        `/api/${store.activeConnection}/${store.activeDb}/${store.activeColl}/document/mass_delete`,
        { query: queryString.value }
      );
      ElMessage.success(res.data.msg || store.t('Documents successfully deleted'));
      resetQuery();
      store.fetchSidebar();
    } catch (e) {
      ElMessage.error(store.t('Error mass deleting documents'));
    } finally {
      loading.value = false;
    }
  }).catch(() => {});
};
</script>

<style scoped>
.collection-view { background: var(--bg-primary); }

.collection-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
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

.title-icon { color: var(--color-brand); }

.section-desc {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
}

.header-action-group { display: flex; gap: 12px; }

.collection-tabs { margin-top: 1rem; }

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}

.empty-docs-box {
  text-align: center;
  padding: 5rem 2rem;
  background: var(--bg-secondary);
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-md);
  margin-top: 2rem;
}

.empty-docs-icon {
  font-size: 3.5rem;
  color: var(--text-muted);
  margin-bottom: 1.5rem;
}

.empty-docs-box h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.empty-docs-box p {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.pagination-footer {
  display: flex;
  justify-content: center;
  margin-top: 2rem;
}

/* View Mode Toolbar & Premium Table styles */
.view-mode-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.table-view-container {
  background: var(--bg-secondary);
  border-radius: var(--radius-md, 8px);
  padding: 1px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  margin-top: 1rem;
}

.premium-docs-table {
  --el-table-border-color: var(--border-color);
  --el-table-header-bg-color: var(--bg-secondary);
  --el-table-row-hover-bg-color: var(--bg-hover, rgba(64, 158, 255, 0.05));
  background-color: transparent !important;
}

:deep(.premium-docs-table .el-table__header-wrapper th) {
  padding: 8px 0;
}

:deep(.premium-docs-table .el-table__cell) {
  border-bottom: 1px solid var(--border-color);
}

.column-header-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px 0;
  width: 100%;
}

.column-name {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--text-primary);
  text-transform: capitalize;
}

.col-search-input {
  width: 100%;
}

:deep(.col-search-input .el-input__wrapper) {
  padding: 0 8px;
  background-color: var(--bg-primary) !important;
  box-shadow: 0 0 0 1px var(--border-color) inset !important;
}

:deep(.col-search-input .el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--color-brand) inset !important;
}

.doc-id-cell-text {
  font-family: monospace;
  font-weight: 700;
  color: var(--color-brand, #409eff);
  background: var(--bg-secondary);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.825rem;
}

.cell-text-regular {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-family: inherit;
}

.table-action-btns {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

/* Bulk Actions Floating Bar */
.bulk-actions-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-left: 4px solid var(--color-brand, #409eff);
  padding: 12px 20px;
  border-radius: 8px;
  margin-bottom: 1.25rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.bulk-info {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.bulk-icon {
  color: var(--color-brand, #409eff);
  font-size: 1.2rem;
}

.bulk-buttons {
  display: flex;
  align-items: center;
  gap: 12px;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>
