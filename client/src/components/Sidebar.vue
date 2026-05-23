<template>
  <div class="sidebar-container" :class="{ 'collapsed': isCollapsed }">
    <!-- Brand / Logo -->
    <div class="sidebar-brand">
      <!-- <el-icon v-if="!isCollapsed" class="brand-icon"><Grid /></el-icon> -->
      <el-image src="/favicon.ico" :size="32" style="width: 32px; height: 32px;" v-if="!isCollapsed" class="brand-logo" />
      <span v-if="!isCollapsed" class="brand-text">VibeMongo</span>
      <div class="collapse-toggle" @click="isCollapsed = !isCollapsed">
        <el-icon><Fold v-if="!isCollapsed" /><Expand v-else /></el-icon>
      </div>
    </div>

    <!-- Actions Bar (Language, Theme & Connections list link) -->
    <div class="sidebar-actions" v-if="!isCollapsed">
      <!-- Connections Manager link -->
      <el-button type="primary" round text size="" @click="$router.push('/')">
        <el-icon><Connection /></el-icon>
        {{ store.t('Connections') }}
      </el-button>
      <!-- Language selector dropdown -->
      <!-- <el-dropdown trigger="click" @command="handleLocaleChange" size="small">
        <el-button round text bg size="">
          <el-icon><Location /></el-icon>
          {{ store.activeLocale.toUpperCase() }}
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item 
              v-for="(label, code) in availableLocales" 
              :key="code" 
              :command="code"
              :class="{ 'is-active': store.activeLocale === code }"
            >
              {{ label }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown> -->
    </div>

    <!-- Database Explorer Tree -->
    <div class="sidebar-explorer" v-if="store.activeConnection && !isCollapsed">
      <div class="explorer-header">
        <span class="explorer-title">{{ store.t('Database Explorer') }}</span>
        <el-tooltip :content="store.t('New Database')" placement="top">
          <el-button 
            type="primary" 
            link 
            :icon="Plus" 
            @click="showCreateDbDialog = true"
            size="small"
          />
        </el-tooltip>
      </div>

      <div class="db-list">
        <div 
          v-for="(collections, dbName) in store.sidebarList" 
          :key="dbName" 
          class="db-node"
          :class="{ 'is-active': store.activeDb === dbName }"
        >
          <!-- Database Node Row -->
          <div class="node-row db-row" @click="toggleDbExpand(dbName)">
            <div class="node-left">
              <el-icon class="expand-icon" :class="{ 'expanded': expandedDbs[dbName] }">
                <CaretRight />
              </el-icon>
              <el-icon class="node-icon"><Folder /></el-icon>
              <span class="node-name">{{ dbName }}</span>
            </div>
            <!-- Click database overview button -->
            <el-button 
              class="node-action" 
              type="primary" 
              link 
              :icon="InfoFilled" 
              @click.stop="goToDatabase(dbName)"
              size="small"
            />
          </div>

          <!-- Nested Collections List -->
          <div class="collections-list" v-show="expandedDbs[dbName]">
            <div 
              v-for="coll in collections" 
              :key="coll" 
              class="node-row coll-row"
              :class="{ 'is-active': store.activeDb === dbName && store.activeColl === coll }"
              @click="goToCollection(dbName, coll)"
            >
              <el-icon class="node-icon"><Document /></el-icon>
              <span class="node-name">{{ coll }}</span>
            </div>
            <div v-if="collections.length === 0" class="no-collections">
              {{ store.t('No collections') }}
            </div>
          </div>
        </div>
        <div v-if="Object.keys(store.sidebarList).length === 0" class="empty-sidebar">
          <el-icon class="empty-icon"><FolderOpened /></el-icon>
          <p>{{ store.t('No databases found') }}</p>
        </div>
      </div>
    </div>

    <!-- Small Collapsed sidebar helper icons -->
    <div class="collapsed-icons" v-if="isCollapsed">
      <el-tooltip :content="store.t('Connections')" placement="right">
        <div class="collapsed-icon-btn" @click="$router.push('/')">
          <el-icon><Connection /></el-icon>
        </div>
      </el-tooltip>
      <el-tooltip :content="store.t('Monitoring')" placement="right" v-if="store.activeConnection">
        <div class="collapsed-icon-btn" @click="$router.push(`/${store.activeConnection}/monitoring`)">
          <el-icon><DataLine /></el-icon>
        </div>
      </el-tooltip>
    </div>

    <!-- Dialog to Create Database -->
    <el-dialog v-model="showCreateDbDialog" :title="store.t('Create new database')" width="400px" append-to-body>
      <el-form label-position="top">
        <el-form-item :label="store.t('Database Name')">
          <el-input v-model="newDbName" placeholder="e.g. users_db" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showCreateDbDialog = false">{{ store.t('Cancel') }}</el-button>
          <el-button type="primary" @click="createDatabase" :loading="creatingDb">{{ store.t('Create') }}</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { store } from '../stores';
import { Plus, InfoFilled } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import axios from 'axios';


const router = useRouter();

const isCollapsed = ref(false);
const showCreateDbDialog = ref(false);
const newDbName = ref('');
const creatingDb = ref(false);
const expandedDbs = ref({});

// Mapped human-friendly labels for available locales
const availableLocales = {
  en: 'English',
  de: 'Deutsch',
  es: 'Español',
  ru: 'Русский',
  'zh-cn': '简体中文',
  it: 'Italiano',
  fa: 'فارسی'
};

watch(() => store.sidebarList, (newVal) => {
  // Pre-expand active DB if sidebar is loaded
  if (store.activeDb && newVal[store.activeDb]) {
    expandedDbs.value[store.activeDb] = true;
  }
}, { immediate: true });

onMounted(() => {
  if (store.activeConnection) {
    store.fetchSidebar();
  }
});

const handleLocaleChange = (locale) => {
  store.setLocale(locale);
  ElMessage.success(store.t('Language changed successfully'));
};

const toggleDbExpand = (dbName) => {
  expandedDbs.value[dbName] = !expandedDbs.value[dbName];
};

const goToDatabase = (dbName) => {
  store.setDatabase(dbName);
  router.push(`/${store.activeConnection}/${dbName}`);
};

const goToCollection = (dbName, collName) => {
  store.setDatabase(dbName);
  store.setCollection(collName);
  router.push(`/${store.activeConnection}/${dbName}/${collName}`);
};

const createDatabase = async () => {
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
    
    // Refresh sidebar and route to it
    await store.fetchSidebar();
    goToDatabase(newDbName.value);
  } catch (e) {
    const msg = e.response && e.response.data && e.response.data.msg 
      ? e.response.data.msg 
      : store.t('Error creating database');
    ElMessage.error(msg);
  } finally {
    creatingDb.value = false;
  }
};
</script>

