<template>
  <el-card class="conn-card">
    <!-- Card title -->
    <div class="card-header-row">
      <div class="conn-title-box">
        <el-icon class="conn-icon"><Connection /></el-icon>
        <span class="conn-name">{{ name }}</span>
      </div>
      <el-dropdown trigger="click" @command="handleCommand">
        <el-button type="primary" link :icon="MoreFilled" />
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="edit" :icon="Edit">{{ store.t('Edit') }}</el-dropdown-item>
            <el-dropdown-item command="delete" :icon="Delete" class="text-danger">{{ store.t('Delete') }}</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <!-- Connection details -->
    <div class="card-body-box">
      <div class="detail-row">
        <span class="detail-lbl">{{ store.t('Connection String') }}:</span>
        <span class="detail-val mask-string">{{ maskConnString(config.connection_string) }}</span>
      </div>
      <div class="detail-row" v-if="config.connection_options && Object.keys(config.connection_options).length > 0">
        <span class="detail-lbl">{{ store.t('Options') }}:</span>
        <span class="detail-val">{{ JSON.stringify(config.connection_options) }}</span>
      </div>
    </div>

    <!-- Card actions -->
    <div class="card-footer-box">
      <el-button 
        type="primary" round
        class="connect-btn"
        @click="handleConnect"
      >
        {{ store.t('Connect') }}
      </el-button>
    </div>
  </el-card>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { store } from '../../stores';
import { Connection, Edit, Delete, MoreFilled } from '@element-plus/icons-vue';

const props = defineProps({
  name: {
    type: String,
    required: true
  },
  config: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['edit', 'delete']);

const router = useRouter();

const maskConnString = (str) => {
  if (!str) return '';
  try {
    return str.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@)/, '$1******$3');
  } catch (e) {
    return str;
  }
};

const handleConnect = () => {
  store.setConnection(props.name);
  router.push(`/${props.name}`);
};

const handleCommand = (cmd) => {
  if (cmd === 'edit') {
    emit('edit', props.name, props.config);
  } else if (cmd === 'delete') {
    emit('delete', props.name);
  }
};
</script>

<style scoped>
.conn-card {
  height: 240px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 0.5rem;
}

.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.75rem;
  margin-bottom: 1rem;
}

.conn-title-box {
  display: flex;
  align-items: center;
  gap: 8px;
}

.conn-icon {
  font-size: 1.25rem;
  color: var(--color-brand);
}

.conn-name {
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--text-primary);
}

.card-body-box {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-lbl {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.05em;
}

.detail-val {
  font-size: 0.875rem;
  color: var(--text-secondary);
  word-break: break-all;
}

.mask-string {
  font-family: var(--font-mono, monospace);
  font-size: 0.8rem;
  background: var(--bg-secondary);
  padding: 4px 6px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

.card-footer-box {
  border-top: 1px solid var(--border-color);
  padding-top: 1rem;
  margin-top: auto;
}

.connect-btn {
  width: 100%;
}
</style>
