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
              type="danger" circle text bg icon="RefreshLeft"
              :title="store.t('Clear Chat Logs')"
              @click="handleClearChat"
            />
            <el-button
              type="primary" circle text bg icon="Close"
              :title="store.t('Close')"
              @click="toggleSidebar"
            />
          </div>
        </div>

        <!-- Message List -->
        <ChatMessageList
          ref="messageListRef"
          :messages="historyList"
          :suggestions="currentSuggestions"
          :thinking="thinking"
          @send-suggestion="sendSuggestion"
          @speak="speakText"
          @navigate-db="handleNavigateDb"
          @navigate-coll="handleNavigateColl"
          @copy-query="copyQueryText"
          @run-query="handleRunProposedQuery"
          @view-trace="(id) => $router.push(`/${store.activeConnection}/monitoring?traceId=${id}`)"
          @retry="handleRetry"
        />

        <!-- Input Bar -->
        <ChatInputBar
          v-model="inputMsg"
          :listening="listening"
          :has-suggestions="historyList.length > 0 && currentSuggestions.length > 0"
          :suggestions="currentSuggestions"
          :show-mention-list="showMentionList"
          :mention-options="mentionOptions"
          :mention-active-index="mentionActiveIndex"
          @input="handleInput"
          @keydown="handleInputKeydown"
          @blur="handleBlur"
          @send="handleSend"
          @toggle-voice="toggleVoiceListening"
          @send-suggestion="sendSuggestion"
          @select-mention="selectMention"
        />
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted, computed, reactive } from 'vue';
import { store } from '../../stores';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import axios from 'axios';
import * as echarts from 'echarts';
import { buildChartOption } from '../../utils/chartBuilder';
import ChatMessageList from './ChatMessageList.vue';
import ChatInputBar from './ChatInputBar.vue';

const localeVoiceMap: Record<string, string> = {
  'vn': 'vi-VN',
  'vi': 'vi-VN',
  'en': 'en-US',
  'es': 'es-ES',
  'de': 'de-DE',
  'ru': 'ru-RU',
  'fa': 'fa-IR',
  'fr': 'fr-FR',
  'ja': 'ja-JP',
  'zh': 'zh-CN',
  'ko': 'ko-KR'
};


const route = useRoute();
const router = useRouter();

const inputMsg = ref('');
const thinking = ref(false);
const listening = ref(false);

const showMentionList = ref(false);
const mentionQuery = ref('');
const mentionStartIndex = ref(-1);
const mentionActiveIndex = ref(0);

const schemaFieldsCache = reactive<Record<string, Array<{ type: 'field'; label: string; value: string; detail: string }>>>({});

const mentionOptions = computed(() => {
  const query = mentionQuery.value.toLowerCase().trim();
  const list: Array<{ type: 'db' | 'coll' | 'field'; label: string; value: string; detail?: string }> = [];
  
  if (!store.sidebarList) return list;

  // Add fields if query has dots
  if (query.includes('.')) {
    const parts = query.split('.');
    
    // 1. collection.field (using activeDb)
    if (parts.length === 2 && store.activeDb) {
      const collName = parts[0];
      const fieldQuery = parts[1];
      const cacheKey = `${store.activeDb}.${collName}`.toLowerCase();
      
      if (schemaFieldsCache[cacheKey]) {
        for (const field of schemaFieldsCache[cacheKey]) {
          if (!fieldQuery || field.label.toLowerCase().includes(fieldQuery)) {
            list.push({
              type: 'field',
              label: field.label,
              value: `@${collName}.${field.label}`,
              detail: `${field.detail} (in ${collName})`
            });
          }
        }
      }
    }
    
    // 2. db.collection.field
    if (parts.length === 3) {
      const dbName = parts[0];
      const collName = parts[1];
      const fieldQuery = parts[2];
      const cacheKey = `${dbName}.${collName}`.toLowerCase();
      
      if (schemaFieldsCache[cacheKey]) {
        for (const field of schemaFieldsCache[cacheKey]) {
          if (!fieldQuery || field.label.toLowerCase().includes(fieldQuery)) {
            list.push({
              type: 'field',
              label: field.label,
              value: `@${dbName}.${collName}.${field.label}`,
              detail: `${field.detail} (in ${collName})`
            });
          }
        }
      }
    }
  }

  // 1. Add databases (if no dot)
  if (!query.includes('.')) {
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
  }
  
  // 2. Add collections
  for (const [db, colls] of Object.entries(store.sidebarList)) {
    const collections = colls as string[];
    for (const coll of collections) {
      const fullLabel = `${db}.${coll}`;
      if (!query || coll.toLowerCase().includes(query) || fullLabel.toLowerCase().includes(query)) {
        // If they type db.coll, we should suggest the collection too, so value = db.coll
        list.push({
          type: 'coll',
          label: coll,
          value: query.includes('.') ? `@${db}.${coll}` : `@${coll}`,
          detail: db
        });
      }
    }
  }
  
  return list.slice(0, 15);
});

