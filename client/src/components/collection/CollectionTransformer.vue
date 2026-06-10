<template>
  <div class="collection-transformer-comp">
    <el-card class="transformer-console-card">
      <template #header>
        <div class="console-header-row">
          <span class="console-title">
            <el-icon class="title-icon"><Cpu /></el-icon>
            AI Document Schema Migrator & Transformer
          </span>
          <el-tag type="danger" round size="small" effect="dark">PROACTIVE DRY-RUN PROTECTION ACTIVE</el-tag>
        </div>
      </template>

      <div class="console-intro">
        <p>Refactor your document schema safely. Type your intent in natural language below. The AI sentinel will generate a MongoDB-compliant aggregation update pipeline, run a completely read-only dry-run aggregate on an actual sample document, and show you the exact outcome for safety validation prior to execution.</p>
      </div>

      <!-- Quick prompts tags -->
      <div class="quick-prompts-row" v-loading="loadingSuggestions">
        <span class="quick-label">{{ store.t('Quick Intent Templates:') }}</span>
        <el-tag
          v-for="tpl in quickTemplates"
          :key="tpl" round
          size="small"
          class="quick-tag"
          @click="selectTemplate(tpl)"
        >
          {{ tpl }}
        </el-tag>
      </div>

      <div class="prompt-input-wrapper">
        <el-input
          v-model="migrationPrompt"
          type="textarea"
          :rows="3"
          placeholder="e.g. Convert price from string to double and multiply by 1.15. Rename price field to unitPrice."
          class="prompt-textarea"
        />
        <div class="input-actions-row">
          <el-button
            type="primary" round text bg
            :loading="dryRunning"
            :disabled="!migrationPrompt.trim()"
            @click="runDryRun"
          >
            {{ store.t('Run Safe Dry-Run Preview') }}
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- Dry-run results visualizer -->
    <div v-if="dryRunResult" class="dry-run-results-wrapper animate-slide-up">
      <el-alert
        v-if="dryRunResult.explanation"
        :title="store.t('AI SRE Safe Migration Analysis')"
        type="success"
        :description="dryRunResult.explanation"
        show-icon
        :closable="false"
        class="sre-alert-box"
      />

      <!-- Relational ERD Dependency Warnings -->
      <div v-if="dryRunResult.impactedRelations && dryRunResult.impactedRelations.length > 0" class="impact-warnings-container animate-slide-up">
        <div class="impact-warning-card">
          <div class="impact-title-row">
            <el-icon class="impact-title-icon"><WarningFilled /></el-icon>
            <strong>{{ store.t('Relational ERD Dependency Impact Warnings:') }}</strong>
          </div>
          <div class="impact-warnings-list">
            <div v-for="(warn, idx) in dryRunResult.impactedRelations" :key="idx" class="impact-warning-item animate-slide-up">
              <div class="warning-text-container">
                <span class="warning-fields">
                  <code>{{ warn.fromField }}</code> &rarr; <code>{{ warn.toCollection }}.{{ warn.toField }}</code>:
                </span>
                <span class="warning-desc">{{ warn.impactDescription }}</span>
              </div>

              <!-- Side-by-Side Coordinated Sync Preview -->
              <div v-if="warn.sampleOriginal && warn.sampleTransformed" class="coordinated-sync-preview-box">
                <div class="coordinated-sync-header">
                  <el-icon><Cpu /></el-icon>
                  <span>{{ store.t('Coordinated Synchronization Preview for') }} <strong>{{ warn.toCollection }}</strong> {{ store.t('collection') }}:</span>
                </div>
                
                <el-row :gutter="10" class="coordinated-diff-row">
                  <!-- Related Before Document -->
                  <el-col :xs="24" :sm="12" :md="12">
                    <div class="mini-diff-card before-mini">
                      <div class="mini-diff-header">BEFORE ({{ warn.toCollection }})</div>
                      <pre class="json-codeblock mini-codeblock" v-html="renderDiffHtml(warn.sampleOriginal, warn.sampleTransformed, 'before')"></pre>
                    </div>
                  </el-col>

                  <!-- Related After Document -->
                  <el-col :xs="24" :sm="12" :md="12">
                    <div class="mini-diff-card after-mini">
                      <div class="mini-diff-header">AFTER (Coordinated Update)</div>
                      <pre class="json-codeblock mini-codeblock" v-html="renderDiffHtml(warn.sampleOriginal, warn.sampleTransformed, 'after')"></pre>
                    </div>
                  </el-col>
                </el-row>
              </div>
            </div>
          </div>
        </div>
      </div>

      <el-row :gutter="20" class="diff-row">
        <!-- Before Document -->
        <el-col :xs="24" :md="12">
          <el-card class="diff-card before-card">
            <template #header>
              <div class="diff-header-row text-muted-header">
                <span>BEFORE (Original Active Document Sample)</span>
                <el-icon><Document /></el-icon>
              </div>
            </template>
            <pre class="json-codeblock" v-html="formattedOriginalHtml"></pre>
          </el-card>
        </el-col>

        <!-- After Document -->
        <el-col :xs="24" :md="12">
          <el-card class="diff-card after-card">
            <template #header>
              <div class="diff-header-row text-success-header">
                <span>AFTER (Dry-Run Computed Output Preview)</span>
                <el-icon><Tickets /></el-icon>
              </div>
            </template>
            <pre class="json-codeblock" v-html="formattedTransformedHtml"></pre>
          </el-card>
        </el-col>
      </el-row>

      <!-- Raw pipeline visualizer -->
      <el-collapse v-model="activeCollapseNames" class="pipeline-collapse">
        <el-collapse-item name="pipeline" :title="store.t('Compiled Raw MongoDB Update Aggregation Pipeline')">
          <pre class="pipeline-codeblock">{{ formattedPipeline }}</pre>
        </el-collapse-item>
      </el-collapse>

      <div class="bulk-execute-box">
        <el-card class="warning-execution-card">
          <div class="warning-inner">
            <el-icon class="warning-icon"><Warning /></el-icon>
            <div class="warning-text">
              <strong>{{ store.t('Ready for Bulk Execution?') }}</strong>
              <p>Proceeding will perform a native <code>updateMany</code> aggregate operation on all documents in this collection. This action is direct and permanent.</p>
            </div>
            <el-button
              type="danger"
              size="large" round
              :loading="executing"
              @click="confirmBulkExecution"
            >
              {{ store.t('Execute Schema Migration') }}
            </el-button>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { store } from '../../stores';
