import {getDiarizationThreshold} from '../../shared/config/runtimeConfig';

export interface StoredEmbedding {
  vector: number[];
  duration: number;
  timestamp: number;
}

export interface SpeakerCluster {
  id: number;
  speakerId: string;
  speakerLabel: string;
  embeddings: StoredEmbedding[];
  centroid: number[];
  count: number;
  lastSeenTimestamp: number;
  confidence: number;
}

interface HistoricalEmbedding {
  utteranceId: string;
  embedding: number[];
  timestamp: number;
  clusterId: number;
}

export interface AssignmentResult {
  speakerId: string;
  speakerLabel: string;
  isNew: boolean;
  confidence: number;
  bestCosine: number;
  secondBestCosine: number;
  reason: string;
}

export interface ReassignmentResult {
  utteranceAssignments: Map<string, {speakerId: string; speakerLabel: string}>;
}

export interface SpeakerClusterConfig {
  similarityThreshold: number;
  highConfidenceThreshold: number;
  lowConfidenceThreshold: number;
  minUtteranceDuration: number;
  temporalBiasWindow: number;
  temporalBiasBoost: number;
  maxEmbeddingsPerCluster: number;
  minClusterSize: number;
  clusterMergeThreshold: number;
  maxSpeakers: number;
}

const DEFAULT_CONFIG: SpeakerClusterConfig = {
  similarityThreshold: 0.50,
  highConfidenceThreshold: 0.65,
  /** Only auto-create a new cluster when best match is below this (strict — avoids S3..S6 spam) */
  lowConfidenceThreshold: 0.22,
  minUtteranceDuration: 1.0,
  temporalBiasWindow: 10.0,
  temporalBiasBoost: 0.05,
  maxEmbeddingsPerCluster: 30,
  minClusterSize: 3,
  /** Aggressive merge: same person split across clusters often has centroid cos ~0.55–0.70 */
  clusterMergeThreshold: 0.68,
  maxSpeakers: 8,
};

/** Only allow automatic "strong-new-speaker" while there is a single cluster (0→S1 already done; 1 cluster → may add S2). Never auto-spawn S3+ from low score — that caused 5–6 speakers for 2 people. */
const ALLOW_STRONG_NEW_SPEAKER_ONLY_WHEN_CLUSTERS_LTE = 1;

const K_NEAREST = 3;

function toSpeakerId(index: number): string {
  return `S${index + 1}`;
}

export function getSpeakerColor(speakerId: string): {bg: string; text: string; border: string} {
  switch (speakerId) {
    case 'S1': return {bg: 'rgba(162,155,254,0.18)', text: '#A29BFE', border: 'rgba(162,155,254,0.4)'};
    case 'S2': return {bg: 'rgba(52,211,153,0.18)', text: '#34D399', border: 'rgba(52,211,153,0.4)'};
    case 'S3': return {bg: 'rgba(248,113,113,0.18)', text: '#F87171', border: 'rgba(248,113,113,0.4)'};
    case 'S4': return {bg: 'rgba(251,191,36,0.18)', text: '#FBBF24', border: 'rgba(251,191,36,0.4)'};
    default: return {bg: 'rgba(152,149,173,0.18)', text: '#9895AD', border: 'rgba(152,149,173,0.4)'};
  }
}

interface ScoredCluster {
  clusterIndex: number;
  topKSim: number;
  centroidSim: number;
  baseSimilarity: number;
  temporal: number;
  confidenceBoost: number;
  totalScore: number;
}

