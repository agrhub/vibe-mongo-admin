<template>
  <div class="collection-erd-comp" v-loading="loading">
    <div class="erd-wrapper">
      <!-- AI Overview Header -->
      <div v-if="erdData" class="erd-banner">
        <div class="erd-banner-left">
          <div class="ai-badge-row">
            <el-tag type="success" effect="dark" size="small">
              <el-icon style="vertical-align: middle; margin-right: 4px;"><Cpu /></el-icon>
              AI RELATION MAPPER
            </el-tag>
            <span class="ai-badge-text">Powered by Google Gemini</span>
          </div>
          <p class="erd-banner-desc">
            AI evaluated **{{ erdData.siblingCollections.length }} sibling collections** in database **"{{ route.params.db }}"** and inferred **{{ erdData.relations.length }} logical references**.
          </p>
        </div>
        <el-button type="success" plain round :icon="Refresh" size="small" @click="loadErdData">
          {{ store.t('Refresh ERD') }}
        </el-button>
      </div>

      <!-- No Relations Fallback Alert -->
      <el-alert
        v-if="erdData && erdData.relations.length === 0"
        type="info"
        show-icon
        :closable="false"
        title="No Logical Relations Detected"
        description="AI analyzed key names and sibling collections, but found no obvious foreign key reference paths (e.g. userId, productId) in this collection."
        class="erd-alert"
      />

      <!-- ERD Interactive Visual Flow Grid -->
      <div v-if="erdData" class="erd-flow-grid">
        <el-row :gutter="30">
          <!-- Left: Current Collection Entity -->
          <el-col :xs="24" :md="10">
            <el-card class="erd-node-card active-node">
              <template #header>
                <div class="erd-node-header">
                  <span class="node-title">
                    <el-icon class="node-icon"><Tickets /></el-icon>
                    {{ route.params.coll }}
                  </span>
                  <el-tag type="success" size="small">Active Collection</el-tag>
                </div>
              </template>

              <div class="node-fields-list">
                <div
                  v-for="field in erdData.fields"
                  :key="typeof field === 'object' && field ? field.field : field"
                  class="node-field-row"
                  :class="{ 'is-referenced-key': isFieldReferenced(typeof field === 'object' && field ? field.field : field) }"
                >
                  <div class="field-info">
                    <el-icon v-if="isFieldReferenced(typeof field === 'object' && field ? field.field : field)" class="ref-plug-icon"><Link /></el-icon>
                    <el-icon v-else class="field-bullet-icon"><Document /></el-icon>
                    <span class="field-name">{{ typeof field === 'object' && field ? field.field : field }}</span>
                  </div>
                  <span class="field-type">{{ typeof field === 'object' && field ? field.type : 'String' }}</span>
                </div>
              </div>
            </el-card>
          </el-col>

          <!-- Right: Inferred Relationships & Target Entities -->
          <el-col :xs="24" :md="14">
            <h4 class="section-title">
              <el-icon><Connection /></el-icon>
              {{ store.t('Inferred Sibling Mappings') }}
            </h4>

            <div v-if="erdData.relations.length > 0" class="relations-stack">
              <el-card
                v-for="(rel, idx) in erdData.relations"
                :key="idx"
                class="rel-connector-card"
              >
                <div class="rel-connector-header">
                  <div class="rel-path-flow">
                    <el-tag size="small" effect="dark" type="success">{{ rel.fromField }}</el-tag>
                    <span class="rel-arrow">
                      ─── <el-tag size="small" type="warning" effect="plain">{{ rel.type }}</el-tag> ───>
                    </span>
                    <el-tag size="small" effect="dark" type="primary">{{ rel.toCollection }}.{{ rel.toField }}</el-tag>
                  </div>
                </div>
                <div class="rel-reason">
                  <strong>AI Logic:</strong> {{ rel.reason }}
                </div>
              </el-card>
            </div>
            <div v-else class="no-relations-placeholder">
              <p>No foreign key targets mapped for this collection.</p>
            </div>
          </el-col>
        </el-row>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { store } from '../../stores';
import { Cpu, Refresh, Tickets, Document, Connection, Link } from '@element-plus/icons-vue';
import axios from 'axios';

const route = useRoute();
const loading = ref(false);
const erdData = ref<any>(null);

const loadErdData = async () => {
  const { conn, db, coll } = route.params;
  if (!conn || !db || !coll) return;

  loading.value = true;
  try {
    const res = await axios.get(`/api/${conn}/${db}/${coll}/erd`);
    erdData.value = res.data;
  } catch (e) {
    console.error('Error mapping ERD:', e);
  } finally {
    loading.value = false;
  }
};

const isFieldReferenced = (fieldName: string) => {
  if (!erdData.value || !erdData.value.relations) return false;
  return erdData.value.relations.some((r: any) => r.fromField === fieldName);
};

watch(() => [route.params.conn, route.params.db, route.params.coll], () => {
  loadErdData();
}, { immediate: true });
</script>

<style scoped>
.collection-erd-comp {
  padding: 8px 4px;
}
.erd-wrapper {
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.erd-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 12px 18px;
}
.ai-badge-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.ai-badge-text {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 500;
}
.erd-banner-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin: 0;
}
.erd-alert {
  margin-bottom: 5px;
}
.erd-flow-grid {
  margin-top: 10px;
}
.erd-node-card {
  border-radius: 8px;
  border: 1px solid var(--el-border-color);
}
.active-node {
  border-top: 4px solid var(--el-color-success);
}
.erd-node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.node-title {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.95rem;
}
.node-icon {
  color: var(--el-color-success);
}
.node-fields-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.node-field-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  border-radius: 4px;
  background-color: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color-lighter);
}
.is-referenced-key {
  border: 1px solid rgba(103, 194, 58, 0.3);
  background-color: rgba(103, 194, 58, 0.04);
}
.field-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
}
.ref-plug-icon {
  color: var(--el-color-success);
}
.field-bullet-icon {
  color: var(--text-muted);
  font-size: 0.8rem;
}
.field-name {
  font-weight: 500;
}
.field-type {
  font-size: 0.75rem;
  color: var(--text-muted);
}
.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 15px 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
}
.relations-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.rel-connector-card {
  border-radius: 6px;
  border: 1px solid var(--el-border-color-light);
  border-left: 4px solid var(--el-color-warning);
}
.rel-connector-header {
  margin-bottom: 6px;
}
.rel-path-flow {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.rel-arrow {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: bold;
}
.rel-reason {
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.3;
}
.no-relations-placeholder {
  padding: 30px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.85rem;
  background-color: var(--el-fill-color-light);
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
}
</style>
