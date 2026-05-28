<template>
  <div class="database-erd" v-loading="loading">
    <!-- Header Toolbar -->
    <div class="erd-toolbar">
      <div class="toolbar-left">
        <h3 class="erd-title">
          <el-icon class="erd-icon"><Connection /></el-icon>
          <span>{{ store.t('Database Entity Relationships') }}</span>
        </h3>
        <el-tag plain round type="success">
          <el-icon class="badge-icon"><Cpu /></el-icon>
          {{ store.t('AI Logical Reference Map') }}
        </el-tag>
      </div>

      <div class="toolbar-actions">
        <el-switch
          v-model="showLines"
          :active-text="store.t('Show Connectors')"
          class="switch-control"
        />
        <el-button
          type="primary"
          text round bg
          :loading="loading"
          @click="fetchDatabaseErd"
          class="map-btn"
        >
          <template #icon>
            <el-icon v-if="!loading"><Refresh /></el-icon>
          </template>
          {{ erdData ? store.t('Remap Database') : store.t('Generate DB Schema Map') }}
        </el-button>
      </div>
    </div>

    <!-- Filter and Zoom Controls -->
    <div v-if="erdData" class="erd-filters-panel">
      <div class="filter-item">
        <span class="filter-label">{{ store.t('Filter Sibling Collections') }}:</span>
        <el-select
          v-model="selectedFilterColls"
          multiple
          collapse-tags
          collapse-tags-tooltip
          placeholder="All Collections"
          style="width: 260px;"
          size="small"
        >
          <el-option
            v-for="coll in Object.keys(erdData.collections)"
            :key="coll"
            :label="coll"
            :value="coll"
          />
        </el-select>
      </div>
      <div class="zoom-controls">
        <el-button size="small" circle :icon="Minus" @click="changeScale(-0.1)" />
        <span class="scale-label">{{ Math.round(scale * 100) }}%</span>
        <el-button size="small" circle :icon="Plus" @click="changeScale(0.1)" />
        <el-button size="small" round @click="resetScale">{{ store.t('Reset') }}</el-button>
      </div>
    </div>

    <!-- Empty/No Data State -->
    <div v-if="!erdData && !loading" class="erd-placeholder">
      <el-empty :description="store.t('No schema ERD mapped yet. Click button above to discover database-wide reference paths.')">
        <el-button type="primary" round text bg @click="fetchDatabaseErd">{{ store.t('Generate ERD') }}</el-button>
      </el-empty>
    </div>

    <!-- Visual ERD Workspace -->
    <div v-else-if="erdData" class="erd-workspace">
      <div class="erd-layout-container">
        <!-- ERD Scroll Canvas -->
        <div class="erd-canvas" :style="{ transform: `scale(${scale})`, transformOrigin: 'top left' }">
          <div class="erd-flow-container" ref="flowContainerRef">
            
            <!-- SVG Connector Lines Overlay -->
            <svg
              v-if="showLines && connectionPaths.length > 0"
              class="connections-svg"
            >
              <defs>
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--svg-arrow-color)" />
                </marker>
                
                <!-- Glowing linear gradients for active hover connector links -->
                <linearGradient id="glow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#409eff" />
                  <stop offset="100%" stop-color="#67c23a" />
                </linearGradient>
              </defs>

              <g>
                <path
                  v-for="path in connectionPaths"
                  :key="path.id"
                  :d="path.d"
                  class="connector-line"
                  :class="{
                    'is-dimmed': activeFocusedNode && !isPathRelated(path),
                    'is-highlighted': isPathHighlighted(path)
                  }"
                  fill="none"
                  marker-end="url(#arrow)"
                  @mouseenter="hoveredRelation = path.relation"
                  @mouseleave="hoveredRelation = null"
                />
              </g>
            </svg>

            <!-- Collections Grid Cards -->
            <div class="collections-erd-grid">
              <div
                v-for="(fields, collName) in filteredCollections"
                :key="collName"
                :id="`card-${String(collName)}`"
                class="collection-node-card"
                :class="{
                  'is-focused': activeFocusedNode === String(collName),
                  'is-linked': activeFocusedNode && isCollectionLinked(String(collName)),
                  'is-dimmed': activeFocusedNode && activeFocusedNode !== String(collName) && !isCollectionLinked(String(collName))
                }"
                @click="focusCollection(String(collName))"
              >
                <!-- Card Header -->
                <div class="card-node-header">
                  <div class="card-node-title">
                    <el-icon class="node-icon"><Tickets /></el-icon>
                    <span>{{ collName }}</span>
                  </div>
                  <el-tag size="small" round type="info" class="fields-count-badge">
                    {{ fields.length }} fields
                  </el-tag>
                </div>

                <!-- Fields List -->
                <div class="card-node-body">
                  <div
                    v-for="f in fields"
                    :key="f.field"
                    class="node-field-row"
                    :class="{
                      'is-ref-source': isFieldSource(String(collName), f.field),
                      'is-ref-target': isFieldTarget(String(collName), f.field)
                    }"
                  >
                    <div class="field-info">
                      <el-icon v-if="isFieldSource(String(collName), f.field)" class="ref-plug-icon source-plug"><Link /></el-icon>
                      <el-icon v-else-if="isFieldTarget(String(collName), f.field)" class="ref-plug-icon target-plug"><Key /></el-icon>
                      <el-icon v-else class="field-bullet"><Document /></el-icon>
                      <span class="field-name">{{ f.field }}</span>
                    </div>
                    <span class="field-type">{{ f.type }}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- Right Side Panel: Relations & Details Explorer -->
        <div class="erd-explorer-sidebar">
          <div class="sidebar-header">
            <h4>{{ store.t('Relationship Explorer') }}</h4>
            <p v-if="activeFocusedNode" class="focused-node-hint">
              Selected: <strong class="focused-name">{{ activeFocusedNode }}</strong>
              <el-button link size="small" type="primary" style="margin-left: 8px;" @click="activeFocusedNode = null">Clear</el-button>
            </p>
          </div>

          <!-- Relations Stack -->
          <div v-if="filteredRelations.length > 0" class="sidebar-relations-list">
            <el-card
              v-for="(rel, idx) in filteredRelations"
              :key="idx"
              class="sidebar-rel-card"
              :class="{ 'is-hovered-rel': hoveredRelation && hoveredRelation.fromCollection === rel.fromCollection && hoveredRelation.fromField === rel.fromField }"
              shadow="hover"
              @mouseenter="hoveredRelation = rel"
              @mouseleave="hoveredRelation = null"
            >
              <div class="sidebar-rel-flow">
                <span class="rel-tag source-tag">{{ rel.fromCollection }}.{{ rel.fromField }}</span>
                <div class="rel-link-arrow">
                  <span class="rel-type-label">{{ rel.type }}</span>
                  <el-icon><Right /></el-icon>
                </div>
                <span class="rel-tag target-tag">{{ rel.toCollection }}.{{ rel.toField }}</span>
              </div>
              <div class="sidebar-rel-reason">
                <strong>AI Link Logic:</strong> {{ rel.reason }}
              </div>
            </el-card>
          </div>
          <div v-else class="sidebar-empty-state">
            <el-icon class="empty-icon"><Compass /></el-icon>
            <p>{{ store.t('No reference connections found.') }}</p>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { store } from '../../stores';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { Connection, Cpu, Refresh, Tickets, Document, Link, Key, Minus, Plus, Compass, Right } from '@element-plus/icons-vue';

