<template>
  <div class="input-panel-row">
    <!-- Context-aware suggestion tray (shown when chat has messages) -->
    <div v-if="hasSuggestions" class="context-suggestions-tray">
      <el-button
        v-for="sugg in suggestions"
        :key="sugg"
        type="primary" round text bg size="small"
        @click="emit('send-suggestion', store.t(sugg))"
      >
        {{ store.t(sugg) }}
      </el-button>
    </div>

    <!-- @mention autocomplete popup -->
    <div v-if="showMentionList && mentionOptions.length > 0" class="mention-list-popup">
      <div
        v-for="(opt, idx) in mentionOptions"
        :key="idx"
        class="mention-item"
        :class="{ 'is-active': idx === mentionActiveIndex }"
        @mousedown.prevent="emit('select-mention', opt)"
      >
        <span class="mention-icon">{{ opt.type === 'db' ? '📁' : (opt.type === 'coll' ? '📄' : '🏷️') }}</span>
        <span class="mention-label">{{ opt.label }}</span>
        <span class="mention-detail">{{ opt.detail }}</span>
      </div>
    </div>

    <!-- Input field -->
    <el-input
      ref="inputRef"
      :model-value="modelValue"
      :placeholder="store.t('Type instructions ...')"
      class="chat-input-bar"
      @update:model-value="emit('update:modelValue', $event)"
      @input="emit('input', $event)"
      @keydown="emit('keydown', $event)"
      @blur="emit('blur')"
    >
      <template #prepend>
        <el-button
          :type="listening ? 'danger' : 'info'"
          circle icon="Microphone"
          @click="emit('toggle-voice')"
        />
      </template>
      <template #append>
        <el-button circle icon="Promotion" @click="emit('send')" />
      </template>
    </el-input>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { store } from '../../stores';

defineProps<{
  modelValue: string;
  listening: boolean;
  hasSuggestions: boolean;
  suggestions: string[];
  showMentionList: boolean;
  mentionOptions: any[];
  mentionActiveIndex: number;
}>();

const emit = defineEmits([
  'update:modelValue', 'input', 'keydown', 'blur',
  'send', 'toggle-voice', 'send-suggestion', 'select-mention'
]);

const inputRef = ref<any>(null);
defineExpose({ inputRef });
</script>

<style scoped lang="scss">
.input-panel-row {
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: relative;
}

.context-suggestions-tray {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding-bottom: 0.25rem;
}

.mention-list-popup {
  position: absolute;
  bottom: 100%;
  left: 1rem;
  right: 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 -4px 16px rgba(0,0,0,0.2);
  max-height: 220px;
  overflow-y: auto;
  z-index: 100;
}

.mention-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition: background 0.15s;
  font-size: 0.85rem;

  &:hover, &.is-active { background: rgba(64, 158, 255, 0.08); }
}

.mention-icon { font-size: 1rem; }
.mention-label { font-weight: 600; color: var(--text-primary); }
.mention-detail { font-size: 0.75rem; color: var(--text-muted); margin-left: auto; }

.chat-input-bar {
  width: 100%;
  :deep(.el-input__wrapper) { border-radius: 0 8px 8px 0 !important; }
}
</style>
