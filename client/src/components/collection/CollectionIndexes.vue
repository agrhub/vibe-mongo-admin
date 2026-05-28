<template>
  <div class="collection-indexes-comp" v-loading="loading">
    <!-- AI Sanitizer Dashboard -->
    <el-collapse-transition>
      <div v-if="showSanitizerDashboard || sanitizerResult" class="sanitizer-dashboard-wrapper">
        <el-card class="sanitizer-card" v-loading="sanitizing">
          <template #header>
            <div class="sanitizer-header">
              <span class="ai-title">
                <el-icon class="ai-icon"><Cpu /></el-icon>
                AI Index Sanitizer & Diagnostics
              </span>
              <el-button type="success" size="small" :loading="sanitizing" @click="runIndexSanitizer">
                {{ store.t('Run Analysis') }}
              </el-button>
            </div>
          </template>

          <div v-if="sanitizerResult" class="sanitizer-content">
            <el-row :gutter="20">
              <el-col :xs="24" :sm="8" class="health-score-col">
                <el-progress
                  type="circle"
                  :percentage="sanitizerResult.healthScore"
                  :color="getProgressColor(sanitizerResult.healthScore)"
                  :width="120"
                />
                <div class="score-label">Index Health Score</div>
                <div class="score-desc">{{ sanitizerResult.statusDescription }}</div>
              </el-col>
              <el-col :xs="24" :sm="16">
                <h4 class="recommendations-title">{{ store.t('AI Recommendations & Safe Dropping') }}</h4>
                <div v-if="sanitizerResult.recommendations.length === 0" class="no-rec-msg">
                  <el-alert
                    type="success"
                    show-icon
                    :closable="false"
                    title="All Indexes are Optimized!"
                    description="AI analyzed your active index paths and structural overlaps. Everything is fully optimal and healthy."
                  />
                </div>
                <div v-else class="rec-list">
                  <div
                    v-for="rec in sanitizerResult.recommendations"
                    :key="rec.indexName"
                    class="rec-item"
                    :class="`rec-level-${rec.level}`"
                  >
                    <div class="rec-item-header">
                      <span class="rec-index-name">Index: <strong>{{ rec.indexName }}</strong></span>
                      <el-tag :type="rec.level === 'danger' ? 'danger' : rec.level === 'warning' ? 'warning' : 'info'" size="small">
                        {{ rec.level.toUpperCase() }}
                      </el-tag>
                    </div>
                    <div class="rec-reason">{{ rec.reason }}</div>
                    <div v-if="rec.safeToDrop" class="rec-actions">
                      <el-button
                        type="danger"
                        plain
                        size="small"
                        :icon="Delete"
                        @click="handleDropIndexWithAI(rec.indexName, rec.reason)"
                      >
                        {{ store.t('Drop Redundant Index') }}
                      </el-button>
                    </div>
                  </div>
                </div>
              </el-col>
            </el-row>
          </div>
          <div v-else class="sanitizer-idle-state">
            <p>Click "Run Analysis" to let AI perform a prefix matching, analyze index usage metrics, and detect structural redundancies.</p>
          </div>
        </el-card>
      </div>
    </el-collapse-transition>

    <el-card class="indexes-card" style="margin-top: 15px;">
      <template #header>
        <div class="card-header">
          <span>{{ collectionName ?? activeCollectionName }}</span>
          <div class="header-actions">
            <el-button type="success" round plain :icon="MagicStick" size="small" @click="optimizeIndexes">
              {{ store.t('AI Optimize') }}
            </el-button>
            <el-button type="primary" round text bg :icon="Plus" size="small" @click="openCreateDialog">
              {{ store.t('New Index') }}
            </el-button>
          </div>
        </div>
      </template>

      <el-table :data="indexesList" style="width: 100%" size="small" :empty-text="store.t('No Data')">
        <el-table-column prop="name" :label="store.t('Index Name')">
          <template #default="scope">
            <strong>{{ scope.row.name }}</strong>
            <el-tag
              v-if="sanitizerResult?.indexStatuses?.[scope.row.name]"
              :type="getIndexStatusType(sanitizerResult.indexStatuses[scope.row.name])"
              size="small"
              class="status-badge"
            >
              {{ sanitizerResult.indexStatuses[scope.row.name] }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column :label="store.t('Fields')">
          <template #default="scope">
            <el-tag
              v-for="(val, key) in scope.row.key"
              :key="key"
              size="small"
              class="index-field-tag"
            >
              {{ key }}: {{ val }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="v" :label="store.t('Version')" width="90" />

        <el-table-column :label="store.t('Unique')" width="90">
          <template #default="scope">
            <el-tag :type="scope.row.unique ? 'success' : 'info'" size="small">
              {{ scope.row.unique ? 'Yes' : 'No' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column :label="store.t('Sparse')" width="90">
          <template #default="scope">
            <el-tag :type="scope.row.sparse ? 'success' : 'info'" size="small">
              {{ scope.row.sparse ? 'Yes' : 'No' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column :label="store.t('Action')" fixed="right" width="160">
          <template #default="scope">
            <el-button
              type="primary"
              link size="small"
              :icon="Edit"
              @click="openEditDialog(scope.row)"
              :disabled="scope.row.name === '_id_'"
            >
              {{ store.t('Edit') }}
            </el-button>
            <el-button
              type="danger"
              link size="small"
              :icon="Delete"
              @click="handleDropIndex(scope.row.name)"
              :disabled="scope.row.name === '_id_'"
            >
              {{ store.t('Drop') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- ===== Create / Edit Index Dialog ===== -->
    <el-dialog
      v-model="showDialog"
      :title="isEditMode ? store.t('Edit Index') : store.t('Create collection index')"
      width="500px"
      append-to-body
      @closed="resetForm"
    >
      <!-- Edit mode: info banner -->
      <el-alert
        v-if="isEditMode"
        type="warning"
        show-icon
        :closable="false"
        class="edit-info-alert"
      >
        <template #title>
          {{ store.t('MongoDB does not support modifying indexes in place.') }}
        </template>
        <template #default>
          {{ store.t('Saving will DROP the existing index and CREATE a new one with the updated options. Index fields (keys) cannot be changed — drop and create a new index instead.') }}
        </template>
      </el-alert>

      <el-form :model="indexForm" label-position="top" style="margin-top: 12px;">
        <!-- Keys field: read-only in edit mode -->
        <el-form-item :label="store.t('Index Keys (JSON syntax)')" required>
          <el-input
            v-model="indexForm.keys"
            type="textarea"
            :rows="3"
            placeholder='e.g. { "price": 1, "created_at": -1 }'
            :disabled="isEditMode"
          />
          <p class="field-hint">
            <span v-if="isEditMode">
              🔒 {{ store.t('Index keys cannot be changed. Drop this index and create a new one to change fields.') }}
            </span>
            <span v-else>1 for Ascending, -1 for Descending, "text" for full-text</span>
          </p>
        </el-form-item>

        <el-form-item :label="store.t('Index Options')">
          <div class="options-row">
            <el-checkbox v-model="indexForm.unique">
              {{ store.t('Unique constraint') }}
            </el-checkbox>
            <el-checkbox v-model="indexForm.sparse">
              {{ store.t('Sparse index') }}
            </el-checkbox>
          </div>
        </el-form-item>

        <!-- Edit-mode: show index name being edited -->
        <el-form-item v-if="isEditMode" :label="store.t('Current Index Name')">
          <el-input :model-value="editingIndexName" disabled />
        </el-form-item>
      </el-form>

      <template #footer>
        <span class="dialog-footer">
          <el-button round text bg @click="showDialog = false">{{ store.t('Cancel') }}</el-button>
          <el-button 
            round text bg
            :type="isEditMode ? 'warning' : 'primary'"
            @click="isEditMode ? updateIndex() : createIndex()"
            :loading="saving"
          >
            {{ isEditMode ? store.t('Drop & Recreate') : store.t('Create Index') }}
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue';
import { useRoute } from 'vue-router';
import { store } from '../../stores';
import { Plus, Delete, Edit, MagicStick, Cpu } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import axios from 'axios';

const props = defineProps<{ collectionName?: string }>();
const route = useRoute();
const loading = ref(false);

const indexesList    = ref([]);
const showDialog     = ref(false);
const isEditMode     = ref(false);
const saving         = ref(false);
const editingIndexName = ref('');

const indexForm = reactive({ keys: '', unique: false, sparse: false });

const activeCollectionName = computed(() => props.collectionName || store.activeColl);

watch(() => [route.params.conn, route.params.db, activeCollectionName.value], () => {
  loadIndexes();
}, { immediate: true });

// ── Load ──────────────────────────────────────────────────────────
async function loadIndexes() {
  const { conn, db } = route.params;
  const coll = activeCollectionName.value;
  if (!conn || !db || !coll) return;

  loading.value = true;
  try {
    const res = await axios.get(`/api/${conn}/${db}/${coll}/indexes`);
    indexesList.value = res.data.coll_indexes || [];
  } catch (e) {
    console.error('Error fetching indexes:', e);
  } finally {
    loading.value = false;
  }
}

// ── Open dialogs ──────────────────────────────────────────────────
// AI Sanitizer state
const sanitizerResult = ref<any>(null);
const sanitizing = ref(false);
const showSanitizerDashboard = ref(false);

const runIndexSanitizer = async () => {
  const { conn, db } = route.params;
  const coll = activeCollectionName.value;
  if (!conn || !db || !coll) return;

  sanitizing.value = true;
  try {
    const res = await axios.post(`/api/${conn}/${db}/${coll}/indexes/ai-sanitize`);
    sanitizerResult.value = res.data;
    showSanitizerDashboard.value = true;
  } catch (e) {
    console.error('Error running sanitizer:', e);
    ElMessage.error(store.t('Error running AI index optimizer'));
  } finally {
    sanitizing.value = false;
  }
};

const getProgressColor = (score: number) => {
  if (score >= 90) return '#67c23a';
  if (score >= 70) return '#e6a23c';
  return '#f56c6c';
};

const getIndexStatusType = (status: string) => {
  if (status === 'HEALTHY') return 'success';
  if (status === 'REDUNDANT') return 'danger';
  if (status === 'UNUSED') return 'warning';
  return 'info';
};

const handleDropIndexWithAI = (indexName: string, reason: string) => {
  ElMessageBox.confirm(
    `AI recommends dropping index "${indexName}" because: "${reason}". Proceed to drop?`,
    store.t('AI Confirmation'),
    {
      confirmButtonText: store.t('Drop Index'),
      cancelButtonText:  store.t('Cancel'),
      type: 'warning'
    }
  ).then(async () => {
    const conn = route.params.conn || store.activeConnection;
    const db = route.params.db || store.activeDb;
    const coll = activeCollectionName.value;

    loading.value = true;
    try {
      await axios.post(`/api/${conn}/${db}/${coll}/index/drop`, {
        index_name: indexName
      });
      ElMessage.success(store.t('Index successfully dropped'));
      loadIndexes();
      runIndexSanitizer();
    } catch (e) {
      ElMessage.error(store.t('Error dropping index'));
    } finally {
      loading.value = false;
    }
  }).catch(() => {});
};

const optimizeIndexes = () => {
  showSanitizerDashboard.value = !showSanitizerDashboard.value;
  if (showSanitizerDashboard.value && !sanitizerResult.value) {
    runIndexSanitizer();
  }
};

const openCreateDialog = () => {
  isEditMode.value = false;
  showDialog.value = true;
};

const openEditDialog = (row: any) => {
  isEditMode.value      = true;
  editingIndexName.value = row.name;
  // Populate form with existing index data
  indexForm.keys   = JSON.stringify(row.key, null, 2);
  indexForm.unique = !!row.unique;
  indexForm.sparse = !!row.sparse;
  showDialog.value = true;
};

const resetForm = () => {
  indexForm.keys   = '';
  indexForm.unique = false;
  indexForm.sparse = false;
  editingIndexName.value = '';
};

// ── Create ────────────────────────────────────────────────────────
const createIndex = async () => {
  if (!indexForm.keys.trim()) {
    ElMessage.error(store.t('Index key fields are required'));
    return;
  }

  const conn = route.params.conn || store.activeConnection;
  const db = route.params.db || store.activeDb;
  const coll = activeCollectionName.value;

  saving.value = true;
  try {
    await axios.post(`/api/${conn}/${db}/${coll}/index/create`, {
      keys:   indexForm.keys,
      unique: indexForm.unique,
      sparse: indexForm.sparse
    });
    ElMessage.success(store.t('Index successfully created'));
    showDialog.value = false;
    loadIndexes();
  } catch (e: any) {
    const msg = e.response?.data?.msg || store.t('Error creating index');
    ElMessage.error(msg);
  } finally {
    saving.value = false;
  }
};

// ── Update (Drop → Recreate) ──────────────────────────────────────
const updateIndex = async () => {
  const conn = route.params.conn || store.activeConnection;
  const db = route.params.db || store.activeDb;
  const coll = activeCollectionName.value;

  saving.value = true;
  try {
    // Step 1: drop the existing index
    await axios.post(`/api/${conn}/${db}/${coll}/index/drop`, {
      index_name: editingIndexName.value
    });

    // Step 2: recreate with the same keys but updated options
    await axios.post(`/api/${conn}/${db}/${coll}/index/create`, {
      keys:   indexForm.keys,
      unique: indexForm.unique,
      sparse: indexForm.sparse
    });

    ElMessage.success(store.t('Index successfully updated (dropped & recreated)'));
    showDialog.value = false;
    loadIndexes();
  } catch (e: any) {
    const msg = e.response?.data?.msg || store.t('Error updating index');
    ElMessage.error(msg);
  } finally {
    saving.value = false;
  }
};

// ── Drop ──────────────────────────────────────────────────────────
const handleDropIndex = (indexName: string) => {
  ElMessageBox.confirm(
    `${store.t('Drop index')} "${indexName}"?`,
    store.t('Warning'),
    {
      confirmButtonText: store.t('Drop'),
      cancelButtonText:  store.t('Cancel'),
      type: 'warning'
    }
  ).then(async () => {
    const conn = route.params.conn || store.activeConnection;
    const db = route.params.db || store.activeDb;
    const coll = activeCollectionName.value;

    loading.value = true;
    try {
      await axios.post(`/api/${conn}/${db}/${coll}/index/drop`, {
        index_name: indexName
      });
      ElMessage.success(store.t('Index successfully dropped'));
      loadIndexes();
    } catch (e) {
      ElMessage.error(store.t('Error dropping index'));
    } finally {
      loading.value = false;
    }
  }).catch(() => {});
};
</script>

<style scoped>
/* .indexes-card { 
  background-color: transparent !important;
} */

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 1rem;
}

.index-field-tag { margin-right: 4px; }

.field-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 4px;
  line-height: 1.4;
}

.options-row {
  display: flex;
  gap: 24px;
}

.edit-info-alert {
  margin-bottom: 4px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* AI Sanitizer Dashboard Styles */
.sanitizer-dashboard-wrapper {
  margin-bottom: 1.5rem;
}
.sanitizer-card {
  border: 1px solid rgba(103, 194, 58, 0.2);
}
.sanitizer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.ai-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--el-color-success);
}
.health-score-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  border-right: 1px solid var(--el-border-color-lighter);
  padding: 1rem;
}
.score-label {
  font-weight: 600;
  margin-top: 10px;
  font-size: 0.9rem;
}
.score-desc {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 6px;
  max-width: 160px;
  line-height: 1.3;
}
.recommendations-title {
  margin: 0 0 10px 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
}
.no-rec-msg {
  padding: 10px 0;
}
.rec-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 250px;
  overflow-y: auto;
  padding-right: 6px;
}
.rec-item {
  border-left: 4px solid var(--el-border-color);
  background-color: var(--el-fill-color-blank);
  padding: 10px 12px;
  border-radius: 4px;
  border: 1px solid var(--el-border-color-light);
  border-left-width: 4px;
}
.rec-level-danger {
  border-left-color: var(--el-color-danger);
}
.rec-level-warning {
  border-left-color: var(--el-color-warning);
}
.rec-level-info {
  border-left-color: var(--el-color-info);
}
.rec-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  margin-bottom: 6px;
}
.rec-reason {
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.3;
  margin-bottom: 8px;
}
.rec-actions {
  display: flex;
  justify-content: flex-end;
}
.status-badge {
  margin-left: 8px;
}
.sanitizer-idle-state {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.85rem;
}
</style>
