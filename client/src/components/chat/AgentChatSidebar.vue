<template>
  <div class="agent-chat-wrapper" :class="{ 'is-open': sidebarOpen }">
    <!-- Floating Neon Trigger Button (Visible only when closed) -->
    <div 
      v-if="!sidebarOpen"
      class="floating-chat-trigger" 
      @click="toggleSidebar"
    >
      <div class="pulse-ring"></div>
      <el-icon><ChatDotRound /></el-icon>
    </div>

    <!-- Sliding Sidebar Chat Panel -->
    <aside v-else class="agent-chat-sidebar">
      <div class="sidebar-layout">
        <!-- Header -->
        <div class="sidebar-header">
          <div class="avatar">🤖</div>
          <div class="header-meta">
            <h3>{{ store.t('MongoDB AI') }}</h3>
            <span class="status-tag">
              <span class="pulse-dot"></span>
              {{ store.t('Gemini Active') }}
            </span>
          </div>
          <div class="header-actions">
            <el-button 
              type="info" 
              size="small" 
              circle 
              icon="RefreshLeft" 
              :title="store.t('Clear Chat Logs')"
              @click="handleClearChat" 
            />
            <el-button 
              type="danger" 
              size="small" 
              circle 
              icon="Close" 
              :title="store.t('Close')"
              @click="toggleSidebar" 
            />
          </div>
        </div>

        <!-- Messaging Bubble Logs -->
        <div ref="messageBox" class="chat-logs-container">
          <div v-if="historyList.length === 0" class="welcome-box">
            <div class="welcome-icon">🍃</div>
            <h4>{{ store.t('Welcome to MongoDB AI') }}</h4>
            <p>{{ store.t('I can help you query, aggregate, insert, index, or analyze MongoDB data using natural language chat.') }}</p>
            <div class="suggestions-box">
              <span 
                v-for="sugg in currentSuggestions" 
                :key="sugg" 
                class="suggestion-tag" 
                @click="sendSuggestion(store.t(sugg))"
              >
                "{{ store.t(sugg) }}"
              </span>
            </div>
          </div>

          <div 
            v-for="(msg, idx) in historyList" 
            :key="idx"
            class="msg-bubble-wrapper"
            :class="msg.role"
          >
            <div class="bubble-avatar">{{ msg.role === 'user' ? '👤' : '🤖' }}</div>
            <div class="bubble-body">
              <div class="bubble-text" v-html="renderMarkdown(msg.content)"></div>
              
              <!-- Dynamic ECharts Container if aggregate visual returned -->
              <div v-if="msg.chartVisual" class="msg-chart-container">
                <div :id="'chart_' + idx" class="echart-box"></div>
              </div>

              <!-- Structured Databases List Buttons -->
              <div v-if="msg.databases && msg.databases.length > 0" class="db-list-buttons">
                <button 
                  v-for="db in msg.databases" 
                  :key="db"
                  class="quick-db-btn"
                  @click="handleNavigateDb(db)"
                >
                  📁 {{ db }}
                </button>
              </div>

              <!-- Structured Collections List Buttons -->
              <div v-if="msg.collectionsInfo && msg.collectionsInfo.collections.length > 0" class="coll-list-buttons">
                <div class="db-header-label">{{ store.t('Database:') }} <strong>{{ msg.collectionsInfo.db }}</strong></div>
                <div class="coll-buttons-grid">
                  <button 
                    v-for="coll in msg.collectionsInfo.collections" 
                    :key="coll"
                    class="quick-coll-btn"
                    @click="handleNavigateColl(msg.collectionsInfo.db, coll)"
                  >
                    📄 {{ coll }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Typing and thinking indicator -->
          <div v-if="thinking" class="thinking-row">
            <div class="bubble-avatar">🤖</div>
            <div class="thinking-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>

        <!-- Context-aware suggestions tray at the bottom (shows when chat has logs) -->
        <div v-if="historyList.length > 0 && currentSuggestions.length > 0" class="context-suggestions-tray">
          <span 
            v-for="sugg in currentSuggestions" 
            :key="sugg" 
            class="context-chip" 
            @click="sendSuggestion(store.t(sugg))"
          >
            {{ store.t(sugg) }}
          </span>
        </div>

        <!-- Dynamic Voice / Text Input Box -->
        <div class="input-panel-row">
          <el-input
            v-model="inputMsg"
            :placeholder="store.t('Type instructions ...')"
            class="chat-input-bar"
            @keyup.enter="handleSend"
          >
            <template #prepend>
              <el-button 
                :type="listening ? 'danger' : 'info'" 
                circle 
                icon="Microphone"
                class="audio-btn"
                @click="toggleVoiceListening" 
              />
            </template>
            <template #append>
              <el-button type="primary" circle icon="Promotion" @click="handleSend" />
            </template>
          </el-input>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from 'vue';
import { store } from '../../stores';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import axios from 'axios';
import * as echarts from 'echarts';
import { marked } from 'marked';

const route = useRoute();
const router = useRouter();

const sidebarOpen = ref(false);
const inputMsg = ref('');
const thinking = ref(false);
const listening = ref(false);

const renderMarkdown = (text: string) => {
  try {
    return marked.parse(text, { async: false });
  } catch (e) {
    return text;
  }
};

const currentSuggestions = ref<string[]>([]);

interface LocalMessage {
  role: 'user' | 'assistant';
  content: string;
  chartVisual?: any;
  databases?: string[];
  collectionsInfo?: { db: string; collections: string[] };
}

const historyList = ref<LocalMessage[]>([]);
const messageBox = ref<HTMLElement | null>(null);

const updateWelcomeSuggestions = () => {
  const suggestions: string[] = [];
  const conn = store.activeConnection;
  const db = store.activeDb;
  const coll = store.activeColl;

  if (route.name === 'Connections' || !conn) {
    suggestions.push(
      store.t('List all databases'),
      store.t('Show active database connections'),
      store.t('How do I create a new database connection?')
    );
  } else if (route.name === 'Monitoring') {
    suggestions.push(
      store.t('Show server status and uptime'),
      store.t('Explain resident vs virtual memory'),
      store.t('List all databases')
    );
  } else if ((route.name === 'DatabaseDashboard' || route.name === 'DatabaseCollections') && db) {
    suggestions.push(
      `${store.t('List collections in database')} ${db}`,
      `${store.t('Show database stats for')} ${db}`,
      `${store.t('Create a new collection in')} ${db}`,
      `${store.t('Backup database')} ${db}`
    );
  } else if (route.name === 'CollectionView' && db && coll) {
    suggestions.push(
      `${store.t('Query first 5 documents in')} ${coll}`,
      `${store.t('Show stats and size of collection')} ${coll}`,
      `${store.t('List indexes created on')} ${coll}`,
      `${store.t('Analyze schema of collection')} ${coll}`
    );
  } else if ((route.name === 'DocumentInsert' || route.name === 'DocumentEdit') && db && coll) {
    suggestions.push(
      `${store.t('Show collection details of')} ${coll}`,
      store.t('Explain how to insert a document with ObjectId'),
      `${store.t('Analyze schema of collection')} ${coll}`
    );
  } else if (conn) {
    suggestions.push(
      store.t('List databases in this connection'),
      store.t('Show server status & uptime'),
      store.t('Show active database connections')
    );
  }

  currentSuggestions.value = suggestions;
};

watch(
  () => [store.activeConnection, store.activeDb, store.activeColl, route.path, store.activeLocale],
  () => {
    if (historyList.value.length === 0) {
      updateWelcomeSuggestions();
    }
  },
  { immediate: true }
);



onMounted(async () => {
  await loadChatHistory();
});

const toggleSidebar = () => {
  sidebarOpen.value = !sidebarOpen.value;
  if (sidebarOpen.value) {
    scrollBottom();
  }
};

const loadChatHistory = async () => {
  try {
    const res = await axios.get('/api/agent/history');
    historyList.value = res.data.history.map((h: any) => ({
      role: h.role,
      content: h.content
    }));
    scrollBottom();
  } catch (e) {
    console.error('Failed to load chat history:', e);
  }
};

const toggleVoiceListening = () => {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    ElMessage.warning(store.t('Web Speech recognition is not supported in this browser.'));
    return;
  }

  if (listening.value) {
    listening.value = false;
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'vi-VN'; // Defaults to Vietnamese voice inputs
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    listening.value = true;
    ElMessage.info(store.t('Listening... Speak into your microphone.'));
  };

  recognition.onerror = () => {
    listening.value = false;
    ElMessage.error(store.t('Voice recognition error.'));
  };

  recognition.onend = () => {
    listening.value = false;
  };

  recognition.onresult = (event: any) => {
    const speechToText = event.results[0][0].transcript;
    inputMsg.value = speechToText;
    ElMessage.success(store.t('Voice transcribed successfully!'));
  };

  recognition.start();
};

