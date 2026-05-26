<template>
  <div class="table-view-container">
    <el-table
      ref="tableRef"
      :data="documents"
      style="width: 100%"
      stripe
      size="small"
      class="premium-docs-table"
      :empty-text="store.t('No matching documents found')"
      @sort-change="handleSortChange"
      @selection-change="handleSelectionChange"
    >
      <!-- Checkbox selection column -->
      <el-table-column type="selection" width="55" fixed="left" />

      <!-- Dynamic Columns -->
      <el-table-column
        v-for="col in tableColumns"
        :key="col"
        :prop="col"
        sortable="custom"
        min-width="150"
        show-overflow-tooltip
      >
        <template #header>
          <div class="column-header-box">
            <span class="column-name">{{ col }}</span>
            <el-input
              v-model="localFilters[col]"
              size="small"
              :placeholder="store.t('Type to search...')"
              clearable
              class="col-search-input"
              @click.stop
            >
              <template #prefix>
                <el-icon class="el-input__icon"><Search /></el-icon>
              </template>
            </el-input>
          </div>
        </template>
        <template #default="scope">
          <span :class="{ 'doc-id-cell-text': col === '_id', 'cell-text-regular': col !== '_id' }">
            {{ formatCellValue(scope.row[col]) }}
          </span>
        </template>
      </el-table-column>

      <!-- Actions column -->
      <el-table-column :label="store.t('Actions')" width="130" fixed="right">
        <template #default="scope">
          <div class="table-action-btns">
            <el-tooltip :content="store.t('Copy (without _id)')" placement="top">
              <el-button
                type="primary"
                link
                size="small"
                :icon="CopyDocument"
                @click="$emit('copy-doc', scope.row)"
              />
            </el-tooltip>
            <el-tooltip :content="store.t('Edit')" placement="top">
              <el-button
                type="primary"
                link
                size="small"
                :icon="Edit"
                @click="$emit('edit-doc', formatDocIdRaw(scope.row._id))"
              />
            </el-tooltip>
            <el-tooltip :content="store.t('Delete')" placement="top">
              <el-button
                type="danger"
                link
                size="small"
                :icon="Delete"
                @click="$emit('delete-doc', formatDocIdRaw(scope.row._id))"
              />
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { store } from '../../stores';
import { Search, CopyDocument, Edit, Delete } from '@element-plus/icons-vue';

const props = defineProps({
  documents: {
    type: Array,
    required: true
  }
});

const emit = defineEmits(['sort-change', 'selection-change', 'filter-change', 'copy-doc', 'edit-doc', 'delete-doc']);

const tableRef = ref(null);
const localFilters = ref({});

// Watch for deep changes in localFilters with a 450ms debounce
let filterTimeout = null;
watch(
  () => localFilters.value,
  (newFilters) => {
    if (filterTimeout) clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => {
      // Create a clean copy to emit
      const cleanFilters = {};
      for (const [k, v] of Object.entries(newFilters)) {
        if (v !== '' && v !== null && v !== undefined) {
          cleanFilters[k] = v;
        }
      }
      emit('filter-change', cleanFilters);
    }, 450);
  },
  { deep: true }
);

// Get unique keys from the current documents page to build columns dynamically
const tableColumns = computed(() => {
  const keys = new Set();
  props.documents.forEach(doc => {
    Object.keys(doc).forEach(key => {
      if (key !== '_id') {
        keys.add(key);
      }
    });
  });
  return ['_id', ...Array.from(keys).sort()];
});

// Format dynamic cell values safely
const formatCellValue = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if (val.$oid) return val.$oid;
    if (val.$date) return val.$date;
    return JSON.stringify(val);
  }
  return String(val);
};

// Raw ID formatter for Edit/Delete actions
const formatDocIdRaw = (id) => {
  if (id === null || id === undefined) return '';
  if (id.$oid) return id.$oid;
  if (typeof id === 'object') return id.toString();
  return id;
};

const handleSortChange = ({ prop, order }) => {
  emit('sort-change', { prop, order });
};

const handleSelectionChange = (selection) => {
  emit('selection-change', selection);
};

// Expose clearSelection so parent can call it
defineExpose({
  clearSelection: () => {
    if (tableRef.value) {
      tableRef.value.clearSelection();
    }
  },
  clearFilters: () => {
    localFilters.value = {};
  }
});
</script>

<style scoped>
.table-view-container {
  background: var(--bg-secondary);
  border-radius: var(--radius-md, 8px);
  padding: 1px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  margin-top: 1rem;
}

.premium-docs-table {
  --el-table-border-color: var(--border-color);
  --el-table-header-bg-color: var(--bg-secondary);
  --el-table-row-hover-bg-color: var(--bg-hover, rgba(64, 158, 255, 0.05));
  background-color: transparent !important;
}

:deep(.premium-docs-table .el-table__header-wrapper th) {
  padding: 8px 0;
}

:deep(.premium-docs-table .el-table__cell) {
  border-bottom: 1px solid var(--border-color);
}

.column-header-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px 0;
  width: 100%;
}

.column-name {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--text-primary);
  text-transform: capitalize;
}

.col-search-input {
  width: 100%;
}

:deep(.col-search-input .el-input__wrapper) {
  padding: 0 8px;
  background-color: var(--bg-primary) !important;
  box-shadow: 0 0 0 1px var(--border-color) inset !important;
}

:deep(.col-search-input .el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--color-brand) inset !important;
}

.doc-id-cell-text {
  font-family: monospace;
  font-weight: 700;
  color: var(--color-brand, #409eff);
  background: var(--bg-secondary);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.825rem;
}

.cell-text-regular {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-family: inherit;
}

.table-action-btns {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
</style>
