<template>
  <div ref="messageBox" class="chat-logs-container">
    <!-- Empty state with suggestions -->
    <div v-if="messages.length === 0" class="welcome-box">
      <div class="welcome-icon">🍃</div>
      <h4>{{ store.t('Welcome to MongoDB AI') }}</h4>
      <p>{{ store.t('I can help you query, aggregate, insert, index, or analyze MongoDB data using natural language chat.') }}</p>
      <div class="suggestions-box">
        <span
          v-for="sugg in suggestions"
          :key="sugg"
          class="suggestion-tag"
          @click="emit('send-suggestion', store.t(sugg))"
        >
          "{{ store.t(sugg) }}"
        </span>
      </div>
    </div>

    <!-- Message bubbles -->
    <div
      v-for="(msg, idx) in messages"
      :key="idx"
      class="msg-bubble-wrapper"
      :class="msg.role"
    >
      <div class="bubble-avatar">{{ msg.role === 'user' ? '👤' : '🤖' }}</div>
      <div class="bubble-body">
        <div class="bubble-text-wrapper">
          <div class="bubble-text" v-html="renderMarkdown(msg.content)"></div>
          <el-button
            v-if="msg.role === 'assistant'"
            circle size="small" icon="Headset"
            class="speech-tts-btn"
            :title="store.t('Speak text')"
            @click="emit('speak', msg.content)"
          />
        </div>

        <!-- ECharts container -->
        <div v-if="msg.chartVisual" class="msg-chart-item-container">
          <div class="msg-chart-container">
            <div :id="'chart_' + idx" class="echart-box"></div>
          </div>
        </div>

        <!-- Database list buttons -->
        <div v-if="msg.databases && msg.databases.length > 0" class="db-list-buttons">
          <div class="db-header-label">{{ store.t('Available databases:') }}</div>
          <div class="coll-buttons-grid">
            <el-button
              v-for="db in msg.databases"
              :key="db"
              type="primary" round text bg size="small"
              @click="emit('navigate-db', db)"
            >
              📁 {{ db }}
            </el-button>
          </div>
        </div>

        <!-- Collections list buttons -->
        <div v-if="msg.collectionsInfo && msg.collectionsInfo.collections.length > 0" class="coll-list-buttons">
          <div class="db-header-label">{{ store.t('Database:') }} <strong>{{ msg.collectionsInfo.db }}</strong></div>
          <div class="coll-buttons-grid">
            <el-button
              v-for="coll in msg.collectionsInfo.collections"
              :key="coll"
              type="primary" round text bg size="small" icon="Collection"
              @click="emit('navigate-coll', msg.collectionsInfo.db, coll)"
            >
              {{ coll }}
            </el-button>
          </div>
        </div>

        <!-- Documents table result -->
        <div v-if="msg.documentsResult && msg.documentsResult.documents.length > 0" class="doc-result-wrapper">
          <DocumentResult :documents="msg.documentsResult.documents" />
        </div>

        <!-- MongoDB query inspector -->
        <div v-if="msg.mongoQuery" class="doc-result-wrapper">
          <div class="chart-query-inspector">
            <div class="inspector-header" @click="queryExpanded[idx] = !queryExpanded[idx]" style="cursor: pointer;">
              <div class="header-left">
                <span class="icon">⌘</span>
                <span class="label">{{ store.t('View Query') }}</span>
              </div>
              <div class="header-right">
                <el-button size="small" icon="CopyDocument" text circle @click.stop="emit('copy-query', msg.mongoQuery)" :title="store.t('Copy query')" />
                <el-button type="primary" size="small" icon="CaretRight" round text style="margin-left: 0px;" @click.stop="emit('run-query', msg.mongoQuery)">
                  {{ store.t('Run') }}
                </el-button>
                <span class="chevron" :class="{ 'is-open': queryExpanded[idx] }">›</span>
              </div>
            </div>
            <div v-if="queryExpanded[idx]" class="inspector-body">
              <pre><code>{{ msg.mongoQuery }}</code></pre>
            </div>
          </div>
        </div>

        <!-- Trace result banner -->
        <div v-if="msg.traceResult" class="doc-result-wrapper">
          <div class="chart-query-inspector">
            <div class="inspector-header">
              <div class="header-left">
                <span class="icon"><el-icon><Link /></el-icon></span>
                <span class="label">{{ store.t('Trace') + ': ...' + msg.traceResult.traceId.slice(-10) }}</span>
              </div>
              <div class="header-right">
                <el-button type="primary" size="small" icon="CaretRight" round text style="margin-left: 0px;" @click.stop="emit('view-trace', msg.traceResult.traceId)">
                  {{ store.t('View Trace') }}
                </el-button>
              </div>
            </div>
          </div>
        </div>

        <!-- Retry button -->
        <div v-if="msg.isError" class="retry-action-box">
          <el-button type="warning" size="small" icon="RefreshLeft" round text bg @click="emit('retry', idx)">
            {{ store.t('Retry') }}
          </el-button>
        </div>
      </div>
    </div>

    <!-- Thinking indicator -->
    <div v-if="thinking" class="thinking-row">
      <div class="bubble-avatar">🤖</div>
      <div class="thinking-indicator">
        <div class="thinking-pulse"></div>
        <span class="thinking-text">{{ store.t('MongoAgent is thinking...') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { store } from '../../stores';
import { marked } from 'marked';
import DocumentResult from './DocumentResult.vue';

defineProps<{
  messages: any[];
  suggestions: string[];
  thinking: boolean;
}>();

const emit = defineEmits([
  'send-suggestion', 'speak', 'navigate-db', 'navigate-coll',
  'copy-query', 'run-query', 'view-trace', 'retry'
]);

const messageBox = ref<HTMLElement | null>(null);
const queryExpanded = ref<Record<number, boolean>>({});

// Expose messageBox so parent can scroll it
defineExpose({ messageBox });

const renderMarkdown = (text: string) => {
  try {
    const clean = text
      .replace(/\[QUERY\][\s\S]*?\[\/QUERY\]/gi, '')
      .replace(/\[NAVIGATION\][\s\S]*?\[\/NAVIGATION\]/gi, '')
      .replace(/\[NAVIGATION\]\s*\{[^}]*\}/gi, '')
      .replace(/\[QUERY\]\s*\{[^}]*\}/gi, '')
      .replace(/\[NAVIGATION\]/gi, '')
      .replace(/\[QUERY\]/gi, '')
      .trim();
    return marked.parse(clean, { async: false });
  } catch (e) {
    return text;
  }
};
</script>