const handleSend = async () => {
  if (!inputMsg.value.trim() || thinking.value) return;
  
  const userText = inputMsg.value.trim();
  inputMsg.value = '';
  
  // Append user bubble immediately
  historyList.value.push({ role: 'user', content: userText });
  scrollBottom();
  
  thinking.value = true;
  
  // Load current screen metadata
  const currentCtx = {
    currentConnection: store.activeConnection || undefined,
    currentDb: store.activeDb || undefined,
    currentCollection: store.activeColl || undefined,
    currentRoute: route.path,
    currentLocale: store.activeLocale || 'en'
  };

  try {
    const res = await axios.post('/api/agent/chat', {
      message: userText,
      context: currentCtx
    });

    const assistantMsg = res.data.message;
    const chartData = res.data.chartVisual;
    const navTrigger = res.data.navigation;
    const suggestions = res.data.suggestions;
    const databases = res.data.databases;
    const collectionsInfo = res.data.collectionsInfo;

    if (suggestions && Array.isArray(suggestions)) {
      currentSuggestions.value = suggestions;
    }

    // Append AI bubble
    const index = historyList.value.push({ 
      role: 'assistant', 
      content: assistantMsg,
      chartVisual: chartData,
      databases: databases,
      collectionsInfo: collectionsInfo
    }) - 1;

    scrollBottom();

    // 1. Process chart rendering inside bubble if aggregates exist
    if (chartData) {
      await nextTick();
      renderBubbleChart(index, chartData);
    }

    // 2. Process automatic page routing if triggered by agent
    if (navTrigger) {
      const connName = store.activeConnection;
      if (connName) {
        if (navTrigger.db && navTrigger.collection) {
          router.push(`/${connName}/${navTrigger.db}/${navTrigger.collection}`);
        } else if (navTrigger.db) {
          router.push(`/${connName}/${navTrigger.db}`);
        }
      }
    }
  } catch (err: any) {
    ElMessage.error(store.t('Failed to communicate with AI Copilot.'));
  } finally {
    thinking.value = false;
  }
};

