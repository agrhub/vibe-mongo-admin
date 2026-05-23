<template>
  <div class="collection-indexes-comp" v-loading="loading">
    <el-card class="indexes-card">
      <template #header>
        <div class="card-header">
          <span>{{ collectionName ?? activeCollectionName }}</span>
          <div class="header-actions">
            <el-button type="success" round plain :icon="MagicStick" size="small" @click="optimizeIndexes">
              {{ store.t('Optimize Index') }}
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
import { Plus, Delete, Edit, MagicStick } from '@element-plus/icons-vue';
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
const optimizeIndexes = () => {
  const coll = activeCollectionName.value;
  const prompt = `Please analyze the indexes for the collection \`${coll}\`. Suggest how to optimize them to improve query performance, and show a comparison of before and after if possible.`;
  store.openChatWithCommand(prompt, null, true);
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

  saving.value = true;
  try {
    await axios.post(`/api/${store.activeConnection}/${store.activeDb}/${store.activeColl}/index/create`, {
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
  saving.value = true;
  try {
    // Step 1: drop the existing index
    await axios.post(`/api/${store.activeConnection}/${store.activeDb}/${store.activeColl}/index/drop`, {
      index_name: editingIndexName.value
    });

    // Step 2: recreate with the same keys but updated options
    await axios.post(`/api/${store.activeConnection}/${store.activeDb}/${store.activeColl}/index/create`, {
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
    loading.value = true;
    try {
      await axios.post(`/api/${store.activeConnection}/${store.activeDb}/${store.activeColl}/index/drop`, {
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
</style>
