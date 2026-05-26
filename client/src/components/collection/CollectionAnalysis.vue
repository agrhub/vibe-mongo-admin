<template>
  <div class="collection-analysis">
    <!-- Header Controls -->
    <div class="analysis-header-toolbar">
      <div class="header-left">
        <h3 class="analysis-title">
          <el-icon class="ai-icon"><Cpu /></el-icon>
          <span>{{ store.t('AI-Powered Analysis') }}</span>
        </h3>
        <el-tag round plain type="success">
          <span style="display: inline-flex; align-items: center;">
            <el-icon class="badge-icon"><Collection /></el-icon>
            {{ activeCollectionName }}
          </span>
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
          {{ analysisData.length > 0 ? store.t('Regenerate') : store.t('Analyze Data') }}
        </el-button>
      </div>
    </div>

    <!-- Optional Custom Prompt Box -->
    <div v-if="activeCollectionName" class="custom-prompt-container">
      <el-input
        v-model="customPrompt"
        :placeholder="store.t('Ask Gemini a specific analysis question (e.g. \'Compare average rating by property type\' or \'Analyze customer count by segment\')')"
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
      <div class="ai-avatar">🤖</div>
      <div class="pulse-circles">
        <div class="circle"></div>
        <div class="circle"></div>
        <div class="circle"></div>
      </div>
      <h4 class="loading-title">{{ store.t('Gemini is analyzing your collection...') }}</h4>
      <p class="loading-subtitle">{{ store.t('Inferring schema, generating aggregation pipelines, and plotting visualization options.') }}</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="!activeCollectionName" class="analysis-placeholder">
      <el-empty :description="store.t('Select a collection to view analysis')" />
    </div>

    <div v-else-if="analysisData.length === 0" class="analysis-placeholder">
      <el-empty :description="store.t('No analysis data available. Click Analyze to begin.')">
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
            <span class="card-title">{{ store.t('Executive Summary & Insights') }}</span>
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
                <el-tag size="small" type="success" effect="plain" class="chart-type-tag">
                  {{ chart.chartType.toUpperCase() }}
                </el-tag>
              </div>
            </template>
            
            <!-- EChart Box -->
            <div class="chart-container">
              <v-chart :option="chart.option" autoresize style="height: 320px;" />
            </div>

            <!-- View Pipeline Collapse -->
            <div class="pipeline-section">
              <el-collapse>
                <el-collapse-item name="1">
                  <template #title>
                    <div class="pipeline-title">
                      <el-icon><Operation /></el-icon>
                      <span>{{ store.t('View Pipeline') }}</span>
                      
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
                          round text
                          @click="runQueryInChat(chart)"
                        >
                          {{ store.t('Run') }}
                        </el-button>
                      </div>
                    </div>
                  </template>
                  <div class="pipeline-code-container">
                    <pre class="pipeline-code"><code>db.{{ store.activeColl }}.aggregate({{ formatPipeline(chart.pipeline) }})</code></pre>
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

<script setup>
import { ref, watch, computed } from 'vue';
import { store } from '../../stores';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { Cpu, Collection, Refresh, Position, Opportunity, Operation, DocumentCopy, CaretRight } from '@element-plus/icons-vue';
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
import { buildChartOption } from '../../utils/chartBuilder';

use([CanvasRenderer, BarChart, PieChart, LineChart, TitleComponent, TooltipComponent, GridComponent, LegendComponent]);

const loading = ref(false);
const customPrompt = ref('');
const insightsText = ref('');
const analysisData = ref([]);

const activeCollectionName = computed(() => store.activeColl);

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

function formatPipeline(pipeline) {
  if (!pipeline) return '[]';
  return JSON.stringify(pipeline, null, 2);
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success(store.t('Copied to clipboard'));
  } catch (err) {
    ElMessage.error(store.t('Failed to copy'));
  }
};

function runQueryInChat(chart) {
  const query = `db.${store.activeColl}.aggregate(${formatPipeline(chart.pipeline)})`;
  store.openChatWithCommand(`Execute command: ${query}`, chart.chartType || 'bar');
}