import { Cpu, Document, Tickets, Warning } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import axios from 'axios';

const route = useRoute();

interface FieldInfo {
  field: string;
  type: string;
  example: any;
}

const fields = ref<FieldInfo[]>([]);
const quickTemplates = ref<string[]>([]);
const loadingSuggestions = ref(false);

const fetchSuggestions = async () => {
  const { conn, db, coll } = route.params;
  if (!conn || !db || !coll) return;
  loadingSuggestions.value = true;
  try {
    const res = await axios.get(`/api/${conn}/${db}/${coll}/migrations/suggestions`, {
      params: { locale: store.activeLocale || 'en' }
    });
    if (res.data?.success && Array.isArray(res.data.suggestions) && res.data.suggestions.length > 0) {
      quickTemplates.value = res.data.suggestions;
    } else {
      quickTemplates.value = [];
    }
  } catch (e) {
    console.error('Error fetching suggestions from Gemini, falling back:', e);
    quickTemplates.value = [];
  } finally {
    loadingSuggestions.value = false;
  }
};

const fetchFields = async () => {
  const { conn, db, coll } = route.params;
  if (!conn || !db || !coll) return;
  try {
    const res = await axios.get(`/api/${conn}/${db}/${coll}/schema`);
    fields.value = res.data.fields || [];
    await fetchSuggestions();
  } catch (e) {
    console.error('Error fetching fields in Migrator:', e);
    quickTemplates.value = [];
  }
};

