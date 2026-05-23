<template>
  <div class="document-editor-view page-body" v-loading="loading">
    <div class="editor-header-row">
      <div>
        <h2 class="section-title">
          <el-icon class="title-icon"><EditPen v-if="isEdit" /><Plus v-else /></el-icon>
          {{ isEdit ? store.t('Edit Document') : store.t('Insert New Document') }}
        </h2>
        <p class="section-desc">
          {{ store.activeConnection }} — {{ store.activeDb }} — {{ store.activeColl }}
          <template v-if="isEdit"> — _id: <span class="doc-id-lbl">{{ docId }}</span></template>
        </p>
      </div>
      <div class="header-action-group">
        <el-button @click="goBack" round>{{ store.t('Cancel') }}</el-button>
        <el-button type="primary" round :icon="DocumentChecked" @click="handleSave" :loading="saving">
          {{ store.t('Save Document') }}
        </el-button>
      </div>
    </div>

    <!-- Master Editor Layout split into Editor vs Dynamic Media Live Previews -->
    <el-row :gutter="24" class="editor-layout-row">
      <!-- Left: BSON input editor -->
      <el-col :xs="24" :lg="mediaPreviews.length > 0 ? 15 : 24" class="editor-col">
        <el-card class="editor-card">
          <template #header>
            <div class="card-header-lbl">
              <span>{{ store.t('BSON Document Editor') }}</span>
              <el-tag v-if="!isEdit" type="info" size="small">{{ store.t('Supports single document or array insertMany') }}</el-tag>
            </div>
          </template>
          
          <div class="editor-input-box">
            <el-input
              v-model="documentBson"
              type="textarea"
              :rows="18"
              class="bson-monospace-textarea"
              placeholder='{\n    "name": "Product Name",\n    "price": 299.99,\n    "status": "active"\n}'
              @input="parseLivePreviews"
            />
          </div>

          <div class="editor-help-box">
            <el-icon><InfoFilled /></el-icon>
            <p>{{ store.t('Uses Extended JSON. Wrap objects like ObjectId("...") or ISODate("...") standard BSON shell helpers.') }}</p>
          </div>
        </el-card>
      </el-col>

      <!-- Right: Live AI Media Extractor previews (Stunning dynamic premium visual detail!) -->
      <el-col :xs="24" :lg="9" class="previews-col" v-if="mediaPreviews.length > 0">
        <el-card class="previews-card">
          <template #header>
            <div class="card-header-lbl">
              <el-icon class="preview-icon-header"><Picture /></el-icon>
              <span>{{ store.t('Live Media Previews') }}</span>
            </div>
          </template>

          <div class="previews-list">
            <div v-for="item in mediaPreviews" :key="item.id" class="preview-item-card">
              <div class="preview-meta">
                <el-tag size="small" type="success" effect="plain">{{ item.type.toUpperCase() }}</el-tag>
                <span class="preview-id-lbl">{{ item.id }}</span>
              </div>

              <!-- Media render -->
              <div class="preview-render-viewport">
                <el-image 
                  v-if="item.type === 'image'"
                  :src="item.src"
                  class="preview-img-box"
                  fit="contain"
                  :preview-src-list="[item.src]"
                  preview-teleported
                />
                <audio 
                  v-else-if="item.type === 'audio'"
                  controls
                  :src="item.src"
                  class="preview-audio-box"
                />
                <video 
                  v-else-if="item.type === 'video'"
                  controls
                  :src="item.src"
                  class="preview-video-box"
                />
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { store } from '../stores';
import { EditPen, Plus, DocumentChecked, InfoFilled, Picture } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import axios from 'axios';

const props = defineProps({
  isEdit: {
    type: Boolean,
    default: false
  }
});

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const saving = ref(false);

const documentBson = ref('{\n    \n}');
const docId = ref('');

// Live media previews state
const mediaPreviews = ref([]);

onMounted(() => {
  loadDocument();
});

async function loadDocument() {
  if (!props.isEdit) {
    // Insert mode: blank skeleton template
    documentBson.value = '{\n    "name": "Sample Product",\n    "price": 99.99,\n    "status": "available",\n    "created_at": ISODate("' + new Date().toISOString() + '")\n}';
    parseLivePreviews();
    return;
  }
  
  // Edit mode: fetch doc from backend
  const conn = route.params.conn;
  const db = route.params.db;
  const coll = route.params.coll;
  const id = route.params.id;
  
  if (!conn || !db || !coll || !id) return;
  
  loading.value = true;
  try {
    const res = await axios.get(`/api/${conn}/${db}/${coll}/document/${id}`);
    documentBson.value = res.data.doc || '';
    docId.value = id;
    parseLivePreviews();
  } catch (e) {
    ElMessage.error(store.t('Error loading document from database'));
    goBack();
  } finally {
    loading.value = false;
  }
}

