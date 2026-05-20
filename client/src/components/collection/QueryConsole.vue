<template>
  <el-card class="query-card">
    <template #header>
      <div class="query-card-header" @click="showQueryConsole = !showQueryConsole">
        <span class="query-title">
          <el-icon class="query-icon"><Search /></el-icon>
          {{ store.t('Query Console') }}
        </span>
        <el-icon class="collapse-icon" :class="{ 'collapsed': !showQueryConsole }">
          <ArrowDown />
        </el-icon>
      </div>
    </template>

    <div v-show="showQueryConsole" class="query-console-body">
      <!-- Quick Filter Builder -->
      <div class="quick-filter-builder">
        <div class="builder-header">
          <span class="builder-title">
            <el-icon><Filter /></el-icon>
            {{ store.t('Quick Filter Builder') }}
          </span>
          <div class="builder-actions">
            <el-button size="small" type="primary" plain :icon="Plus" @click="addRule">
              {{ store.t('Add Rule') }}
            </el-button>
            <el-button size="small" :icon="RefreshLeft" @click="clearRules" v-if="rules.length > 0">
              {{ store.t('Clear Rules') }}
            </el-button>
          </div>
        </div>

        <div class="filter-rules-list">
          <div v-for="(rule, idx) in rules" :key="idx" class="filter-rule-item">
            <el-autocomplete
              v-model="rule.field"
              :fetch-suggestions="queryFieldSuggestions"
              :placeholder="store.t('Field name')"
              size="default"
              class="rule-field-input"
              style="width: 200px;"
              clearable
              @change="handleFieldChange(rule)"
              @select="(item) => handleFieldSelect(rule, item)"
            />

            <el-select v-model="rule.operator" size="default" class="rule-op-select" @change="handleOperatorChange(rule)">
              <el-option label="==" value="==" />
              <el-option label="!=" value="!=" />
              <el-option label="in" value="$in" />
              <el-option label="not in" value="$nin" />
              <template v-if="rule.valType === 'number' || rule.valType === 'string'">
                <el-option label=">" value=">" />
                <el-option label=">=" value=">=" />
                <el-option label="<" value="<" />
                <el-option label="<=" value="<=" />
              </template>
            </el-select>

            <template v-if="rule.operator === '$in' || rule.operator === '$nin'">
              <el-select
                v-model="rule.valList"
                multiple
                filterable
                allow-create
                default-first-option
                clearable
                :placeholder="store.t('Enter values...')"
                size="default"
                class="rule-val-input"
                @change="syncToQuery"
              />
            </template>
            <template v-else-if="rule.valType === 'boolean'">
              <el-select v-model="rule.val" size="default" class="rule-val-input" @change="syncToQuery">
                <el-option label="true" value="true" />
                <el-option label="false" value="false" />
              </el-select>
            </template>
            <template v-else>
              <el-input
                v-model="rule.val"
                :placeholder="store.t('Filter value')"
                size="default"
                class="rule-val-input"
                @input="syncToQuery"
                clearable
              />
            </template>

            <el-button type="danger" link :icon="Delete" @click="removeRule(idx)" />
          </div>
        </div>
      </div>

      <!-- JSON query + settings -->
      <div class="query-inputs-grid">
        <div class="query-editor-box">
          <label class="input-lbl">{{ store.t('Extended JSON Query Filter') }}</label>
          <el-input
            :model-value="query"
            @update:model-value="$emit('update:query', $event)"
            type="textarea"
            :rows="3"
            placeholder='e.g. { "status": "active", "views": { "$gt": 1000 } }'
            class="code-textarea"
          />
        </div>
        <div class="query-settings-box">
          <div class="setting-item">
            <label class="input-lbl">{{ store.t('Docs Per Page') }}</label>
            <el-select
              :model-value="docsPerPage"
              @update:model-value="$emit('update:docsPerPage', $event)"
              size="default"
              style="width: 100%"
            >
              <el-option :value="5"  label="5"  />
              <el-option :value="10" label="10" />
              <el-option :value="20" label="20" />
              <el-option :value="50" label="50" />
            </el-select>
          </div>
        </div>
      </div>

      <!-- Action row -->
      <div class="query-actions-row">
        <el-button type="danger" plain :icon="Delete" @click="$emit('mass-delete')" :disabled="totalDocs === 0">
          {{ store.t('Mass Delete') }}
        </el-button>
        <div class="query-btn-group">
          <el-button @click="handleReset">{{ store.t('Reset') }}</el-button>
          <el-button type="primary" :icon="Search" @click="$emit('search')">
            {{ store.t('Find') }}
          </el-button>
        </div>
      </div>

      <el-alert
        v-if="queryError"
        :title="queryError"
        type="error"
        show-icon
        :closable="false"
        class="query-alert"
      />
    </div>
  </el-card>