watch(() => [route.params.conn, route.params.db, route.params.coll, store.activeLocale], () => {
  fetchFields();
}, { immediate: true });

const migrationPrompt = ref('');
const dryRunning = ref(false);
const executing = ref(false);
const dryRunResult = ref<{
  original: any;
  transformed: any;
  pipeline: any[];
  explanation: string;
  impactedRelations?: Array<{
    fromField: string;
    toCollection: string;
    toField: string;
    impactDescription: string;
    coordinatedPipeline?: any[];
    sampleOriginal?: any;
    sampleTransformed?: any;
  }>;
} | null>(null);
const activeCollapseNames = ref([]);

const selectTemplate = (tpl: string) => {
  migrationPrompt.value = tpl;
};


function renderDiffHtml(val1: any, val2: any, mode: 'before' | 'after', indent = 0): string {
  const pad = ' '.repeat(indent);
  
  const escapeHtml = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const normalStringify = (v: any) => {
    const raw = JSON.stringify(v, null, 2);
    return escapeHtml(raw).split('\n').map((l, i) => i === 0 ? l : pad + l).join('\n');
  };

  if (val1 === undefined) {
    if (mode === 'before') return '';
    return `<span class="diff-line-added">${pad}${normalStringify(val2)}</span>`;
  }
  if (val2 === undefined) {
    if (mode === 'after') return '';
    return `<span class="diff-line-removed">${pad}${normalStringify(val1)}</span>`;
  }

  const areEqual = (a: any, b: any): boolean => {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (a && b && typeof a === 'object') {
      if (Array.isArray(a) !== Array.isArray(b)) return false;
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      return keysA.every(k => areEqual(a[k], b[k]));
    }
    return false;
  };

  if (areEqual(val1, val2)) {
    return pad + normalStringify(val1);
  }

  if (val1 && val2 && typeof val1 === 'object' && typeof val2 === 'object' && !Array.isArray(val1) && !Array.isArray(val2)) {
    const keys = Array.from(new Set([...Object.keys(val1), ...Object.keys(val2)]));
    const lines: string[] = [];
    lines.push('{');
    keys.forEach((k, idx) => {
      const v1 = val1[k];
      const v2 = val2[k];
      const comma = idx < keys.length - 1 ? ',' : '';
      const escapedKey = escapeHtml(k);
      
      if (v1 === undefined) {
        if (mode === 'after') {
          lines.push(`<span class="diff-line-added">${pad}  "${escapedKey}": ${escapeHtml(JSON.stringify(v2))}${comma}</span>`);
        } else {
          lines.push(`<span class="diff-line-placeholder">${pad}</span>`);
        }
      } else if (v2 === undefined) {
        if (mode === 'before') {
          lines.push(`<span class="diff-line-removed">${pad}  "${escapedKey}": ${escapeHtml(JSON.stringify(v1))}${comma}</span>`);
        } else {
          lines.push(`<span class="diff-line-placeholder">${pad}</span>`);
        }
      } else if (!areEqual(v1, v2)) {
        if (typeof v1 === 'object' && typeof v2 === 'object' && v1 !== null && v2 !== null) {
          const nested = renderDiffHtml(v1, v2, mode, indent + 2);
          lines.push(`${pad}  "${escapedKey}": ${nested.trimStart()}${comma}`);
        } else {
          if (mode === 'before') {
            lines.push(`${pad}  "${escapedKey}": <span class="diff-value-removed">${escapeHtml(JSON.stringify(v1))}</span>${comma}`);
          } else {
            lines.push(`${pad}  "${escapedKey}": <span class="diff-value-added">${escapeHtml(JSON.stringify(v2))}</span>${comma}`);
          }
        }
      } else {
        lines.push(`${pad}  "${escapedKey}": ${escapeHtml(JSON.stringify(v1))}${comma}`);
      }
    });
    lines.push(pad + '}');
    return lines.filter(line => line !== '').join('\n');
  }

  if (Array.isArray(val1) && Array.isArray(val2)) {
    const maxLen = Math.max(val1.length, val2.length);
    const lines: string[] = [];
    lines.push('[');
    for (let i = 0; i < maxLen; i++) {
      const v1 = val1[i];
      const v2 = val2[i];
      const comma = i < maxLen - 1 ? ',' : '';
      if (v1 === undefined) {
        if (mode === 'after') {
          lines.push(`<span class="diff-line-added">${pad}  ${escapeHtml(JSON.stringify(v2))}${comma}</span>`);
        } else {
          lines.push(`<span class="diff-line-placeholder">${pad}</span>`);
        }
      } else if (v2 === undefined) {
        if (mode === 'before') {
          lines.push(`<span class="diff-line-removed">${pad}  ${escapeHtml(JSON.stringify(v1))}${comma}</span>`);
        } else {
          lines.push(`<span class="diff-line-placeholder">${pad}</span>`);
        }
      } else {
        const nested = renderDiffHtml(v1, v2, mode, indent + 2);
        lines.push(nested + comma);
      }
    }
    lines.push(pad + ']');
    return lines.filter(line => line !== '').join('\n');
  }

  if (mode === 'before') {
    return `<span class="diff-value-removed">${pad}${escapeHtml(JSON.stringify(val1))}</span>`;
  } else {
    return `<span class="diff-value-added">${pad}${escapeHtml(JSON.stringify(val2))}</span>`;
  }
}

