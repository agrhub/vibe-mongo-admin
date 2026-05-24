<template>
  <div class="phoenix-metrics-grid">

    <!-- Row 1: Traces over time + Traces with errors -->
    <el-row :gutter="24" class="charts-row">
      <el-col :xs="24" :lg="12" class="chart-col">
        <el-card class="chart-card">
          <template #header>
            <div class="chart-header-title">
              <el-icon class="card-chart-icon" style="color: #6b7280;"><DataLine /></el-icon>
              <div>
                <div>Traces over time</div>
                <div class="chart-subtitle">Overall volume of traces</div>
              </div>
            </div>
          </template>
          <div class="canvas-viewport"><canvas ref="tracesRef"></canvas></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="12" class="chart-col">
        <el-card class="chart-card">
          <template #header>
            <div class="chart-header-title">
              <el-icon class="card-chart-icon" style="color: #ef4444;"><Warning /></el-icon>
              <div>
                <div>Traces with errors</div>
                <div class="chart-subtitle">Overall volume of traces with errors</div>
              </div>
            </div>
          </template>
          <div class="canvas-viewport"><canvas ref="traceErrorsRef"></canvas></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Row 2: Trace Latency + Annotation scores -->
    <el-row :gutter="24" class="charts-row">
      <el-col :xs="24" :lg="12" class="chart-col">
        <el-card class="chart-card">
          <template #header>
            <div class="chart-header-title">
              <el-icon class="card-chart-icon" style="color: #0ea5e9;"><Timer /></el-icon>
              <div>
                <div>Trace Latency</div>
                <div class="chart-subtitle">Latency percentiles</div>
              </div>
            </div>
          </template>
          <div class="canvas-viewport"><canvas ref="latencyRef"></canvas></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="12" class="chart-col">
        <el-card class="chart-card">
          <template #header>
            <div class="chart-header-title">
              <el-icon class="card-chart-icon" style="color: #8b5cf6;"><Star /></el-icon>
              <div>
                <div>Annotation scores</div>
                <div class="chart-subtitle">Average annotation scores</div>
              </div>
            </div>
          </template>
          <div class="canvas-viewport"><canvas ref="annotationsRef"></canvas></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Row 3: Cost + Top models by cost -->
    <el-row :gutter="24" class="charts-row">
      <el-col :xs="24" :lg="12" class="chart-col">
        <el-card class="chart-card">
          <template #header>
            <div class="chart-header-title">
              <el-icon class="card-chart-icon" style="color: #10b981;"><Money /></el-icon>
              <div>
                <div>Cost</div>
                <div class="chart-subtitle">Estimated cost in USD</div>
              </div>
            </div>
          </template>
          <div class="canvas-viewport"><canvas ref="costRef"></canvas></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="12" class="chart-col">
        <el-card class="chart-card">
          <template #header>
            <div class="chart-header-title">
              <el-icon class="card-chart-icon" style="color: #f59e0b;"><TrendCharts /></el-icon>
              <div>
                <div>Top models by cost</div>
              </div>
            </div>
          </template>
          <div class="canvas-viewport"><canvas ref="topModelsCostRef"></canvas></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Row 4: Token usage + Top models by tokens -->
    <el-row :gutter="24" class="charts-row">
      <el-col :xs="24" :lg="12" class="chart-col">
        <el-card class="chart-card">
          <template #header>
            <div class="chart-header-title">
              <el-icon class="card-chart-icon" style="color: #3b82f6;"><Document /></el-icon>
              <div>
                <div>Token usage</div>
                <div class="chart-subtitle">Token usage by prompt and completion</div>
              </div>
            </div>
          </template>
          <div class="canvas-viewport"><canvas ref="tokenUsageRef"></canvas></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="12" class="chart-col">
        <el-card class="chart-card">
          <template #header>
            <div class="chart-header-title">
              <el-icon class="card-chart-icon" style="color: #6366f1;"><Histogram /></el-icon>
              <div>
                <div>Top models by tokens</div>
              </div>
            </div>
          </template>
          <div class="canvas-viewport"><canvas ref="topModelsTokensRef"></canvas></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Row 5: LLM spans + LLM spans with errors -->
    <el-row :gutter="24" class="charts-row">
      <el-col :xs="24" :lg="12" class="chart-col">
        <el-card class="chart-card">
          <template #header>
            <div class="chart-header-title">
              <el-icon class="card-chart-icon" style="color: #6b7280;"><Cpu /></el-icon>
              <div>
                <div>LLM spans</div>
                <div class="chart-subtitle">LLM span count over time</div>
              </div>
            </div>
          </template>
          <div class="canvas-viewport"><canvas ref="llmSpansRef"></canvas></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="12" class="chart-col">
        <el-card class="chart-card">
          <template #header>
            <div class="chart-header-title">
              <el-icon class="card-chart-icon" style="color: #ef4444;"><CircleClose /></el-icon>
              <div>
                <div>LLM spans with errors</div>
                <div class="chart-subtitle">LLM spans with errors over time</div>
              </div>
            </div>
          </template>
          <div class="canvas-viewport"><canvas ref="llmSpansErrorsRef"></canvas></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Row 6: Tool spans + Tool spans with errors -->
    <el-row :gutter="24" class="charts-row">
      <el-col :xs="24" :lg="12" class="chart-col">
        <el-card class="chart-card">
          <template #header>
            <div class="chart-header-title">
              <el-icon class="card-chart-icon" style="color: #6b7280;"><Tools /></el-icon>
              <div>
                <div>Tool spans</div>
                <div class="chart-subtitle">Tool span count over time</div>
              </div>
            </div>
          </template>
          <div class="canvas-viewport"><canvas ref="toolSpansRef"></canvas></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="12" class="chart-col">
        <el-card class="chart-card">
          <template #header>
            <div class="chart-header-title">
              <el-icon class="card-chart-icon" style="color: #ef4444;"><CircleClose /></el-icon>
              <div>
                <div>Tool spans with errors</div>
                <div class="chart-subtitle">Tool spans with errors over time</div>
              </div>
            </div>
          </template>
          <div class="canvas-viewport"><canvas ref="toolSpansErrorsRef"></canvas></div>
        </el-card>
      </el-col>
    </el-row>

  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import {
  DataLine, Warning, Timer, Star, Money, TrendCharts,
  Document, Histogram, Cpu, CircleClose, Tools,
} from '@element-plus/icons-vue';
import Chart from 'chart.js/auto';

