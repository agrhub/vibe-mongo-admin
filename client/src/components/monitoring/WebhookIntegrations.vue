<template>
  <div class="webhook-integrations-comp" v-loading="loading">
    <el-row :gutter="20">
      <!-- Left side: Webhook configuration panel -->
      <el-col :xs="24" :md="14">
        <el-card class="integration-card">
          <template #header>
            <div class="card-header-row" style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
              <span class="card-title" style="display: flex; align-items: center; gap: 8px;">
                <el-icon class="title-icon"><Cpu /></el-icon>
                AI Autopilot Alert Channels (Webhooks & Email)
              </span>
              <div class="active-switch-wrapper" style="display: flex; align-items: center; gap: 8px;">
                <span class="switch-label" style="font-size: 0.8rem; font-weight: 500; color: #a3a3a3;">
                  {{ (savedUrl || savedEmail) ? 'Alerts Enabled' : 'Alerts Disabled' }}
                </span>
                <el-switch
                  :model-value="!!(savedUrl || savedEmail)"
                  active-color="#13ce66"
                  inactive-color="#494949"
                  @change="handleToggleActive"
                />
              </div>
            </div>
          </template>

          <el-form label-position="top" size="small" class="webhook-form">
            <el-form-item :label="store.t('Webhook Target URL')">
              <el-input
                v-model="webhookUrl"
                placeholder="https://discord.com/api/webhooks/... or https://hooks.slack.com/services/..."
                clearable
              />
            </el-form-item>

            <el-form-item :label="store.t('Email Target Address')">
              <el-input
                v-model="emailAddress"
                placeholder="sre-alerts@company.com, developer@company.com"
                clearable
              />
            </el-form-item>

            <!-- SMTP Server Settings Expansion -->
            <div class="smtp-config-section">
              <div class="section-divider" @click="showSmtpSettings = !showSmtpSettings">
                <span class="divider-label">
                  <el-icon class="divider-icon"><Setting /></el-icon>
                  SMTP Mail Server Configuration
                </span>
                <el-icon :class="['arrow-icon', { rotated: showSmtpSettings }]"><ArrowRight /></el-icon>
              </div>

              <transition name="slide-fade">
                <div v-if="showSmtpSettings" class="smtp-inputs-container">
                  <el-row :gutter="12">
                    <el-col :xs="24" :sm="16">
                      <el-form-item :label="store.t('SMTP Host')">
                        <el-input v-model="smtpHost" placeholder="smtp.gmail.com or mail.company.com" />
                      </el-form-item>
                    </el-col>
                    <el-col :xs="24" :sm="8">
                      <el-form-item :label="store.t('SMTP Port')">
                        <el-input-number v-model="smtpPort" :min="1" :max="65535" style="width: 100%" />
                      </el-form-item>
                    </el-col>
                  </el-row>

                  <el-row :gutter="12">
                    <el-col :xs="24" :sm="12">
                      <el-form-item :label="store.t('SMTP Username')">
                        <el-input v-model="smtpUser" placeholder="username@gmail.com" />
                      </el-form-item>
                    </el-col>
                    <el-col :xs="24" :sm="12">
                      <el-form-item :label="store.t('SMTP Password')">
                        <el-input v-model="smtpPass" type="password" show-password placeholder="••••••••••••" />
                      </el-form-item>
                    </el-col>
                  </el-row>

                  <el-row :gutter="12">
                    <el-col :xs="24" :sm="16">
                      <el-form-item :label="store.t('Sender Address (From)')">
                        <el-input v-model="smtpSender" placeholder="alerts@vibemongo.local" />
                      </el-form-item>
                    </el-col>
                    <el-col :xs="24" :sm="8">
                      <el-form-item :label="store.t('SSL/TLS Secure')">
                        <div class="secure-switch-wrapper">
                          <el-switch v-model="smtpSecure" :active-text="store.t('SSL')" />
                        </div>
                      </el-form-item>
                    </el-col>
                  </el-row>
                </div>
              </transition>
            </div>

            <!-- Notification Spam Prevention (Smart Alert Aggregation) -->
            <div class="spam-prevention-section" style="margin-top: 18px; margin-bottom: 18px; padding: 16px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px solid rgba(255,255,255,0.06);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <span style="font-weight: 600; font-size: 0.9rem; color: #fff; display: flex; align-items: center; gap: 6px;">
                  🛡️ Notification Spam Prevention (Smart Aggregation)
                </span>
                <el-switch
                  v-model="enableGrouping"
                  active-color="#13ce66"
                />
              </div>
              <p class="filter-desc" style="font-size: 0.75rem; color: #a3a3a3; margin-bottom: 12px; margin-top: 0; line-height: 1.4;">
                Consolidates multiple alerts occurring within the specified window into a single high-fidelity digest report, keeping your inbox clean and noise-free.
              </p>
              
              <transition name="slide-fade">
                <div v-if="enableGrouping" style="display: flex; align-items: center; gap: 12px;">
                  <span style="font-size: 0.8rem; color: #a3a3a3;">Aggregation Time Window:</span>
                  <el-select v-model="groupWindow" size="small" style="width: 130px;">
                    <el-option :label="'5 minutes'" :value="5" />
                    <el-option :label="'15 minutes'" :value="15" />
                    <el-option :label="'30 minutes'" :value="30" />
                    <el-option :label="'1 hour'" :value="60" />
                  </el-select>
                </div>
              </transition>
            </div>

            <el-form-item :label="store.t('Event Subscriptions (Alert Triggers)')">
              <div class="filter-options-grid">
                <div class="filter-option-item">
                  <el-checkbox v-model="slowQueries">
                    <strong>{{ store.t('COLLSCAN & Slow Query Spikes') }}</strong>
                  </el-checkbox>
                  <p class="filter-desc">Trigger AI diagnostics when P99 latency exceeds 1.0s or query analysis detects index misses.</p>
                </div>

                <div class="filter-option-item">
                  <el-checkbox v-model="systemSpikes">
                    <strong>{{ store.t('Container Resource Spikes') }}</strong>
                  </el-checkbox>
                  <p class="filter-desc">Trigger alerts when resident container memory exceeds 800MB peak or memory leaks are flagged.</p>
                </div>

                <div class="filter-option-item">
                  <el-checkbox v-model="connectionFailures">
                    <strong>{{ store.t('Database Connection Failures') }}</strong>
                  </el-checkbox>
                  <p class="filter-desc">Immediate high-priority alert if connection drops, DNS lookup fails, or credentials expire.</p>
                </div>
              </div>
            </el-form-item>

            <div class="form-action-row">
              <!-- <el-button
                type="danger"
                plain round
                :disabled="!savedUrl && !savedEmail"
                @click="handleDeleteWebhook"
              >
                {{ store.t('Disable Channels') }}
              </el-button> -->
              <div> </div>
              <div class="action-buttons-right">
                <el-button
                  type="success"
                  plain round
                  :loading="testing"
                  :disabled="!webhookUrl && !emailAddress"
                  @click="handleTestWebhook"
                >
                  {{ store.t('Test Alert Channels') }}
                </el-button>
                <el-button
                  type="primary" round
                  :disabled="!webhookUrl && !emailAddress"
                  @click="handleSaveWebhook"
                >
                  {{ store.t('Save Settings') }}
                </el-button>
              </div>
            </div>
          </el-form>
        </el-card>
      </el-col>

      <!-- Right side: Terminal dispatch logs simulator -->
      <el-col :xs="24" :md="10">
        <el-card class="terminal-card">
          <template #header>
            <div class="terminal-header">
              <span class="terminal-title">
                <el-icon class="terminal-icon"><Monitor /></el-icon>
                Outbound Dispatch Logs
              </span>
              <span class="dot-indicator pulse-animation"></span>
            </div>
          </template>

          <div class="terminal-body" ref="terminalBodyRef">
            <div v-for="(log, idx) in dispatchLogs" :key="idx" class="terminal-log-row">
              <span class="log-time">[{{ log.time }}]</span>
              <span class="log-level" :class="`log-${log.level}`">[{{ log.level.toUpperCase() }}]</span>
              <span class="log-msg">{{ log.message }}</span>
            </div>
            <div v-if="dispatchLogs.length === 0" class="terminal-empty-msg">
              Waiting for outbound alert activities...
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { store } from '../../stores';
import { Cpu, Monitor, Setting, ArrowRight } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import axios from 'axios';