const handleInput = (val: string) => {
  // Approximate cursor at end of string (full string value)
  const selectionStart = val.length;
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
        
        // Fetch schema fields if querying db.coll or coll.
        if (textAfterAt.includes('.')) {
          const parts = textAfterAt.split('.');
          let dbToFetch = '';
          let collToFetch = '';
          
          if (parts.length >= 2) {
             const firstPart = parts[0];
             const secondPart = parts[1];
             if (store.sidebarList && (store.sidebarList as any)[firstPart] && (store.sidebarList as any)[firstPart].includes(secondPart)) {
               dbToFetch = firstPart;
               collToFetch = secondPart;
             } else if (store.activeDb) {
               dbToFetch = store.activeDb;
               collToFetch = firstPart;
             }
          }
          
          if (dbToFetch && collToFetch) {
            const cacheKey = `${dbToFetch}.${collToFetch}`.toLowerCase();
            if (!schemaFieldsCache[cacheKey]) {
              schemaFieldsCache[cacheKey] = []; // initialize to prevent duplicate fetches
              axios.get(`/api/${store.activeConnection}/${dbToFetch}/${collToFetch}/schema`)
                .then(res => {
                  if (res.data && res.data.fields) {
                    schemaFieldsCache[cacheKey] = res.data.fields.map((f: any) => ({
                      type: 'field',
                      label: f.field,
                      value: `@${dbToFetch}.${collToFetch}.${f.field}`,
                      detail: f.type
                    }));
                  }
                })
                .catch(err => {
                   console.error('Error fetching schema for autocomplete:', err);
                });
            }
          }
        }
        
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

const selectMention = (option: { type: 'db' | 'coll' | 'field'; label: string; value: string; detail?: string }) => {
  const text = inputMsg.value;
  const start = mentionStartIndex.value;
  const cursorIdx = text.length;
  
  const insertedText = option.value + ' ';
  
  const beforeMention = text.substring(0, start);
  const afterMention = text.substring(cursorIdx);
  
  inputMsg.value = beforeMention + insertedText + afterMention;
  
  showMentionList.value = false;
  mentionStartIndex.value = -1;
  mentionQuery.value = '';
  
  nextTick(() => {
    // Focus is handled by ChatInputBar internally
  });
};

const handleBlur = () => {
  setTimeout(() => {
    showMentionList.value = false;
  }, 200);
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
  traceResult?: { traceId: string; [key: string]: any };
  isError?: boolean;
}

const historyList = ref<LocalMessage[]>([]);
const messageListRef = ref<any>(null);

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
      store.t('Evaluate recent slow trace with AI Judge'),
      store.t('Check security status of active connection')
    );
  } else if ((route.name === 'DatabaseDashboard' || route.name === 'DatabaseCollections') && db) {
    suggestions.push(
      store.t('Run DB-Guardian Performance Diagnostic'),
      store.t('Check security status of active connection'),
      `${store.t('List collections in database')} ${db}`
    );
  } else if (route.name === 'CollectionView' && db && coll) {
    suggestions.push(
      store.t('Run DB-Guardian Performance Diagnostic'),
      store.t('Evaluate recent slow trace with AI Judge'),
      `${store.t('Query first 5 documents in')} ${coll}`
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
      store.t('Evaluate recent slow trace with AI Judge'),
      store.t('List databases in this connection')
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
  
  // Dynamically detect and set microphone recognition language based on active locale
  const userLocale = (store.activeLocale || 'en').toLowerCase();
  recognition.lang = localeVoiceMap[userLocale] || userLocale;
  
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
    if (navTrigger && route.name !== 'Monitoring') {
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
  const chartType = (chartSpec.type || 'bar').replace('-stacked', '') as string;
  const spec = {
    title: chartSpec.title || '',
    chartType: chartType,
    labelField: chartSpec.xAxis,
    valueField: Array.isArray(chartSpec.series) ? chartSpec.series[0] : chartSpec.series
  };

  const option = buildChartOption(spec, chartSpec.data || [], true);
  myChart.setOption(applyDarkTheme(option));
};


const scrollBottom = () => {
  nextTick(() => {
    const el = messageListRef.value?.messageBox;
    if (el) {
      el.scrollTop = el.scrollHeight;
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

// ---- Text-to-Speech (TTS) ----

function speakText(text: string) {
  if (!text) return;
  // Clean markdown syntax, navigation tags, query tags, and html tags to make it sound natural
  const cleanText = text
    .replace(/\[NAVIGATION\][\s\S]*?\[\/NAVIGATION\]/gi, '')
    .replace(/\[QUERY\][\s\S]*?\[\/QUERY\]/gi, '')
    .replace(/<[^>]*>/g, '') // remove HTML tags
    .replace(/[*#`_\-]/g, '') // remove markdown symbols
    .trim();
  
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel(); // cancel current speech
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Dynamically match voice language based on user's active locale
    const userLocale = (store.activeLocale || 'en').toLowerCase();
    utterance.lang = localeVoiceMap[userLocale] || userLocale;
    
    window.speechSynthesis.speak(utterance);
  } else {
    ElMessage.warning(store.t('Speech synthesis is not supported in this browser.'));
  }
}
</script>

<style scoped lang="scss">
.agent-chat-wrapper {
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  width: 0;
  z-index: 9999;
  
  &.is-open {
    width: 400px;
    border-left: 1px solid var(--border-color);
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
  // z-index: 9999;
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
    color: var(--el-color-primary);
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    
    &:hover {
      background-color: var(--el-color-primary-light-9);
      border-color: var(--el-color-primary-light-5);
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
      background-color: var(--el-color-primary);
      color: var(--el-color-white);
      border-top-right-radius: 2px;
    }
  }

  &.assistant {
    align-self: flex-start;
    
    .bubble-text {
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      border-top-left-radius: 2px;
    }
  }
}

.msg-chart-container {
  width: 280px;
  height: 180px;
  background-color: var(--bg-primary);
  border-radius: 10px;
  border: 1px solid var(--border-color);
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
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  padding: 8px 16px;
  border-radius: 12px;
  border-top-left-radius: 2px;
  box-shadow: 0 0 15px var(--border-color);
}

.thinking-pulse {
  width: 8px;
  height: 8px;
  background-color: var(--color-brand);
  border-radius: 50%;
  position: relative;
  box-shadow: 0 0 10px var(--color-brand);
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
  color: var(--text-primary);
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
  border-top: 1px solid var(--border-color);
  background-color: var(--bg-primary);
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
  border-top: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
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
  color: var(--el-color-primary);
  padding: 2px 4px;
  background-color: var(--bg-secondary);
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
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}
.db-header-label {
  font-size: 11.5px;
  color: var(--text-primary);
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
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
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
  border-top: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
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

.trace-alert-banner {
  background-color: rgba(14, 165, 233, 0.1) !important;
  border: 1px solid rgba(14, 165, 233, 0.2);
  margin-top: 10px;
}
.trace-alert-banner :deep(.el-alert__title) {
  color: #38bdf8 !important;
}
</style>