const loading = ref(false);
const erdData = ref<any>(null);
const showLines = ref(true);
const selectedFilterColls = ref<string[]>([]);
const scale = ref(1.0);
const flowContainerRef = ref<HTMLElement | null>(null);
const connectionPaths = ref<any[]>([]);

const activeFocusedNode = ref<string | null>(null);
const hoveredRelation = ref<any>(null);

const filteredCollections = computed(() => {
  if (!erdData.value) return {};
  if (selectedFilterColls.value.length === 0) return erdData.value.collections;
  
  const filtered: Record<string, any[]> = {};
  selectedFilterColls.value.forEach(coll => {
    if (erdData.value.collections[coll]) {
      filtered[coll] = erdData.value.collections[coll];
    }
  });
  return filtered;
});

const filteredRelations = computed(() => {
  if (!erdData.value || !erdData.value.relations) return [];
  const allRels = erdData.value.relations;
  
  // Filter by collections
  let rels = allRels;
  if (selectedFilterColls.value.length > 0) {
    rels = allRels.filter((r: any) =>
      selectedFilterColls.value.includes(r.fromCollection) ||
      selectedFilterColls.value.includes(r.toCollection)
    );
  }
  
  // Filter by focused collection card
  if (activeFocusedNode.value) {
    rels = rels.filter((r: any) =>
      r.fromCollection === activeFocusedNode.value ||
      r.toCollection === activeFocusedNode.value
    );
  }
  
  return rels;
});

