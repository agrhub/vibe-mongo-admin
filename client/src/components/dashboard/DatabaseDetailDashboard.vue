<template>
  <div class="database-detail-dashboard-comp" v-loading="loading">
    <div class="dashboard-header-row">
      <div>
        <h2 class="section-title">
          <el-icon class="title-icon"><Folder /></el-icon>
          {{ store.activeDb }}
        </h2>
        <p class="section-desc">{{ store.activeConnection }} — {{ store.t('Manage database collections and users.') }}</p>
      </div>
      <div class="header-action-group">
        <el-button :icon="Files" round @click="handleBackupDb(store.activeDb)" :loading="backingUp">
          {{ store.t('Backup DB') }}
        </el-button>
        <el-button type="primary" round :icon="Plus" @click="showCreateCollDialog = true">
          {{ store.t('New Collection') }}
        </el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="dashboard-tabs">
      <!-- General Tab -->
      <el-tab-pane :label="store.t('General')" name="general">
        <el-row :gutter="24">
          <!-- Collections table list -->
          <el-col :span="24">
            <el-card class="list-card">
              <template #header>
                <div class="card-header">
                  <span>{{ store.t('Collections') }}</span>
                </div>
              </template>
              <el-table :data="collectionsList" style="width: 100%" size="small" :empty-text="store.t('No Data')">
                <el-table-column :label="store.t('Collection Name')">
                  <template #default="scope">
                    <router-link :to="`/${store.activeConnection}/${store.activeDb}/${scope.row.name}`" class="table-link font-brand">
                      <el-icon class="table-icon"><Document /></el-icon>
                      <strong>{{ scope.row.name }}</strong>
                    </router-link>
                  </template>
                </el-table-column>
                <el-table-column :label="store.t('Documents')" width="120">
                  <template #default="scope">
                    {{ scope.row.stats ? scope.row.stats.Documents : 0 }}
                  </template>
                </el-table-column>
                <el-table-column :label="store.t('Size')" width="120">
                  <template #default="scope">
                    {{ formatBytes(scope.row.stats ? scope.row.stats.Storage : 0) }}
                  </template>
                </el-table-column>
                <el-table-column :label="store.t('Actions')" fixed="right" width="180">
                  <template #default="scope">
                    <el-button 
                      type="primary" 
                      link size="small"
                      :icon="Edit"
                      @click="openRenameCollDialog(scope.row.name)"
                    >
                      {{ store.t('Rename') }}
                    </el-button>
                    <el-button 
                      type="danger" 
                      link size="small"
                      :icon="Delete"
                      @click="handleDropColl(scope.row.name)"
                    >
                      {{ store.t('Drop') }}
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>
          </el-col>
        </el-row>

        <el-row :gutter="24" justify="center">
          <!-- Database User Management & Backups -->
          <el-col :xs="24" :md="10">
            <el-card class="list-card">
              <template #header>
                <div class="card-header">
                  <span>{{ store.t('Database Users') }}</span>
                  <el-button type="primary" text bg round size="small" :icon="Plus" @click="showCreateUserDialog = true">
                    {{ store.t('Add User') }}
                  </el-button>
                </div>
              </template>
              <el-table :data="usersList" style="width: 100%" :empty-text="store.t('No Data')" size="small">
                <el-table-column prop="user" :label="store.t('Username')">
                  <template #default="scope">
                    <span class="user-cell">
                      <el-icon><User /></el-icon>
                      <strong>{{ scope.row.user }}</strong>
                    </span>
                  </template>
                </el-table-column>
                <el-table-column :label="store.t('Roles')">
                  <template #default="scope">
                    <el-tag 
                      v-for="role in scope.row.roles" 
                      :key="role.role" 
                      size="small" 
                      class="role-tag"
                    >
                      {{ role.role }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column :label="store.t('Action')" fixed="right" width="100">
                  <template #default="scope">
                    <el-button 
                      type="danger" 
                      link size="small"
                      :icon="Delete"
                      @click="handleDropUser(scope.row.user)"
                    >
                      {{ store.t('Delete') }}
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>
          </el-col>
          <el-col :xs="24" :md="14">
            <!-- Database Backups list -->
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
                    <el-button type="primary" text bg round size="small" :icon="Upload">
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
                        :icon="Download"
                        @click="handleDownloadBackup(scope.row.name)"
                      >
                      </el-button>
                    </el-tooltip>
                    <el-tooltip :content="store.t('Restore')" placement="top">
                      <el-button 
                        type="success" 
                        link 
                        :icon="RefreshLeft"
                        @click="handleRestoreDb(scope.row.name)"
                      >
                      </el-button>
                    </el-tooltip>
                    <el-tooltip :content="store.t('Delete')" placement="top">
                      <el-button 
                        type="danger" 
                        link 
                        :icon="Delete"
                        @click="handleDeleteBackup(scope.row.name)"
                      >
                      </el-button>
                    </el-tooltip>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>
          </el-col>
        </el-row>
      </el-tab-pane>

      <!-- Schema Tab -->
      <el-tab-pane :label="store.t('Schema')" name="schema">
        <div v-if="collectionsList.length === 0" class="all-collections-empty">
          <el-empty :description="store.t('No collections found')" />
        </div>
        <div v-else class="all-collections-list">
          <!-- <el-card class="list-card"> -->
            <div v-for="coll in collectionsList" :key="coll.name" class="collection-section">
              <CollectionSchema :collection-name="coll.name" />
            </div>
          <!-- </el-card> -->
        </div>
      </el-tab-pane>

      <!-- Indexes Tab -->
      <el-tab-pane :label="store.t('Indexes')" name="indexes">
        <div v-if="collectionsList.length === 0" class="all-collections-empty">
          <el-empty :description="store.t('No collections found')" />
        </div>
        <div v-else class="all-collections-list">
          <!-- <el-card class="list-card"> -->
            <div v-for="coll in collectionsList" :key="coll.name" class="collection-section">
              <CollectionIndexes :collection-name="coll.name" />
            </div>
          <!-- </el-card> -->
        </div>
      </el-tab-pane>

      <!-- Analysis Tab -->
      <el-tab-pane :label="store.t('Analysis')" name="analysis">
        <DatabaseAnalysis />
      </el-tab-pane>

      <!-- ERD Tab -->
      <el-tab-pane :label="store.t('ERD')" name="erd" lazy>
        <DatabaseErd />
      </el-tab-pane>
    </el-tabs>

    <!-- New Collection dialog -->
    <el-dialog v-model="showCreateCollDialog" :title="store.t('Create new collection')" width="400px">
      <el-form label-position="top">
        <el-form-item :label="store.t('Collection Name')" required>
          <el-input v-model="newCollName" placeholder="e.g. products" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showCreateCollDialog = false" round>{{ store.t('Cancel') }}</el-button>
          <el-button type="primary" round @click="createCollection" :loading="creatingColl">{{ store.t('Create') }}</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Rename Collection dialog -->
    <el-dialog v-model="showRenameCollDialog" :title="store.t('Rename collection')" width="400px">
      <el-form label-position="top">
        <el-form-item :label="store.t('New Collection Name')" required>
          <el-input v-model="renameCollModel.newName" placeholder="e.g. products_old" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showRenameCollDialog = false" round>{{ store.t('Cancel') }}</el-button>
          <el-button type="primary" round @click="renameCollection" :loading="renamingColl">{{ store.t('Rename') }}</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- New Database User dialog -->
    <el-dialog v-model="showCreateUserDialog" :title="store.t('Add new database user')" width="420px">
      <el-form :model="userForm" label-position="top">
        <el-form-item :label="store.t('Username')" required>
          <el-input v-model="userForm.username" placeholder="e.g. read_only_app" />
        </el-form-item>
        <el-form-item :label="store.t('Password')" required>
          <el-input v-model="userForm.password" type="password" show-password placeholder="••••••••" />
        </el-form-item>
        <el-form-item :label="store.t('Roles (Comma separated privileges)')">
          <el-input v-model="userForm.roles" placeholder="readWrite, dbAdmin" />
          <p class="role-hint">e.g. read, readWrite, dbAdmin, userAdmin</p>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showCreateUserDialog = false" round>{{ store.t('Cancel') }}</el-button>
          <el-button type="primary" round @click="createDbUser" :loading="creatingUser">{{ store.t('Create User') }}</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Backup DB dialog -->
    <el-dialog v-model="showBackupDialog" :title="store.t('Backup Database')" width="400px">
      <el-form label-position="top">
        <el-form-item :label="store.t('Backup Options')">
          <el-checkbox v-model="backupOptions.keepObjectId">
            {{ store.t('Keep ObjectId (recommended to preserve references)') }}
          </el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showBackupDialog = false" round>{{ store.t('Cancel') }}</el-button>
          <el-button type="primary" round @click="confirmBackupDb" :loading="backingUp">{{ store.t('Backup') }}</el-button>
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
          <el-button @click="showRestoreDialog = false" round>{{ store.t('Cancel') }}</el-button>
          <el-button type="primary" round @click="confirmRestoreDb" :loading="restoringDb" :disabled="!restoreTargetDb">{{ store.t('Restore') }}</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { store } from '../../stores';
import { Folder, Document, Delete, Plus, Edit, User, Files, RefreshLeft, Upload, Download } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import axios from 'axios';

// Component imports
import CollectionSchema from '../collection/CollectionSchema.vue';
import CollectionIndexes from '../collection/CollectionIndexes.vue';
import DatabaseAnalysis from './DatabaseAnalysis.vue';
import DatabaseErd from './DatabaseErd.vue';

const route = useRoute();
const loading = ref(false);

// Pinia properties mappings
const collectionsList = computed({
  get: () => store.collectionsList,
  set: (val) => { store.collectionsList = val; }
});
const usersList = computed({
  get: () => store.usersList,
  set: (val) => { store.usersList = val; }
});
const backupsList = computed({
  get: () => store.backupsList,
  set: (val) => { store.backupsList = val; }
});

const allDatabasesList = computed(() => {
  if (!store.sidebarList) return [];
  return Object.keys(store.sidebarList);
});

// Dialog controllers
const showCreateCollDialog = ref(false);
const newCollName = ref('');
const creatingColl = ref(false);

const showRenameCollDialog = ref(false);
const renameCollModel = reactive({ oldName: '', newName: '' });
const renamingColl = ref(false);

const showCreateUserDialog = ref(false);
const creatingUser = ref(false);
const userForm = reactive({ username: '', password: '', roles: 'readWrite' });

// Custom Backup & Restore dialog states
const showBackupDialog = ref(false);
const backupOptions = reactive({
  keepObjectId: true
});
const backingUp = ref(false);

const showRestoreDialog = ref(false);
const restoreTargetBackup = ref('');
const restoreTargetDb = ref('');
const restoringDb = ref(false);
const restoreOptions = reactive({
  restoreMode: 'replace'
});

// Schema & Analysis tab state
const activeTab = ref('general');

watch(() => store.activeDb, () => {
  loadDashboardData();
}, { immediate: true });

// SYNC TAB from URL query param (for AI agent navigation)
watch(
  () => route.query.tab,
  (newTab) => {
    if (newTab && ['general', 'schema', 'indexes', 'analysis'].includes(newTab)) {
      activeTab.value = newTab;
    }
  },
  { immediate: true }
);

// Format helpers
function formatBytes(bytes, decimals = 2) {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatDate(dStr) {
  if (!dStr) return '';
  const d = new Date(dStr);
  return d.toLocaleString();
}

// Fetch dashboard data
async function loadDashboardData() {
  const conn = store.activeConnection;
  const db = store.activeDb;
  if (!conn || !db) return;
  loading.value = true;
  try {
    const res = await axios.get(`/api/${conn}/${db}/stats`);
    const stats = res.data.db_stats || {};
    store.collectionsList = (res.data.coll_list || []).map((name) => ({
      name: name,
      stats: stats[name] || null
    }));
    store.usersList = res.data.conn_users?.users || [];
    store.backupsList = res.data.backup_list || [];
  } catch(e) {
    ElMessage.error(store.t('Error loading database dashboard statistics'));
  } finally {
    loading.value = false;
  }
}

// Collection management
const createCollection = async () => {
  if (!newCollName.value) {
    ElMessage.error(store.t('Collection name is required'));
    return;
  }
  
  creatingColl.value = true;
  try {
    const res = await axios.post(`/api/${store.activeConnection}/${store.activeDb}/collection/create`, {
      collection_name: newCollName.value
    });
    ElMessage.success(res.data.msg || store.t('Collection successfully created'));
    showCreateCollDialog.value = false;
    newCollName.value = '';
    
    // Refresh sidebar & table
    await store.fetchSidebar();
    loadDashboardData();
  } catch (e) {
    const msg = e.response && e.response.data && e.response.data.msg 
      ? e.response.data.msg 
      : store.t('Error creating collection');
    ElMessage.error(msg);
  } finally {
    creatingColl.value = false;
  }
};

const openRenameCollDialog = (collName) => {
  renameCollModel.oldName = collName;
  renameCollModel.newName = collName;
  showRenameCollDialog.value = true;
};

const renameCollection = async () => {
  if (!renameCollModel.newName) {
    ElMessage.error(store.t('New collection name is required'));
    return;
  }
  
  renamingColl.value = true;
  try {
    const res = await axios.post(`/api/${store.activeConnection}/${store.activeDb}/${renameCollModel.oldName}/rename`, {
      new_collection_name: renameCollModel.newName
    });
    ElMessage.success(res.data.msg || store.t('Collection successfully renamed'));
    showRenameCollDialog.value = false;
    
    await store.fetchSidebar();
    loadDashboardData();
  } catch (e) {
    const msg = e.response && e.response.data && e.response.data.msg 
      ? e.response.data.msg 
      : store.t('Error renaming collection');
    ElMessage.error(msg);
  } finally {
    renamingColl.value = false;
  }
};

const handleDropColl = (collName) => {
  ElMessageBox.prompt(
    store.t('This action will delete all documents in collection ') + collName + '! ' + store.t('Please type collection name to confirm:'),
    store.t('Warning'),
    {
      confirmButtonText: store.t('Drop Collection'),
      cancelButtonText: store.t('Cancel'),
      confirmButtonClass: 'el-button--danger',
      inputPattern: new RegExp(`^${collName}$`),
      inputErrorMessage: store.t('Collection name does not match')
    }
  ).then(async () => {
    loading.value = true;
    try {
      await axios.post(`/api/${store.activeConnection}/${store.activeDb}/collection/delete`, {
        collection_name: collName
      });
      ElMessage.success(store.t('Collection successfully deleted'));
      
      await store.fetchSidebar();
      loadDashboardData();
    } catch (e) {
      ElMessage.error(store.t('Error deleting collection'));
    } finally {
      loading.value = false;
    }
  }).catch(() => {});
};

// Users management
const createDbUser = async () => {
  if (!userForm.username || !userForm.password) {
    ElMessage.error(store.t('Username and password are required'));
    return;
  }
  
  creatingUser.value = true;
  try {
    await axios.post(`/api/${store.activeConnection}/${store.activeDb}/user/create`, {
      username: userForm.username,
      user_password: userForm.password,
      roles: userForm.roles
    });
    ElMessage.success(store.t('User successfully created'));
    showCreateUserDialog.value = false;
    userForm.username = '';
    userForm.password = '';
    userForm.roles = 'readWrite';
    
    loadDashboardData();
  } catch (e) {
    const msg = e.response && e.response.data && e.response.data.msg 
      ? e.response.data.msg 
      : store.t('Error creating user');
    ElMessage.error(msg);
  } finally {
    creatingUser.value = false;
  }
};

const handleDropUser = (username) => {
  ElMessageBox.confirm(
    store.t('Are you sure you want to drop user ') + username + '?',
    store.t('Warning'),
    {
      confirmButtonText: store.t('Drop User'),
      cancelButtonText: store.t('Cancel'),
      type: 'warning'
    }
  ).then(async () => {
    loading.value = true;
    try {
      await axios.post(`/api/${store.activeConnection}/${store.activeDb}/user/delete`, {
        username: username
      });
      ElMessage.success(store.t('User successfully dropped'));
      loadDashboardData();
    } catch (e) {
      ElMessage.error(store.t('Error dropping user'));
    } finally {
      loading.value = false;
    }
  }).catch(() => {});
};

// Backup / restore
const handleBackupDb = (dbName) => {
  backupOptions.keepObjectId = true;
  showBackupDialog.value = true;
};

const confirmBackupDb = async () => {
  backingUp.value = true;
  try {
    const res = await axios.post(`/api/${store.activeConnection}/${store.activeDb}/backup`, {
      keepObjectId: backupOptions.keepObjectId
    });
    ElMessage.success(res.data.msg || store.t('Database successfully backed up'));
    showBackupDialog.value = false;
    loadDashboardData();
  } catch (e) {
    const msg = e.response && e.response.data && e.response.data.msg 
      ? e.response.data.msg 
      : store.t('Error backing up database');
    ElMessage.error(msg);
  } finally {
    backingUp.value = false;
  }
};

// Backups list management
const handleUploadBackup = async (options) => {
  const file = options.file;
  const formData = new FormData();
  formData.append('backupFile', file);
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
  restoreTargetDb.value = store.activeDb || '';
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
</script>

<style scoped>
.database-detail-dashboard-comp {
  padding-bottom: 40px;
}

.dashboard-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 6px 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.title-icon { color: #ebcb8b; }

.section-desc {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.header-action-group {
  display: flex;
  gap: 12px;
}

.dashboard-tabs :deep(.el-tabs__header) {
  margin-bottom: 24px;
}

.dashboard-tabs :deep(.el-tabs__item) {
  font-size: 1rem;
  font-weight: 500;
  padding: 0 24px;
}

.tab-header-toolbar {
  margin-bottom: 16px;
  display: flex;
  justify-content: flex-end;
}

.content-row { margin-bottom: 24px; }
.list-card {
  border-radius: var(--radius-md) !important;
  /* background: var(--bg-secondary) !important; */
  /* border: 1px solid var(--border-color) !important; */
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: var(--text-primary);
}

.table-link {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--el-color-primary);
  text-decoration: none;
  transition: opacity 0.2s;
}

.table-link:hover { opacity: 0.8; }
.table-icon { font-size: 1.1rem; }

.user-cell, .backup-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.role-tag {
  margin-right: 4px;
  background: rgba(64, 158, 255, 0.1);
  border-color: rgba(64, 158, 255, 0.2);
  color: #409eff;
}

.no-users-prompt, .no-backups-prompt {
  padding: 30px;
  text-align: center;
  color: var(--text-muted);
  font-style: italic;
  font-size: 0.9rem;
}

.role-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 4px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* :deep(.el-table) {
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
} */

/* All-collections view for Schema & Indexes tabs */
.all-collections-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.all-collections-empty {
  padding: 40px 0;
}

.collection-section {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-secondary);
  margin-bottom: 20px;
}

.collection-section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-primary);
}

.collection-section-header .el-icon {
  color: var(--color-brand);
}

.collection-section-name {
  font-family: 'Fira Code', monospace;
  color: var(--color-brand);
}

</style>
