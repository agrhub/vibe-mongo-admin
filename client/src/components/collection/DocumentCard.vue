<template>
  <el-card class="doc-card">
    <div class="doc-card-header">
      <div class="doc-id-box">
        <el-tag type="info" size="small" effect="plain">_id</el-tag>
        <span class="doc-id-val">{{ formatDocId(doc._id) }}</span>
      </div>
      <div class="doc-action-box">
        <el-tooltip :content="store.t('Copy (without _id, for duplication)')" placement="top">
          <el-button
            type="primary"
            link
            :icon="CopyDocument"
            @click="copyDocWithoutId"
          />
        </el-tooltip>
        <el-button
          type="primary"
          link
          :icon="Edit"
          @click="$router.push(`/${store.activeConnection}/${store.activeDb}/${store.activeColl}/edit/${formatDocIdRaw(doc._id)}`)"
        >
          {{ store.t('Edit') }}
        </el-button>
        <el-button
          type="danger"
          link
          :icon="Delete"
          @click="handleDelete"
        >
          {{ store.t('Delete') }}
        </el-button>
      </div>
    </div>

    <div class="doc-card-body">
      <pre class="json-code">{{ formatDocContent(doc) }}</pre>

      <!-- Inline Media Previews -->
      <div class="media-previews-container" v-if="hasMedia">
        <div v-for="img in mediaImages" :key="img.field" class="media-preview-item">
          <div class="media-preview-lbl">{{ img.field }}</div>
          <el-image
            :src="img.src"
            class="embedded-preview-img"
            fit="cover"
            :preview-src-list="[img.src]"
            preview-teleported
          />
        </div>
        <div v-for="aud in mediaAudios" :key="aud.field" class="media-preview-item media-full-width">
          <div class="media-preview-lbl">{{ aud.field }}</div>
          <audio controls :src="aud.src" class="embedded-preview-audio"></audio>
        </div>
        <div v-for="vid in mediaVideos" :key="vid.field" class="media-preview-item">
          <div class="media-preview-lbl">{{ vid.field }}</div>
          <video controls :src="vid.src" class="embedded-preview-video"></video>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { store } from '../../stores';
import { CopyDocument, Edit, Delete } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';

const props = defineProps({
  doc: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['delete']);

const router = useRouter();

// ── Formatting helpers ──────────────────────────────────────────
const formatDocId = (id) => {
  if (id === null || id === undefined) return '';
  if (typeof id === 'object') return id.toString();
  return id;
};

const formatDocIdRaw = (id) => {
  if (id === null || id === undefined) return '';
  if (id.$oid) return id.$oid;
  if (typeof id === 'object') return id.toString();
  return id;
};

const formatDocContent = (doc) => JSON.stringify(doc, null, 2);

// ── Clipboard ───────────────────────────────────────────────────
// Copy full document as-is (raw clone)
const copyDocToClipboard = () => {
  navigator.clipboard.writeText(JSON.stringify(props.doc, null, 2));
  ElMessage.success(store.t('Document copied to clipboard'));
};

// Copy without _id so pasting into Insert form creates a brand-new document
const copyDocWithoutId = () => {
  const { _id, ...rest } = props.doc;
  navigator.clipboard.writeText(JSON.stringify(rest, null, 2));
  ElMessage.success(store.t('Copied without _id — paste into Insert form to duplicate'));
};


// ── Delete ──────────────────────────────────────────────────────
const handleDelete = () => {
  ElMessageBox.confirm(
    store.t('Delete this document? This action cannot be undone.'),
    store.t('Warning'),
    {
      confirmButtonText: store.t('Delete'),
      cancelButtonText: store.t('Cancel'),
      type: 'warning'
    }
  ).then(() => {
    emit('delete', formatDocIdRaw(props.doc._id));
  }).catch(() => {});
};

// ── Inline media ────────────────────────────────────────────────
const hasMedia = computed(() =>
  Object.values(props.doc).some(
    v => typeof v === 'string' && (v.startsWith('data:image') || v.startsWith('data:audio') || v.startsWith('data:video'))
  )
);

const mediaImages = computed(() =>
  Object.entries(props.doc)
    .filter(([, v]) => typeof v === 'string' && v.startsWith('data:image'))
    .map(([field, src]) => ({ field, src }))
);

const mediaAudios = computed(() =>
  Object.entries(props.doc)
    .filter(([, v]) => typeof v === 'string' && v.startsWith('data:audio'))
    .map(([field, src]) => ({ field, src }))
);

const mediaVideos = computed(() =>
  Object.entries(props.doc)
    .filter(([, v]) => typeof v === 'string' && v.startsWith('data:video'))
    .map(([field, src]) => ({ field, src }))
);
</script>

<style scoped>
.doc-card {
  margin-bottom: 1.5rem;
  border-radius: var(--radius-sm) !important;
}

.doc-card:hover {
  transform: none !important;
}

.doc-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.75rem;
  margin-bottom: 1rem;
}

.doc-id-box {
  display: flex;
  align-items: center;
  gap: 8px;
}

.doc-id-val {
  font-family: monospace;
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.doc-action-box {
  display: flex;
  align-items: center;
  gap: 8px;
}

.doc-card-body {
  position: relative;
}

.json-code {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 1rem;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 100px;
  overflow-y: auto;
}

.media-previews-container {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  margin-top: 1rem;
  padding: 1rem;
  background: var(--bg-primary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.media-preview-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--bg-secondary);
  padding: 8px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  max-width: 260px;
}

.media-full-width {
  max-width: 100%;
  width: 100%;
}

.media-preview-lbl {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
}

.embedded-preview-img {
  width: 240px;
  height: 135px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  cursor: pointer;
}

.embedded-preview-audio {
  width: 100%;
  height: 40px;
}

.embedded-preview-video {
  width: 240px;
  height: 135px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  background: #000;
}
</style>
