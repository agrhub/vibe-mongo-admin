<template>
  <div class="connections-view page-body">
    <!-- Header Summary row -->
    <div class="connections-header">
      <div>
        <h2 class="section-title">{{ store.t('MongoDB Connections') }}</h2>
        <p class="section-desc">{{ store.t('Manage your MongoDB database connection profiles.') }}</p>
      </div>
      <el-button 
        type="primary" 
        :icon="Plus" 
        size="large" round
        @click="openAddDialog"
      >
        {{ store.t('New Connection') }}
      </el-button>
    </div>

    <!-- Active Connection Cards grid -->
    <el-row :gutter="24" class="cards-grid">
      <el-col 
        v-for="(config, name) in store.connections" 
        :key="name" 
        :xs="24" :sm="12" :lg="8"
        class="card-col"
      >
        <ConnectionCard 
          :name="name" 
          :config="config" 
          @edit="handleEdit" 
          @delete="handleDelete" 
        />
      </el-col>

      <!-- Empty state Connection -->
      <el-col :span="24" v-if="Object.keys(store.connections).length === 0">
        <div class="empty-state">
          <el-icon class="empty-state-icon"><ConnectionIcon /></el-icon>
          <h3>{{ store.t('No Connections Configured') }}</h3>
          <p>{{ store.t('Create your first database connection profile to get started.') }}</p>
          <el-button type="primary" round :icon="Plus" @click="openAddDialog" size="large">
            {{ store.t('Add Connection') }}
          </el-button>
        </div>
      </el-col>
    </el-row>

    <!-- Dialog to Add / Edit Connection -->
    <NewConnectionDialog 
      v-model="dialogVisible" 
      :edit-data="editData" 
      @saved="store.fetchConnections" 
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { store } from '../stores';
import { Plus, Connection as ConnectionIcon } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import axios from 'axios';
import ConnectionCard from '../components/connection/ConnectionCard.vue';
import NewConnectionDialog from '../components/connection/NewConnectionDialog.vue';

const dialogVisible = ref(false);
const editData = ref(null);

onMounted(() => {
  store.activeConnection = '';
  store.activeDb = '';
  store.activeColl = '';
  store.fetchConnections();
});

const openAddDialog = () => {
  editData.value = null;
  dialogVisible.value = true;
};

const handleEdit = (name, config) => {
  editData.value = { name, config };
  dialogVisible.value = true;
};

const handleDelete = (name) => {
  ElMessageBox.confirm(
    store.t('Are you sure you want to delete this connection profile?'),
    store.t('Warning'),
    {
      confirmButtonText: store.t('Delete'),
      cancelButtonText: store.t('Cancel'),
      type: 'warning',
    }
  ).then(async () => {
    try {
      await axios.post('/api/connections/delete', { curr_config: name });
      ElMessage.success(store.t('Connection successfully deleted'));
      store.fetchConnections();
    } catch (e) {
      ElMessage.error(store.t('Error deleting connection'));
    }
  }).catch(() => {});
};
</script>

<style scoped>
.connections-view {
  background-color: var(--bg-primary);
}

.connections-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2.5rem;
}

.section-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.03em;
}

.section-desc {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
}

.cards-grid {
  margin-top: 1rem;
}

.card-col {
  margin-bottom: 1.5rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 5rem 2rem;
  background: var(--bg-secondary);
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-lg);
  margin-top: 2rem;
}

.empty-state-icon {
  font-size: 3.5rem;
  color: var(--text-muted);
  margin-bottom: 1.5rem;
}

.empty-state h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.empty-state p {
  font-size: 0.875rem;
  color: var(--text-secondary);
  max-width: 400px;
  margin-bottom: 2rem;
}
</style>
