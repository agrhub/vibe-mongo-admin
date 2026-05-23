<template>
  <el-dialog 
    v-model="visible" 
    :title="isEditMode ? store.t('Edit Connection') : store.t('Add Connection')" 
    width="500px"
  >
    <el-form :model="connForm" label-position="top">
      <el-form-item :label="store.t('Connection Name')" required>
        <el-input v-model="connForm.name" placeholder="e.g. Production_DB" :disabled="isEditMode" />
      </el-form-item>

      <el-form-item :label="store.t('Connection String')" required>
        <el-input 
          v-model="connForm.string" 
          type="textarea" 
          :rows="3" 
          placeholder="mongodb://username:password@localhost:27017/database" 
        />
      </el-form-item>

      <el-form-item :label="store.t('Connection Options (JSON)')" v-if="!isEditMode">
        <el-input 
          v-model="connForm.options" 
          type="textarea" 
          :rows="3" 
          placeholder='{ "ssl": true, "replicaSet": "mySet" }'
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="visible = false" round>{{ store.t('Cancel') }}</el-button>
        <el-button type="primary" round @click="saveConnection" :loading="saving">{{ store.t('Save') }}</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue';
import { store } from '../../stores';
import { ElMessage } from 'element-plus';
import axios from 'axios';

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  editData: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['update:modelValue', 'saved']);

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const isEditMode = ref(false);
const saving = ref(false);

const connForm = reactive({
  name: '',
  string: '',
  options: '{}',
  curr_config: ''
});

watch(() => props.editData, (newVal) => {
  if (newVal) {
    isEditMode.value = true;
    connForm.name = newVal.name || '';
    connForm.string = newVal.config?.connection_string || '';
    connForm.options = JSON.stringify(newVal.config?.connection_options || {});
    connForm.curr_config = newVal.name || '';
  } else {
    isEditMode.value = false;
    connForm.name = '';
    connForm.string = '';
    connForm.options = '{}';
    connForm.curr_config = '';
  }
}, { immediate: true });

const saveConnection = async () => {
  if (!connForm.name || !connForm.string) {
    ElMessage.error(store.t('Connection name and connection string are required'));
    return;
  }

  saving.value = true;
  try {
    if (isEditMode.value) {
      // Edit mode
      await axios.post('/api/connections/update', {
        curr_config: connForm.curr_config,
        conn_name: connForm.name,
        conn_string: connForm.string
      });
      ElMessage.success(store.t('Connection successfully updated'));
    } else {
      // Add mode
      await axios.post('/api/connections/add', {
        name: connForm.name,
        string: connForm.string,
        options: connForm.options
      });
      ElMessage.success(store.t('Connection successfully added'));
    }
    visible.value = false;
    emit('saved');
  } catch (e) {
    const msg = e.response && e.response.data && e.response.data.msg 
      ? e.response.data.msg 
      : store.t('Error saving connection');
    ElMessage.error(msg);
  } finally {
    saving.value = false;
  }
};
</script>
