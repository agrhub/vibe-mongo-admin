<template>
  <div class="agent-chat-wrapper" :class="{ 'is-open': store.chatSidebarOpen }">
    <!-- Floating Neon Trigger Button (Visible only when closed) -->
    <div 
      v-if="!store.chatSidebarOpen"
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
              type="danger" 
              size="small" 
              circle 
              icon="RefreshLeft" 
              :title="store.t('Clear Chat Logs')"
              @click="handleClearChat" 
            />
            <el-button 
              type="primary" 
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
              <div v-if="msg.chartVisual" class="msg-chart-item-container">
                <div class="msg-chart-container">
                  <div :id="'chart_' + idx" class="echart-box"></div>
                </div>
              </div>

              <!-- Structured Databases List Buttons -->
              <div v-if="msg.databases && msg.databases.length > 0" class="db-list-buttons">
                <div class="db-header-label">{{ store.t('Available databases:') }}</div>
                <div class="coll-buttons-grid">
                  <el-button 
                    v-for="db in msg.databases" 
                    :key="db"
                    type="primary"
                    round text bg
                    size="small"
                    @click="handleNavigateDb(db)"
                  >
                    📁 {{ db }}
                  </el-button>
                </div>
              </div>

              <!-- Structured Collections List Buttons -->
              <div v-if="msg.collectionsInfo && msg.collectionsInfo.collections.length > 0" class="coll-list-buttons">
                <div class="db-header-label">{{ store.t('Database:') }} <strong>{{ msg.collectionsInfo.db }}</strong></div>
                <div class="coll-buttons-grid">
                  <el-button 
                    v-for="coll in msg.collectionsInfo.collections" 
                    :key="coll"
                    type="primary"
                    round text bg
                    size="small"
                    icon="Collection"
                    @click="handleNavigateColl(msg.collectionsInfo.db, coll)"
                  >
                    {{ coll }}
                  </el-button>
                </div>
              </div>

              <!-- Documents Table Result with MongoDB Query Viewer -->
              <div v-if="msg.documentsResult && msg.documentsResult.documents.length > 0" class="doc-result-wrapper">
                <DocumentResult
                  :documents="msg.documentsResult.documents"
                />
              </div>

              <div v-if="msg.mongoQuery" class="doc-result-wrapper">
                <div class="chart-query-inspector">
                  <div class="inspector-header">
                    <div class="header-left" @click="chartQueryExpanded[idx] = !chartQueryExpanded[idx]">
                      <span class="icon">⌘</span>
                      <span class="label">{{ store.t('View MongoDB Query') }}</span>
                    </div>
                    <div class="header-right">
                      <el-button 
                        size="small" 
                        icon="CopyDocument" 
                        text circle
                        @click.stop="copyQueryText(msg.mongoQuery)" 
                        :title="store.t('Copy query')" />
                      <el-button 
                        type="primary" 
                        size="small" 
                        icon="CaretRight" 
                        round text bg style="margin-left: 0px;"
                        @click="handleRunProposedQuery(msg.mongoQuery)"
                      >
                        {{ store.t('Run') }}
                      </el-button>
                      <span class="chevron" :class="{ 'is-open': chartQueryExpanded[idx] }" @click="chartQueryExpanded[idx] = !chartQueryExpanded[idx]">›</span>
                    </div>
                  </div>
                  <div v-if="chartQueryExpanded[idx]" class="inspector-body">
                    <pre><code>{{ msg.mongoQuery }}</code></pre>
                  </div>
                </div>
              </div>

              <!-- Retry Action Box if message failed -->
              <div v-if="msg.isError" class="retry-action-box">
                <el-button 
                  type="warning" 
                  size="small" 
                  icon="RefreshLeft" 
                  round text bg
                  @click="handleRetry(idx)"
                >
                  {{ store.t('Retry') }}
                </el-button>
              </div>
            </div>
          </div>

          <!-- Typing and thinking indicator -->
          <div v-if="thinking" class="thinking-row">
            <div class="bubble-avatar">🤖</div>
            <div class="thinking-indicator">
              <div class="thinking-pulse"></div>
              <span class="thinking-text">{{ store.t('MongoAgent is thinking...') }}</span>
            </div>
          </div>
        </div>

        <!-- Context-aware suggestions tray at the bottom (shows when chat has logs) -->
        <div v-if="historyList.length > 0 && currentSuggestions.length > 0" class="context-suggestions-tray">
          <el-button v-for="sugg in currentSuggestions"
            :key="sugg"
            type="primary"
            round text bg size="small"
            @click="sendSuggestion(store.t(sugg))">
            {{ store.t(sugg) }}
          </el-button>
        </div>

        <!-- Dynamic Voice / Text Input Box -->
        <div class="input-panel-row">
          <!-- Mention autocomplete popup -->
          <div v-if="showMentionList && mentionOptions.length > 0" class="mention-list-popup">
            <div 
              v-for="(opt, idx) in mentionOptions" 
              :key="idx"
              class="mention-item"
              :class="{ 'is-active': idx === mentionActiveIndex }"
              @mousedown.prevent="selectMention(opt)"
            >
              <span class="mention-icon">{{ opt.type === 'db' ? '📁' : '📄' }}</span>
              <span class="mention-label">{{ opt.label }}</span>
              <span class="mention-detail">{{ opt.detail }}</span>
            </div>
          </div>

          <el-input
            ref="inputRef"
            v-model="inputMsg"
            :placeholder="store.t('Type instructions ...')"
            class="chat-input-bar"
            @input="handleInput"
            @keydown="handleInputKeydown"
            @blur="handleBlur"
          >
            <template #prepend>
              <el-button 
                :type="listening ? 'danger' : 'info'" 
                circle 
                icon="Microphone"
                @click="toggleVoiceListening" 
              />
            </template>
            <template #append>
              <el-button circle icon="Promotion" @click="handleSend" />
            </template>
          </el-input>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted, computed } from 'vue';
