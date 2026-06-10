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
        <el-button type="success" :icon="Cpu" round @click="handleOpenMockDataGenerator">
          {{ store.t('Mock Data') }}
        </el-button>
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
        <BulkActionsBar
          v-if="viewMode === 'table'"
          :selected-rows="selectedRows"
          @bulk-copy="bulkCopy"
          @bulk-delete="bulkDelete"
          @clear-selection="clearSelection"
        />

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

          <DocumentTable
            v-else-if="viewMode === 'table'"
            ref="docTableRef"
            :documents="documents"
            @sort-change="handleSortChange"
            @selection-change="handleSelectionChange"
            @filter-change="handleFilterChange"
            @copy-doc="copyDocWithoutId"
            @edit-doc="handleEditDoc"
            @delete-doc="handleDeleteDocTable"
          />

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
        
        <el-tabs v-model="schemaSubTab" type="border-card" class="schema-sub-tabs">
          <el-tab-pane name="fields" lazy>
            <template #label>
              <span class="sub-tab-label">
                <el-icon><Menu /></el-icon>
                {{ store.t('Fields') }}
              </span>
            </template>
            <CollectionSchema />
          </el-tab-pane>
          
          <el-tab-pane name="erd" lazy>
            <template #label>
              <span class="sub-tab-label">
                <el-icon><Connection /></el-icon>
                {{ store.t('ERD') }}
              </span>
            </template>
            <CollectionErd />
          </el-tab-pane>
          
          <el-tab-pane name="migrator" lazy>
            <template #label>
              <span class="sub-tab-label">
                <el-icon><Cpu /></el-icon>
                {{ store.t('Migrator') }}
              </span>
            </template>
            <CollectionTransformer />
          </el-tab-pane>
        </el-tabs>
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

    <!-- Premium AI Mock Data Generator Dialog -->
    <el-dialog
      v-model="mockDialogVisible"
      :title="store.t('AI Smart Mock Data Generator')"
      width="450px"
      destroy-on-close
      align-center
    >
      <div class="mock-generator-dialog-body" v-loading="mockGenerating">
        <div class="ai-badge-row">
          <el-tag type="success" effect="dark" size="small">
            <el-icon style="vertical-align: middle; margin-right: 4px;"><Cpu /></el-icon>
            AI POWERED
          </el-tag>
          <span class="ai-badge-text">Powered by Google Gemini</span>
        </div>
        <p class="mock-dialog-desc">
          Automatically analyzes your collection's existing schema structure and samples to synthesize realistic and coherent mock documents.
        </p>

        <el-form label-position="top">
          <el-form-item :label="store.t('Number of Documents')">
            <el-input-number
              v-model="mockDocCount"
              :min="1"
              :max="100"
              style="width: 100%;"
            />
            <span class="form-item-help">Recommended max of 50 documents per AI batch execution.</span>
          </el-form-item>

          <el-form-item :label="store.t('Data Locale / Language')">
            <el-select v-model="mockLocale" style="width: 100%;">
              <el-option
                v-for="(name, code) in AVAILABLE_LOCALES"
                :key="code"
                :label="store.t(name)"
                :value="code"
              />
            </el-select>
          </el-form-item>

          <el-form-item :label="store.t('Custom Constraints (Optional)')">
            <el-input
              v-model="mockConstraints"
              type="textarea"
              :rows="2"
              placeholder="e.g. Set price values between 50 and 500. Generate realistic Vietnamese names."
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="mockDialogVisible = false" :disabled="mockGenerating">
            {{ store.t('Cancel') }}
          </el-button>
          <el-button type="success" :loading="mockGenerating" @click="handleGenerateMockData">
            {{ store.t('Generate Data') }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { store } from '../stores';
import { AVAILABLE_LOCALES } from '../hooks/useLocale';
import DocumentCard      from '../components/collection/DocumentCard.vue';
import QueryConsole      from '../components/collection/QueryConsole.vue';
import CollectionIndexes from '../components/collection/CollectionIndexes.vue';
import CollectionSchema  from '../components/collection/CollectionSchema.vue';
import CollectionAnalysis from '../components/collection/CollectionAnalysis.vue';
import CollectionErd     from '../components/collection/CollectionErd.vue';
import CollectionTransformer from '../components/collection/CollectionTransformer.vue';
import DocumentTable     from '../components/collection/DocumentTable.vue';
import BulkActionsBar    from '../components/collection/BulkActionsBar.vue';
import { Document, Download, Plus, Compass, DocumentDelete, DataAnalysis, Menu, Tickets, Cpu, Connection } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import axios from 'axios';

const route = useRoute();
const router = useRouter();

const loading     = ref(false);
const activeTab   = ref('documents');
const schemaSubTab = ref('fields');

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
const docTableRef   = ref(null);

// Automatically reset sort and selection when active connection/db/collection changes
watch(
  () => [route.params.conn, route.params.db, route.params.coll],
  () => {
    activeSort.value = {};
    selectedRows.value = [];
    if (docTableRef.value) {
      docTableRef.value.clearFilters();
    }
  }
);

// SYNC TAB from URL query param (for AI agent navigation)
watch(
  () => route.query.tab,
  (newTab) => {
    if (newTab) {
      if (['documents', 'indexes', 'schema', 'analysis'].includes(newTab)) {
        activeTab.value = newTab;
      } else if (newTab === 'erd') {
        activeTab.value = 'schema';
        schemaSubTab.value = 'erd';
      } else if (newTab === 'transformer' || newTab === 'migrator') {
        activeTab.value = 'schema';
        schemaSubTab.value = 'migrator';
      }
    }
  },
  { immediate: true }
);

// Reload documents on global data refresh trigger
watch(
  () => store.dataRefreshTrigger,
  () => {
    loadDocuments();
  }
);

const copyDocWithoutId = (doc) => {
  const { _id, ...rest } = doc;
  navigator.clipboard.writeText(JSON.stringify(rest, null, 2));
  ElMessage.success(store.t('Copied without _id — paste into Insert form to duplicate'));
};

const handleEditDoc = (rawId) => {
  router.push(`/${store.activeConnection}/${store.activeDb}/${store.activeColl}/edit/${rawId}`);
};

const handleDeleteDocTable = (rawId) => {
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

const handleFilterChange = (filters) => {
  columnFilters.value = filters;
  currentPage.value = 1;
  loadDocuments();
};

const handleSelectionChange = (selection) => {
  selectedRows.value = selection;
};

const clearSelection = () => {
  if (docTableRef.value) {
    docTableRef.value.clearSelection();
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
    columnFilters.value = {};
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

// AI Mock Data Logic
const mockDialogVisible = ref(false);
const mockGenerating = ref(false);
const mockDocCount = ref(25);
const mockLocale = ref(store.activeLocale || 'en');
const mockConstraints = ref('');

const handleOpenMockDataGenerator = () => {
  mockDocCount.value = 25;
  mockLocale.value = store.activeLocale || 'en';
  mockConstraints.value = '';
  mockDialogVisible.value = true;
};

const handleGenerateMockData = async () => {
  mockGenerating.value = true;
  try {
    const { conn, db, coll } = route.params;
    const res = await axios.post(`/api/${conn}/${db}/${coll}/generate-mock`, {
      count: mockDocCount.value,
      locale: mockLocale.value,
      constraints: mockConstraints.value
    });
    ElMessage.success(res.data.msg || store.t('Mock documents successfully generated'));
    mockDialogVisible.value = false;
    loadDocuments();
    store.fetchSidebar();
  } catch (e) {
    console.error(e);
    ElMessage.error(e.response?.data?.msg || store.t('Error generating mock data'));
  } finally {
    mockGenerating.value = false;
  }
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

/* View Mode Toolbar styles */
.view-mode-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

/* AI Mock Data styles */
.mock-generator-dialog-body {
  padding: 8px 4px;
}
.ai-badge-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 0.75rem;
}
.ai-badge-text {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 500;
}
.mock-dialog-desc {
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.4;
  margin-bottom: 1.5rem;
}
.form-item-help {
  font-size: 0.75rem;
  color: var(--text-muted);
  display: block;
  margin-top: 4px;
}

</style>
