/**
 * Intent Classification System
 *
 * Classifies user queries into 7 intent categories using pattern matching.
 * This determines which layout strategy will be applied to the generated page.
 */

import { UserIntent } from '@/lib/constants/intent-layouts';

export interface IntentClassificationResult {
  intent: UserIntent;
  confidence: number;
  matchedPatterns: string[];
  reasoning: string;
}

/**
 * Pattern definitions for each intent type
 */
const INTENT_PATTERNS: Record<UserIntent, {
  keywords: string[];
  phrases: string[];
  questionPatterns: RegExp[];
}> = {
  product_inquiry: {
    keywords: ['what is', 'tell me about', 'explain', 'bevgenie', 'product', 'platform', 'overview', 'about'],
    phrases: [
      'what is bevgenie',
      'tell me about bevgenie',
      'what does bevgenie do',
      'bevgenie overview',
      'what can bevgenie',
      'describe bevgenie'
    ],
    questionPatterns: [
      /^what (?:is|does|can) (?:this|the|your)?\s?(?:product|platform|solution|tool)/i,
      /^(?:tell|explain).*(?:about|bevgenie|platform|product)/i,
      /^(?:what|who) (?:are|is) (?:you|bevgenie)/i
    ]
  },

  feature_question: {
    keywords: ['feature', 'capability', 'function', 'can it', 'does it have', 'support', 'integrate', 'analytics'],
    phrases: [
      'what features',
      'does it have',
      'can it do',
      'what capabilities',
      'how does it work',
      'what can it do',
      'features available',
      'functionality'
    ],
    questionPatterns: [
      /^what (?:features|capabilities|functions)/i,
      /^(?:does it|can it|do you) (?:have|support|offer|provide)/i,
      /^(?:how|what) (?:does|do) (?:it|the|your)?\s?(?:features?|work)/i,
      /^(?:list|show|tell).*(?:features|capabilities)/i
    ]
  },

  comparison: {
    keywords: ['vs', 'versus', 'compare', 'comparison', 'competitor', 'alternative', 'difference', 'better than', 'why choose'],
    phrases: [
      'bevgenie vs',
      'compare to',
      'compared to',
      'better than',
      'why choose bevgenie',
      'advantages over',
      'difference between',
      'alternative to'
    ],
    questionPatterns: [
      /\bvs\b|\bversus\b/i,
      /\bcompare(?:d)?\s+(?:to|with|against)/i,
      /\b(?:better|different)\s+(?:than|from)/i,
      /\b(?:why|how)\s+(?:choose|use|prefer)/i,
      /\balternative(?:s)?\s+to/i
    ]
  },

  stats_roi: {
    keywords: ['roi', 'results', 'metrics', 'stats', 'statistics', 'impact', 'performance', 'outcomes', 'savings', 'revenue', 'growth'],
    phrases: [
      'what results',
      'roi calculator',
      'show me stats',
      'what impact',
      'how much save',
      'revenue increase',
      'proven results',
      'customer success'
    ],
    questionPatterns: [
      /\b(?:roi|return on investment)/i,
      /\b(?:results|metrics|stats|statistics|outcomes)\b/i,
      /\b(?:how much|what).*(?:save|increase|improve|gain)/i,
      /\b(?:impact|performance|growth|revenue)/i,
      /\bproven\s+(?:results|success)/i
    ]
  },

  implementation: {
    keywords: ['get started', 'how to', 'implement', 'setup', 'onboard', 'launch', 'install', 'deploy', 'integration', 'timeline'],
    phrases: [
      'get started',
      'how to start',
      'implementation process',
      'setup guide',
      'onboarding',
      'launch timeline',
      'how long to implement',
      'integration steps'
    ],
    questionPatterns: [
      /^(?:how (?:do|can) (?:i|we)).*(?:get started|start|begin|implement|setup|onboard)/i,
      /\b(?:implementation|setup|onboarding|integration)\s+(?:process|steps|guide|timeline)/i,
      /\bhow long.*(?:to|does it take).*(?:implement|setup|launch)/i,
      /^(?:what|show).*(?:steps|process).*(?:get started|implement)/i
    ]
  },

  use_case: {
    keywords: ['can you help', 'use case', 'scenario', 'for my', 'my business', 'my team', 'problem', 'challenge', 'need', 'looking for'],
    phrases: [
      'can you help with',
      'does it work for',
      'use case for',
      'my business',
      'my problem',
      'i need',
      'looking for solution',
      'solve my'
    ],
    questionPatterns: [
      /^(?:can|could|will).*(?:help|work|solve|address)/i,
      /\b(?:my|our)\s+(?:business|team|company|problem|challenge|need)/i,
      /\buse case.*for\b/i,
      /\b(?:looking for|need|want).*(?:solution|help|tool)/i,
      /\b(?:does it|can it).*work.*for\b/i
    ]
  },

  off_topic: {
    keywords: ['weather', 'recipe', 'movie', 'sports', 'politics', 'joke', 'game', 'music', 'news'],
    phrases: [
      'tell me a joke',
      'what\'s the weather',
      'latest news',
      'movie recommendation',
      'recipe for',
      'sports score'
    ],
    questionPatterns: [
      /^(?:tell|give|show).*(?:joke|story|game)/i,
      /\b(?:weather|recipe|movie|sports|politics|music|news)\b/i,
      /^(?:what|who|how).*(?:not related to beverage|unrelated)/i
    ]
  }
};

/**
 * Classify user intent using pattern matching
 */