const sendSuggestion = (text: string) => {
  inputMsg.value = text;
  handleSend();
};

const handleNavigateDb = (dbName: string) => {
  const connName = store.activeConnection;
  if (connName) {
    // Direct navigation
    router.push(`/${connName}/${dbName}`);
    
    // Append user visual indicator of their action
    historyList.value.push({
      role: 'user',
      content: `${store.t('Navigate to database')} "${dbName}"`
    });
    
    // Append friendly assistant confirm
    historyList.value.push({
      role: 'assistant',
      content: `${store.t('Switched database view to')} **${dbName}**.`
    });
    scrollBottom();
  }
};

const handleNavigateColl = (dbName: string, collName: string) => {
  const connName = store.activeConnection;
  if (connName) {
    // Direct navigation
    router.push(`/${connName}/${dbName}/${collName}`);
    
    // Auto-query the selected collection
    inputMsg.value = `${store.t('Query first 5 documents in')} ${collName}`;
    handleSend();
  }
};

const handleClearChat = async () => {
  try {
    await axios.delete('/api/agent/session');
    historyList.value = [];
    updateWelcomeSuggestions();
    ElMessage.success(store.t('Chat history cleared.'));
  } catch (e) {
    ElMessage.error(store.t('Failed to clear logs.'));
  }
};

const renderBubbleChart = (bubbleIndex: number, chartSpec: any) => {
  const chartDom = document.getElementById(`chart_${bubbleIndex}`);
  if (!chartDom) return;

  const myChart = echarts.init(chartDom);
  const categories = chartSpec.data.map((item: any) => item[chartSpec.xAxis]);
  
  const seriesData = chartSpec.series.map((sKey: string) => ({
    name: sKey,
    type: chartSpec.type,
    data: chartSpec.data.map((item: any) => item[sKey]),
    smooth: true,
    itemStyle: {
      color: chartSpec.type === 'bar' ? '#00f2fe' : '#10b981'
    }
  }));

  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    grid: { left: '10%', right: '10%', bottom: '15%', top: '15%' },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: { color: '#9ca3af' },
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#9ca3af' },
      splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } }
    },
    series: seriesData
  };

  myChart.setOption(option);
};