import { store } from '../../stores';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import axios from 'axios';
import * as echarts from 'echarts';
import { marked } from 'marked';
import DocumentResult from './DocumentResult.vue';

// Customize marked renderer for code blocks
const renderer = new marked.Renderer();
renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
  const language = lang || 'code';
  // Use a base64 encoded string to safely store the code in a data attribute
  const encodedCode = btoa(unescape(encodeURIComponent(text)));
  return `
    <div class="code-block-wrapper">
      <div class="code-block-header">
        <span class="code-lang">${language}</span>
        <button class="global-copy-btn" data-code="${encodedCode}">📋</button>
      </div>
      <pre><code class="language-${language}">${text}</code></pre>
    </div>
  `;
};
marked.use({ renderer });

const route = useRoute();
const router = useRouter();

const inputMsg = ref('');
const thinking = ref(false);
const listening = ref(false);

const inputRef = ref<any>(null);
const showMentionList = ref(false);
const mentionQuery = ref('');
const mentionStartIndex = ref(-1);
const mentionActiveIndex = ref(0);

// Tracks which chart queries are expanded in the message logs
const chartQueryExpanded = ref<Record<number, boolean>>({});

const mentionOptions = computed(() => {
  const query = mentionQuery.value.toLowerCase().trim();
  const list: Array<{ type: 'db' | 'coll'; label: string; value: string; detail?: string }> = [];
  
  if (!store.sidebarList) return list;

  // 1. Add databases
  const dbs = Object.keys(store.sidebarList);
  for (const db of dbs) {
    if (!query || db.toLowerCase().includes(query)) {
      list.push({
        type: 'db',
        label: db,
        value: `@${db}`,
        detail: 'Database'
      });
    }
  }
  
  // 2. Add collections
  for (const [db, colls] of Object.entries(store.sidebarList)) {
    const collections = colls as string[];
    for (const coll of collections) {
      const fullLabel = `${db}.${coll}`;
      if (!query || coll.toLowerCase().includes(query) || fullLabel.toLowerCase().includes(query)) {
        list.push({
          type: 'coll',
          label: coll,
          value: `@${coll}`,
          detail: db
        });
      }
    }
  }
  
  return list.slice(0, 15);
});

