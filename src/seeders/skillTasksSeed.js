import SkillVerificationTask from "../models/SkillVerificationTask.js";

export const initialTasksSeed = [
  // ===================== REACT.JS =====================
  {
    skillName: "React.js",
    category: "Technical",
    difficulty: "Beginner",
    title: "Filterable Product Catalog with Category Pills",
    problemStatement:
      "Build a modular React component that displays a catalog of items with instant client-side search filtering, category selection pills, and sorting by price/rating.",
    requirements: [
      "Use useState and useMemo for efficient state management and filtered computations",
      "Implement a responsive grid layout that adapts from mobile (1 column) to desktop (3-4 columns)",
      "Include empty-state UI when no items match search criteria",
      "Ensure proper key props and component prop types / validation"
    ],
    starterRepositoryUrl: "https://github.com/vibe-tasks/react-catalog-starter",
    rubric: [
      { criterion: "State Management & React Hooks", maxPoints: 35 },
      { criterion: "Clean Component Hierarchy & Code Quality", maxPoints: 35 },
      { criterion: "Responsive Design & Edge Case Handling", maxPoints: 30 }
    ],
    estimatedTimeHours: 3
  },
  {
    skillName: "React.js",
    category: "Technical",
    difficulty: "Intermediate",
    title: "Multi-Step Form Wizard with Persistent Draft Recovery",
    problemStatement:
      "Implement a multi-step registration wizard using useReducer and custom hooks. The wizard must handle field-level schema validation, track progress, and persist draft state to localStorage so refreshes do not lose data.",
    requirements: [
      "Use useReducer for deterministic state transitions across 3 distinct steps",
      "Implement client-side field validation with clear error messages",
      "Persist form state in localStorage with a 'Resume Draft' or 'Clear Draft' option",
      "Provide accessible step indicators with keyboard navigation support"
    ],
    starterRepositoryUrl: "https://github.com/vibe-tasks/react-wizard-starter",
    rubric: [
      { criterion: "Reducer Design & State Architecture", maxPoints: 40 },
      { criterion: "Validation & Error Handling", maxPoints: 30 },
      { criterion: "Accessibility & UX Polish", maxPoints: 30 }
    ],
    estimatedTimeHours: 5
  },
  {
    skillName: "React.js",
    category: "Technical",
    difficulty: "Advanced",
    title: "Virtualized Infinite Scroll Feed with Abortable Requests",
    problemStatement:
      "Build a high-performance virtualized list capable of rendering 5,000+ items smoothly at 60fps. Implement debounced search, windowing/virtualization without heavy external dependencies, and cancel in-flight network requests using AbortController.",
    requirements: [
      "Implement DOM windowing/virtualization calculating scroll offsets and visible slices",
      "Debounce user input and cancel stale pending fetch calls with AbortController",
      "Include skeleton loading placeholders and graceful error boundaries",
      "Zero memory leaks on component unmount and smooth scroll benchmarks"
    ],
    starterRepositoryUrl: "https://github.com/vibe-tasks/react-virtual-feed-starter",
    rubric: [
      { criterion: "Performance & Rendering Optimization", maxPoints: 40 },
      { criterion: "Abortable Async State Management", maxPoints: 35 },
      { criterion: "Code Structure & Architectural Patterns", maxPoints: 25 }
    ],
    estimatedTimeHours: 7
  },

  // ===================== NODE.JS & EXPRESS =====================
  {
    skillName: "Node.js & Express",
    category: "Technical",
    difficulty: "Beginner",
    title: "RESTful Resource API with Structured Error Handling",
    problemStatement:
      "Create an Express.js CRUD API for a resource (e.g. Courses or Tasks) with input sanitization, query parameter pagination, filtering by category, and consistent JSON error envelopes.",
    requirements: [
      "Implement GET, POST, PUT, DELETE with correct HTTP status codes",
      "Add validation middleware checking required fields and data formats",
      "Implement query pagination (?page=1&limit=10) and category filtering",
      "Centralized error handling middleware returning standardized { success, message, errors } shape"
    ],
    starterRepositoryUrl: "https://github.com/vibe-tasks/node-express-crud-starter",
    rubric: [
      { criterion: "REST Conventions & HTTP Semantics", maxPoints: 35 },
      { criterion: "Input Validation & Middleware Hygiene", maxPoints: 35 },
      { criterion: "Centralized Error Handling", maxPoints: 30 }
    ],
    estimatedTimeHours: 3
  },
  {
    skillName: "Node.js & Express",
    category: "Technical",
    difficulty: "Intermediate",
    title: "JWT Authentication Flow with Refresh Token Rotation",
    problemStatement:
      "Build a complete authentication microservice featuring bcrypt password hashing, short-lived access JWTs, secure HTTP-only refresh tokens, and a token revocation mechanism.",
    requirements: [
      "Secure password hashing with bcrypt using work factor >= 10",
      "Access token verification middleware with expired token detection",
      "Refresh token rotation endpoint that invalidates reused/stale tokens",
      "Proper CORS configuration and HTTP-only cookie security flags"
    ],
    starterRepositoryUrl: "https://github.com/vibe-tasks/node-auth-service-starter",
    rubric: [
      { criterion: "Security Practices & JWT Lifecycle", maxPoints: 45 },
      { criterion: "Middleware Architecture & Clean Separation", maxPoints: 30 },
      { criterion: "Edge Case & Error Handling", maxPoints: 25 }
    ],
    estimatedTimeHours: 6
  },
  {
    skillName: "Node.js & Express",
    category: "Technical",
    difficulty: "Advanced",
    title: "Sliding Window Rate Limiter & Concurrency Job Worker",
    problemStatement:
      "Implement an in-memory or Redis-backed sliding-window rate limiting middleware, combined with an asynchronous task processing queue that throttles concurrent outbound tasks.",
    requirements: [
      "Sliding window log algorithm tracking requests per IP within rolling timeframes",
      "Return standard 429 Too Many Requests with Retry-After and rate limit headers",
      "Asynchronous worker pool processing queue items with configurable concurrency limit (e.g., max 3 parallel)",
      "Graceful shutdown handling SIGTERM without dropping in-progress tasks"
    ],
    starterRepositoryUrl: "https://github.com/vibe-tasks/node-rate-limiter-starter",
    rubric: [
      { criterion: "Algorithmic Correctness of Rate Limiting", maxPoints: 40 },
      { criterion: "Concurrency Control & Worker Architecture", maxPoints: 35 },
      { criterion: "Graceful Failure & Lifecycle Management", maxPoints: 25 }
    ],
    estimatedTimeHours: 8
  },

  // ===================== JAVASCRIPT / TYPESCRIPT =====================
  {
    skillName: "JavaScript / TypeScript",
    category: "Technical",
    difficulty: "Beginner",
    title: "Interactive DOM Event Dashboard with Local Storage",
    problemStatement:
      "Build a vanilla JavaScript/TypeScript application managing a personal habit or expense log. Demonstrate clean DOM manipulation, event delegation, and persistent storage.",
    requirements: [
      "Use event delegation for dynamic list item actions (delete, toggle, edit)",
      "Strict data sanitization to prevent XSS before rendering user inputs",
      "Synchronize state changes seamlessly with window.localStorage",
      "Zero global namespace pollution using ES Modules"
    ],
    starterRepositoryUrl: "https://github.com/vibe-tasks/ts-dom-dashboard-starter",
    rubric: [
      { criterion: "Event Delegation & DOM Hygiene", maxPoints: 40 },
      { criterion: "State Synchronization & Storage", maxPoints: 30 },
      { criterion: "Code Modularity & Clean Syntax", maxPoints: 30 }
    ],
    estimatedTimeHours: 3
  },
  {
    skillName: "JavaScript / TypeScript",
    category: "Technical",
    difficulty: "Intermediate",
    title: "Async Data Pipeline with Custom Retry & Backoff",
    problemStatement:
      "Implement an asynchronous TypeScript utility library providing promise batching, exponential backoff with jitter on network failures, and strongly typed response envelopes.",
    requirements: [
      "Create a retryWithBackoff(fn, retries, delay, jitter) helper",
      "Implement Promise.allSettled style batch processing with max concurrency limit",
      "Use TypeScript Generics, Discriminated Unions, and utility types for type safety",
      "Include unit test suite covering success, retry, and fatal failure paths"
    ],
    starterRepositoryUrl: "https://github.com/vibe-tasks/ts-async-pipeline-starter",
    rubric: [
      { criterion: "TypeScript Typing & Generics Usage", maxPoints: 40 },
      { criterion: "Asynchronous Flow Control & Backoff Logic", maxPoints: 35 },
      { criterion: "Unit Test Coverage & Assertions", maxPoints: 25 }
    ],
    estimatedTimeHours: 5
  },
  {
    skillName: "JavaScript / TypeScript",
    category: "Technical",
    difficulty: "Advanced",
    title: "Custom Reactive State Store (Signal / Pub-Sub Engine)",
    problemStatement:
      "Build a lightweight reactive signal / state management library in TypeScript from scratch. Implement dependency tracking, computed values that only recalculate when dependencies change, and batch updates.",
    requirements: [
      "Implement createSignal, createEffect, and createMemo primitives",
      "Automatic dependency tracking via execution stack context",
      "Batching mechanism to coalesce synchronous updates into a single re-computation cycle",
      "Memory cleanup / unsubscribe teardown to prevent subscriber leaks"
    ],
    starterRepositoryUrl: "https://github.com/vibe-tasks/ts-reactive-signals-starter",
    rubric: [
      { criterion: "Reactivity Graph Architecture", maxPoints: 45 },
      { criterion: "Dependency Tracking & Cycle Detection", maxPoints: 35 },
      { criterion: "Type Safety & Memory Management", maxPoints: 20 }
    ],
    estimatedTimeHours: 8
  },

  // ===================== PYTHON =====================
  {
    skillName: "Python",
    category: "Technical",
    difficulty: "Beginner",
    title: "CLI Dataset Parser & Summary Statistics Report",
    problemStatement:
      "Write a Python script that parses CSV or JSON dataset files, cleans missing values, and outputs formatted statistical summaries and histograms in the terminal.",
    requirements: [
      "Use argparse or click for command-line options (--input, --filter, --output)",
      "Compute mean, median, standard deviation, and value frequency distributions",
      "Gracefully handle missing, null, or malformed data rows",
      "Write clean, PEP-8 compliant code with docstrings and type hints"
    ],
    starterRepositoryUrl: "https://github.com/vibe-tasks/python-cli-analyzer-starter",
    rubric: [
      { criterion: "Data Cleaning & Parsing Robustness", maxPoints: 40 },
      { criterion: "CLI Usability & Error Messaging", maxPoints: 30 },
      { criterion: "PEP-8 Standards & Code Organization", maxPoints: 30 }
    ],
    estimatedTimeHours: 3
  },
  {
    skillName: "Python",
    category: "Technical",
    difficulty: "Intermediate",
    title: "Async Web Scraper with Rate Throttling and Data Export",
    problemStatement:
      "Build an asynchronous scraper using aiohttp or asyncio to extract structured product or article data from target web pages, with domain rate limiting and SQLite storage.",
    requirements: [
      "Use asyncio and aiohttp with concurrency semaphores to prevent IP bans",
      "Parse and validate extracted data into structured Pydantic models",
      "Save clean records into a SQLite database with upsert operations",
      "Implement logging showing scrape velocity, retries, and errors"
    ],
    starterRepositoryUrl: "https://github.com/vibe-tasks/python-async-scraper-starter",
    rubric: [
      { criterion: "Asyncio Concurrency & Throttling", maxPoints: 40 },
      { criterion: "Data Modeling & Validation (Pydantic)", maxPoints: 30 },
      { criterion: "Database Persistence & Error Resilience", maxPoints: 30 }
    ],
    estimatedTimeHours: 5
  },
  {
    skillName: "Python",
    category: "Technical",
    difficulty: "Advanced",
    title: "Microservice API with Background Worker & Redis Queue",
    problemStatement:
      "Develop a FastAPI microservice that accepts compute-heavy jobs, offloads them to an asynchronous worker queue (RQ or Celery), and exposes polling endpoints for status and results.",
    requirements: [
      "FastAPI endpoints with OpenAPI documentation and dependency injection",
      "Background worker consumer that processes jobs and updates Redis state",
      "Implement task cancellation and exponential timeout handling",
      "Comprehensive Pytest suite with test fixtures and mock Redis"
    ],
    starterRepositoryUrl: "https://github.com/vibe-tasks/python-fastapi-worker-starter",
    rubric: [
      { criterion: "FastAPI Architecture & Asynchronous Design", maxPoints: 40 },
      { criterion: "Queue Consumer & State Synchronization", maxPoints: 35 },
      { criterion: "Automated Testing & Modularity", maxPoints: 25 }
    ],
    estimatedTimeHours: 8
  },

  // ===================== DATA STRUCTURES & ALGORITHMS =====================
  {
    skillName: "Data Structures & Algorithms",
    category: "Technical",
    difficulty: "Beginner",
    title: "Balanced Parentheses & Custom Stack / Queue Implementations",
    problemStatement:
      "Implement custom Generic Stack and Queue data structures from scratch with amortized O(1) operations, and use them to solve multiple bracket matching and expressions evaluation problems.",
    requirements: [
      "Implement Stack and Queue with push, pop, peek, isEmpty, and size methods",
      "Solve the multi-bracket balance validation problem ((), {}, [])",
      "Evaluate postfix (Reverse Polish) mathematical expressions",
      "Include unit tests testing boundary conditions and empty states"
    ],
    starterRepositoryUrl: "https://github.com/vibe-tasks/dsa-stack-queue-starter",
    rubric: [
      { criterion: "Data Structure Implementation & Invariants", maxPoints: 40 },
      { criterion: "Algorithmic Correctness & Edge Cases", maxPoints: 35 },
      { criterion: "Time and Space Complexity Analysis", maxPoints: 25 }
    ],
    estimatedTimeHours: 3
  },
  {
    skillName: "Data Structures & Algorithms",
    category: "Technical",
    difficulty: "Intermediate",
    title: "LRU Cache & Trie (Prefix Tree) Autocomplete Engine",
    problemStatement:
      "Build an O(1) Least Recently Used (LRU) Cache using a Hash Map + Doubly Linked List, and a Trie (Prefix Tree) that supports prefix search and frequency-ranked autocomplete recommendations.",
    requirements: [
      "LRU Cache get and put operations strictly executed in O(1) time complexity",
      "Trie supporting insert, search, and startsWith with prefix string traversal",
      "Ranked autocomplete returning top 5 most frequent completions for a given prefix",
      "Performance benchmarks demonstrating correct evictions under heavy load"
    ],
    starterRepositoryUrl: "https://github.com/vibe-tasks/dsa-lru-trie-starter",
    rubric: [
      { criterion: "O(1) LRU Linked List + Map Correctness", maxPoints: 40 },
      { criterion: "Trie Traversal & Autocomplete Ranking", maxPoints: 35 },
      { criterion: "Complexity Analysis & Clean Modular Code", maxPoints: 25 }
    ],
    estimatedTimeHours: 5
  },
  {
    skillName: "Data Structures & Algorithms",
    category: "Technical",
    difficulty: "Advanced",
    title: "Dijkstra Shortest Path & Topological Sort Dependency Graph",
    problemStatement:
      "Implement a graph engine that models a dependency network (like npm or a build pipeline). Detect circular dependencies using Tarjan or Kahn's topological sort, and compute shortest weighted paths using Dijkstra with a Min-Heap priority queue.",
    requirements: [
      "Graph representation supporting directed, weighted edges",
      "Cycle detection throwing a descriptive error identifying the exact cycle path",
      "Topological sort producing a valid serial build order",
      "Dijkstra's algorithm using a custom Binary Heap priority queue"
    ],
    starterRepositoryUrl: "https://github.com/vibe-tasks/dsa-graph-engine-starter",
    rubric: [
      { criterion: "Algorithmic Precision & Cycle Detection", maxPoints: 45 },
      { criterion: "Binary Heap Priority Queue Implementation", maxPoints: 35 },
      { criterion: "Comprehensive Graph Test Scenarios", maxPoints: 20 }
    ],
    estimatedTimeHours: 8
  },

  // ===================== GIT & VERSION CONTROL =====================
  {
    skillName: "Git & Version Control",
    category: "Tools",
    difficulty: "Beginner",
    title: "Feature Branch Workflow & Clean Commit History",
    problemStatement:
      "Demonstrate proficiency in modern Git workflows by creating a repository with a clean feature-branch structure, conventional commits, and a successful squash merge into main.",
    requirements: [
      "Use Conventional Commits standard (feat:, fix:, chore:, docs:)",
      "Create separate feature branches off main without uncommitted tracking leaks",
      "Include a detailed PR description with testing verification steps",
      "Provide a clean git log graph output showing structured branch merges"
    ],
    starterRepositoryUrl: "https://github.com/vibe-tasks/git-workflow-starter",
    rubric: [
      { criterion: "Commit Granularity & Conventional Syntax", maxPoints: 40 },
      { criterion: "Branching Strategy & PR Clarity", maxPoints: 35 },
      { criterion: "Clean Merge History", maxPoints: 25 }
    ],
    estimatedTimeHours: 2
  },
  {
    skillName: "Git & Version Control",
    category: "Tools",
    difficulty: "Intermediate",
    title: "Interactive Rebase, Cherry-Pick & Conflict Resolution",
    problemStatement:
      "Simulate and resolve a complex multi-file merge conflict, perform an interactive rebase (git rebase -i) to squash and reword commits, and cherry-pick a hotfix across branches.",
    requirements: [
      "Set up deliberate conflicting edits across branches and document resolution",
      "Use interactive rebase to squash 5 messy commits into 2 logical atomic commits",
      "Cherry-pick a critical patch commit from development to production branch",
      "Provide step-by-step markdown log with git commands used and diff outputs"
    ],
    starterRepositoryUrl: "https://github.com/vibe-tasks/git-rebase-conflict-starter",
    rubric: [
      { criterion: "Conflict Resolution Integrity", maxPoints: 40 },
      { criterion: "Interactive Rebase & Commit Hygiene", maxPoints: 35 },
      { criterion: "Cherry-pick Execution & Documentation", maxPoints: 25 }
    ],
    estimatedTimeHours: 4
  },
  {
    skillName: "Git & Version Control",
    category: "Tools",
    difficulty: "Advanced",
    title: "Automated GitHub Actions CI/CD Pipeline & Pre-commit Hooks",
    problemStatement:
      "Configure an end-to-end repository automation pipeline using Husky for git hooks (lint-staged, commitlint) and a GitHub Actions workflow that executes tests, builds, and fails on coverage regressions.",
    requirements: [
      "Configure pre-commit hooks running linter and formatting checks on staged files",
      "Configure commit-msg hook enforcing conventional commit message formats",
      "Build a multi-job GitHub Actions workflow (lint -> test matrix -> build)",
      "Add status badge to README reflecting automated build pipeline status"
    ],
    starterRepositoryUrl: "https://github.com/vibe-tasks/git-ci-automation-starter",
    rubric: [
      { criterion: "CI/CD Workflow Architecture & Triggers", maxPoints: 40 },
      { criterion: "Local Git Hook Integration (Husky/Lint-Staged)", maxPoints: 35 },
      { criterion: "Build Matrix & Security Best Practices", maxPoints: 25 }
    ],
    estimatedTimeHours: 6
  }
];

export const seedSkillTasks = async () => {
  try {
    const existingCount = await SkillVerificationTask.countDocuments();
    if (existingCount === 0) {
      console.log("🌱 Seeding Skill Verification Task Bank...");
      await SkillVerificationTask.insertMany(initialTasksSeed);
      console.log(`✅ Seeded ${initialTasksSeed.length} skill verification tasks successfully.`);
    } else {
      console.log(`ℹ️ Skill Verification Task Bank already initialized (${existingCount} tasks).`);
    }
  } catch (error) {
    console.error("❌ Error seeding Skill Verification Task Bank:", error);
  }
};