export function createSpeakerClusterService(overrides: Partial<SpeakerClusterConfig> = {}) {
  let config: SpeakerClusterConfig = {...DEFAULT_CONFIG, ...overrides};
  let clusters: SpeakerCluster[] = [];
  let allEmbeddings: HistoricalEmbedding[] = [];

  // ── Math ──

  function l2Normalize(vec: number[]): number[] {
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    if (norm < 1e-10) return [...vec];
    return vec.map((v) => v / norm);
  }

  function cosineSimilarity(a: number[], b: number[]): number {
    const n = Math.min(a.length, b.length);
    let dot = 0;
    for (let i = 0; i < n; i += 1) dot += a[i] * b[i];
    return dot;
  }

  function calculateCentroid(embs: StoredEmbedding[]): number[] {
    if (embs.length === 0) return [];
    const dim = embs[0].vector.length;
    const sum = new Array(dim).fill(0);
    let totalWeight = 0;

    for (const emb of embs) {
      // Weight embeddings by their duration (capped at 4s) so short noise doesn't pull centroid
      const w = Math.min(4.0, emb.duration);
      totalWeight += w;
      for (let i = 0; i < dim; i += 1) {
        sum[i] += emb.vector[i] * w;
      }
    }
    return l2Normalize(sum.map((v) => v / (totalWeight || 1)));
  }

  // ── Cluster operations ──

  function createCluster(embedding: number[], timestamp: number, duration: number, reason: string): AssignmentResult {
    const id = clusters.length;
    const speakerId = toSpeakerId(id);
    const cluster: SpeakerCluster = {
      id, speakerId, speakerLabel: `Speaker ${id + 1}`,
      embeddings: [{vector: [...embedding], duration, timestamp}],
      centroid: [...embedding],
      count: 1, lastSeenTimestamp: timestamp, confidence: 0.5,
    };
    clusters.push(cluster);
    allEmbeddings.push({utteranceId: '', embedding, timestamp, clusterId: id});
    
    // Safety check - maybe we shouldn't have created this (merge it instantly if highly similar)
    tryMergeClusters();
    
    return {
      speakerId, speakerLabel: cluster.speakerLabel, isNew: true,
      confidence: 0.5, bestCosine: -1, secondBestCosine: -1, reason,
    };
  }

  function assignToCluster(
    clusterIndex: number, embedding: number[], timestamp: number, duration: number, score: number, reason: string,
  ): AssignmentResult {
    const cluster = clusters[clusterIndex];
    cluster.embeddings.push({vector: embedding, duration, timestamp});
    if (cluster.embeddings.length > config.maxEmbeddingsPerCluster) {
      cluster.embeddings.shift();
    }
    cluster.centroid = calculateCentroid(cluster.embeddings);
    cluster.count += 1;
    cluster.lastSeenTimestamp = timestamp;
    cluster.confidence = Math.min(1, cluster.count / 10);
    allEmbeddings.push({utteranceId: '', embedding, timestamp, clusterId: cluster.id});
    return {
      speakerId: cluster.speakerId,
      speakerLabel: cluster.speakerLabel,
      isNew: false,
      confidence: score,
      bestCosine: score,
      secondBestCosine: -1,
      reason,
    };
  }

  // ── Merge ──

  function mergeClusters(keepIndex: number, removeIndex: number) {
    const keep = clusters[keepIndex];
    const remove = clusters[removeIndex];
    keep.embeddings.push(...remove.embeddings);
    // Sort by timestamp to keep the latest ones if we exceed max
    keep.embeddings.sort((a, b) => a.timestamp - b.timestamp);
    if (keep.embeddings.length > config.maxEmbeddingsPerCluster) {
      keep.embeddings = keep.embeddings.slice(-config.maxEmbeddingsPerCluster);
    }
    keep.centroid = calculateCentroid(keep.embeddings);
    keep.count += remove.count;
    keep.lastSeenTimestamp = Math.max(keep.lastSeenTimestamp, remove.lastSeenTimestamp);
    keep.confidence = Math.min(1, keep.count / 10);
    const removedId = remove.id;
    const keptId = keep.id;
    allEmbeddings = allEmbeddings.map((e) => e.clusterId === removedId ? {...e, clusterId: keptId} : e);
    clusters.splice(removeIndex, 1);
    renumberClusters();
  }

  function renumberClusters() {
    const oldToNew = new Map<number, number>();
    clusters.forEach((cluster, index) => {
      oldToNew.set(cluster.id, index);
      cluster.id = index;
      cluster.speakerId = toSpeakerId(index);
      cluster.speakerLabel = `Speaker ${index + 1}`;
    });
    allEmbeddings = allEmbeddings.map((e) => {
      const newId = oldToNew.get(e.clusterId);
      return newId !== undefined ? {...e, clusterId: newId} : e;
    });
  }

  function tryMergeClusters() {
    if (clusters.length < 2) return;
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < clusters.length; i += 1) {
        for (let j = i + 1; j < clusters.length; j += 1) {
          // Use Top-K similarity between clusters instead of just centroid
          // A cluster is highly similar to another if their top K embeddings match well
          const sim = cosineSimilarity(clusters[i].centroid, clusters[j].centroid);
          const young = clusters[i].count < config.minClusterSize || clusters[j].count < config.minClusterSize;
          const bar = young ? config.clusterMergeThreshold - 0.10 : config.clusterMergeThreshold;
          
          if (sim >= bar) {
            const [keep, remove] = clusters[i].count >= clusters[j].count ? [i, j] : [j, i];
            mergeClusters(keep, remove);
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
    }
  }

  // ── Scoring ──

  function scoreClusters(embedding: number[], timestamp: number): ScoredCluster[] {
    return clusters.map((cluster, index) => {
      // 1. Centroid Similarity (baseline)
      const centroidSim = cosineSimilarity(embedding, cluster.centroid);
      
      // 2. Top-K kNN Similarity
      // Compute similarity against all stored history to bypass noise
      const memberSims = cluster.embeddings.map((e) => cosineSimilarity(embedding, e.vector));
      memberSims.sort((a, b) => b - a); // Descending
      const k = Math.min(K_NEAREST, memberSims.length);
      let sumTopK = 0;
      for (let i = 0; i < k; i++) sumTopK += memberSims[i];
      const topKSim = k > 0 ? sumTopK / k : centroidSim;

      // 3. Blended Base Similarity
      // We rely heavily on Top-K to avoid the "polluted centroid" drift
      const baseSimilarity = 0.7 * topKSim + 0.3 * centroidSim;

      // 4. Temporal Bias (only if 2+ speakers exist, prevents S1-lock-in)
      const ageSec = (timestamp - cluster.lastSeenTimestamp) / 1000;
      const temporal = clusters.length >= 2 && ageSec <= config.temporalBiasWindow
        ? config.temporalBiasBoost : 0;

      // 5. Confidence Boost
      const confidenceBoost = cluster.count >= config.minClusterSize ? 0.02 : 0;
      const totalScore = Math.min(1, Math.max(-1, baseSimilarity + temporal + confidenceBoost));

      return {clusterIndex: index, topKSim, centroidSim, baseSimilarity, temporal, confidenceBoost, totalScore};
    }).sort((a, b) => b.totalScore - a.totalScore);
  }

  function effectiveThreshold(): number {
    const runtime = getDiarizationThreshold();
    if (!runtime) return config.similarityThreshold;
    return 0.7 * config.similarityThreshold + 0.3 * runtime;
  }

  // ── Public service ──

  const service = {
    reset() {
      clusters = [];
      allEmbeddings = [];
    },

    setThreshold(value: number) {
      config = {...config, similarityThreshold: value};
    },

    setConfig(overrides: Partial<SpeakerClusterConfig>) {
      config = {...config, ...overrides};
    },

    addEmbedding(
      utteranceId: string,
      rawEmbedding: number[],
      timestamp: number,
      utteranceDuration = 1,
    ): AssignmentResult {
      // Drop audio that is too short to be reliable at all
      if (utteranceDuration < config.minUtteranceDuration) {
        return {
          speakerId: '', speakerLabel: '', isNew: false, confidence: 0,
          bestCosine: -1, secondBestCosine: -1, reason: 'too-short',
        };
      }

      const embedding = l2Normalize(rawEmbedding);

      if (clusters.length === 0) {
        const result = createCluster(embedding, timestamp, utteranceDuration, 'first-speaker');
        allEmbeddings[allEmbeddings.length - 1].utteranceId = utteranceId;
        return result;
      }

      const scores = scoreClusters(embedding, timestamp);
      const best = scores[0];
      const second = scores.length >= 2 ? scores[1] : null;
      
      // Use Top-K similarity as the purest metric for logic gates
      const baseScore = best.baseSimilarity;
      const gap = second ? (best.baseSimilarity - second.baseSimilarity) : baseScore;
      const threshold = effectiveThreshold();

      let result: AssignmentResult;

      // ── LOGIC GATES ──
      // This tree is designed to prevent over-segmentation (creating fake S3/S4)
      // while allowing clear new speakers (S2) to form when similarity drops hard.

      if (baseScore >= config.highConfidenceThreshold) {
        // High confidence match
        result = assignToCluster(best.clusterIndex, embedding, timestamp, utteranceDuration, best.totalScore, 'high-confidence');
      } 
      else if (second && gap > 0.15) {
        // Very clear margin between S1 and S2
        result = assignToCluster(best.clusterIndex, embedding, timestamp, utteranceDuration, best.totalScore, 'clear-margin');
      } 
      else if (second && gap <= 0.05 && best.totalScore < threshold) {
        // Two clusters compete, but both are low score -> fallback to more recent one to ride the wave
        const bestTime = clusters[best.clusterIndex].lastSeenTimestamp;
        const secondTime = clusters[second.clusterIndex].lastSeenTimestamp;
        const winner = bestTime >= secondTime ? best : second;
        result = assignToCluster(winner.clusterIndex, embedding, timestamp, utteranceDuration, winner.totalScore, 'ambiguous-tiebreak');
      }
      else if (baseScore >= threshold) {
        // Regular match above UI threshold
        result = assignToCluster(best.clusterIndex, embedding, timestamp, utteranceDuration, best.totalScore, 'above-threshold');
      }
      else if (
        baseScore < config.lowConfidenceThreshold
        && clusters.length <= ALLOW_STRONG_NEW_SPEAKER_ONLY_WHEN_CLUSTERS_LTE
        && clusters.length < config.maxSpeakers
      ) {
        // Second speaker only: when we still have exactly one cluster and match is very poor
        result = createCluster(embedding, timestamp, utteranceDuration, 'strong-new-speaker');
      }
      else {
        // Low match but already 2+ clusters: do NOT spawn S3+ (same person often <0.35 to wrong centroids)
        result = assignToCluster(best.clusterIndex, embedding, timestamp, utteranceDuration, best.totalScore, 'fallback-noise-suppressed');
      }

      // Link utteranceId
      const last = allEmbeddings[allEmbeddings.length - 1];
      if (last && last.utteranceId === '') last.utteranceId = utteranceId;

      tryMergeClusters();

      const updatedScores = scoreClusters(embedding, timestamp);
      const bestCos = updatedScores[0]?.totalScore ?? best.totalScore;
      const secondCos = updatedScores[1]?.totalScore ?? -1;

      if (__DEV__) {
        console.log('[Diarization]', {
          id: utteranceId.slice(-4),
          dur: `${utteranceDuration.toFixed(1)}s`,
          c: clusters.length,
          topK: best.topKSim.toFixed(3),
          centroid: best.centroidSim.toFixed(3),
          gap: gap.toFixed(3),
          decision: result.reason,
          assigned: result.speakerId,
        });
      }

      return {...result, bestCosine: bestCos, secondBestCosine: secondCos};
    },

    recalculateAll(): ReassignmentResult {
      if (allEmbeddings.length < 4) {
        return {utteranceAssignments: new Map()};
      }
      const oldEmbeddings = [...allEmbeddings];
      clusters = [];
      allEmbeddings = [];
      const reassigned = new Map<string, {speakerId: string; speakerLabel: string}>();
      
      // Chronological replay
      for (const item of oldEmbeddings.sort((a, b) => a.timestamp - b.timestamp)) {
        // Force a slightly stricter minimum duration during recalculation
        // to build highly reliable base clusters.
        const dur = Math.max(1.2, config.minUtteranceDuration);
        const r = service.addEmbedding(item.utteranceId, item.embedding, item.timestamp, dur);
        if (item.utteranceId) {
          reassigned.set(item.utteranceId, {speakerId: r.speakerId, speakerLabel: r.speakerLabel});
        }
      }
      return {utteranceAssignments: reassigned};
    },

    getSpeakerCount() {
      return clusters.length;
    },

    getClusters() {
      return [...clusters];
    },

    getSpeakerMetadata(speakerId: string) {
      const cluster = clusters.find((c) => c.speakerId === speakerId);
      if (!cluster) return null;
      const color = getSpeakerColor(speakerId);
      return {speakerId: cluster.speakerId, speakerLabel: cluster.speakerLabel, color: color.text, bg: color.bg, border: color.border};
    },

    getConfig() {
      return {...config};
    },
  };

  return service;
}

export type SpeakerClusterService = ReturnType<typeof createSpeakerClusterService>;

let singleton: SpeakerClusterService | null = null;
export function getSpeakerClusterService(): SpeakerClusterService {
  if (!singleton) singleton = createSpeakerClusterService();
  return singleton;
}
