<template>
  <div class="connection-dashboard-comp" v-loading="loading">
    <div class="dashboard-header-row">
      <div>
        <h2 class="section-title">{{ store.t('Connection Dashboard') }}</h2>
        <p class="section-desc">{{ store.activeConnection }} — {{ store.t('Overview of MongoDB server status') }}</p>
      </div>
    </div>

    <!-- Quick Metrics Summary cards -->
    <el-row :gutter="20" class="metrics-row" v-if="serverInfo">
      <el-col :xs="12" :sm="6">
        <el-card class="metric-card">
          <div class="metric-lbl">{{ store.t('Server Version') }}</div>
          <div class="metric-val text-brand">{{ serverInfo.version }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card class="metric-card">
          <div class="metric-lbl">{{ store.t('Memory Virtual') }} / {{ store.t('Resident') }}</div>
          <div class="metric-val" v-if="serverInfo.mem">
            {{ formatBytes(serverInfo.mem.virtual * 1024 * 1024) }} / {{ formatBytes(serverInfo.mem.resident * 1024 * 1024) }}
          </div>
          <div class="metric-val" v-else>N/A</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card class="metric-card">
          <div class="metric-lbl">{{ store.t('Active Connections') }}</div>
          <div class="metric-val" v-if="serverInfo.connections">
            {{ serverInfo.connections.current }} <span class="sub-val">/ {{ serverInfo.connections.available || 'N/A' }}</span>
          </div>
          <div class="metric-val" v-else>N/A</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card class="metric-card">
          <div class="metric-lbl">{{ store.t('Uptime') }}</div>
          <div class="metric-val">{{ formatDuration(serverInfo.uptime) }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Databases list and Backups list -->
    <el-row :gutter="24" class="content-row">
      <!-- Database table list -->
      <el-col :xs="24" :lg="14">
        <el-card class="list-card">
          <template #header>
            <div class="card-header">
              <span>{{ store.t('Databases') }}</span>
              <el-button 
                type="primary" 
                size="small" 
                :icon="Plus"
                @click="showCreateDbDialog = true"
              >
                {{ store.t('Add Database') }}
              </el-button>
            </div>
          </template>
          <el-table :data="databasesList" style="width: 100%" size="small" :empty-text="store.t('No Data')">
            <el-table-column :label="store.t('Database Name')">
              <template #default="scope">
                <router-link :to="`/${store.activeConnection}/${scope.row.name}`" class="table-link">
                  <el-icon class="table-icon"><Folder /></el-icon>
                  <strong>{{ scope.row.name }}</strong>
                </router-link>
              </template>
            </el-table-column>
            <el-table-column :label="store.t('Storage Size')">
              <template #default="scope">
                {{ formatBytes(scope.row.sizeOnDisk) }}
              </template>
            </el-table-column>
            <el-table-column :label="store.t('Action')" fixed="right" width="180">
              <template #default="scope">
                <el-button 
                  type="primary" 
                  link 
                  :icon="Edit"
                  @click="openRenameDbDialog(scope.row.name)"
                >
                  {{ store.t('Rename') }}
                </el-button>
                <el-button 
                  type="danger" 
                  link 
                  :icon="Delete"
                  @click="handleDropDb(scope.row.name)"
                >
                  {{ store.t('Drop') }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <!-- Backups list -->
      <el-col :xs="24" :lg="10">
        <el-card class="list-card">
          <template #header>
            <div class="card-header">
              <span>{{ store.t('Database Backups') }}</span>
              <el-upload
                action="#"
                :show-file-list="false"
                :http-request="handleUploadBackup"
                accept=".zip"
              >
                <el-button type="primary" link :icon="Upload">
                  {{ store.t('Upload Backup') }}
                </el-button>
              </el-upload>
            </div>
          </template>
          <el-table :data="backupsList" style="width: 100%" :empty-text="store.t('No Data')" size="small">
            <el-table-column :label="store.t('Backup Name')" min-width="140">
              <template #default="scope">
                <span class="backup-name-cell">
                  <el-icon><Files /></el-icon>
                  {{ scope.row.name }}
                </span>
              </template>
            </el-table-column>
            <el-table-column :label="store.t('Size')" width="90">
              <template #default="scope">
                <span style="color: var(--text-muted); font-size: 0.8rem;">{{ formatBytes(scope.row.size) }}</span>
              </template>
            </el-table-column>
            <el-table-column :label="store.t('Date')" width="150">
              <template #default="scope">
                <span style="color: var(--text-muted); font-size: 0.8rem;">{{ formatDate(scope.row.date) }}</span>
              </template>
            </el-table-column>
            <el-table-column :label="store.t('Actions')" fixed="right" width="120">
              <template #default="scope">
                <el-tooltip :content="store.t('Download')" placement="top">
                  <el-button 
                    type="primary" 
                    link 
                    size="small"
                    :icon="Download"
                    @click="handleDownloadBackup(scope.row.name)"
                  >
                  </el-button>
                </el-tooltip>
                <el-tooltip :content="store.t('Restore')" placement="top">
                  <el-button 
                    type="success" 
                    link 
                    size="small"
                    :icon="RefreshLeft"
                    @click="handleRestoreDb(scope.row.name)"
                  >
                  </el-button>
                </el-tooltip>
                <el-tooltip :content="store.t('Delete')" placement="top">
                  <el-button 
                    type="danger" 
                    link 
                    size="small"
                    :icon="Delete"
                    @click="handleDeleteBackup(scope.row.name)"
                  >
                  </el-button>
                </el-tooltip>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="backupsList.length === 0" class="no-backups-prompt">
            {{ store.t('No backups found on server backups folder.') }}
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Create Database dialog -->
    <el-dialog v-model="showCreateDbDialog" :title="store.t('Create Database')" width="420px">
      <el-form label-position="top">
        <el-form-item :label="store.t('Database Name')" required>
          <el-input v-model="newDbName" placeholder="e.g. SampleDB" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showCreateDbDialog = false">{{ store.t('Cancel') }}</el-button>
          <el-button type="primary" @click="handleCreateDb" :loading="creatingDb">{{ store.t('Create') }}</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Rename Database dialog -->
    <el-dialog v-model="showRenameDbDialog" :title="store.t('Rename Database')" width="420px">
      <el-form :model="renameDbModel" label-position="top">
        <el-form-item :label="store.t('Old Name')">
          <el-input v-model="renameDbModel.oldName" disabled />
        </el-form-item>
        <el-form-item :label="store.t('New Name')" required>
          <el-input v-model="renameDbModel.newName" placeholder="e.g. sample_store" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showRenameDbDialog = false">{{ store.t('Cancel') }}</el-button>
          <el-button type="primary" @click="renameDatabase" :loading="renamingDb">{{ store.t('Rename') }}</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Restore DB dialog -->
    <el-dialog v-model="showRestoreDialog" :title="store.t('Restore Database Backup')" width="500px">
      <div style="margin-bottom: 16px;">
        <span style="font-size: 0.875rem; color: var(--text-muted);">
          {{ store.t('Restore from: ') }}<strong>{{ restoreTargetBackup }}</strong>
        </span>
      </div>
      <el-form label-position="top">
        <el-form-item :label="store.t('Target Database')">
          <el-select
            v-model="restoreTargetDb"
            style="width: 100%;"
            filterable
            allow-create
            :placeholder="store.t('Select or type database name')"
          >
            <el-option
              v-for="db in allDatabasesList"
              :key="db"
              :label="db"
              :value="db"
            />
          </el-select>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
            {{ store.t('Data will be restored into this database. You can type a new name to create one.') }}
          </div>
        </el-form-item>
        <el-form-item :label="store.t('Restore Mode')">
          <el-select v-model="restoreOptions.restoreMode" style="width: 100%;">
            <el-option value="replace" :label="store.t('Replace completely (Drop target collections first)')" />
            <el-option value="upsert" :label="store.t('Update existing, insert new (Upsert by ObjectId)')" />
            <el-option value="insert" :label="store.t('Insert new objects only (Skip duplicate ObjectIds)')" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showRestoreDialog = false">{{ store.t('Cancel') }}</el-button>
          <el-button type="primary" @click="confirmRestoreDb" :loading="restoringDb" :disabled="!restoreTargetDb">{{ store.t('Restore') }}</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { store } from '../../stores';
import { Folder, Delete, Plus, Edit, Files, RefreshLeft, Upload, Download } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import axios from 'axios';

const loading = ref(false);

// Pinia properties mappings
const serverInfo = computed({
  get: () => store.serverInfo,
  set: (val) => { store.serverInfo = val; }
});
const databasesList = computed({
  get: () => store.databasesList,
  set: (val) => { store.databasesList = val; }
});
const backupsList = computed({
  get: () => store.backupsList,
  set: (val) => { store.backupsList = val; }
});

const allDatabasesList = computed(() => {
  if (!store.sidebarList) return [];
  return Object.keys(store.sidebarList);
});

// Create/Rename Database Dialog controls
const showCreateDbDialog = ref(false);
const newDbName = ref('');
const creatingDb = ref(false);

const showRenameDbDialog = ref(false);
const renameDbModel = reactive({ oldName: '', newName: '' });
const renamingDb = ref(false);

// Restore DB dialog states
const showRestoreDialog = ref(false);
const restoreTargetBackup = ref('');
const restoreTargetDb = ref('');
const restoringDb = ref(false);
const restoreOptions = reactive({
  restoreMode: 'replace'
});

// Format helpers
function formatBytes(bytes, decimals = 2) {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatDuration(sec) {
  if (!sec) return '0s';
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = Math.floor(sec % 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function formatDate(dStr) {
  if (!dStr) return '';
  const d = new Date(dStr);
  return d.toLocaleString();
}

// Fetch dashboard data
async function loadDashboardData() {
  const conn = store.activeConnection;
  if (!conn) return;
  loading.value = true;
  try {
    const res = await axios.get(`/api/${conn}/stats`);
    store.serverInfo = res.data.db_status || null;
    store.databasesList = (res.data.db_list || []).map(item => {
      if (typeof item === 'string') {
        return { name: item, sizeOnDisk: 0 };
      }
      return item;
    });
    store.backupsList = res.data.backup_list || [];
  } catch(e) {
    ElMessage.error(store.t('Error loading dashboard statistics'));
  } finally {
    loading.value = false;
  }
}

// Actions
const handleCreateDb = async () => {
  if (!newDbName.value) {
    ElMessage.error(store.t('Database name is required'));
    return;
  }
  creatingDb.value = true;
  try {
    const res = await axios.post(`/api/${store.activeConnection}/db/create`, {
      db_name: newDbName.value
    });
    ElMessage.success(res.data.msg || store.t('Database successfully created'));
    showCreateDbDialog.value = false;
    newDbName.value = '';
    await store.fetchSidebar();
    await loadDashboardData();
  } catch (e) {
    const msg = e.response && e.response.data && e.response.data.msg 
      ? e.response.data.msg 
      : store.t('Error creating database');
    ElMessage.error(msg);
  } finally {
    creatingDb.value = false;
  }
};

const openRenameDbDialog = (dbName) => {
  renameDbModel.oldName = dbName;
  renameDbModel.newName = dbName;
  showRenameDbDialog.value = true;
};

const renameDatabase = async () => {
  if (!renameDbModel.newName) {
    ElMessage.error(store.t('New database name is required'));
    return;
  }
  if (renameDbModel.newName === renameDbModel.oldName) {
    showRenameDbDialog.value = false;
    return;
  }
  renamingDb.value = true;
  try {
    const res = await axios.post(`/api/${store.activeConnection}/db/rename`, {
      old_db_name: renameDbModel.oldName,
      new_db_name: renameDbModel.newName
    });
    ElMessage.success(res.data.msg || store.t('Database successfully renamed'));
    showRenameDbDialog.value = false;
    await store.fetchSidebar();
    await loadDashboardData();
  } catch (e) {
    const msg = e.response && e.response.data && e.response.data.msg 
      ? e.response.data.msg 
      : store.t('Error renaming database');
    ElMessage.error(msg);
  } finally {
    renamingDb.value = false;
  }
};

const handleDropDb = (dbName) => {
  ElMessageBox.prompt(
    store.t('This action will drop the database completely! Please enter the database name to confirm:'),
    store.t('Warning'),
    {
      confirmButtonText: store.t('Drop Database'),
      cancelButtonText: store.t('Cancel'),
      confirmButtonClass: 'el-button--danger',
      inputPattern: new RegExp(`^${dbName}$`),
      inputErrorMessage: store.t('Database name does not match')
    }
  ).then(async () => {
    loading.value = true;
    try {
      await axios.post(`/api/${store.activeConnection}/db/delete`, { db_name: dbName });
      ElMessage.success(store.t('Database successfully dropped'));
      await store.fetchSidebar();
      await loadDashboardData();
    } catch(e) {
      ElMessage.error(store.t('Error dropping database'));
    } finally {
      loading.value = false;
    }
  }).catch(() => {});
};

// Backups Actions
const handleUploadBackup = async (options) => {
  const file = options.file;
  const formData = new FormData();
  formData.append('backup_file', file);
  try {
    const res = await axios.post(`/api/${store.activeConnection}/backup/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    ElMessage.success(res.data.msg || store.t('Backup successfully uploaded'));
    await loadDashboardData();
  } catch (e) {
    const msg = e.response && e.response.data && e.response.data.msg 
      ? e.response.data.msg 
      : store.t('Error uploading backup');
    ElMessage.error(msg);
  }
};

const handleDownloadBackup = (backupName) => {
  window.open(`/api/${store.activeConnection}/backup/${encodeURIComponent(backupName)}/download`, '_blank');
};

const handleDeleteBackup = (backupName) => {
  ElMessageBox.confirm(
    store.t('Are you sure you want to delete this backup file?'),
    store.t('Warning'),
    {
      confirmButtonText: store.t('Delete'),
      cancelButtonText: store.t('Cancel'),
      type: 'warning'
    }
  ).then(async () => {
    try {
      await axios.delete(`/api/${store.activeConnection}/backup/${encodeURIComponent(backupName)}`);
      ElMessage.success(store.t('Backup file deleted successfully'));
      await loadDashboardData();
    } catch(e) {
      ElMessage.error(store.t('Error deleting backup file'));
    }
  }).catch(() => {});
};

const handleRestoreDb = (backupName) => {
  restoreTargetBackup.value = backupName;
  restoreOptions.restoreMode = 'replace';
  restoreTargetDb.value = '';
  showRestoreDialog.value = true;
};

const confirmRestoreDb = async () => {
  if (!restoreTargetDb.value) {
    ElMessage.error(store.t('Please select a target database'));
    return;
  }
  restoringDb.value = true;
  try {
    const res = await axios.post(`/api/${store.activeConnection}/${restoreTargetDb.value}/restore`, {
      backupFile: restoreTargetBackup.value,
      restoreMode: restoreOptions.restoreMode
    });
    ElMessage.success(res.data.msg || store.t('Database successfully restored'));
    showRestoreDialog.value = false;
    await store.fetchSidebar();
    await loadDashboardData();
  } catch (e) {
    const msg = e.response && e.response.data && e.response.data.msg 
      ? e.response.data.msg 
      : store.t('Error restoring backup');
    ElMessage.error(msg);
  } finally {
    restoringDb.value = false;
  }
};

onMounted(() => {
  loadDashboardData();
});
</script>
