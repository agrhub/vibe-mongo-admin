<template>
  <div class="database-analysis">
    <!-- Header Controls -->
    <div class="analysis-header-toolbar">
      <div class="header-left">
        <h3 class="analysis-title">
          <el-icon class="ai-icon"><Cpu /></el-icon>
          <span>{{ store.t('AI Analysis') }}</span>
        </h3>
        <el-tag plain round type="primary">
          <el-icon class="badge-icon"><Connection /></el-icon>
          {{ store.t('Cross-Collection Insights') }}
        </el-tag>
      </div>
      
      <div class="header-actions">
        <el-button 
          type="primary" 
          text round bg
          :loading="loading" 
          @click="fetchAIAnalysis"
          class="analyze-btn"
        >
          <template #icon>
            <el-icon v-if="!loading"><Refresh /></el-icon>
          </template>
          {{ analysisData.length > 0 ? store.t('Regenerate') : store.t('Run DB Analysis') }}
        </el-button>
      </div>
    </div>

    <!-- Optional Custom Prompt Box -->
    <div class="custom-prompt-container">
      <el-input
        size="large"
        v-model="customPrompt"
        :placeholder="store.t('Ask a database-wide question (e.g. \'Find users who haven\'t made any purchases\' or \'Compare growth across collections\')')"
        class="custom-prompt-input"
        clearable
        @keyup.enter="fetchAIAnalysis"
      >
        <template #append>
          <el-button @click="fetchAIAnalysis" :loading="loading">
            <el-icon><Position /></el-icon>
          </el-button>
        </template>
      </el-input>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="ai-avatar">🧠</div>
      <div class="pulse-circles">
        <div class="circle"></div>
        <div class="circle"></div>
        <div class="circle"></div>
      </div>
      <h4 class="loading-title">{{ store.t('Gemini is synthesizing cross-collection data...') }}</h4>
      <p class="loading-subtitle">{{ store.t('Sampling metadata from all collections to find correlations and trends.') }}</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="analysisData.length === 0" class="analysis-placeholder">
      <el-empty :description="store.t('No database analysis available. Click Run DB Analysis to start discovery.')">
        <el-button type="primary" round text bg @click="fetchAIAnalysis">{{ store.t('Run AI Analysis') }}</el-button>
      </el-empty>
    </div>

    <!-- AI Results Content -->
    <div v-else class="analysis-results">
      <!-- Executive Summary / Insights Card -->
      <el-card class="insights-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <el-icon class="insight-icon"><Opportunity /></el-icon>
            <span class="card-title">{{ store.t('Database Overview & Associations') }}</span>
          </div>
        </template>
        <div class="insights-content markdown-body" v-html="renderedInsights"></div>
      </el-card>

      <!-- Charts Grid -->
      <div class="charts-grid">
        <div 
          v-for="(chart, idx) in analysisData" 
          :key="idx" 
          class="analysis-chart-card-wrapper"
        >
          <el-card class="chart-card" shadow="hover">
            <template #header>
              <div class="chart-header">
                <div class="chart-title-box">
                  <h4 class="chart-title">{{ chart.title }}</h4>
                  <p class="chart-desc">{{ chart.description }}</p>
                </div>
                <div class="coll-tags">
                  <!-- Cross-collection join indicator -->
                  <!-- <el-tooltip v-if="chart.collections && chart.collections.length > 1" content="Cross-collection join ($lookup)" placement="top">
                    <el-tag size="small" round type="primary">
                      <el-icon><Connection /></el-icon>
                      {{ store.t('Join') }}
                    </el-tag>
                  </el-tooltip> -->
                  <el-tag
                    v-for="cname in (chart.collections || [chart.collection])"
                    :key="cname"
                    size="small" round
                    :type="cname === chart.collection ? 'primary' : 'success'"
                    effect="dark"
                    class="coll-tag"
                  >
                    {{ cname }}
                  </el-tag>
                </div>
              </div>
            </template>
            
            <!-- EChart Box -->
            <div class="chart-container">
              <v-chart :option="chart.option" :theme="chartTheme" autoresize style="height: 320px;" />
            </div>

            <!-- View Pipeline Collapse -->
            <div class="pipeline-section">
              <el-collapse>
                <el-collapse-item name="1">
                  <template #title>
                    <div class="pipeline-title">
                      <el-icon><Operation /></el-icon>
                      <span>{{ store.t('View Query') }}</span>
                      <span v-if="chart.collections && chart.collections.length > 1" class="pipeline-join-hint">
                        (joins {{ chart.collections.length }} collections)
                      </span>
                      
                      <div class="pipeline-header-actions" @click.stop>
                        <el-button 
                          size="small" 
                          :icon="DocumentCopy" 
                          text circle
                          @click="copyToClipboard(formatPipeline(chart.pipeline))" 
                          :title="store.t('Copy pipeline')"
                        />
                        <el-button 
                          type="primary" 
                          size="small" 
                          :icon="CaretRight" 
                          round text bg
                          @click="runQueryInChat(chart)"
                        >
                          {{ store.t('Run') }}
                        </el-button>
                      </div>
                    </div>
                  </template>
                  <div class="pipeline-code-container">
                    <pre class="pipeline-code"><code>db.{{ chart.collection }}.aggregate({{ formatPipeline(chart.pipeline) }})</code></pre>
                  </div>
                </el-collapse-item>
              </el-collapse>
            </div>
          </el-card>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { store } from '../../stores';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { Cpu, Connection, Refresh, Position, Opportunity, Operation, DocumentCopy, CaretRight } from '@element-plus/icons-vue';