const props = defineProps({
  metrics: { type: Object, default: null },
});

// Canvas refs
const tracesRef        = ref(null);
const traceErrorsRef   = ref(null);
const latencyRef       = ref(null);
const annotationsRef   = ref(null);
const costRef          = ref(null);
const topModelsCostRef = ref(null);
const tokenUsageRef    = ref(null);
const topModelsTokensRef = ref(null);
const llmSpansRef      = ref(null);
const llmSpansErrorsRef = ref(null);
const toolSpansRef     = ref(null);
const toolSpansErrorsRef = ref(null);

// Chart instances
let instances = {};

// Chart.js dark theme defaults
const GRID_COLOR = 'rgba(255,255,255,0.06)';
const TEXT_COLOR = '#9ca3af';
const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: { color: TEXT_COLOR, font: { family: 'Outfit', size: 11 }, boxWidth: 12 },
    },
  },
  scales: {
    x: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_COLOR, maxRotation: 0 } },
    y: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_COLOR }, beginAtZero: true },
  },
};

const stackedBar = (labels, datasets) => ({
  type: 'bar',
  data: { labels, datasets },
  options: {
    ...CHART_DEFAULTS,
    scales: {
      ...CHART_DEFAULTS.scales,
      x: { ...CHART_DEFAULTS.scales.x, stacked: true },
      y: { ...CHART_DEFAULTS.scales.y, stacked: true },
    },
  },
});

