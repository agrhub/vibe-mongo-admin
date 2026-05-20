<template>
  <div class="db-dashboard-view page-body">
    <!-- Component-based delegator -->
    <ConnectionDashboard v-slot="{ loading }" v-if="!store.activeDb" />
    <DatabaseDetailDashboard v-else />
  </div>
</template>

<script setup>
import { store } from '../stores';
import ConnectionDashboard from '../components/dashboard/ConnectionDashboard.vue';
import DatabaseDetailDashboard from '../components/dashboard/DatabaseDetailDashboard.vue';
</script>

<style>
.db-dashboard-view {
  background: var(--bg-primary);
}

.dashboard-header-row {
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

.header-action-group {
  display: flex;
  gap: 12px;
}

.metrics-row {
  margin-bottom: 2.5rem;
}

.metric-card {
  height: 128px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0.5rem 1rem;
}

.metric-card .el-card__body {
  overflow: hidden !important;
}

.metric-lbl {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.metric-val {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.metric-val .sub-val {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-muted);
}

.text-brand {
  color: var(--color-brand);
}

.content-row {
  margin-top: 1rem;
}

.list-card {
  margin-bottom: 2rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 1rem;
}

.table-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-primary);
  text-decoration: none;
  transition: color var(--transition-fast);
}

.table-link:hover {
  color: var(--color-brand);
}

.table-icon {
  color: var(--text-muted);
}

.font-brand .table-icon {
  color: var(--color-brand);
}

.backup-name-cell, .user-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.no-backups-prompt, .no-users-prompt {
  padding: 2.5rem 1rem;
  text-align: center;
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-style: italic;
}

.role-tag {
  margin-right: 4px;
}

.role-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 4px;
}
</style>