const scrollBottom = () => {
  nextTick(() => {
    if (messageBox.value) {
      messageBox.value.scrollTop = messageBox.value.scrollHeight;
    }
  });
};

watch(historyList, () => {
  scrollBottom();
}, { deep: true });
</script>

<style scoped lang="scss">
.agent-chat-wrapper {
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  width: 0;
  
  &.is-open {
    width: 400px;
    border-left: 1px solid rgba(255, 255, 255, 0.08);
    background-color: var(--bg-secondary);
  }
}

.agent-chat-sidebar {
  width: 400px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.floating-chat-trigger {
  position: fixed;
  bottom: 25px;
  right: 25px;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24px;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(0, 242, 254, 0.4);
  z-index: 2000;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  
  &:hover {
    transform: scale(1.1) rotate(5deg);
    box-shadow: 0 0 25px rgba(0, 242, 254, 0.7);
  }
}

.pulse-ring {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px solid #00f2fe;
  animation: pulse-ring 2s infinite ease-in-out;
  pointer-events: none;
}

.sidebar-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sidebar-header {
  display: flex;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  gap: 12px;
  
  .avatar {
    font-size: 28px;
  }

  .header-meta {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    h3 { margin: 0; font-size: 15px; font-weight: 700; color: var(--text-primary); }
    
    .status-tag {
      font-size: 11px;
      color: #10b981;
      display: flex;
      align-items: center;
      gap: 5px;
      margin-top: 2px;
      
      .pulse-dot {
        width: 6px;
        height: 6px;
        background-color: #10b981;
        border-radius: 50%;
        animation: pulse-ring 1.5s infinite;
      }
    }
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }
}

.chat-logs-container {
  flex-grow: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.welcome-box {
  text-align: center;
  color: var(--text-muted);
  padding: 20px 10px;
  
  .welcome-icon { font-size: 40px; margin-bottom: 12px; }
  h4 { margin: 0 0 8px 0; color: var(--text-primary); }
  p { font-size: 13px; margin: 0 0 20px 0; }
}

.suggestions-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  
  .suggestion-tag {
    background-color: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    padding: 8px;
    font-size: 12px;
    color: #00f2fe;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    
    &:hover {
      background-color: rgba(0, 242, 254, 0.1);
      border-color: rgba(0, 242, 254, 0.3);
    }
  }
}

.msg-bubble-wrapper {
  display: flex;
  gap: 10px;
  max-width: 85%;

  .bubble-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
  }

  .bubble-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .bubble-text {
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 13px;
    line-height: 1.5;
    word-break: break-word;
    white-space: pre-wrap;
  }

  &.user {
    align-self: flex-end;
    flex-direction: row-reverse;
    
    .bubble-text {
      background-color: #3b82f6;
      color: #fff;
      border-top-right-radius: 2px;
    }
  }

  &.assistant {
    align-self: flex-start;
    
    .bubble-text {
      background-color: rgba(18, 20, 32, 0.7);
      border: 1px solid rgba(0, 242, 254, 0.2);
      color: #e5e7eb;
      border-top-left-radius: 2px;
    }
  }
}

.msg-chart-container {
  width: 280px;
  height: 180px;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 5px;
}

.echart-box {
  width: 100%;
  height: 100%;
}

.thinking-row {
  display: flex;
  gap: 10px;
  align-self: flex-start;
  
  .bubble-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
  }
}

.thinking-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  background-color: rgba(18, 20, 32, 0.7);
  border: 1px solid rgba(0, 242, 254, 0.1);
  padding: 10px 16px;
  border-radius: 12px;
  border-top-left-radius: 2px;

  span {
    width: 6px;
    height: 6px;
    background-color: #00f2fe;
    border-radius: 50%;
    animation: pulse-ring 1.4s infinite ease-in-out both;
    
    &:nth-child(1) { animation-delay: -0.32s; }
    &:nth-child(2) { animation-delay: -0.16s; }
  }
}