const formattedOriginalHtml = computed(() => {
  if (!dryRunResult.value?.original) return '';
  return renderDiffHtml(dryRunResult.value.original, dryRunResult.value.transformed, 'before');
});

const formattedTransformedHtml = computed(() => {
  if (!dryRunResult.value?.transformed) return '';
  return renderDiffHtml(dryRunResult.value.original, dryRunResult.value.transformed, 'after');
});

const formattedPipeline = computed(() => {
  if (!dryRunResult.value?.pipeline) return '[]';
  return JSON.stringify(dryRunResult.value.pipeline, null, 2);
});

const runDryRun = async () => {
  if (!migrationPrompt.value.trim()) return;

  dryRunning.value = true;
  dryRunResult.value = null;
  try {
    const res = await axios.post(
      `/api/${route.params.conn}/${route.params.db}/${route.params.coll}/migrations/dry-run?locale=${store.activeLocale}`,
      { prompt: migrationPrompt.value }
    );
    if (res.data?.success && res.data.result) {
      dryRunResult.value = res.data.result;
      ElMessage.success(store.t('Safe dry-run preview populated successfully.'));
    }
  } catch (e: any) {
    const errMsg = e.response?.data?.msg || e.message;
    ElMessage.error(store.t('Dry-run failed: ') + errMsg);
  } finally {
    dryRunning.value = false;
  }
};