</template>

<script setup>
import { ref, computed } from 'vue';
import { store } from '../../stores';
import { Search, ArrowDown, Filter, Plus, RefreshLeft, Delete } from '@element-plus/icons-vue';

const props = defineProps({
  documents:   { type: Array,  default: () => [] },
  totalDocs:   { type: Number, default: 0 },
  query:       { type: String, default: '' },
  docsPerPage: { type: Number, default: 10 },
  queryError:  { type: String, default: '' }
});

const emit = defineEmits(['update:query', 'update:docsPerPage', 'search', 'reset', 'mass-delete']);

// ── Collapse toggle ──────────────────────────────────────────────
const showQueryConsole = ref(true);

// ── Quick Filter Builder ─────────────────────────────────────────
const rules = ref([]);

// Smart type detection from a raw value returned by BSON serializer
const detectType = (k, v) => {
  if (v && typeof v === 'object') {
    if (v.$oid)  return 'objectId';
    if (v.$date) return 'string';   // date → treat as string in filter
    return 'string';
  }
  if (typeof v === 'boolean') return 'boolean';
  if (typeof v === 'number')  return 'number';
  return 'string';
};

const availableFields = computed(() => {
  const fieldsMap = new Map();
  // Do NOT pre-set _id — detect its real type from documents
  props.documents.forEach(doc => {
    if (doc && typeof doc === 'object') {
      Object.entries(doc).forEach(([k, v]) => {
        if (!fieldsMap.has(k)) {
          fieldsMap.set(k, detectType(k, v));
        }
      });
    }
  });
  // Fallback: if no docs loaded yet, expose _id as string so it still appears
  if (!fieldsMap.has('_id')) fieldsMap.set('_id', 'string');
  return Array.from(fieldsMap.entries()).map(([value, detectedType]) => ({ value, detectedType }));
});


const queryFieldSuggestions = (input, cb) => {
  const results = input
    ? availableFields.value.filter(i => i.value.toLowerCase().includes(input.toLowerCase()))
    : availableFields.value;
  cb(results);
};

const handleValTypeChange = (rule) => {
  if (rule.valType === 'boolean' || rule.valType === 'objectId') {
    if (rule.operator !== '==' && rule.operator !== '!=') rule.operator = '==';
    if (rule.valType === 'boolean' && rule.val !== 'true' && rule.val !== 'false') rule.val = 'true';
  }
  syncToQuery();
};

const handleOperatorChange = (rule) => {
  if (rule.operator === '$in' || rule.operator === '$nin') {
    if (!Array.isArray(rule.valList)) {
      rule.valList = rule.val && rule.val !== '' ? [rule.val] : [];
    }
  } else {
    if (Array.isArray(rule.valList) && rule.valList.length > 0) {
      rule.val = String(rule.valList[0]);
    }
  }
  syncToQuery();
};

const handleFieldSelect = (rule, item) => {
  if (item && item.detectedType) {
    rule.valType = item.detectedType;
    handleValTypeChange(rule);
  }
};

const handleFieldChange = (rule) => {
  const matched = availableFields.value.find(f => f.value === rule.field);
  if (matched && matched.detectedType) {
    rule.valType = matched.detectedType;
    handleValTypeChange(rule);
  }
};