const handleInput = (val: string) => {
  const inputEl = inputRef.value?.$el.querySelector('input') as HTMLInputElement | null;
  if (!inputEl) return;
  
  const selectionStart = inputEl.selectionStart || 0;
  const textBeforeCursor = val.substring(0, selectionStart);
  const lastAtIndex = textBeforeCursor.lastIndexOf('@');
  
  if (lastAtIndex !== -1) {
    const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
    if (!/\s/.test(textAfterAt)) {
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : '';
      if (charBeforeAt === '' || /\s/.test(charBeforeAt)) {
        showMentionList.value = true;
        mentionStartIndex.value = lastAtIndex;
        mentionQuery.value = textAfterAt;
        mentionActiveIndex.value = 0;
        return;
      }
    }
  }
  
  showMentionList.value = false;
  mentionStartIndex.value = -1;
  mentionQuery.value = '';
};

const handleInputKeydown = (e: KeyboardEvent) => {
  if (showMentionList.value && mentionOptions.value.length > 0) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      mentionActiveIndex.value = (mentionActiveIndex.value + 1) % mentionOptions.value.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      mentionActiveIndex.value = (mentionActiveIndex.value - 1 + mentionOptions.value.length) % mentionOptions.value.length;
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      selectMention(mentionOptions.value[mentionActiveIndex.value]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      showMentionList.value = false;
    }
    return; // Consume all keydown events while mention list is open
  }

  // No mention list open — Enter key sends the message
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
};

const selectMention = (option: { type: 'db' | 'coll'; label: string; value: string; detail?: string }) => {
  const text = inputMsg.value;
  const start = mentionStartIndex.value;
  
  const inputEl = inputRef.value?.$el.querySelector('input') as HTMLInputElement | null;
  const cursorIdx = inputEl ? inputEl.selectionStart || 0 : text.length;
  
  const insertedText = option.value + ' ';
  
  const beforeMention = text.substring(0, start);
  const afterMention = text.substring(cursorIdx);
  
  inputMsg.value = beforeMention + insertedText + afterMention;
  
  showMentionList.value = false;
  mentionStartIndex.value = -1;
  mentionQuery.value = '';
  
  nextTick(() => {
    if (inputEl) {
      inputEl.focus();
      const newCursorPos = start + insertedText.length;
      inputEl.setSelectionRange(newCursorPos, newCursorPos);
    }
  });
};

const handleBlur = () => {
  setTimeout(() => {
    showMentionList.value = false;
  }, 200);
};