const props = defineProps<{
  conn: string;
}>();

const loading = ref(false);
const testing = ref(false);

const webhookUrl = ref('');
const savedUrl = ref('');
const emailAddress = ref('');
const savedEmail = ref('');

// SMTP configurations state
const showSmtpSettings = ref(false);
const smtpHost = ref('');
const smtpPort = ref(587);
const smtpSecure = ref(false);
const smtpUser = ref('');
const smtpPass = ref('');
const smtpSender = ref('');

const slowQueries = ref(true);
const systemSpikes = ref(true);
const connectionFailures = ref(true);

const enableGrouping = ref(true);
const groupWindow = ref(5);

const dispatchLogs = ref<{ time: string; level: string; message: string }[]>([]);
const terminalBodyRef = ref<HTMLElement | null>(null);

const addLog = (level: 'info' | 'warn' | 'success' | 'error', message: string) => {
  const time = new Date().toLocaleTimeString();
  dispatchLogs.value.push({ time, level, message });
  setTimeout(() => {
    if (terminalBodyRef.value) {
      terminalBodyRef.value.scrollTop = terminalBodyRef.value.scrollHeight;
    }
  }, 100);
};

const loadWebhookConfig = async () => {
  if (!props.conn) return;

  loading.value = true;
  try {
    const res = await axios.get(`/api/${props.conn}/webhooks`);
    if (res.data) {
      webhookUrl.value = res.data.url || '';
      savedUrl.value = res.data.url || '';
      emailAddress.value = res.data.email || '';
      savedEmail.value = res.data.email || '';
      slowQueries.value = res.data.slowQueries === 1;
      systemSpikes.value = res.data.systemSpikes === 1;
      connectionFailures.value = res.data.connectionFailures === 1;

      // Populate SMTP settings
      smtpHost.value = res.data.smtpHost || '';
      smtpPort.value = res.data.smtpPort || 587;
      smtpSecure.value = res.data.smtpSecure === 1;
      smtpUser.value = res.data.smtpUser || '';
      smtpPass.value = res.data.smtpPass || '';
      smtpSender.value = res.data.smtpSender || '';
      enableGrouping.value = res.data.enableGrouping === 1;
      groupWindow.value = res.data.groupWindow || 5;

      if (res.data.url && res.data.email) {
        addLog('info', `Config loaded. Webhook & Email channels active for '${props.conn}'`);
      } else if (res.data.url) {
        addLog('info', `Config loaded. Target webhook is active for '${props.conn}'`);
      } else if (res.data.email) {
        addLog('info', `Config loaded. Email notifications active for '${props.conn}'`);
      } else {
        addLog('info', `No active alert channels loaded for connection '${props.conn}'`);
      }

      if (res.data.smtpHost) {
        addLog('info', `Custom SMTP relay host found: ${res.data.smtpHost}:${res.data.smtpPort}`);
      }
    }
  } catch (e: any) {
    console.error('Error fetching webhook config:', e);
    addLog('error', 'Failed to retrieve connection alerting configuration.');
  } finally {
    loading.value = false;
  }
};

