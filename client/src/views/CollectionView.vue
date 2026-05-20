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
        <el-button :icon="Download" @click="handleExportCollection">
          {{ store.t('Export') }}
        </el-button>
        <el-button
          type="primary"
          :icon="Plus"
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

        <!-- Document card list -->
        <div class="documents-list-box">
          <DocumentCard
            v-for="doc in documents"
            :key="doc._id"
            :doc="doc"
            @delete="handleDeleteDoc"
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

    </el-tabs>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { store } from '../stores';
import DocumentCard      from '../components/collection/DocumentCard.vue';
import QueryConsole      from '../components/collection/QueryConsole.vue';
import CollectionIndexes from '../components/collection/CollectionIndexes.vue';
import { Document, Download, Plus, Compass, DocumentDelete } from '@element-plus/icons-vue';
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
      query:       queryString.value
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
</style>