<style scoped>
.sidebar-container {
  width: 260px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  height: 100vh;
  border-right: 1px solid var(--border-color);
  transition: width var(--transition-normal);
  flex-shrink: 0;
}

.sidebar-container.collapsed {
  width: 64px;
}

/* Brand styling */
.sidebar-brand {
  height: 64px;
  display: flex;
  align-items: center;
  padding: 0 1rem;
  border-bottom: 1px solid var(--border-color);
  position: relative;
  overflow: hidden;
}

.brand-icon {
  font-size: 1.5rem;
  color: var(--color-brand);
  margin-right: 0.75rem;
  flex-shrink: 0;
}

.brand-text {
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  white-space: nowrap;
  color: var(--text-primary);
}

.collapse-toggle {
  position: absolute;
  right: 1rem;
  cursor: pointer;
  color: var(--text-muted);
  transition: color var(--transition-fast);
}

.collapse-toggle:hover {
  color: var(--text-primary);
}

/* Actions bar styling */
.sidebar-actions {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  transition: color var(--transition-fast);
}

.action-btn:hover {
  color: var(--text-primary);
}

.action-btn-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  text-decoration: none;
  transition: color var(--transition-fast);
}

.action-btn-link:hover {
  color: var(--text-primary);
}

/* Database Explorer tree */
.sidebar-explorer {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 1rem 0;
}

.explorer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 1rem 0.75rem;
}

.explorer-title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.db-list {
  display: flex;
  flex-direction: column;
}

.db-node {
  margin-bottom: 4px;
}

.node-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  cursor: pointer;
  border-radius: 4px;
  margin: 0 0.5rem;
  transition: all var(--transition-fast);
}

.db-row:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.node-left {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.expand-icon {
  font-size: 0.75rem;
  color: var(--text-muted);
  transition: transform var(--transition-fast);
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

.node-icon {
  font-size: 1rem;
  color: var(--text-muted);
}

.node-name {
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-action {
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.node-row:hover .node-action {
  opacity: 1;
}

/* Collections lists */
.collections-list {
  padding-left: 1.5rem;
  margin-top: 2px;
}

.coll-row {
  padding: 0.35rem 0.75rem;
  margin: 1px 0.5rem 1px 0;
  justify-content: flex-start;
  gap: 8px;
}

.coll-row .node-icon {
  color: var(--color-brand);
}

.coll-row:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.db-node.is-active > .db-row {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-weight: 600;
}

.coll-row.is-active {
  background: var(--color-brand-light);
  color: var(--color-brand);
  font-weight: 600;
  border-left: 2px solid var(--color-brand);
}

.no-collections, .empty-sidebar {
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  color: var(--text-muted);
  font-style: italic;
}

.empty-sidebar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-top: 2rem;
  text-align: center;
}

.empty-icon {
  font-size: 2rem;
}

/* Collapsed items helper */
.collapsed-icons {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem 0;
  gap: 1rem;
}

.collapsed-icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-muted);
  transition: all var(--transition-fast);
}

.collapsed-icon-btn:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}
</style>