const renderMarkdown = (text: string) => {
  try {
    // Strip special metadata blocks that are already rendered in dedicated widgets
    const clean = text
      .replace(/\[QUERY\][\s\S]*?\[\/QUERY\]/gi, '')
      .replace(/\[NAVIGATION\][\s\S]*?\[\/NAVIGATION\]/gi, '')
      .trim();
    return marked.parse(clean, { async: false });
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
  documentsResult?: { query: string; documents: any[] };
  mongoQuery?: string;
  isError?: boolean;
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
      store.t('How to connect to MongoDB'),
      store.t('Check server status'),
      store.t('How do I add a new connection?'),
      store.t('How do I edit an existing connection?')
    );
  } else if (route.name === 'Monitoring') {
    suggestions.push(
      store.t('Run DB-Guardian Performance Diagnostic'),
      store.t('Show server status and uptime'),
      store.t('Explain resident vs virtual memory')
    );
  } else if ((route.name === 'DatabaseDashboard' || route.name === 'DatabaseCollections') && db) {
    suggestions.push(
      store.t('Run DB-Guardian Performance Diagnostic'),
      `${store.t('List collections in database')} ${db}`,
      `${store.t('Show database stats for')} ${db}`
    );
  } else if (route.name === 'CollectionView' && db && coll) {
    suggestions.push(
      store.t('Run DB-Guardian Performance Diagnostic'),
      `${store.t('Query first 5 documents in')} ${coll}`,
      `${store.t('List indexes created on')} ${coll}`
    );
  } else if ((route.name === 'DocumentInsert' || route.name === 'DocumentEdit') && db && coll) {
    suggestions.push(
      `${store.t('Show collection details of')} ${coll}`,
      store.t('Explain how to insert a document with ObjectId'),
      `${store.t('Analyze schema of collection')} ${coll}`
    );
  } else if (conn) {
    suggestions.push(
      store.t('Run DB-Guardian Performance Diagnostic'),
      store.t('List databases in this connection'),
      store.t('Show server status & uptime')
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
  store.chatSidebarOpen = !store.chatSidebarOpen;
  if (store.chatSidebarOpen) {
    scrollBottom();
  }
};

// Listen for global command injections (e.g. from Analysis dashboard)
watch(() => store.chatInput, (newCmd) => {
  if (newCmd) {
    inputMsg.value = newCmd;
    // Clear the store input to allow same command re-injection if needed (though unlikely)
    // Actually we keep it so the watcher triggers.
    // If it starts with 'Execute command:' or autoSendNextCommand is true, it's an auto-run.
    if (newCmd.startsWith('Execute command:') || store.autoSendNextCommand) {
      handleSend();
      store.autoSendNextCommand = false;
    }
    // Briefly clear it after a small delay so subsequent clicks work even if it's the same command
    setTimeout(() => {
      store.chatInput = '';
    }, 500);
  }
});

const loadChatHistory = async () => {
  try {
    const res = await axios.get('/api/agent/history');
    historyList.value = res.data.history.map((h: any) => ({
      role: h.role,
      content: h.content,
      chartVisual: h.chartVisual,
      navigation: h.navigation,
      suggestions: h.suggestions,
      databases: h.databases,
      collectionsInfo: h.collectionsInfo,
      documentsResult: h.documentsResult,
      mongoQuery: h.mongoQuery
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
  recognition.lang = 'en-US'; // Defaults to English voice inputs
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

const sendChat = async (userText: string, skipAppendUser = false) => {
  if (thinking.value) return;
  
  if (!skipAppendUser) {
    historyList.value.push({ role: 'user', content: userText });
    scrollBottom();
  }
  
  thinking.value = true;
  
  const currentCtx = {
    currentConnection: store.activeConnection || undefined,
    currentDb: store.activeDb || undefined,
    currentCollection: store.activeColl || undefined,
    currentRoute: route.path,
    currentLocale: store.activeLocale || 'en',
    chartTypeHint: store.chartTypeHint || undefined
  };

  // Clear chartTypeHint after reading it for this run
  store.chartTypeHint = '';

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
    const documentsResult = res.data.documentsResult;

    // Check if response is empty
    if (!assistantMsg || !assistantMsg.trim()) {
      throw new Error('Empty response received from AI.');
    }

    if (suggestions && Array.isArray(suggestions)) {
      currentSuggestions.value = suggestions;
    }

    // Append AI bubble
    const index = historyList.value.push({ 
      role: 'assistant', 
      content: assistantMsg,
      chartVisual: chartData,
      databases: databases,
      collectionsInfo: collectionsInfo,
      documentsResult: documentsResult,
      mongoQuery: res.data.mongoQuery
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
          router.push({
            path: `/${connName}/${navTrigger.db}/${navTrigger.collection}`,
            query: navTrigger.tab ? { tab: navTrigger.tab } : {}
          });
        } else if (navTrigger.db) {
          router.push({
            path: `/${connName}/${navTrigger.db}`,
            query: navTrigger.tab ? { tab: navTrigger.tab } : {}
          });
        }
      }
    }
  } catch (err: any) {
    console.error('AI chat error:', err);
    ElMessage.error(store.t('Failed to communicate with AI Copilot.'));
    
    // Append error/retry assistant bubble
    historyList.value.push({
      role: 'assistant',
      content: store.t('Failed to get response from AI. Please try again.'),
      isError: true
    });
    scrollBottom();
  } finally {
    thinking.value = false;
  }
};

const handleRunProposedQuery = (query: string) => {
  if (!query || thinking.value) return;
  inputMsg.value = `Execute command: ${query}`;
  handleSend();
};

const handleSend = async () => {
  if (showMentionList.value) return;
  if (!inputMsg.value.trim() || thinking.value) return;
  const userText = inputMsg.value.trim();
  inputMsg.value = '';
  await sendChat(userText, false);
};

const sendSuggestion = (text: string) => {
  sendChat(text, false);
};

const handleRetry = async (idx: number) => {
  // Find the corresponding user message
  let userMsgText = '';
  for (let i = idx - 1; i >= 0; i--) {
    if (historyList.value[i].role === 'user') {
      userMsgText = historyList.value[i].content;
      break;
    }
  }

  if (!userMsgText) {
    ElMessage.warning(store.t('No message to retry.'));
    return;
  }

  // Remove the error assistant bubble
  historyList.value.splice(idx, 1);
  
  // Retry sending the message
  await sendChat(userMsgText, true);
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

const copyQueryText = (text: string) => {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success(store.t('Query copied to clipboard!'));
  }).catch(() => {
    ElMessage.error(store.t('Failed to copy'));
  });
};

const SERIES_COLORS = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#9b59b6', '#00c9ff', '#f39c12', '#1abc9c'];

const applyDarkTheme = (option: any): any => {
  const base: Record<string, any> = {
    backgroundColor: 'transparent',
    textStyle: { color: '#ccc' },
    legend: { show: true, textStyle: { color: '#bbb' } },
    tooltip: option.tooltip || { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '8%', containLabel: true, ...option.grid }
  };
  if (option.xAxis) {
    const xArr = Array.isArray(option.xAxis) ? option.xAxis : [option.xAxis];
    const themed = xArr.map((ax: any) => ({
      ...ax,
      axisLabel: { color: '#999', ...ax.axisLabel },
      axisLine: { lineStyle: { color: '#444' }, ...ax.axisLine }
    }));
    base['xAxis'] = themed.length === 1 ? themed[0] : themed;
  }
  if (option.yAxis) {
    const yArr = Array.isArray(option.yAxis) ? option.yAxis : [option.yAxis];
    const themed = yArr.map((ax: any) => ({
      ...ax,
      axisLabel: { color: '#999', ...ax.axisLabel },
      splitLine: { lineStyle: { color: '#282828' }, ...ax.splitLine }
    }));
    base['yAxis'] = themed.length === 1 ? themed[0] : themed;
  }
  if (option.series) {
    base['series'] = (Array.isArray(option.series) ? option.series : [option.series]).map((s: any, i: number) => ({
      smooth: true,
      ...s,
      itemStyle: { color: SERIES_COLORS[i % SERIES_COLORS.length], ...s.itemStyle }
    }));
  }
  return { ...option, ...base };
};

const renderBubbleChart = (bubbleIndex: number, chartSpec: any) => {
  const chartDom = document.getElementById(`chart_${bubbleIndex}`);
  if (!chartDom) return;

  const myChart = echarts.getInstanceByDom(chartDom) || echarts.init(chartDom, 'dark');

  // Detect format: full ECharts option has series as objects with 'type'
  // Legacy agent format has series as array of field-name strings
  const isFullEChartsOption = Array.isArray(chartSpec.series) && chartSpec.series.length > 0 && typeof chartSpec.series[0] === 'object';

  // Case 1: Full ECharts option directly from AI (series is array of objects)
  if (isFullEChartsOption) {
    myChart.setOption(applyDarkTheme(chartSpec));
    return;
  }

  // Case 2: Legacy agent format { type, data, xAxis (string), series (string[]) }
  const chartType = (chartSpec.type || 'bar') as string;
  const isPie = chartType === 'pie' || chartType === 'donut';
  const isRadar = chartType === 'radar';
  const isCartesian = !isPie && !isRadar;

  if (isPie) {
    const xField = chartSpec.xAxis;
    const vField = chartSpec.series?.[0];
    const pieData = (chartSpec.data || []).map((item: any, i: number) => ({
      name: String(item[xField] ?? Object.values(item)[0]),
      value: item[vField] ?? Object.values(item)[1],
      itemStyle: { color: SERIES_COLORS[i % SERIES_COLORS.length] }
    }));

    myChart.setOption(applyDarkTheme({
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      series: [{
        type: 'pie',
        radius: chartType === 'donut' ? ['40%', '70%'] : '65%',
        data: pieData,
        label: { color: '#bbb' }
      }]
    }));
    return;
  }

  if (isCartesian) {
    const baseType = chartType.replace('-stacked', '');
    const stacked = chartType.endsWith('-stacked');
    const categories = (chartSpec.data || []).map((item: any) => String(item[chartSpec.xAxis] ?? ''));
    const seriesKeys: string[] = Array.isArray(chartSpec.series) ? chartSpec.series : [];

    const seriesData = seriesKeys.map((sKey: string, i: number) => ({
      name: sKey,
      type: baseType || 'bar',
      stack: stacked ? 'total' : undefined,
      smooth: baseType === 'line',
      data: (chartSpec.data || []).map((item: any) => item[sKey]),
      itemStyle: {
        color: SERIES_COLORS[i % SERIES_COLORS.length],
        borderRadius: baseType === 'bar' ? [3, 3, 0, 0] : undefined
      }
    }));

    myChart.setOption(applyDarkTheme({
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: categories },
      yAxis: { type: 'value' },
      series: seriesData
    }));
    return;
  }

  // Radar chart
  if (isRadar) {
    const seriesKeys: string[] = Array.isArray(chartSpec.series) ? chartSpec.series : [];
    const indicators = seriesKeys.map((k: string) => ({ name: k }));
    const values = (chartSpec.data || []).map((item: any) => ({
      name: item[chartSpec.xAxis],
      value: seriesKeys.map((k: string) => item[k])
    }));
    myChart.setOption(applyDarkTheme({
      tooltip: {},
      radar: { indicator: indicators },
      series: [{ type: 'radar', data: values }]
    }));
  }
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

onMounted(() => {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target && target.classList.contains('global-copy-btn')) {
      const encodedCode = target.getAttribute('data-code');
      if (encodedCode) {
        try {
          const code = decodeURIComponent(escape(atob(encodedCode)));
          navigator.clipboard.writeText(code).then(() => {
            ElMessage.success(store.t('Copied to clipboard'));
            target.textContent = '✅';
            setTimeout(() => { target.textContent = '📋'; }, 2000);
          });
        } catch (err) {
          console.error('Failed to copy code block', err);
        }
      }
    }
  });
});
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
    min-width: 0;
    max-width: 100%;
  }

  .bubble-text {
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 13px;
    line-height: 1.5;
    word-break: break-word;
    /*white-space: pre-wrap;*/
    max-width: 100%;
    box-sizing: border-box;
  }

  .retry-action-box {
    margin-top: 4px;
    display: flex;
    justify-content: flex-start;
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
  gap: 10px;
  background-color: rgba(18, 20, 32, 0.7);
  border: 1px solid rgba(0, 242, 254, 0.2);
  padding: 8px 16px;
  border-radius: 12px;
  border-top-left-radius: 2px;
  box-shadow: 0 0 15px rgba(0, 242, 254, 0.1);
}

