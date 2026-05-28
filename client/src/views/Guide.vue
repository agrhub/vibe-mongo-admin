<template>
  <div class="guide-wrapper" @mousemove="handleMouseMove" @mouseleave="handleMouseLeave">
    <!-- Particle Canvas background -->
    <canvas ref="bgCanvas" class="guide-canvas-bg"></canvas>

    <!-- Shared Nav Header -->
    <PublicNavHeader
      badge-text="Manual"
      :brand-clickable="true"
      :show-back-btn="true"
      @brand-click="goHome"
      @back="goHome"
      @launch="launchConsole"
    />

    <!-- Main Container -->
    <div class="guide-container">
      <!-- Sticky Sidebar -->
      <GuideSidebar
        :chapters="chapters"
        :active-chapter="activeChapter"
        @scroll-to="scrollToChapter"
      />

      <!-- Chapter Content -->
      <main class="guide-main">
        <ChapterCard
          v-for="(chap, idx) in chapters"
          :key="idx"
          :chapter="chap"
          :index="idx"
        />
      </main>
    </div>

    <!-- Shared Footer -->
    <PublicFooter />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useParticleCanvas } from '../hooks/useParticleCanvas';

import PublicNavHeader from '../components/common/PublicNavHeader.vue';
import PublicFooter    from '../components/common/PublicFooter.vue';
import GuideSidebar    from '../components/guide/GuideSidebar.vue';
import ChapterCard     from '../components/guide/ChapterCard.vue';

const router = useRouter();

// Particle canvas animation (shared composable)
const { bgCanvas, handleMouseMove, handleMouseLeave } = useParticleCanvas();

const activeChapter = ref(0);