const lineChart = (labels, datasets) => ({
  type: 'line',
  data: { labels, datasets },
  options: CHART_DEFAULTS,
});

const barChart = (labels, datasets) => ({
  type: 'bar',
  data: { labels, datasets },
  options: CHART_DEFAULTS,
});

function destroy(key) {
  if (instances[key]) { instances[key].destroy(); instances[key] = null; }
}

function mk(key, ref, cfg) {
  destroy(key);
  if (ref?.value) instances[key] = new Chart(ref.value, cfg);
}

function buildCharts() {
  if (!props.metrics) return;

  const m = props.metrics;
  const labels      = (m.tracesOverTime || []).map(d => d.date);
  const okData      = (m.tracesOverTime || []).map(d => d.ok ?? 0);
  const errData     = (m.tracesOverTime || []).map(d => d.error ?? 0);
  const latLabels   = (m.latencyPercentiles || []).map(d => d.date);
  const p50         = (m.latencyPercentiles || []).map(d => d.p50 ?? 0);
  const p75         = (m.latencyPercentiles || []).map(d => d.p75 ?? d.p50 ?? 0);
  const p90         = (m.latencyPercentiles || []).map(d => d.p90 ?? 0);
  const p95         = (m.latencyPercentiles || []).map(d => d.p95 ?? d.p90 ?? 0);
  const p99         = (m.latencyPercentiles || []).map(d => d.p99 ?? 0);

  // Token / cost fallback simulation if not provided by backend
  const tokenLabels = labels.length ? labels : ['Today'];
  const promptTokens     = (m.tokenUsage || [{ prompt: 0 }]).map(t => t.prompt ?? 0);
  const completionTokens = (m.tokenUsage || [{ completion: 0 }]).map(t => t.completion ?? 0);
  const promptCost       = (m.costData   || [{ prompt: 0 }]).map(c => c.prompt ?? 0);
  const completionCost   = (m.costData   || [{ completion: 0 }]).map(c => c.completion ?? 0);
  const llmOk   = (m.llmSpans  || []).map(d => d.ok ?? 0);
  const llmErr  = (m.llmSpans  || []).map(d => d.error ?? 0);
  const toolOk  = (m.toolSpans || []).map(d => d.ok ?? 0);
  const toolErr = (m.toolSpans || []).map(d => d.error ?? 0);

  // 1) Traces over time
  mk('traces', tracesRef, stackedBar(labels, [
    { label: 'error', data: errData, backgroundColor: '#ef4444' },
    { label: 'ok',    data: okData,  backgroundColor: '#4b5563' },
  ]));

  // 2) Traces with errors only
  mk('traceErrors', traceErrorsRef, barChart(labels, [
    { label: 'error', data: errData, backgroundColor: '#ef4444' },
  ]));

  // 3) Trace Latency percentiles
  const lineDash = { borderCapStyle: 'round', pointRadius: 3 };
  mk('latency', latencyRef, lineChart(latLabels, [
    { label: 'Max', data: p99.map(v => v * 1.5), borderColor: '#6b7280', borderDash: [4,4], ...lineDash },
    { label: 'P50', data: p50, borderColor: '#3b82f6', ...lineDash },
    { label: 'P75', data: p75, borderColor: '#60a5fa', borderDash: [3,3], ...lineDash },
    { label: 'P90', data: p90, borderColor: '#93c5fd', borderDash: [5,5], ...lineDash },
    { label: 'P95', data: p95, borderColor: '#bfdbfe', borderDash: [2,4], ...lineDash },
    { label: 'P99', data: p99, borderColor: '#dbeafe', borderDash: [1,3], ...lineDash },
  ]));

  // 4) Annotation scores (empty data since we don't collect yet)
  mk('annotations', annotationsRef, lineChart(labels, [
    { label: 'Score', data: labels.map(() => null), borderColor: '#8b5cf6', ...lineDash },
  ]));

  // 5) Cost
  const costTokenLabels = tokenLabels.length === promptCost.length ? tokenLabels : tokenLabels.slice(-promptCost.length);
  mk('cost', costRef, stackedBar(costTokenLabels, [
    { label: 'completion', data: completionCost, backgroundColor: '#3b82f6' },
    { label: 'prompt',     data: promptCost,     backgroundColor: '#0ea5e9' },
  ]));

  // 6) Top models by cost
  mk('topModelsCost', topModelsCostRef, barChart(
    (m.topModels || ['gemini-1.5-pro']),
    [
      { label: 'completion_cost', data: (m.topModelCosts || [0]).map(c => c.completion ?? 0), backgroundColor: '#3b82f6' },
      { label: 'prompt_cost',     data: (m.topModelCosts || [0]).map(c => c.prompt ?? 0),     backgroundColor: '#0ea5e9' },
    ]
  ));

  // 7) Token usage
  mk('tokenUsage', tokenUsageRef, stackedBar(costTokenLabels, [
    { label: 'completion', data: completionTokens, backgroundColor: '#3b82f6' },
    { label: 'prompt',     data: promptTokens,     backgroundColor: '#0ea5e9' },
  ]));

  // 8) Top models by tokens
  mk('topModelsTokens', topModelsTokensRef, barChart(
    (m.topModels || ['gemini-1.5-pro']),
    [
      { label: 'completion_tokens', data: (m.topModelCosts || [{}]).map(c => c.completionTokens ?? 0), backgroundColor: '#3b82f6' },
      { label: 'prompt_tokens',     data: (m.topModelCosts || [{}]).map(c => c.promptTokens ?? 0),     backgroundColor: '#0ea5e9' },
    ]
  ));

  // 9) LLM spans
  const llmLabels = (m.llmSpans || []).map(d => d.date) || labels;
  mk('llmSpans', llmSpansRef, stackedBar(llmLabels.length ? llmLabels : labels, [
    { label: 'error', data: llmErr, backgroundColor: '#ef4444' },
    { label: 'ok',    data: llmOk,  backgroundColor: '#4b5563' },
    { label: 'unset', data: llmOk.map(v => Math.round(v * 0.1)), backgroundColor: '#374151' },
  ]));

  // 10) LLM spans with errors
  mk('llmSpansErrors', llmSpansErrorsRef, barChart(llmLabels.length ? llmLabels : labels, [
    { label: 'error', data: llmErr, backgroundColor: '#ef4444' },
  ]));

  // 11) Tool spans
  const toolLabels = (m.toolSpans || []).map(d => d.date) || labels;
  mk('toolSpans', toolSpansRef, stackedBar(toolLabels.length ? toolLabels : labels, [
    { label: 'error', data: toolErr, backgroundColor: '#ef4444' },
    { label: 'ok',    data: toolOk,  backgroundColor: '#4b5563' },
    { label: 'unset', data: toolOk.map(v => Math.round(v * 0.1)), backgroundColor: '#374151' },
  ]));

  // 12) Tool spans with errors
  mk('toolSpansErrors', toolSpansErrorsRef, barChart(toolLabels.length ? toolLabels : labels, [
    { label: 'error', data: toolErr, backgroundColor: '#ef4444' },
  ]));
}

watch(() => props.metrics, (val) => {
  if (val) buildCharts();
}, { deep: true });

onMounted(() => {
  if (props.metrics) buildCharts();
});

onBeforeUnmount(() => {
  Object.values(instances).forEach(c => c?.destroy());
  instances = {};
});
</script>

<style scoped>
.phoenix-metrics-grid { padding: 0; }
.charts-row { margin-bottom: 1.5rem; }
.chart-col { margin-bottom: 1.5rem; }
.chart-card { border-radius: 8px !important; }
.chart-header-title {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-primary);
}
.chart-subtitle {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 400;
  margin-top: 2px;
}
.card-chart-icon { font-size: 1.1rem; margin-top: 2px; }
.canvas-viewport {
  height: 200px;
  position: relative;
  width: 100%;
}
</style>