const handleSaveWebhook = async () => {
  if (!webhookUrl.value && !emailAddress.value) return;

  try {
    await axios.post(`/api/${props.conn}/webhooks/save`, {
      url: webhookUrl.value,
      email: emailAddress.value,
      slowQueries: slowQueries.value,
      systemSpikes: systemSpikes.value,
      connectionFailures: connectionFailures.value,
      smtpHost: smtpHost.value,
      smtpPort: smtpPort.value,
      smtpSecure: smtpSecure.value ? 1 : 0,
      smtpUser: smtpUser.value,
      smtpPass: smtpPass.value,
      smtpSender: smtpSender.value,
      enableGrouping: enableGrouping.value ? 1 : 0,
      groupWindow: groupWindow.value
    });

    ElMessage.success(store.t('Alert settings successfully saved!'));
    savedUrl.value = webhookUrl.value;
    savedEmail.value = emailAddress.value;
    addLog('success', `Alerting channels configurations successfully registered.`);
  } catch (e: any) {
    ElMessage.error(store.t('Failed to save settings'));
    addLog('error', `Failed to persist configurations.`);
  }
};

const handleTestWebhook = async () => {
  if (!webhookUrl.value && !emailAddress.value) return;

  testing.value = true;
  addLog('warn', `Initiating mock alert push payload to channel...`);
  try {
    const res = await axios.post(`/api/${props.conn}/webhooks/test`, {
      url: webhookUrl.value,
      email: emailAddress.value,
      smtpHost: smtpHost.value,
      smtpPort: smtpPort.value,
      smtpSecure: smtpSecure.value ? 1 : 0,
      smtpUser: smtpUser.value,
      smtpPass: smtpPass.value,
      smtpSender: smtpSender.value
    });
    ElMessage.success(store.t('AI SRE mock incident notification sent successfully!'));
    
    const report = res.data.report;
    if (report.webhookSent) {
      addLog('info', `Webhook dispatch initiated for: ${report.targetUrl}`);
      addLog('success', `Outbound webhook notification delivered. Status: 200 OK`);
    }
    if (report.emailSent) {
      if (smtpHost.value) {
        addLog('info', `SMTP dispatch initiated for: ${report.targetEmail} via host ${smtpHost.value}`);
      } else {
        addLog('info', `SMTP dispatch initiated for: ${report.targetEmail}`);
      }
      addLog('success', `Outbound SRE alert email successfully delivered via SMTP Relay.`);
    }
  } catch (e: any) {
    const errMsg = e.response?.data?.msg || e.message;
    ElMessage.error(store.t('Failed to send test webhook: ') + errMsg);
    addLog('error', `Alert delivery failed: ${errMsg}`);
  } finally {
    testing.value = false;
  }
};