<style scoped lang="scss">
.chat-logs-container {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  scroll-behavior: smooth;
}

.welcome-box {
  text-align: center;
  padding: 2rem 1rem;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.welcome-icon { font-size: 3rem; margin-bottom: 1rem; }

.welcome-box h4 {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.welcome-box p {
  font-size: 0.875rem;
  color: var(--text-muted);
  line-height: 1.5;
  max-width: 280px;
  margin-bottom: 1.5rem;
}

.suggestions-box {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.suggestion-tag {
  font-size: 0.78rem;
  padding: 0.4rem 0.85rem;
  border-radius: 20px;
  background: rgba(64, 158, 255, 0.08);
  border: 1px solid rgba(64, 158, 255, 0.2);
  color: #409eff;
  cursor: pointer;
  transition: all 0.2s;
  &:hover { background: rgba(64, 158, 255, 0.15); border-color: #409eff; }
}

.msg-bubble-wrapper {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  &.user { flex-direction: row-reverse; }
}

.bubble-avatar {
  font-size: 1.3rem;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.bubble-body { max-width: 85%; display: flex; flex-direction: column; gap: 0.5rem; }

.bubble-text-wrapper {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.bubble-text {
  flex: 1;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  font-size: 0.875rem;
  line-height: 1.6;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  word-break: break-word;
  
  :deep(pre) {
    background: rgba(0,0,0,0.3);
    padding: 0.75rem;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 0.78rem;
    margin: 0.5rem 0;
  }
  
  :deep(code) { font-size: 0.8rem; }
  :deep(p) { margin: 0 0 0.5rem 0; &:last-child { margin-bottom: 0; } }
  :deep(ul), :deep(ol) { margin: 0.5rem 0; padding-left: 1.2rem; }
}

.user .bubble-text {
  background: rgba(64, 158, 255, 0.12);
  border-color: rgba(64, 158, 255, 0.3);
}

.speech-tts-btn {
  opacity: 0.6;
  flex-shrink: 0;
  background: transparent !important;
  border: none !important;
  padding: 4px !important;
}

.db-list-buttons, .coll-list-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.db-header-label {
  font-size: 0.78rem;
  color: var(--text-muted);
  font-weight: 600;
}

.coll-buttons-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.coll-buttons-grid .el-button+.el-button {
	margin-left: 0px;
}

.doc-result-wrapper { width: 100%; }

.chart-query-inspector {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-primary);
}

.inspector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 1rem;
  background: rgba(255,255,255,0.02);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-muted);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.chevron {
  font-size: 1.2rem;
  color: var(--text-muted);
  transition: transform 0.2s;
  &.is-open { transform: rotate(90deg); }
}

.inspector-body {
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border-color);
  pre { margin: 0; font-size: 0.78rem; white-space: pre-wrap; }
}

.trace-alert-banner { font-size: 0.85rem; }

.retry-action-box { display: flex; }

.thinking-row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.thinking-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
}

.thinking-pulse {
  width: 8px;
  height: 8px;
  background: var(--color-brand);
  border-radius: 50%;
  animation: thinking-pulse 1s infinite ease-in-out;
}

@keyframes thinking-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.5); opacity: 0.5; }
}

.thinking-text {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-style: italic;
}

.msg-chart-item-container { width: 100%; }
.msg-chart-container { border-radius: 8px; overflow: hidden; }
.echart-box { width: 100%; height: 260px; }
</style>