function isFieldSource(coll: string, field: string) {
  if (!erdData.value || !erdData.value.relations) return false;
  return erdData.value.relations.some((r: any) => r.fromCollection === coll && r.fromField === field);
}

function isFieldTarget(coll: string, field: string) {
  if (!erdData.value || !erdData.value.relations) return false;
  return erdData.value.relations.some((r: any) => r.toCollection === coll && r.toField === field);
}

function isCollectionLinked(coll: string) {
  if (!activeFocusedNode.value || !erdData.value || !erdData.value.relations) return false;
  return erdData.value.relations.some((r: any) =>
    (r.fromCollection === activeFocusedNode.value && r.toCollection === coll) ||
    (r.toCollection === activeFocusedNode.value && r.fromCollection === coll)
  );
}

function focusCollection(coll: string) {
  if (activeFocusedNode.value === coll) {
    activeFocusedNode.value = null;
  } else {
    activeFocusedNode.value = coll;
  }
}

function isPathRelated(path: any) {
  if (!activeFocusedNode.value) return true;
  return path.fromCollection === activeFocusedNode.value || path.toCollection === activeFocusedNode.value;
}

function isPathHighlighted(path: any) {
  if (hoveredRelation.value) {
    return hoveredRelation.value.fromCollection === path.relation.fromCollection &&
           hoveredRelation.value.fromField === path.relation.fromField &&
           hoveredRelation.value.toCollection === path.relation.toCollection;
  }
  if (activeFocusedNode.value) {
    return path.fromCollection === activeFocusedNode.value || path.toCollection === activeFocusedNode.value;
  }
  return false;
}

function changeScale(delta: number) {
  scale.value = Math.max(0.4, Math.min(2.0, scale.value + delta));
  nextTick(() => drawLines());
}

function resetScale() {
  scale.value = 1.0;
  nextTick(() => drawLines());
}

