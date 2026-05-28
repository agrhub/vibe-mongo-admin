<template>
  <div class="collection-schema" v-loading="loading">
    <div v-if="!activeCollectionName" class="schema-placeholder">
      <el-empty :description="store.t('Select a collection to view schema')" />
    </div>
    <div v-else-if="fields.length === 0 && !loading" class="schema-placeholder">
      <el-empty :description="store.t('No schema data available')" />
    </div>
    <el-card v-else class="schema-card">
      <template #header>
        <div class="card-header">
          <span>{{ collectionName ?? activeCollectionName }}</span>
        </div>
      </template>
      <el-table :data="fields" style="width: 100%" size="small" :empty-text="store.t('No Data')">
        <el-table-column prop="field" :label="store.t('Field')" min-width="150">
          <template #default="scope">
            <span style="font-weight: 600;">{{ scope.row.field }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="type" :label="store.t('Type')" width="140">
          <template #default="scope">
            <el-tag size="small" :type="typeTagColor(scope.row.type)">{{ scope.row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="example" :label="store.t('Example')" min-width="250">
          <template #default="scope">
            <span class="example-value">{{ formatExample(scope.row.example) }}</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { store } from '../../stores';
import axios from 'axios';
import { ElMessage } from 'element-plus';

interface FieldInfo {
  field: string;
  type: string;
  example: any;
}

const props = defineProps<{ collectionName?: string }>();
const loading = ref(false);
const fields = ref<FieldInfo[]>([]);

const activeCollectionName = computed(() => props.collectionName || store.activeColl);

function typeTagColor(type: string): string {
  const map: Record<string, string> = {
    string: '',
    number: 'success',
    boolean: 'warning',
    object: 'info',
    array: 'danger',
    ObjectId: 'info',
    Date: 'warning'
  };
  return map[type] || '';
}

function formatExample(val: any): string {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'object') return JSON.stringify(val).slice(0, 80);
  return String(val).slice(0, 80);
}

async function fetchSchema() {
  if (!activeCollectionName.value) return;
  loading.value = true;
  try {
    const res = await axios.get(
      `/api/${store.activeConnection}/${store.activeDb}/${activeCollectionName.value}/schema`
    );
    fields.value = res.data.fields || [];
  } catch (e) {
    ElMessage.error(store.t('Error loading schema'));
  } finally {
    loading.value = false;
  }
}

watch(() => activeCollectionName.value, (newVal) => {
  if (newVal) fetchSchema();
  else fields.value = [];
}, { immediate: true });

watch(() => store.schemaRefreshTrigger, () => {
  fetchSchema();
});
</script>

<style scoped>
.collection-schema {
  min-height: 80px;
}
/* .schema-card {
  background-color: transparent !important;
} */
.schema-placeholder {
  padding: 24px 0;
}
.example-value {
  color: var(--text-muted, #999);
  font-family: monospace;
  font-size: 0.85rem;
}
</style>