const addRule    = () => rules.value.push({ field: '', operator: '==', val: '', valType: 'string', valList: [] });
const removeRule = (idx) => { rules.value.splice(idx, 1); syncToQuery(); };

const clearRules = () => {
  rules.value = [];
  emit('update:query', '');
};

const syncToQuery = () => {
  const queryObj = {};
  rules.value.forEach(rule => {
    if (!rule.field) return;

    if (rule.operator === '$in' || rule.operator === '$nin') {
      if (!Array.isArray(rule.valList) || rule.valList.length === 0) return;
      const parsed = rule.valList.map(item => {
        if (rule.valType === 'number') { const n = parseFloat(item); return !isNaN(n) ? n : item; }
        if (rule.valType === 'boolean') return item === 'true';
        if (rule.valType === 'objectId') return { "$oid": item };
        return item;
      });
      queryObj[rule.field] = Object.assign(queryObj[rule.field] || {}, { [rule.operator]: parsed });
      return;
    }

    if (rule.val === '' || rule.val === undefined || rule.val === null) return;
    let parsedVal = rule.val;
    if (rule.valType === 'number') { const n = parseFloat(rule.val); if (!isNaN(n)) parsedVal = n; }
    else if (rule.valType === 'boolean')  parsedVal = rule.val === 'true';
    else if (rule.valType === 'objectId') parsedVal = { "$oid": rule.val };

    if      (rule.operator === '==') queryObj[rule.field] = parsedVal;
    else if (rule.operator === '>')  queryObj[rule.field] = Object.assign(queryObj[rule.field] || {}, { "$gt": parsedVal });
    else if (rule.operator === '>=') queryObj[rule.field] = Object.assign(queryObj[rule.field] || {}, { "$gte": parsedVal });
    else if (rule.operator === '<')  queryObj[rule.field] = Object.assign(queryObj[rule.field] || {}, { "$lt": parsedVal });
    else if (rule.operator === '<=') queryObj[rule.field] = Object.assign(queryObj[rule.field] || {}, { "$lte": parsedVal });
    else if (rule.operator === '!=') queryObj[rule.field] = Object.assign(queryObj[rule.field] || {}, { "$ne": parsedVal });
  });

  if (Object.keys(queryObj).length > 0) {
    emit('update:query', JSON.stringify(queryObj, null, 2));
  } else if (rules.value.length === 0) {
    emit('update:query', '');
  }
};

const handleReset = () => {
  clearRules();
  emit('reset');
};

// expose clearRules so parent can call it on hard reset
defineExpose({ clearRules });
</script>

<style scoped>
.quick-filter-builder {
  background: var(--bg-secondary, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-md, 8px);
  padding: 1rem;
  margin-bottom: 1.25rem;
}

.builder-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.builder-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-rules-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.filter-rule-item {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 12px;
  background: var(--bg-primary, #ffffff);
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  border: 1px solid var(--border-color, #e2e8f0);
}

.rule-field-input { flex: 1; min-width: 150px; }
.rule-op-select   { width: 90px; flex-shrink: 0; }
.rule-val-input   { flex: 2; min-width: 200px; }

.query-card { margin-bottom: 2rem; border-radius: var(--radius-sm) !important; }

.query-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.query-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--text-primary);
}

.query-icon { color: var(--color-brand); }

.collapse-icon {
  color: var(--text-muted);
  transition: transform var(--transition-fast);
}
.collapse-icon.collapsed { transform: rotate(-90deg); }

.query-console-body { padding-top: 0.5rem; }

.query-inputs-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1.5rem;
}
@media (max-width: 768px) { .query-inputs-grid { grid-template-columns: 1fr; } }

.input-lbl {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  margin-bottom: 6px;
  display: block;
}

.query-editor-box, .query-settings-box { display: flex; flex-direction: column; }

.query-actions-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.query-btn-group { display: flex; gap: 10px; }
.query-alert     { margin-top: 1rem; }
</style>