const drawLines = () => {
  if (!erdData.value || !erdData.value.relations || !flowContainerRef.value) return;
  const container = flowContainerRef.value;
  const containerRect = container.getBoundingClientRect();
  const pathsList: any[] = [];

  // Filter relationship edges that connect active visible cards
  const activeColls = Object.keys(filteredCollections.value);
  const visibleRels = erdData.value.relations.filter((r: any) =>
    activeColls.includes(r.fromCollection) && activeColls.includes(r.toCollection)
  );

  visibleRels.forEach((rel: any) => {
    const fromCard = document.getElementById(`card-${rel.fromCollection}`);
    const toCard = document.getElementById(`card-${rel.toCollection}`);

    if (fromCard && toCard) {
      const fromRect = fromCard.getBoundingClientRect();
      const toRect = toCard.getBoundingClientRect();

      // Compute coordinates relative to canvas scaled view
      const x1 = (fromRect.left + fromRect.width / 2 - containerRect.left) / scale.value;
      const y1 = (fromRect.top + fromRect.height / 2 - containerRect.top) / scale.value;
      const x2 = (toRect.left + toRect.width / 2 - containerRect.left) / scale.value;
      const y2 = (toRect.top + toRect.height / 2 - containerRect.top) / scale.value;

      // Draw smooth curving Bezier edge
      const dx = Math.abs(x2 - x1);
      const dy = Math.abs(y2 - y1);
      const controlDist = Math.max(80, Math.min(250, dx * 0.5));
      
      let d = '';
      if (dx > dy) {
        // Curve horizontally
        const controlX1 = x1 + (x2 > x1 ? controlDist : -controlDist);
        const controlX2 = x2 + (x2 > x1 ? -controlDist : controlDist);
        d = `M ${x1} ${y1} C ${controlX1} ${y1}, ${controlX2} ${y2}, ${x2} ${y2}`;
      } else {
        // Curve vertically
        const controlY1 = y1 + (y2 > y1 ? controlDist : -controlDist);
        const controlY2 = y2 + (y2 > y1 ? -controlDist : controlDist);
        d = `M ${x1} ${y1} C ${x1} ${controlY1}, ${x2} ${controlY2}, ${x2} ${y2}`;
      }

      pathsList.push({
        id: `${rel.fromCollection}-${rel.fromField}-${rel.toCollection}`,
        fromCollection: rel.fromCollection,
        toCollection: rel.toCollection,
        d,
        relation: rel
      });
    }
  });

  connectionPaths.value = pathsList;
};

async function fetchDatabaseErd() {
  loading.value = true;
  activeFocusedNode.value = null;
  hoveredRelation.value = null;
  try {
    const res = await axios.get(`/api/${store.activeConnection}/${store.activeDb}/erd`);
    erdData.value = res.data;
    selectedFilterColls.value = [];
    nextTick(() => {
      setTimeout(() => drawLines(), 150);
    });
  } catch (e: any) {
    console.error(e);
    ElMessage.error(store.t('Error generating database ERD: ') + (e.response?.data?.msg || e.message));
  } finally {
    loading.value = false;
  }
}

// Redraw connections on resize/tab updates
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  window.addEventListener('resize', drawLines);
  if (flowContainerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      drawLines();
    });
    resizeObserver.observe(flowContainerRef.value);
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', drawLines);
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});

watch([filteredCollections, showLines, scale], () => {
  nextTick(() => {
    setTimeout(() => drawLines(), 100);
  });
});
</script>

<style scoped>
.database-erd {
  min-height: 400px;
  position: relative;
}

.erd-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  background: var(--bg-secondary);
  padding: 12px 20px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.erd-title {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.erd-icon {
  color: var(--color-brand);
  font-size: 1.3rem;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 20px;
}

.switch-control {
  --el-switch-on-color: var(--color-brand);
}

.erd-filters-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 8px 12px;
  background: rgba(120, 120, 120, 0.05);
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.scale-label {
  font-family: monospace;
  font-size: 0.85rem;
  width: 48px;
  text-align: center;
  color: var(--text-muted);
}

.erd-placeholder {
  padding: 80px 0;
}

.erd-workspace {
  margin-top: 10px;
}

.erd-layout-container {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 24px;
  align-items: start;
}

.erd-canvas {
  background: var(--bg-primary);
  border: 1px dashed var(--border-color);
  border-radius: 8px;
  padding: 24px;
  overflow: auto;
  min-height: 550px;
  max-height: 700px;
  position: relative;
}

.erd-flow-container {
  position: relative;
  min-height: 500px;
  display: flex;
  flex-direction: column;
}

.connections-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.connector-line {
  stroke: rgba(64, 158, 255, 0.25);
  stroke-width: 2px;
  transition: stroke 0.2s, stroke-width 0.2s, opacity 0.2s;
  pointer-events: stroke;
  cursor: pointer;
  --svg-arrow-color: rgba(64, 158, 255, 0.4);
}

.connector-line:hover,
.connector-line.is-highlighted {
  stroke: url(#glow-grad);
  stroke-width: 3.5px;
  opacity: 1 !important;
  --svg-arrow-color: #67c23a;
}

.connector-line.is-dimmed {
  opacity: 0.08;
  stroke: rgba(120, 120, 120, 0.1);
}

.collections-erd-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 32px 24px;
  z-index: 2;
  position: relative;
}

.collection-node-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  overflow: hidden;
  user-select: none;
}