const chapters = [
  {
    title: 'Connection Manager',
    desc: 'Manage and test MongoDB connection profiles. Supports full Mongo URI configurations, custom database authentications, and active host state verification.',
    img: '/docs/images/connections.png',
    steps: [
      'Navigate to Connection Dashboard.',
      'Click Add Connection button to register new URI.',
      'Test host latency before saving configurations.',
      'Modify or delete inactive connection credentials safely.'
    ]
  },
  {
    title: 'Database & Collection Explorer',
    desc: 'Perform high-level catalog audits. Create, rename, or drop databases and collections. Features a lightweight structural scanner that counts documents and lists nested fields.',
    img: '/docs/images/db_explorer.png',
    steps: [
      'Select any active connection to open its Database Explorer.',
      'Create databases or new collections instantly.',
      'Rename collections with zero database lockouts.',
      'View database-level size allocations and collection schemas.'
    ]
  },
  {
    title: 'Document Editor & Query Builder',
    desc: 'Fully BSON-compliant document manipulation board. Utilize the smart interactive query builder to search documents by specific field matches, nested arrays, or custom BSON ObjectID properties.',
    img: '/docs/images/documents.png',
    steps: [
      'Open a collection to view its paginated BSON documents list.',
      'Use the Filter Builder to construct logical database queries.',
      'Insert new BSON documents with strict validator checkups.',
      'Inline edit and delete individual document nodes safely.'
    ]
  },
  {
    title: 'Index & Schema Optimization',
    desc: 'Advanced database index configuration console. Create or drop single, compound, or text indexes. Prevent write degradation and monitor index memory overheads directly in the user interface.',
    img: '/docs/images/indexes.png',
    steps: [
      'Open the Indexes tab within the Collection view.',
      'Inspect all active database index sizes and single/compound rules.',
      'Create high-performance indexes using simple checkboxes.',
      'Safely drop underutilized single or compound indexes.'
    ]
  },
  {
    title: 'Backup & Restore System',
    desc: 'Fail-safe physical and logical database replication board. Instantly export active datasets to standard MongoDB backup profiles or restore previous backup images in one click.',
    img: '/docs/images/backup_database.png',
    steps: [
      'Navigate to the Backup & Restore Console.',
      'Select active collections to package into compressed BSON archives.',
      'Restore legacy collections safely with absolute schema verification.',
      'Audit previous database backup events.'
    ]
  },
  {
    title: 'Arize Phoenix Observability',
    desc: 'Production-ready database performance monitoring telemetry. Tracks query traces waterfall spans, captures active latency percentiles, and measures Google Gemini LLM active token usages.',
    img: '/docs/images/monitoring_traces_list.png',
    steps: [
      'Click the Observability Dashboard from the top panel.',
      'Inspect live OpenTelemetry waterfall trace query spans.',
      'Monitor CPU usage, RAM allocations, and latency percentiles.',
      'Drill down into span attributes to diagnose bottleneck queries.'
    ]
  },
  {
    title: 'DB-Guardian AI SRE',
    desc: 'Premium AI SRE automation module. Constantly scans telemetric traces, automatically flags slow queries, runs deep explainQueryPlan evaluations, and proposes exact, native MongoDB index solutions.',
    img: '/docs/images/guardian_diagnostic.png',
    steps: [
      'Enable DB-Guardian inside the Observability Traces drawer.',
      'Let the AI automatically analyze slow collection scans.',
      'Review automated execution plans and explain recommendations.',
      'Apply suggested native index remedies in one click.'
    ]
  },
  {
    title: 'AI Judge Database Auditor',
    desc: 'Google Gemini-powered smart database auditor. Grades database spans on security, safety, and query optimality. Recommends cache models and flags potential database credentials leaks.',
    img: '/docs/images/judge_trace_eval.png',
    steps: [
      'Open the Trace Auditor inside the Telemetry dashboard.',
      'Select any slow query and click "Evaluate with AI Judge".',
      'Read the step-by-step diagnostic breakdown.',
      'Check safety, caching strategies, and security leaks scores.'
    ]
  },
  {
    title: 'AI Schema ERD & Relational Mapper',
    desc: 'Autonomous relational path discovery. Instantly parses documents across collections, identifies implicit foreign relation keys, and renders a live, interactive Mermaid.js diagram.',
    img: '/docs/images/schema.png',
    steps: [
      'Click the Schema Map option in the collection interface.',
      'Generate Interactive ERD Map using Gemini schema parsing.',
      'Read relational discovery explanations to understand collection paths.',
      'Export or customize the generated Mermaid.js code canvas.'
    ]
  },
  {
    title: 'Gemini SRE Conversational Assistant',
    desc: 'AI copilot integrated into the sidebar. Ask general MongoDB administrative questions, execute complex bulk aggregation pipelines, or ask the SRE to render interactive ECharts graphs.',
    img: '/docs/images/agent_welcome.png',
    steps: [
      'Open the MongoDB AI chatbot sidebar on the right.',
      'Chat naturally to query, index, or analyze MongoDB collections.',
      'Ask the assistant to render real-time telemetric ECharts.',
      'Trigger fast actions like collection schema summaries directly in chat.'
    ]
  }
];

const goHome = () => router.push('/welcome');
const launchConsole = () => router.push('/login');

const scrollToChapter = (idx) => {
  activeChapter.value = idx;
  const el = document.getElementById(`chapter-${idx + 1}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const handleScroll = () => {
  const scrollPosition = window.scrollY + 120;
  for (let i = 0; i < chapters.length; i++) {
    const el = document.getElementById(`chapter-${i + 1}`);
    if (el) {
      const top = el.offsetTop;
      const height = el.offsetHeight;
      if (scrollPosition >= top && scrollPosition < top + height) {
        activeChapter.value = i;
        break;
      }
    }
  }
};

onMounted(() => window.addEventListener('scroll', handleScroll));
onBeforeUnmount(() => window.removeEventListener('scroll', handleScroll));
</script>

<style scoped>
.guide-wrapper {
  position: relative;
  width: 100%;
  min-height: 100vh;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-family);
}

.guide-canvas-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  pointer-events: none;
}

.guide-container {
  display: flex;
  max-width: 1200px;
  margin: 0 auto;
  padding: 3rem 1.5rem;
  gap: 3rem;
  position: relative;
  z-index: 1;
  margin-top: 63px;
}

.guide-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rem;
}

@media (max-width: 900px) {
  .guide-container { flex-direction: column; }
}
</style>
