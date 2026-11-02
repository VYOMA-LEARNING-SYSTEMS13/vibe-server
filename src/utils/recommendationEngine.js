/**
 * Recommendation Engine for VIBE TaskMania
 * 
 * Provides skill normalization, alias canonicalization, composite stack expansion,
 * explainable multi-signal relevance scoring, and deterministic task ranking.
 */

import { isTaskExpired } from "./taskExpiry.js";

// Canonical alias dictionary for developer tools, languages, and frameworks
const SKILL_ALIASES = {
  // Languages
  "js": "javascript",
  "javascript": "javascript",
  "ts": "typescript",
  "typescript": "typescript",
  "py": "python",
  "python": "python",
  "java": "java",
  "c++": "cpp",
  "cpp": "cpp",
  "c#": "csharp",
  "csharp": "csharp",
  "rb": "ruby",
  "ruby": "ruby",
  "php": "php",
  "golang": "go",
  "go": "go",
  "rust": "rust",
  "swift": "swift",
  "kotlin": "kotlin",
  "dart": "dart",

  // Frontend
  "react": "react",
  "react.js": "react",
  "reactjs": "react",
  "react native": "react native",
  "vue": "vue",
  "vue.js": "vue",
  "vuejs": "vue",
  "angular": "angular",
  "angular.js": "angular",
  "angularjs": "angular",
  "next": "nextjs",
  "next.js": "nextjs",
  "nextjs": "nextjs",
  "nuxt": "nuxtjs",
  "nuxt.js": "nuxtjs",
  "svelte": "svelte",
  "html": "html",
  "html5": "html",
  "css": "css",
  "css3": "css",
  "tailwind": "tailwindcss",
  "tailwindcss": "tailwindcss",
  "tailwind css": "tailwindcss",
  "bootstrap": "bootstrap",
  "sass": "sass",
  "scss": "sass",

  // Backend
  "node": "nodejs",
  "node.js": "nodejs",
  "nodejs": "nodejs",
  "express": "express",
  "express.js": "express",
  "expressjs": "express",
  "nest": "nestjs",
  "nest.js": "nestjs",
  "nestjs": "nestjs",
  "django": "django",
  "flask": "flask",
  "fastapi": "fastapi",
  "fast api": "fastapi",
  "spring": "spring boot",
  "spring boot": "spring boot",
  "springboot": "spring boot",
  "asp.net": "asp.net",
  "laravel": "laravel",

  // Databases & Storage
  "mongo": "mongodb",
  "mongodb": "mongodb",
  "postgres": "postgresql",
  "postgresql": "postgresql",
  "psql": "postgresql",
  "sql": "sql",
  "mysql": "mysql",
  "sqlite": "sqlite",
  "redis": "redis",
  "dynamodb": "dynamodb",
  "cassandra": "cassandra",

  // APIs & Architecture
  "rest": "rest api",
  "rest api": "rest api",
  "rest apis": "rest api",
  "restful": "rest api",
  "restful api": "rest api",
  "restful apis": "rest api",
  "graphql": "graphql",
  "grpc": "grpc",
  "websocket": "websockets",
  "websockets": "websockets",
  "microservices": "microservices",

  // Data, AI & ML
  "data analysis": "data analysis",
  "pandas": "pandas",
  "numpy": "numpy",
  "scikit-learn": "scikit-learn",
  "scikit learn": "scikit-learn",
  "sklearn": "scikit-learn",
  "pytorch": "pytorch",
  "tensorflow": "tensorflow",
  "keras": "keras",
  "ml": "machine learning",
  "machine learning": "machine learning",
  "ai": "artificial intelligence",
  "artificial intelligence": "artificial intelligence",
  "nlp": "nlp",
  "natural language processing": "nlp",
  "llm": "llms",
  "llms": "llms",
  "large language models": "llms",
  "embedding": "embeddings",
  "embeddings": "embeddings",
  "rag": "rag",

  // DevOps & Tools
  "docker": "docker",
  "kubernetes": "kubernetes",
  "k8s": "kubernetes",
  "aws": "aws",
  "azure": "azure",
  "gcp": "gcp",
  "git": "git",
  "github": "github",
  "ci/cd": "ci/cd",
  "linux": "linux",
};