.collection-node-card:hover {
  transform: translateY(-4px);
  border-color: var(--color-brand);
  box-shadow: 0 8px 24px rgba(64, 158, 255, 0.15);
}

.collection-node-card.is-focused {
  border-color: #409eff;
  background: rgba(64, 158, 255, 0.05);
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.2);
}

.collection-node-card.is-linked {
  border-color: #67c23a;
  background: rgba(103, 194, 58, 0.02);
}

.collection-node-card.is-dimmed {
  opacity: 0.45;
  filter: grayscale(30%);
}

.card-node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: rgba(120, 120, 120, 0.06);
  border-bottom: 1px solid var(--border-color);
}

.card-node-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-primary);
  font-family: 'Fira Code', monospace;
}

.node-icon {
  color: var(--color-brand);
}

.fields-count-badge {
  font-size: 0.72rem;
}

.card-node-body {
  padding: 6px 0;
  max-height: 220px;
  overflow-y: auto;
}

.node-field-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 14px;
  font-size: 0.78rem;
  border-bottom: 1px solid rgba(120, 120, 120, 0.03);
}

.node-field-row:last-child {
  border-bottom: none;
}

.field-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.field-bullet {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.ref-plug-icon {
  font-size: 0.75rem;
  font-weight: bold;
}

.source-plug {
  color: #67c23a;
}

.target-plug {
  color: #e6a23c;
}

.field-name {
  font-family: 'Fira Code', monospace;
  color: var(--text-primary);
}

.field-type {
  font-size: 0.72rem;
  color: var(--text-muted);
  font-style: italic;
}

.is-ref-source {
  background: rgba(103, 194, 58, 0.07);
}

.is-ref-target {
  background: rgba(230, 162, 60, 0.07);
}

/* Sidebar Details Styles */
.erd-explorer-sidebar {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  min-height: 550px;
  max-height: 700px;
  overflow-y: auto;
}

.sidebar-header h4 {
  margin: 0 0 6px 0;
  font-weight: 600;
  font-size: 1rem;
  color: var(--text-primary);
}

.focused-node-hint {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: 0;
}

.focused-name {
  color: #409eff;
}

.sidebar-relations-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.sidebar-rel-card {
  border: 1px solid var(--border-color) !important;
  background: var(--bg-primary) !important;
  transition: all 0.2s ease;
}

.sidebar-rel-card.is-hovered-rel,
.sidebar-rel-card:hover {
  border-color: #67c23a !important;
  box-shadow: 0 2px 10px rgba(103, 194, 58, 0.1) !important;
}

.sidebar-rel-flow {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.rel-tag {
  font-size: 0.7rem;
  font-family: monospace;
  padding: 2px 6px;
  border-radius: 4px;
}

.source-tag {
  background: rgba(103, 194, 58, 0.15);
  color: #67c23a;
  border: 1px solid rgba(103, 194, 58, 0.3);
}

.target-tag {
  background: rgba(64, 158, 255, 0.15);
  color: #409eff;
  border: 1px solid rgba(64, 158, 255, 0.3);
}

.rel-link-arrow {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  color: var(--text-muted);
  font-size: 0.7rem;
  line-height: 1;
}

.rel-type-label {
  font-size: 0.6rem;
  font-weight: 700;
}

.sidebar-rel-reason {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 10px;
  line-height: 1.4;
  border-top: 1px dashed var(--border-color);
  padding-top: 8px;
}

.sidebar-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 12px;
}
</style>