const goBack = () => {
  router.push(`/${store.activeConnection}/${store.activeDb}/${store.activeColl}`);
};

// ================= DYNAMIC LIVE MEDIA PREVIEWS EXTRACTOR =================

const parseLivePreviews = () => {
  const text = documentBson.value;
  if (!text) {
    mediaPreviews.value = [];
    return;
  }

  // Regex to extract base64 standard media strings (like data:image/png;base64,...)
  const mediaRegex = /"data:(image|audio|video)\/([^;]+);base64,([^"]+)"/g;
  const matches = [];
  let match;
  
  // We also try to locate the field key immediately preceding it
  // e.g. "image_data": "data:image..."
  let count = 0;
  while ((match = mediaRegex.exec(text)) !== null && count < 6) {
    const type = match[1]; // image, audio, video
    const format = match[2]; // png, mp3, mp4, etc.
    const base64Str = match[0].slice(1, -1); // strip quotes
    
    // Find preceding key name in editor text (rough check)
    const matchIndex = match.index;
    const preText = text.substring(0, matchIndex);
    const keyMatch = preText.match(/"([^"]+)"\s*:\s*$/);
    const fieldKey = keyMatch ? keyMatch[1] : `field_media_${count + 1}`;

    matches.push({
      id: fieldKey,
      type: type,
      src: base64Str
    });
    count++;
  }
  
  mediaPreviews.value = matches;
};

// ================= SAVE ACTIONS =================

const handleSave = async () => {
  if (!documentBson.value) {
    ElMessage.error(store.t('Document BSON content cannot be empty'));
    return;
  }
  
  saving.value = true;
  const conn = route.params.conn;
  const db = route.params.db;
  const coll = route.params.coll;
  
  try {
    if (props.isEdit) {
      // Edit save
      const res = await axios.post(`/api/${conn}/${db}/${coll}/document/edit`, {
        objectData: documentBson.value
      });
      ElMessage.success(res.data.msg || store.t('Document successfully saved'));
    } else {
      // Insert save
      const res = await axios.post(`/api/${conn}/${db}/${coll}/document/insert`, {
        objectData: documentBson.value
      });
      ElMessage.success(res.data.msg || store.t('Document successfully inserted'));
    }
    goBack();
  } catch(e) {
    const msg = e.response && e.response.data && e.response.data.msg 
      ? e.response.data.msg 
      : store.t('Syntax Error: Please check BSON syntax validation');
    ElMessage.error(msg);
  } finally {
    saving.value = false;
  }
};
</script>

<style scoped>
.document-editor-view {
  background: var(--bg-primary);
}

.editor-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.section-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.03em;
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-icon {
  color: var(--color-brand);
}

.section-desc {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
}

.doc-id-lbl {
  font-family: monospace;
  font-weight: 700;
  color: var(--text-primary);
}

.header-action-group {
  display: flex;
  gap: 12px;
}

.editor-layout-row {
  margin-top: 1rem;
}

.editor-col, .previews-col {
  margin-bottom: 2rem;
}

.editor-card {
  border-radius: var(--radius-sm) !important;
}

.card-header-lbl {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 1rem;
}

.editor-input-box {
  margin-bottom: 1.5rem;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

/* Monospace textarea style for raw BSON editing */
.bson-monospace-textarea :deep(.el-textarea__inner) {
  font-family: 'Courier New', Courier, monospace !important;
  font-size: 0.9rem !important;
  line-height: 1.6 !important;
  background: #1e293b !important; /* Premium dark slate editor background */
  color: #f8fafc !important;
  padding: 1.5rem !important;
  outline: none !important;
  border: none !important;
}

.editor-help-box {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: var(--bg-primary);
  padding: 1rem;
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.editor-help-box .el-icon {
  font-size: 1.25rem;
  color: var(--color-brand);
  margin-top: 2px;
}

.editor-help-box p {
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* Previews panel styles */
.previews-card {
  border-radius: var(--radius-sm) !important;
  max-height: 80vh;
  overflow-y: auto;
}

.preview-icon-header {
  color: var(--color-brand);
  margin-right: 8px;
}

.previews-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.preview-item-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.preview-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-id-lbl {
  font-size: 0.75rem;
  font-weight: 700;
  font-family: monospace;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-render-viewport {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.preview-img-box {
  width: 100%;
  height: 160px;
  border-radius: 4px;
}

.preview-audio-box {
  width: 100%;
}

.preview-video-box {
  width: 100%;
  height: 160px;
  background: #000;
  border-radius: 4px;
}
</style>