const confirmBulkExecution = () => {
  if (!dryRunResult.value?.pipeline?.length) return;

  const relations = dryRunResult.value.impactedRelations || [];
  const hasImpacted = relations.some(r => r.coordinatedPipeline && r.coordinatedPipeline.length > 0);

  let confirmMsg = store.t('Are you sure you want to execute this bulk schema update on all documents? This action is permanent.');
  let confirmTitle = store.t('Execute Schema Migration');

  if (hasImpacted) {
    const listColls = relations
      .filter(r => r.coordinatedPipeline && r.coordinatedPipeline.length > 0)
      .map(r => `"${r.toCollection}"`)
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(', ');
    
    confirmMsg = store.t(`Are you sure you want to execute this bulk schema update? To maintain referential integrity, this will ALSO execute the coordinated synchronization pipelines on the related collections: ${listColls}. This action is direct, multi-collection, and permanent.`);
    confirmTitle = store.t('Coordinated Multi-Collection Migration');
  }

  ElMessageBox.confirm(
    confirmMsg,
    confirmTitle,
    {
      confirmButtonText: store.t('Execute Updates'),
      cancelButtonText: store.t('Cancel'),
      confirmButtonClass: 'el-button--danger',
      type: 'warning'
    }
  ).then(async () => {
    executing.value = true;
    try {
      const coordinatedUpdates: Array<{ collectionName: string; pipeline: any[] }> = [];
      if (hasImpacted) {
        for (const rel of relations) {
          if (rel.coordinatedPipeline && rel.coordinatedPipeline.length > 0) {
            coordinatedUpdates.push({
              collectionName: rel.toCollection,
              pipeline: rel.coordinatedPipeline
            });
          }
        }
      }

      const res = await axios.post(
        `/api/${route.params.conn}/${route.params.db}/${route.params.coll}/migrations/execute`,
        {
          pipeline: dryRunResult.value?.pipeline,
          coordinatedUpdates
        }
      );
      if (res.data?.success) {
        ElMessage.success(res.data.msg || store.t('Schema migration completed successfully!'));
        dryRunResult.value = null;
        migrationPrompt.value = '';
        await fetchFields();
        store.triggerSchemaRefresh();
      }
    } catch (e: any) {
      const errMsg = e.response?.data?.msg || e.message;
      ElMessage.error(store.t('Bulk execution failed: ') + errMsg);
    } finally {
      executing.value = false;
    }
  }).catch(() => {});
};
</script>

<style scoped>
.collection-transformer-comp {
  margin-top: 1rem;
}
.transformer-console-card {
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
}
.console-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.console-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-primary);
}
.title-icon {
  color: var(--el-color-danger);
}
.console-intro {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.4;
  margin-bottom: 15px;
}
.quick-prompts-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 18px;
  background-color: var(--el-fill-color-lighter);
  padding: 10px;
  border-radius: 6px;
  border: 1px dashed var(--el-border-color-light);
}
.quick-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
}
.quick-tag {
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: normal !important;
  height: auto !important;
}
.quick-tag:hover {
  transform: translateY(-1px);
  background-color: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-7);
}
.prompt-textarea {
  font-family: inherit;
}
.input-actions-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

/* Dry-run results styling */
.dry-run-results-wrapper {
  margin-top: 20px;
}
.animate-slide-up {
  animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.sre-alert-box {
  border-radius: 8px;
  border: 1px solid var(--el-color-success-light-5);
  margin-bottom: 20px;
}
.diff-row {
  margin-bottom: 20px;
}
.diff-card {
  border-radius: 8px;
  background-color: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
}
.diff-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
}
.text-muted-header {
  color: var(--text-muted);
}
.text-success-header {
  color: var(--el-color-success);
}
.json-codeblock {
  height: 280px;
  overflow-y: auto;
  margin: 0;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--text-primary);
  background-color: var(--el-fill-color-blank);
  padding: 5px;
}
.pipeline-collapse {
  margin-bottom: 20px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
  overflow: hidden;
}
.pipeline-collapse :deep(.el-collapse-item__header) {
  padding-left: 20px;
}
.pipeline-codeblock {
  margin: 0;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--el-color-primary);
  background-color: var(--el-fill-color-lighter);
  padding: 10px;
  border-radius: 4px;
}

/* Bulk Execute warning panel */
.warning-execution-card {
  border-radius: 8px;
  border: 1px solid var(--el-color-danger-light-5) !important;
  background-color: var(--el-color-danger-light-9) !important;
}
.warning-inner {
  display: flex;
  align-items: center;
  gap: 20px;
}
.warning-icon {
  font-size: 2.2rem;
  color: var(--el-color-danger);
}
.warning-text {
  flex: 1;
}
.warning-text strong {
  font-size: 0.95rem;
  color: var(--el-color-danger-dark-2);
}
.warning-text p {
  margin: 4px 0 0 0;
  font-size: 0.78rem;
  color: var(--text-secondary);
  line-height: 1.3;
}