export function classifyIntent(userMessage: string): IntentClassificationResult {
  const normalizedMessage = userMessage.toLowerCase().trim();
  const scores: Record<UserIntent, number> = {
    product_inquiry: 0,
    feature_question: 0,
    comparison: 0,
    stats_roi: 0,
    implementation: 0,
    use_case: 0,
    off_topic: 0
  };

  const matchedPatterns: Record<UserIntent, string[]> = {
    product_inquiry: [],
    feature_question: [],
    comparison: [],
    stats_roi: [],
    implementation: [],
    use_case: [],
    off_topic: []
  };

  // Score each intent based on pattern matches
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    const intentKey = intent as UserIntent;

    // Check keywords (weight: 1 point each)
    patterns.keywords.forEach(keyword => {
      if (normalizedMessage.includes(keyword)) {
        scores[intentKey] += 1;
        matchedPatterns[intentKey].push(`keyword:${keyword}`);
      }
    });

    // Check phrases (weight: 3 points each - more specific)
    patterns.phrases.forEach(phrase => {
      if (normalizedMessage.includes(phrase)) {
        scores[intentKey] += 3;
        matchedPatterns[intentKey].push(`phrase:${phrase}`);
      }
    });

    // Check regex patterns (weight: 5 points each - most specific)
    patterns.questionPatterns.forEach((pattern, idx) => {
      if (pattern.test(normalizedMessage)) {
        scores[intentKey] += 5;
        matchedPatterns[intentKey].push(`pattern:${idx}`);
      }
    });
  }

  // Find highest scoring intent
  let maxScore = -1;
  let topIntent: UserIntent = 'product_inquiry'; // default fallback

  for (const [intent, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      topIntent = intent as UserIntent;
    }
  }

  // Apply special rules for edge cases
  if (maxScore === 0) {
    // No patterns matched - classify based on message characteristics
    if (normalizedMessage.length < 20 && normalizedMessage.includes('bevgenie')) {
      topIntent = 'product_inquiry';
      matchedPatterns.product_inquiry.push('rule:short_bevgenie_mention');
      maxScore = 2;
    } else if (normalizedMessage.includes('?') && normalizedMessage.split(' ').length < 10) {
      topIntent = 'feature_question';
      matchedPatterns.feature_question.push('rule:short_question');
      maxScore = 1;
    } else {
      // Long, unfocused query - treat as use_case
      topIntent = 'use_case';
      matchedPatterns.use_case.push('rule:generic_query');
      maxScore = 1;
    }
  }

  // Calculate confidence (0-1 scale)
  // Confidence based on score magnitude and distinctiveness
  const totalScore = Object.values(scores).reduce((sum, s) => sum + s, 0);
  const confidence = totalScore > 0
    ? Math.min(1.0, maxScore / (totalScore * 0.6)) // Top intent should be >60% of total
    : 0.3; // Low confidence for fallback cases

  // Generate reasoning
  const reasoning = generateReasoning(topIntent, matchedPatterns[topIntent], maxScore, confidence);

  console.log(`🎯 [Intent Classifier] Query: "${userMessage.substring(0, 60)}..."`);
  console.log(`🎯 [Intent Classifier] Result: ${topIntent} (confidence: ${Math.round(confidence * 100)}%)`);
  console.log(`🎯 [Intent Classifier] Scores:`, scores);
  console.log(`🎯 [Intent Classifier] Reasoning: ${reasoning}`);

  return {
    intent: topIntent,
    confidence,
    matchedPatterns: matchedPatterns[topIntent],
    reasoning
  };
}

/**
 * Generate human-readable reasoning for classification
 */
function generateReasoning(
  intent: UserIntent,
  matches: string[],
  score: number,
  confidence: number
): string {
  const intentLabels: Record<UserIntent, string> = {
    product_inquiry: 'Product inquiry - user wants to understand what BevGenie is',
    feature_question: 'Feature question - user asking about specific capabilities',
    comparison: 'Comparison - user comparing BevGenie to alternatives',
    stats_roi: 'Stats/ROI - user interested in metrics and business impact',
    implementation: 'Implementation - user asking about getting started',
    use_case: 'Use case - user exploring if BevGenie fits their needs',
    off_topic: 'Off-topic - query not related to beverage intelligence'
  };

  const matchSummary = matches.length > 0
    ? `Matched ${matches.length} pattern(s)`
    : 'No explicit patterns, using heuristics';

  return `${intentLabels[intent]}. ${matchSummary}. Score: ${score}, Confidence: ${Math.round(confidence * 100)}%`;
}

/**
 * Batch classify multiple messages
 */
export function classifyIntentBatch(messages: string[]): IntentClassificationResult[] {
  return messages.map(classifyIntent);
}

/**
 * Get confidence threshold recommendations
 */
export function getConfidenceThreshold(intent: UserIntent): number {
  // Different intents have different confidence requirements
  const thresholds: Record<UserIntent, number> = {
    product_inquiry: 0.4, // Very common, can be more lenient
    feature_question: 0.5, // Common, moderate threshold
    comparison: 0.7, // Very specific patterns, should be confident
    stats_roi: 0.6, // Specific terminology, should be confident
    implementation: 0.6, // Specific action words, should be confident
    use_case: 0.3, // Catch-all category, can be lenient
    off_topic: 0.8 // Should be very confident before redirecting
  };

  return thresholds[intent];
}

/**
 * Validate if classification meets confidence threshold
 */
export function isConfidentClassification(result: IntentClassificationResult): boolean {
  const threshold = getConfidenceThreshold(result.intent);
  return result.confidence >= threshold;
}

/**
 * Get fallback intent when confidence is too low
 */
export function getFallbackIntent(result: IntentClassificationResult): UserIntent {
  if (!isConfidentClassification(result)) {
    // For low confidence, default to use_case (most flexible)
    console.log(`⚠️ [Intent Classifier] Low confidence (${Math.round(result.confidence * 100)}%), falling back to use_case`);
    return 'use_case';
  }
  return result.intent;
}
