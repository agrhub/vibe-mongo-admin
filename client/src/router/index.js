import { createRouter, createWebHistory } from 'vue-router';
import { store } from '../stores';

import Welcome from '../views/Welcome.vue';
import Login from '../views/Login.vue';
import Connections from '../views/Connections.vue';
import DatabaseDashboard from '../views/DatabaseDashboard.vue';
import CollectionView from '../views/CollectionView.vue';
import DocumentEditor from '../views/DocumentEditor.vue';
import MonitoringDashboard from '../views/MonitoringDashboard.vue';
import Guide from '../views/Guide.vue';

const routes = [
  {
    path: '/welcome',
    name: 'Welcome',
    component: Welcome
  },
  {
    path: '/guide',
    name: 'Guide',
    component: Guide
  },
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/',
    name: 'Connections',
    component: Connections
  },
  {
    path: '/:conn/monitoring',
    name: 'Monitoring',
    component: MonitoringDashboard
  },
  {
    path: '/:conn',
    name: 'DatabaseDashboard',
    component: DatabaseDashboard
  },
  {
    path: '/:conn/:db',
    name: 'DatabaseCollections',
    component: DatabaseDashboard // Managed dynamically in view
  },
  {
    path: '/:conn/:db/:coll',
    name: 'CollectionView',
    component: CollectionView
  },
  {
    path: '/:conn/:db/:coll/insert',
    name: 'DocumentInsert',
    component: DocumentEditor,
    props: { isEdit: false }
  },
  {
    path: '/:conn/:db/:coll/edit/:id',
    name: 'DocumentEdit',
    component: DocumentEditor,
    props: { isEdit: true }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Navigation Auth guard
router.beforeEach(async (to, from, next) => {
  await store.fetchAuthStatus();

  // Set store active route tokens automatically
  if (to.params.conn) {
    store.setConnection(to.params.conn);
  }
  if (to.params.db) {
    store.setDatabase(to.params.db);
  } else {
    store.activeDb = '';
  }
  if (to.params.coll) {
    store.setCollection(to.params.coll);
  } else {
    store.activeColl = '';
  }

  // Redirect logic
  if (to.path === '/') {
    if (!store.loggedIn) {
      next('/welcome');
    } else {
      next();
    }
  } else if (store.passwordRequired && !store.loggedIn && to.path !== '/login' && to.path !== '/welcome' && to.path !== '/guide') {
    next('/welcome');
  } else if (store.loggedIn && to.path === '/login') {
    next('/');
  } else {
    next();
  }
});

export default router;