:deep(.diff-line-added) {
  background-color: rgba(46, 160, 67, 0.15) !important;
  display: block;
  width: 100%;
  border-left: 3px solid #2ea043;
  padding-left: 4px;
}
:deep(.diff-line-removed) {
  background-color: rgba(248, 81, 73, 0.15) !important;
  display: block;
  width: 100%;
  border-left: 3px solid #f85149;
  padding-left: 4px;
}
:deep(.diff-value-added) {
  background-color: rgba(46, 160, 67, 0.3) !important;
  color: #56d364 !important;
  padding: 0 4px;
  border-radius: 2px;
  font-weight: bold;
}
:deep(.diff-value-removed) {
  background-color: rgba(248, 81, 73, 0.3) !important;
  color: #ff7b72 !important;
  padding: 0 4px;
  border-radius: 2px;
  font-weight: bold;
  text-decoration: line-through;
}
:deep(.diff-line-placeholder) {
  display: block;
  width: 100%;
  height: 1.4em;
  background-color: rgba(255, 255, 255, 0.02);
}

.impact-warnings-container {
  margin-bottom: 20px;
}
.impact-warning-card {
  border-radius: 8px;
  border: 1px solid var(--el-color-warning-light-5);
  background-color: var(--el-color-warning-light-9) !important;
  padding: 16px;
}
.impact-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-color-warning-dark-2);
  font-size: 0.9rem;
}
.impact-title-icon {
  font-size: 1.1rem;
}
.impact-warnings-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}
.impact-warning-item {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  padding: 12px 16px;
  background-color: var(--el-bg-color);
  border-radius: 6px;
  border-left: 4px solid var(--el-color-warning);
  box-shadow: var(--el-box-shadow-light);
}
.warning-text-container {
  font-size: 0.8rem;
  line-height: 1.4;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.warning-fields {
  font-weight: 600;
}
.warning-fields code {
  background-color: var(--el-fill-color-light);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  color: var(--el-color-primary);
}
.warning-desc {
  color: var(--text-secondary);
}

/* Coordinated sync preview styles */
.coordinated-sync-preview-box {
  margin-top: 10px;
  padding: 10px;
  background-color: rgba(0, 0, 0, 0.15);
  border-radius: 6px;
  border: 1px dashed var(--el-border-color-lighter);
}
.coordinated-sync-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  color: var(--el-color-info);
  margin-bottom: 8px;
}
.coordinated-sync-header strong {
  color: var(--el-color-primary);
  font-family: monospace;
  font-size: 0.82rem;
}
.coordinated-diff-row {
  margin: 0 !important;
}
.mini-diff-card {
  border-radius: 4px;
  border: 1px solid var(--el-border-color-light);
  overflow: hidden;
  margin-bottom: 8px;
}
.mini-diff-header {
  font-size: 0.7rem;
  font-weight: bold;
  padding: 4px 8px;
  text-transform: uppercase;
  background-color: var(--el-fill-color-light);
  color: var(--text-secondary);
  border-bottom: 1px solid var(--el-border-color-light);
}
.before-mini .mini-diff-header {
  color: var(--el-color-danger-dark-2);
  border-bottom-color: rgba(248, 81, 73, 0.2);
}
.after-mini .mini-diff-header {
  color: var(--el-color-success-dark-2);
  border-bottom-color: rgba(46, 160, 67, 0.2);
}
.mini-codeblock {
  max-height: 150px;
  margin: 0 !important;
  font-size: 0.72rem !important;
  padding: 6px !important;
  background-color: rgba(0, 0, 0, 0.2) !important;
}
</style>