// Composite stacks that expand to multiple skills
const COMPOSITE_STACKS = {
  "mern": ["mongodb", "express", "react", "nodejs"],
  "mean": ["mongodb", "express", "angular", "nodejs"],
  "mevn": ["mongodb", "express", "vue", "nodejs"],
  "lamp": ["linux", "apache", "mysql", "php"],
};

/**
 * Normalizes skill names by converting to lowercase, trimming,
 * cleaning harmless punctuation, and resolving common canonical aliases.
 */
export const normalizeSkill = (raw) => {
  if (!raw || typeof raw !== "string") return "";
  const lower = raw.toLowerCase().trim();
  if (SKILL_ALIASES[lower]) return SKILL_ALIASES[lower];

  // Remove harmless punctuation like dots, dashes, underscores
  const cleaned = lower.replace(/[\._\-]/g, " ").replace(/\s+/g, " ").trim();
  return SKILL_ALIASES[cleaned] || cleaned;
};

/**
 * Extracts a normalized, deduplicated list of skills from a student's profile.
 */
export const extractStudentSkills = (user, profile) => {
  const skillMap = new Map();

  const addSkill = (name, verified = false, level = "Intermediate", score = 85) => {
    if (!name || typeof name !== "string") return;
    const cleanName = name.trim();
    const norm = normalizeSkill(cleanName);
    if (!norm) return;

    if (!skillMap.has(norm)) {
      skillMap.set(norm, {
        original: cleanName,
        norm,
        verified: Boolean(verified),
        level: level || "Intermediate",
        score: typeof score === "number" ? score : 85,
      });
    } else {
      const existing = skillMap.get(norm);
      if (verified && !existing.verified) existing.verified = true;
      if (score > existing.score) existing.score = score;
    }
  };

  // 1. Structured skills in Profile.skills
  if (profile && Array.isArray(profile.skills)) {
    profile.skills.forEach((s) => {
      if (typeof s === "string") {
        addSkill(s, false);
      } else if (s && typeof s === "object") {
        addSkill(s.name, s.verified, s.level, s.score);
      }
    });
  }

  // 2. Comma-separated or array in Profile.ExpertiseDomains
  if (profile?.ExpertiseDomains) {
    if (typeof profile.ExpertiseDomains === "string") {
      profile.ExpertiseDomains.split(",").forEach((item) => addSkill(item, false));
    } else if (Array.isArray(profile.ExpertiseDomains)) {
      profile.ExpertiseDomains.forEach((item) => addSkill(item, false));
    }
  }

  return Array.from(skillMap.values());
};

/**
 * Extracts student interests and role affinities from their profile.
 */
export const extractStudentInterests = (user, profile) => {
  const interests = new Set();
  const add = (val) => {
    if (!val || typeof val !== "string") return;
    val.toLowerCase().split(/[\s,/\-]+/).forEach((tok) => {
      if (tok.length > 2) interests.add(tok);
    });
  };

  if (profile?.branch) add(profile.branch);
  if (profile?.position) add(profile.position);
  if (profile?.degree) add(profile.degree);
  if (profile?.ExpertiseDomains) add(String(profile.ExpertiseDomains));

  return interests;
};

/**
 * Computes an explainable relevance score for a task relative to a student.
 * 
 * Scoring Breakdown:
 * 1. Required Technical Skills Match (Primary):
 *    - Each direct/alias match: +10 pts
 *    - Verified skill bonus: +2 pts
 *    - Advanced level / high score bonus: +1 pt
 *    - Composite stack partial/full match: up to +10 pts
 *    - Match coverage density bonus: up to +15 pts (matchedCount / totalCount * 15)
 * 2. Role / Domain Match (Secondary):
 *    - +5 pts if task role aligns with student's branch/profile interests
 * 3. Title & Description Keywords (Tertiary / Lower Priority):
 *    - Skill mentioned in task title: +2 pts (capped at 4 pts)
 *    - Skill mentioned in task description: +1 pt (capped at 3 pts)
 */