.input-panel-row {
  padding: 15px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.chat-input-bar {
  :deep(.el-input-group__append) {
    background-color: transparent !important;
    border: none !important;
    padding: 0 10px !important;
  }
}

.append-actions {
  display: flex;
  gap: 5px;
  align-items: center;
}

.context-suggestions-tray {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 10px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  scrollbar-width: none; /* Hide scrollbar for clean UI on Firefox */
}
.context-suggestions-tray::-webkit-scrollbar {
  display: none; /* Hide scrollbar for Chrome/Safari/Edge */
}
.context-chip {
  flex-shrink: 0;
  background-color: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 6px 12px;
  font-size: 11px;
  color: #00f2fe;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.context-chip:hover {
  background-color: rgba(0, 242, 254, 0.1);
  border-color: rgba(0, 242, 254, 0.3);
}

/* Custom Markdown Rendering Styles */
.bubble-text :deep(p) {
  margin: 0 0 10px 0;
  line-height: 1.5;
}
.bubble-text :deep(p:last-child) {
  margin-bottom: 0;
}
.bubble-text :deep(ul), .bubble-text :deep(ol) {
  margin: 5px 0 10px 20px;
  padding: 0;
}
.bubble-text :deep(li) {
  margin-bottom: 5px;
  line-height: 1.4;
}
.bubble-text :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
  font-size: 12.5px;
  background-color: rgba(0, 0, 0, 0.15);
  border-radius: 6px;
  overflow: hidden;
}
.bubble-text :deep(th), .bubble-text :deep(td) {
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 8px 12px;
  text-align: left;
}
.bubble-text :deep(th) {
  background-color: rgba(255, 255, 255, 0.08);
  font-weight: 600;
  color: #ffffff;
}
.bubble-text :deep(tr:nth-child(even)) {
  background-color: rgba(255, 255, 255, 0.03);
}
.bubble-text :deep(pre) {
  background-color: rgba(0, 0, 0, 0.3) !important;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px;
  overflow-x: auto;
  margin: 10px 0;
}
.bubble-text :deep(code) {
  font-family: 'Fira Code', 'Courier New', Courier, monospace;
  font-size: 11.5px;
  color: #00f2fe;
  padding: 2px 4px;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}
.bubble-text :deep(pre code) {
  padding: 0;
  background-color: transparent;
  color: inherit;
  display: block;
}
.bubble-text :deep(img) {
  max-width: 100%;
  border-radius: 8px;
  margin: 10px 0;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.bubble-text :deep(video) {
  max-width: 100%;
  border-radius: 8px;
  margin: 10px 0;
}
.bubble-text :deep(audio) {
  width: 100%;
  margin: 10px 0;
}
.bubble-text :deep(.quick-db-btn),
.bubble-text :deep(.quick-coll-btn),
.quick-db-btn,
.quick-coll-btn {
  display: inline-flex;
  align-items: center;
  margin: 4px 6px;
  padding: 6px 14px;
  background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
  border: none;
  border-radius: 20px;
  color: #ffffff;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 3px 8px rgba(79, 172, 254, 0.3);
}
.bubble-text :deep(.quick-db-btn:hover),
.bubble-text :deep(.quick-coll-btn:hover),
.quick-db-btn:hover,
.quick-coll-btn:hover {
  transform: translateY(-1.5px);
  box-shadow: 0 6px 14px rgba(79, 172, 254, 0.45);
  filter: brightness(1.1);
}
.bubble-text :deep(.quick-db-btn:active),
.bubble-text :deep(.quick-coll-btn:active),
.quick-db-btn:active,
.quick-coll-btn:active {
  transform: translateY(1px);
  box-shadow: 0 1px 4px rgba(79, 172, 254, 0.2);
}
.db-list-buttons,
.coll-list-buttons {
  margin-top: 10px;
  padding: 8px;
  background-color: rgba(255, 255, 255, 0.04);
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}
.db-header-label {
  font-size: 11.5px;
  color: #9ca3af;
  margin-bottom: 6px;
  padding-left: 6px;
}
.coll-buttons-grid {
  display: flex;
  flex-wrap: wrap;
}
</style>