const handleDeleteWebhook = () => {
  ElMessageBox.confirm(
    store.t('Disable and delete alert channel settings? Proactive SRE alerting will be deactivated.'),
    store.t('Warning'),
    {
      confirmButtonText: store.t('Disable Channels'),
      cancelButtonText: store.t('Cancel'),
      type: 'warning'
    }
  ).then(async () => {
    loading.value = true;
    try {
      await axios.post(`/api/${props.conn}/webhooks/delete`);
      ElMessage.success(store.t('Alert channels successfully disabled'));
      webhookUrl.value = '';
      savedUrl.value = '';
      emailAddress.value = '';
      savedEmail.value = '';
      
      // Clear SMTP configuration
      smtpHost.value = '';
      smtpPort.value = 587;
      smtpSecure.value = false;
      smtpUser.value = '';
      smtpPass.value = '';
      smtpSender.value = '';
      
      // Clear alert grouping config
      enableGrouping.value = true;
      groupWindow.value = 5;
      
      addLog('warn', `Alerting channels de-registered. Proactive SRE alerting idle.`);
    } catch (e) {
      ElMessage.error(store.t('Failed to disable channels'));
    } finally {
      loading.value = false;
    }
  }).catch(() => {});
};

const handleToggleActive = (val: any) => {
  if (!val) {
    handleDeleteWebhook();
  } else {
    if (!webhookUrl.value && !emailAddress.value) {
      ElMessage.warning(store.t('Please enter a Webhook URL or Email Address first before enabling notifications!'));
    } else {
      handleSaveWebhook();
    }
  }
};

onMounted(loadWebhookConfig);

watch(() => props.conn, () => {
  loadWebhookConfig();
});
</script>

<style scoped>
.webhook-integrations-comp {
  margin-top: 1rem;
}
.integration-card {
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
}
.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-primary);
}
.title-icon {
  color: var(--el-color-primary);
}
.webhook-form {
  padding: 5px 0;
}
.filter-options-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background-color: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 15px;
  width: 100%;
}
.filter-option-item {
  display: flex;
  flex-direction: column;
}
.filter-desc {
  margin: 4px 0 0 24px;
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.3;
}
.form-action-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 15px;
}
.action-buttons-right {
  display: flex;
  gap: 10px;
}

/* Terminal simulator styles */
.terminal-card {
  background-color: #1e1e1e !important;
  border: 1px solid #333 !important;
  color: #fff !important;
  border-radius: 8px;
}
.terminal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.terminal-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 0.85rem;
  color: #ccc;
}
.terminal-icon {
  color: var(--el-color-success);
}
.dot-indicator {
  width: 8px;
  height: 8px;
  background-color: var(--el-color-success);
  border-radius: 50%;
}
.pulse-animation {
  box-shadow: 0 0 0 0 rgba(103, 194, 58, 0.7);
  animation: pulse 1.6s infinite;
}
@keyframes pulse {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(103, 194, 58, 0.7);
  }
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 6px rgba(103, 194, 58, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(103, 194, 58, 0);
  }
}
.terminal-body {
  height: 290px;
  overflow-y: auto;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.75rem;
  line-height: 1.4;
  padding: 5px 0;
  color: #00ff00;
}
.terminal-log-row {
  margin-bottom: 8px;
  word-break: break-all;
}
.log-time {
  color: #888;
  margin-right: 6px;
}
.log-level {
  font-weight: bold;
  margin-right: 6px;
}
.log-info { color: #00bcd4; }
.log-warn { color: #ffeb3b; }
.log-success { color: #4caf50; }
.log-error { color: #f44336; }
.log-msg {
  color: #ddd;
}
.terminal-empty-msg {
  color: #555;
  text-align: center;
  margin-top: 100px;
  font-style: italic;
}

/* Custom SMTP Configuration Grid Styles */
.smtp-config-section {
  margin-bottom: 1.25rem;
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  background-color: var(--el-fill-color-blank);
  overflow: hidden;
}
.section-divider {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  cursor: pointer;
  background-color: var(--el-fill-color-light);
  user-select: none;
  transition: background-color 0.2s;
}
.section-divider:hover {
  background-color: var(--el-fill-color);
}
.divider-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  font-size: 0.85rem;
  color: var(--text-primary);
}
.divider-icon {
  color: var(--el-color-warning);
}
.arrow-icon {
  font-size: 0.8rem;
  color: var(--text-muted);
  transition: transform 0.2s ease-in-out;
}
.arrow-icon.rotated {
  transform: rotate(90deg);
}
.smtp-inputs-container {
  padding: 14px 14px 2px 14px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.secure-switch-wrapper {
  margin-top: 6px;
}

/* Slide fade transition */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.25s ease-out;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(-8px);
  opacity: 0;
}
</style>