export const scoreTaskForStudent = (task, studentSkills, studentInterests) => {
  const taskSkills = (task.skillsRequired || []).map((s) => ({
    original: s,
    norm: normalizeSkill(s),
  }));

  const studentSkillMap = new Map();
  studentSkills.forEach((s) => studentSkillMap.set(s.norm, s));

  // If student has no registered skills or interests
  if (studentSkillMap.size === 0 && studentInterests.size === 0) {
    return {
      matchScore: 0,
      matchedSkills: [],
      matchStrength: "none",
      matchReason: "",
    };
  }

  let score = 0;
  const matchedOriginalSkills = [];
  const matchedNorms = new Set();

  // 1. Evaluate task.skillsRequired
  taskSkills.forEach((ts) => {
    // Direct or alias match
    if (studentSkillMap.has(ts.norm)) {
      matchedOriginalSkills.push(ts.original);
      matchedNorms.add(ts.norm);
      const studentSkill = studentSkillMap.get(ts.norm);

      score += 10;
      if (studentSkill.verified) score += 2;
      if (studentSkill.score >= 85 || studentSkill.level === "Advanced") score += 1;
      return;
    }

    // Check composite stack expansion (e.g. task requires 'MERN')
    if (COMPOSITE_STACKS[ts.norm]) {
      const components = COMPOSITE_STACKS[ts.norm];
      const matchedComps = components.filter((comp) => studentSkillMap.has(comp));
      if (matchedComps.length > 0) {
        matchedOriginalSkills.push(ts.original);
        matchedNorms.add(ts.norm);
        const compFraction = matchedComps.length / components.length;
        score += Math.round(10 * compFraction);
        const hasVerified = matchedComps.some((c) => studentSkillMap.get(c)?.verified);
        if (hasVerified) score += 2;
      }
    }
  });

  // Coverage density bonus: Reward tasks where a high percentage of requirements are met
  if (taskSkills.length > 0 && matchedOriginalSkills.length > 0) {
    const coverage = matchedOriginalSkills.length / taskSkills.length;
    score += Math.round(coverage * 15);
  }

  // 2. Role / Domain Match
  const roleLower = String(task.roleOffered || "").toLowerCase();
  const categoryLower = String(task.category || "").toLowerCase();
  let roleMatched = false;

  for (const interest of studentInterests) {
    if (interest && (roleLower.includes(interest) || categoryLower.includes(interest))) {
      score += 5;
      roleMatched = true;
      break;
    }
  }

  // 3. Title & Description Keywords (Lower Priority)
  const titleLower = String(task.title || "").toLowerCase();
  const descLower = String(task.description || "").toLowerCase();

  let titleMatches = 0;
  let descMatches = 0;

  studentSkillMap.forEach((sk, norm) => {
    // Only count if not already credited in skillsRequired
    if (!matchedNorms.has(norm)) {
      if (titleMatches < 2 && titleLower.includes(norm)) {
        score += 2;
        titleMatches++;
      } else if (descMatches < 3 && descLower.includes(norm)) {
        score += 1;
        descMatches++;
      }
    }
  });

  // Classify match strength
  let matchStrength = "none";
  if (
    matchedOriginalSkills.length >= 2 ||
    (matchedOriginalSkills.length >= 1 && taskSkills.length <= 2) ||
    score >= 20
  ) {
    matchStrength = "strong";
  } else if (matchedOriginalSkills.length > 0 || score > 0) {
    matchStrength = "partial";
  }

  // Generate explainable match reason
  let matchReason = "";
  if (matchedOriginalSkills.length === 1) {
    matchReason = `Matches ${matchedOriginalSkills[0]}`;
  } else if (matchedOriginalSkills.length === 2) {
    matchReason = `Matches ${matchedOriginalSkills[0]} and ${matchedOriginalSkills[1]}`;
  } else if (matchedOriginalSkills.length > 2) {
    const firstTwo = matchedOriginalSkills.slice(0, 2).join(", ");
    const remaining = matchedOriginalSkills.length - 2;
    matchReason = `Matches ${firstTwo} +${remaining} more`;
  } else if (roleMatched && score > 0) {
    matchReason = `Matches role focus in ${task.roleOffered || "Development"}`;
  }

  return {
    matchScore: score,
    matchedSkills: matchedOriginalSkills,
    matchStrength,
    matchReason,
  };
};

/**
 * Deterministically sorts tasks by:
 * 1. Score DESC (Strong matches -> Partial matches -> Non-matches)
 * 2. Matched skill count DESC
 * 3. Match density ratio DESC
 * 4. Upcoming active deadline (sooner active deadline first)
 * 5. CreatedAt DESC
 * 6. Task ID deterministic string comparison
 */
