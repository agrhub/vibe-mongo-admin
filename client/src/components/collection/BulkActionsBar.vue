<template>
  <transition name="fade">
    <div v-if="selectedRows.length > 0" class="bulk-actions-toolbar">
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
          @click="$emit('bulk-copy', false)"
        >
          {{ store.t('Copy with _id') }}
        </el-button>
        <el-button 
          type="primary" 
          size="small" 
          plain round
          :icon="CopyDocument" 
          @click="$emit('bulk-copy', true)"
        >
          {{ store.t('Copy without _id') }}
        </el-button>
        <el-button 
          type="danger" 
          size="small" 
          round
          :icon="Delete" 
          @click="$emit('bulk-delete')"
        >
          {{ store.t('Bulk Delete') }}
        </el-button>
        <el-button 
          type="info" 
          size="small" 
          link round
          @click="$emit('clear-selection')"
        >
          {{ store.t('Clear') }}
        </el-button>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';
import { store } from '../../stores';
import { InfoFilled, CopyDocument, Delete } from '@element-plus/icons-vue';

const props = defineProps({
  selectedRows: {
    type: Array,
    required: true
  }
});

defineEmits(['bulk-copy', 'bulk-delete', 'clear-selection']);
</script>

<style scoped>
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