.thinking-pulse {
  width: 8px;
  height: 8px;
  background-color: #00f2fe;
  border-radius: 50%;
  position: relative;
  box-shadow: 0 0 10px #00f2fe;
  animation: thinking-glow 1.5s infinite alternate ease-in-out;

  &::before {
    content: '';
    position: absolute;
    top: -4px;
    left: -4px;
    right: -4px;
    bottom: -4px;
    border: 2px solid #00f2fe;
    border-radius: 50%;
    animation: thinking-ping 1.5s infinite ease-out;
    opacity: 0.7;
  }
}

.thinking-text {
  font-size: 11.5px;
  color: #94a3b8;
  font-style: italic;
  font-weight: 500;
}

@keyframes thinking-glow {
  from { opacity: 0.5; transform: scale(0.85); box-shadow: 0 0 5px #00f2fe; }
  to { opacity: 1; transform: scale(1.1); box-shadow: 0 0 15px #00f2fe; }
}

@keyframes thinking-ping {
  0% { transform: scale(0.5); opacity: 0.8; }
  100% { transform: scale(2.5); opacity: 0; }
}

.input-panel-row {
  padding: 15px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  position: relative;
}

.mention-list-popup {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 20px;
  right: 20px;
  max-height: 220px;
  overflow-y: auto;
  background-color: rgba(15, 23, 42, 0.98);
  border: 1px solid rgba(0, 242, 254, 0.3);
  box-shadow: 0 -8px 24px rgba(0, 242, 254, 0.25);
  border-radius: 8px;
  z-index: 9999;
  padding: 6px 0;
  backdrop-filter: blur(12px);
}

.mention-item {
  display: flex;
  align-items: center;
  padding: 8px 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 13px;
  color: #e2e8f0;
  gap: 8px;
}

.mention-item:hover,
.mention-item.is-active {
  background-color: rgba(0, 242, 254, 0.15);
  color: #00f2fe;
}

.mention-icon {
  font-size: 14px;
}

.mention-label {
  font-weight: 500;
  flex-grow: 1;
}

.mention-detail {
  font-size: 11px;
  color: #94a3b8;
  background-color: rgba(255, 255, 255, 0.05);
  padding: 2px 6px;
  border-radius: 4px;
}

.chat-input-bar {
  border-radius: 10px !important;
}

.append-actions {
  display: flex;
  gap: 5px;
  align-items: center;
}

.context-suggestions-tray {
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 8px 16px;
  gap: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
  scrollbar-width: none;
}
.context-suggestions-tray::-webkit-scrollbar {
  display: none;
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
  max-width: 100%;
  box-sizing: border-box;
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
  overflow-x: auto;
  padding: 10px;
}

.doc-result-wrapper {
  margin-top: 8px;
  border-radius: 8px;
  overflow: hidden;
  max-width: 340px;
  width: 100%;
}

/* Global Markdown Code Blocks */
:deep(.code-block-wrapper) {
  margin: 10px 0;
  border-radius: 8px;
  overflow: hidden;
  background: #1e1e1e;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

:deep(.code-block-header) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

:deep(.code-lang) {
  font-size: 10px;
  color: #94a3b8;
  text-transform: uppercase;
  font-weight: 600;
  font-family: 'Fira Code', monospace;
}

:deep(.global-copy-btn) {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
  border-radius: 4px;
  transition: all 0.2s;
}

:deep(.global-copy-btn:hover) {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

:deep(.code-block-wrapper pre) {
  margin: 0;
  padding: 12px;
  overflow-x: auto;
}

:deep(.code-block-wrapper code) {
  font-family: 'Fira Code', monospace;
  font-size: 11.5px;
  color: #e2e8f0;
}

/* Chart Query Inspector */
.msg-chart-item-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
  width: 100%;
  max-width: 340px;
}

.chart-query-inspector {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(0, 242, 254, 0.15);
  border-radius: 6px;
  overflow: hidden;
}

.inspector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 10px;
  cursor: pointer;
  user-select: none;
  &:hover { background: rgba(0, 242, 254, 0.05); }
}

.header-left {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: #94a3b8;
  .icon { color: var(--el-color-primary) }
}

.run-query-btn {
  padding: 2px 8px !important;
  font-size: 11px !important;
  height: 22px !important;
  border-radius: 4px !important;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
  border: none !important;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
  
  &:hover {
    transform: scale(1.05);
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.4);
    filter: brightness(1.1);
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mini-copy-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 4px;
  font-size: 11px;
  opacity: 0.6;
  &:hover { opacity: 1; }
}

.chevron {
  color: #94a3b8;
  font-size: 14px;
  transition: transform 0.2s;
  display: inline-block;
  &.is-open { transform: rotate(90deg); }
}

.inspector-body {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding: 6px 10px;
  max-height: 120px;
  overflow-y: auto;
  pre {
    margin: 0;
    font-size: 10.5px;
    color: #38bdf8;
    white-space: pre-wrap;
    word-break: break-all;
    font-family: 'Fira Code', monospace;
  }
}
</style>