import { marked } from 'marked';

// ECharts tree-shakeable imports
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart, PieChart, LineChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent
} from 'echarts/components';
import VChart from 'vue-echarts';

use([CanvasRenderer, BarChart, PieChart, LineChart, TitleComponent, TooltipComponent, GridComponent, LegendComponent]);

const loading = ref(false);
const customPrompt = ref('');
const insightsText = ref('');
const analysisData = ref<any[]>([]);

const renderedInsights = computed(() => {
  try {
    return marked(insightsText.value || '');
  } catch (e) {
    return insightsText.value || '';
  }
});

const chartTheme = computed(() => {
  const resolved = store.theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : store.theme;
  return resolved;
});

function formatPipeline(pipeline: any[]) {
  if (!pipeline) return '[]';
  return JSON.stringify(pipeline, null, 2);
}

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success(store.t('Copied to clipboard'));
  } catch (err) {
    ElMessage.error(store.t('Failed to copy'));
  }
};

function runQueryInChat(chart: any) {
  const query = `db.${chart.collection}.aggregate(${formatPipeline(chart.pipeline)})`;
  store.openChatWithCommand(`Execute command: ${query}`, chart.chartType || 'bar');
}

async function fetchAIAnalysis() {
  loading.value = true;
  try {
    const res = await axios.post(
      `/api/${store.activeConnection}/${store.activeDb}/ai-analysis`,
      { customPrompt: customPrompt.value }
    );
    analysisData.value = res.data.charts || [];
    insightsText.value = res.data.insights || '';
  } catch (e: any) {
    console.error(e);
    ElMessage.error(store.t('Error running database analysis: ') + (e.response?.data?.msg || e.message));
  } finally {
    loading.value = false;
  }
}

// Don't auto-load for DB analysis as it might be expensive/slow
</script>

<style scoped>
.database-analysis {
  min-height: 300px;
}

.analysis-header-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  background: var(--bg-secondary);
  padding: 12px 20px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.analysis-title {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.ai-icon {
  color: #409eff;
  font-size: 1.3rem;
}

.cross-coll-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(64, 158, 255, 0.1);
  color: #409eff;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.8rem;
  border: 1px solid rgba(64, 158, 255, 0.2);
}

.custom-prompt-container {
  margin-bottom: 24px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.ai-avatar {
  font-size: 3rem;
  margin-bottom: 16px;
}

.pulse-circles {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.circle {
  width: 10px;
  height: 10px;
  background: #409eff;
  border-radius: 50%;
  animation: pulse-dot 1.2s infinite ease-in-out;
}

.circle:nth-child(2) { animation-delay: 0.2s; }
.circle:nth-child(3) { animation-delay: 0.4s; }

@keyframes pulse-dot {
  0%, 100% { transform: scale(0.6); opacity: 0.4; }
  50% { transform: scale(1.2); opacity: 1; }
}

.loading-title {
  font-size: 1.1rem;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.loading-subtitle {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.analysis-placeholder {
  padding: 60px 0;
}

.analysis-results {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.insights-card {
  /* background: var(--bg-secondary) !important; */
  border: 1px solid var(--border-color) !important;
}

.card-header {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
}

.card-title {
  font-weight: 600;
}

.insight-icon {
  color: #e6a23c;
}

.insights-content {
  line-height: 1.6;
  color: var(--text-secondary);
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
  gap: 20px;
}

.chart-card {
  /* background: var(--bg-secondary) !important; */
  border: 1px solid var(--border-color) !important;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.chart-title {
  margin: 0;
  font-size: 1rem;
  color: var(--text-primary);
}

.chart-desc {
  margin: 4px 0 0 0;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.coll-tag {
  font-family: monospace;
}

.coll-tags {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.join-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: rgba(103, 194, 58, 0.15);
  color: #67c23a;
  border: 1px solid rgba(103, 194, 58, 0.3);
  border-radius: 4px;
  padding: 2px 7px;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: default;
}

.pipeline-title {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.pipeline-header-actions {
  margin-left: auto;
  margin-right: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.pipeline-header-actions :deep(.el-button.is-circle) {
  width: 20px;
  height: 20px;
  min-height: 20px;
  padding: 0;
}

.pipeline-join-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-left: 0;
}


.chart-container {
  padding: 10px 0;
}

.pipeline-section {
  border-top: 1px solid var(--border-color);
  margin-top: 10px;
}

.pipeline-section :deep(.el-collapse) { border: none; }
.pipeline-section :deep(.el-collapse-item__header) {
  background: transparent;
  border: none;
  height: 32px;
  color: var(--text-muted);
}
.pipeline-section :deep(.el-collapse-item__wrap) {
  background: var(--bg-primary);
  border: none;
}

.pipeline-code-container {
  padding: 10px;
  max-height: 150px;
  overflow-y: auto;
}

.pipeline-code {
  margin: 0;
  font-family: 'Fira Code', monospace;
  font-size: 0.75rem;
  color: var(--color-brand);
  white-space: pre-wrap;
}
</style>