async function fetchAIAnalysis() {
  if (!store.activeColl) return;
  loading.value = true;
  try {
    const res = await axios.post(
      `/api/${store.activeConnection}/${store.activeDb}/${store.activeColl}/ai-analysis`,
      { customPrompt: customPrompt.value }
    );
    analysisData.value = (res.data.charts || []).map((chart) => ({
      ...chart,
      option: buildChartOption(chart, chart.results || [], chartTheme.value === 'dark')
    }));
    insightsText.value = res.data.insights || '';
  } catch (e) {
    console.error(e);
    ElMessage.error(store.t('Error running AI analysis: ') + (e.response?.data?.msg || e.message));
  } finally {
    loading.value = false;
  }
}

watch(() => store.activeColl, () => {
  analysisData.value = [];
  insightsText.value = '';
  customPrompt.value = '';
});
</script>

<style scoped>
.collection-analysis {
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

.active-coll-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(103, 194, 58, 0.15);
  color: #67c23a;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  border: 1px solid rgba(103, 194, 58, 0.3);
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

.circle:nth-child(2) {
  animation-delay: 0.2s;
  background: #67c23a;
}

.circle:nth-child(3) {
  animation-delay: 0.4s;
  background: #e6a23c;
}

@keyframes pulse-dot {
  0%, 100% { transform: scale(0.6); opacity: 0.4; }
  50% { transform: scale(1.2); opacity: 1; }
}

.loading-title {
  font-size: 1.1rem;
  color: #fff;
  margin: 0 0 8px 0;
}

.loading-subtitle {
  font-size: 0.9rem;
  color: #888;
  max-width: 450px;
  margin: 0;
}

.analysis-placeholder {
  padding: 40px 0;
  text-align: center;
}

.analysis-results {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.insights-card {
  /* background: rgba(30, 41, 59, 0.3) !important;
  border: 1px solid rgba(255, 255, 255, 0.05) !important; */
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
}

.card-header {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.insight-icon {
  color: var(--el-color-primary);
  font-size: 1.2rem;
}

.card-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.insights-content {
  line-height: 1.6;
  font-size: 0.95rem;
  color: var(--text-primary);
}

.insights-content :deep(p) {
  margin-top: 0;
  margin-bottom: 12px;
}

.insights-content :deep(strong) {
  color: var(--el-color-primary);
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
  gap: 20px;
}

@media (max-width: 768px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
}

.chart-card {
  /* background: rgba(30, 41, 59, 0.3) !important; */
  /* border: 1px solid rgba(255, 255, 255, 0.05) !important; */
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.chart-title-box {
  flex: 1;
}

.chart-title {
  margin: 0 0 4px 0;
  font-size: 1rem;
  color: var(--text-primary);
  font-weight: 600;
}

.chart-desc {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.chart-type-tag {
  font-weight: 600;
}

.chart-container {
  padding: 12px 0;
  flex: 1;
}

.pipeline-section {
  border-top: 1px solid var(--border-color);
  margin-top: 12px;
}

.pipeline-section :deep(.el-collapse) {
  border: none;
}

.pipeline-section :deep(.el-collapse-item__header) {
  background-color: transparent;
  color: var(--text-primary);
  border-bottom: none;
  height: 36px;
  font-size: 0.8rem;
}

.pipeline-section :deep(.el-collapse-item__wrap) {
  background-color: var(--bg-secondary);
  border-bottom: none;
  border-radius: 4px;
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
  width: 24px;
  height: 24px;
  min-height: 24px;
  padding: 0;
}

.pipeline-code-container {
  padding: 8px 12px;
  max-height: 200px;
  overflow-y: auto;
  position: relative;
}

.pipeline-code {
  margin: 0;
  font-family: 'Fira Code', 'Courier New', Courier, monospace;
  font-size: 0.75rem;
  color: var(--el-color-primary);
  white-space: pre-wrap;
}
</style>