export const sortTasksByRelevance = (taskList) => {
  if (!Array.isArray(taskList)) return [];

  return [...taskList].sort((a, b) => {
    // 0. Active, non-expired tasks must always appear before expired tasks
    const isAExpired = isTaskExpired(a);
    const isBExpired = isTaskExpired(b);
    if (!isAExpired && isBExpired) return -1;
    if (isAExpired && !isBExpired) return 1;

    const scoreA = typeof a.matchScore === "number" ? a.matchScore : 0;
    const scoreB = typeof b.matchScore === "number" ? b.matchScore : 0;

    // 1. Match score
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    // 2. Number of matched skills
    const countA = Array.isArray(a.matchedSkills) ? a.matchedSkills.length : 0;
    const countB = Array.isArray(b.matchedSkills) ? b.matchedSkills.length : 0;
    if (countB !== countA) {
      return countB - countA;
    }

    // 3. Upcoming deadline for tasks
    const tsA = typeof a.deadlineTs === "number"
      ? a.deadlineTs
      : a.lastDateToSubmit
      ? new Date(a.lastDateToSubmit).getTime()
      : Infinity;
    const tsB = typeof b.deadlineTs === "number"
      ? b.deadlineTs
      : b.lastDateToSubmit
      ? new Date(b.lastDateToSubmit).getTime()
      : Infinity;

    if (tsA !== tsB) {
      return tsA - tsB; // Sooner deadline ranks higher
    }

    // 4. Stable ID tie-breaker
    const idA = String(a.id || a._id || "");
    const idB = String(b.id || b._id || "");
    return idA.localeCompare(idB);
  });
};

/**
 * Ranks all eligible tasks for a student.
 * 
 * Strict Ordering Rule:
 * 1. Active, non-expired tasks appear first.
 * 2. Expired tasks appear after all active tasks.
 * 3. Preserves student's saved manual ordering within active and expired groups.
 * 4. Preserves recommendation relevance ranking within each group.
 */
export const rankTasksForStudent = (tasks, user, profile, manualOrderIds = null) => {
  if (!Array.isArray(tasks) || tasks.length === 0) return [];

  const studentSkills = extractStudentSkills(user, profile);
  const studentInterests = extractStudentInterests(user, profile);

  // Score every task
  const scoredTasks = tasks.map((task) => {
    const raw = typeof task.toObject === "function" ? task.toObject() : { ...task };
    const relevance = scoreTaskForStudent(raw, studentSkills, studentInterests);
    return {
      ...raw,
      ...relevance,
    };
  });

  // Strict separation: Active tasks must always appear before expired tasks
  const activeScored = scoredTasks.filter((t) => !isTaskExpired(t));
  const expiredScored = scoredTasks.filter((t) => isTaskExpired(t));

  const rankGroup = (group) => {
    if (!Array.isArray(group) || group.length === 0) return [];

    if (Array.isArray(manualOrderIds) && manualOrderIds.length > 0) {
      const orderMap = new Map();
      manualOrderIds.forEach((id, idx) => {
        orderMap.set(String(id), idx);
      });

      const explicitlyOrdered = [];
      const unranked = [];

      group.forEach((task) => {
        const taskId = String(task.id || task._id);
        if (orderMap.has(taskId)) {
          explicitlyOrdered.push(task);
        } else {
          unranked.push(task);
        }
      });

      explicitlyOrdered.sort((a, b) => {
        const idA = String(a.id || a._id);
        const idB = String(b.id || b._id);
        return orderMap.get(idA) - orderMap.get(idB);
      });

      const sortedUnranked = sortTasksByRelevance(unranked);
      return [...explicitlyOrdered, ...sortedUnranked];
    }

    return sortTasksByRelevance(group);
  };

  const rankedActive = rankGroup(activeScored);
  const rankedExpired = rankGroup(expiredScored);

  return [...rankedActive, ...rankedExpired];
};

export default {
  normalizeSkill,
  extractStudentSkills,
  extractStudentInterests,
  scoreTaskForStudent,
  sortTasksByRelevance,
  rankTasksForStudent,
};
