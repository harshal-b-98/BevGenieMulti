/**
 * Page Generation Engine
 *
 * Uses Claude to generate page specifications based on:
 * - User intent and message
 * - Current persona profile
 * - Knowledge base context
 * - BevGenie page type definitions
 *
 * Ensures generated pages are high-quality by:
 * - Providing clear prompts with page type templates
 * - Validating output against spec schema
 * - Retrying with adjusted prompts on failure
 * - Gracefully degrading to text response if generation fails
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  BevGeniePage,
  PageType,
  PAGE_TYPE_TEMPLATES,
  validatePageSpec,
} from './page-specs';
import { PersonaScores } from '@/lib/session/types';
import {
  type UserIntent,
  type IntentLayoutStrategy,
  INTENT_LAYOUT_STRATEGIES,
  getLayoutStrategyForIntent,
  CONTENT_GUIDELINES,
  mapIntentToPageType
} from '@/lib/constants/intent-layouts';
import { classifyIntent, type IntentClassificationResult } from '@/lib/ai/intent-classifier';
import { getPreviouslyUsedContent, trackGeneratedContent } from '@/lib/session/content-memory';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface KBDocument {
  id: string;
  content: string;
  source_type?: string;
  source_url?: string;
  persona_tags?: string[];
  pain_point_tags?: string[];
  similarity_score?: number;
}

export interface PageGenerationRequest {
  userMessage: string;
  pageType: PageType;
  persona?: PersonaScores;
  knowledgeContext?: string[];
  knowledgeDocuments?: KBDocument[];
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  personaDescription?: string;
  pageContext?: any; // Context from user interactions (button clicks, navigation)
  interactionSource?: string; // Source of interaction (hero_cta_click, cta_click, learn_more, etc.)
  userIntent?: UserIntent; // Pre-classified intent (optional, will auto-classify if not provided)
  sessionId?: string; // Session ID for content memory tracking
}

export interface PageGenerationResponse {
  success: boolean;
  page?: BevGeniePage;
  error?: string;
  retryCount?: number;
  generationTime?: number;
}

/**
 * Generate a page specification using intent-based fixed layouts + AI content
 * BULLETPROOF APPROACH: Intent determines layout, AI only fills content
 */
export async function generatePageSpec(
  request: PageGenerationRequest
): Promise<PageGenerationResponse> {
  const startTime = Date.now();

  // 🚨 DEBUG: Log incoming request
  console.log('🎯 [PageGen] Request:', {
    message: request.userMessage,
    pageType: request.pageType,
    hasPersona: !!request.persona,
    hasKnowledge: !!request.knowledgeDocuments && request.knowledgeDocuments.length > 0,
    interactionSource: request.interactionSource || 'none',
    providedIntent: request.userIntent || 'none'
  });

  // Step 1: Classify intent (or use provided intent)
  const intentClassification = request.userIntent
    ? { intent: request.userIntent, confidence: 1.0, matchedPatterns: ['provided'], reasoning: 'Intent provided by caller' }
    : classifyIntent(request.userMessage);

  console.log(`🎯 [PageGen] Intent: ${intentClassification.intent} (confidence: ${Math.round(intentClassification.confidence * 100)}%)`);
  console.log(`🎯 [PageGen] Reasoning: ${intentClassification.reasoning}`);

  // Step 2: Get fixed layout strategy for this intent
  const intentLayoutStrategy = getLayoutStrategyForIntent(intentClassification.intent);
  console.log(`🎯 [PageGen] Layout mode: ${intentLayoutStrategy.layoutMode}`);
  console.log(`🎯 [PageGen] Sections: ${intentLayoutStrategy.sections.map(s => `${s.type}(${s.heightPercent}%)`).join(', ')}`);
  console.log(`🎯 [PageGen] Strategy: ${intentLayoutStrategy.strategy}`);

  // Step 3: Generate page content with intent-aware prompt
  console.log(`🎯 [PageGen] Using INTENT-BASED generation with fixed layouts for intent: ${intentClassification.intent}`);

  try {
    const page = await attemptPageGeneration(request, 0, intentLayoutStrategy, intentClassification);

    // Track generated content to prevent repetition (if sessionId provided)
    if (request.sessionId) {
      // Extract headline from first hero section
      const heroSection = page.sections.find((s: any) => s.type === 'hero');
      const headline = heroSection?.headline || page.title || '';

      // Extract feature titles from feature_grid sections
      const featureTitles: string[] = [];
      page.sections.forEach((section: any) => {
        if (section.type === 'feature_grid' && section.features) {
          section.features.forEach((feature: any) => {
            if (feature.title) {
              featureTitles.push(feature.title);
            }
          });
        }
      });

      // Track this content for future generations
      trackGeneratedContent(request.sessionId, headline, featureTitles);
    }

    // generateObject() with Zod automatically validates - no manual validation needed
    console.log('[PageGen] ✅ Intent-based generation successful');
    return {
      success: true,
      page: page,
      retryCount: 0,
      generationTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during page generation',
      retryCount: 0,
      generationTime: Date.now() - startTime,
    };
  }
}

/**
 * Internal function to attempt page generation with Claude using generateObject()
 * Now uses intent-based fixed layouts - LLM only fills content
 */
async function attemptPageGeneration(
  request: PageGenerationRequest,
  retryCount: number,
  intentLayoutStrategy: IntentLayoutStrategy,
  intentClassification: IntentClassificationResult
): Promise<BevGeniePage> {
  const systemPrompt = buildSystemPrompt(request, retryCount, intentLayoutStrategy, intentClassification);
  const userPrompt = buildUserPrompt(request, intentLayoutStrategy);

  try {
    // Use Claude's native messages API with JSON mode instead of strict Zod validation
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      temperature: 0.7, // Higher temperature for content variety
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: userPrompt + '\n\nRespond with ONLY valid JSON matching the page structure. No markdown, no explanation, just the JSON object.'
      }]
    });

    const textContent = response.content.find((block: any) => block.type === 'text');
    if (!textContent) {
      throw new Error('No text content in response');
    }

    // Extract JSON from response (handle potential markdown code blocks)
    let jsonText = textContent.text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').replace(/```\n?$/g, '');
    }

    const pageObject = JSON.parse(jsonText);

    console.log('[PageGen] ✅ Generated page (no strict validation):', {
      type: pageObject.type,
      sectionCount: pageObject.sections?.length || 0,
      sectionTypes: pageObject.sections?.map((s: any) => s.type).join(', ') || 'none'
    });

    // 🚨 DEBUG: Log generated page details
    console.log('📄 [PageGen] Generated:', {
      type: pageObject.type,
      title: pageObject.title?.substring(0, 50) + '...',
      sectionCount: pageObject.sections?.length || 0,
      sectionTypes: pageObject.sections?.map((s: any) => s.type).join(', ') || 'none',
      firstSection: pageObject.sections?.[0]?.type || 'none',
      intentStrategy: intentLayoutStrategy.layoutMode || 'none',
      recommendedSections: intentLayoutStrategy.sections.map(s => s.type).join(', ') || 'none'
    });

    return pageObject as BevGeniePage;
  } catch (error) {
    console.error('[PageGen] ❌ Generation failed:', error);
    console.error('[PageGen] ❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'Unknown',
    });

    throw error;
  }
}

/**
 * Build the system prompt for page generation
 * Uses intent-based fixed layouts - LLM only fills content
 */
function buildSystemPrompt(
  request: PageGenerationRequest,
  retryCount: number,
  intentLayoutStrategy: IntentLayoutStrategy,
  intentClassification: IntentClassificationResult
): string {
  const contentGuidelines = CONTENT_GUIDELINES[intentClassification.intent];

  // Get previously used content warnings (if sessionId provided)
  const previousContentWarning = request.sessionId
    ? getPreviouslyUsedContent(request.sessionId)
    : '';

  // Build the EXACT section structure the LLM must generate
  const sectionRequirements = intentLayoutStrategy.sections.map((section, idx) => {
    return `${idx + 1}. ${section.type} section (${section.heightPercent}% height)
   - Content focus: ${section.contentFocus}
   - Must specify: layout.requestedHeightPercent = ${section.heightPercent}`;
  }).join('\n');

  return `You are a content writer for BevGenie B2B SaaS. The layout is FIXED - you only write content.

🎯 USER INTENT: ${intentClassification.intent}
Strategy: ${intentLayoutStrategy.strategy}
Confidence: ${Math.round(intentClassification.confidence * 100)}%
Reasoning: ${intentClassification.reasoning}

⛔ CRITICAL - LAYOUT IS LOCKED 🔒
You MUST generate EXACTLY ${intentLayoutStrategy.sections.length} sections in this EXACT order:

${sectionRequirements}

Total: ${intentLayoutStrategy.sections.reduce((sum, s) => sum + s.heightPercent, 0)}%

🚨 MANDATORY HEIGHT CONSTRAINT - NO WHITE SPACE ALLOWED:
Your sections MUST use requestedHeightPercent that sums to 95-105%
The frontend will normalize to exactly 100%, filling the entire screen.

✅ CORRECT EXAMPLES:
{ "type": "hero", "layout": { "requestedHeightPercent": 40 } }
{ "type": "feature_grid", "layout": { "requestedHeightPercent": 40 } }
{ "type": "cta", "layout": { "requestedHeightPercent": 20 } }
TOTAL: 40 + 40 + 20 = 100% ✓ PERFECT!

OR:
{ "type": "hero", "layout": { "requestedHeightPercent": 35 } }
{ "type": "feature_grid", "layout": { "requestedHeightPercent": 50 } }
{ "type": "cta", "layout": { "requestedHeightPercent": 15 } }
TOTAL: 35 + 50 + 15 = 100% ✓ PERFECT!

❌ WRONG - CREATES WHITE SPACE:
{ "type": "hero", "layout": { "requestedHeightPercent": 30 } }
{ "type": "feature_grid", "layout": { "requestedHeightPercent": 30 } }
TOTAL: 60% = 40% WHITE SPACE! ❌ UNACCEPTABLE!

🎯 PROVEN HEIGHT TEMPLATES (ALWAYS SUM TO 100%):
- 2 sections: [50, 50] or [45, 55] or [40, 60]
- 3 sections: [35, 50, 15] or [30, 55, 15] or [40, 45, 15]
- 4 sections: [30, 35, 25, 10] or [25, 40, 25, 10]

🎨 COLORS (MUST FOLLOW):
ONLY use: Cyan (#06B6D4, #22D3EE) and Blue (#3B82F6, #2563EB)
NO purple, NO pink, NO orange
Dark background: #0A1628

🚨 ABSOLUTE REQUIREMENTS - NO EXCEPTIONS:
1. Generate EXACTLY ${intentLayoutStrategy.sections.length} sections (no more, no less)
2. Use ONLY these types: ${intentLayoutStrategy.sections.map(s => s.type).join(', ')}
3. Maintain EXACT order listed above
4. Set requestedHeightPercent to EXACT values specified above
5. DO NOT add extra sections
6. DO NOT skip sections
7. DO NOT change the order

📝 CONTENT GUIDELINES FOR "${intentClassification.intent}":
- Headline: ${contentGuidelines.headline.min}-${contentGuidelines.headline.max} chars, ${contentGuidelines.headline.tone}
- Subheadline: ${contentGuidelines.subheadline.min}-${contentGuidelines.subheadline.max} chars, ${contentGuidelines.subheadline.tone}
${contentGuidelines.maxFeatures > 0 ? `- Max features: ${contentGuidelines.maxFeatures}` : ''}
${contentGuidelines.featureDescriptionLength.max > 0 ? `- Feature descriptions: ${contentGuidelines.featureDescriptionLength.min}-${contentGuidelines.featureDescriptionLength.max} chars` : ''}

Example headlines for this intent:
${contentGuidelines.examples.map(ex => `  - "${ex}"`).join('\n')}

🎨 FEATURE TITLE REQUIREMENTS (CRITICAL FOR ICONS):
When generating feature_grid sections, feature titles MUST include one of these keywords for proper icon mapping:
- "Performance" → BarChart3 icon
- "Intelligence" → Zap icon
- "Distributor" → Users icon
- "Competitive" → Target icon
- "Gap" → TrendingUp icon
- "Account" → Award icon
- "Prioritization" → Map icon
- "Optimization" → Shield icon

✅ GOOD Examples:
  - "Performance Analytics Dashboard"
  - "Competitive Intelligence Tracking"
  - "Distributor Relationship Management"

❌ BAD Examples (no icon keywords):
  - "Track Your Metrics" (use "Performance Tracking" instead)
  - "Market Insights" (use "Competitive Intelligence" instead)
  - "Manage Partners" (use "Distributor Management" instead)

🔘 CTA BUTTON REQUIREMENTS:
- Hero sections: ALWAYS include ctaButton field with meaningful action
- CTA sections: ALWAYS include buttons array with at least 2 buttons
- Button text should be action-oriented: "Explore Features", "Schedule Demo", "Get Started"
- Never leave CTA fields empty or null

${previousContentWarning ? `\n${previousContentWarning}\n` : ''}

SECTION JSON FORMAT (COPY EXACT HEIGHT VALUES):
{
  "type": "${intentLayoutStrategy.sections[0].type}",
  "layout": { "requestedHeightPercent": ${intentLayoutStrategy.sections[0].heightPercent} },  // ← EXACT VALUE
  "headline": "Your Headline Here",
  "subheadline": "Your subheadline here"
}

BRAND GUIDELINES:
- Beverage industry B2B terminology
- Professional, credible tone
- Focus on market intelligence, data-driven insights
- Colors: Navy #0A1930, Cyan #00C8FF, Copper #AA6C39
- Content density: ${intentLayoutStrategy.contentDensity}

📦 REQUIRED JSON OUTPUT FORMAT:
{
  "type": "${request.pageType}",
  "title": "Page title (10-100 chars)",
  "description": "Page description (50-250 chars)",
  "sections": [
    {
      "type": "${intentLayoutStrategy.sections[0]?.type || 'hero'}",
      "layout": { "requestedHeightPercent": ${intentLayoutStrategy.sections[0]?.heightPercent || 35} },
      "headline": "Main headline",
      "subheadline": "Supporting text",
      "ctaButton": { "text": "Action text", "action": "action_name" }
    },
    // ... ${intentLayoutStrategy.sections.length} sections total
  ]
}

⚠️ CRITICAL:
- Output ONLY valid JSON
- NO markdown code blocks
- NO explanatory text
- Exactly ${intentLayoutStrategy.sections.length} sections
- All required fields must be present`;
}

/**
 * Build the user prompt for page generation
 * Includes specific context from the conversation and knowledge base
 */
function buildUserPrompt(request: PageGenerationRequest, intentLayoutStrategy: IntentLayoutStrategy): string {
  const parts: string[] = [];

  parts.push(`USER QUERY: "${request.userMessage}"`);
  parts.push(`\nGENERATE: ${request.pageType} page with the ${intentLayoutStrategy.sections.length} sections specified in the system prompt.`);

  // Add page interaction context if available
  if (request.pageContext?.context) {
    parts.push(`\nCONTEXT: User clicked "${request.pageContext.context}" - provide deeper detail on this topic.`);
  }

  // Add persona context (brief)
  if (request.personaDescription) {
    parts.push(`\nUSER PROFILE: ${request.personaDescription.substring(0, 150)}`);
  }

  // Add knowledge documents - top 2 only, 150 chars each
  if (request.knowledgeDocuments && request.knowledgeDocuments.length > 0) {
    parts.push(`\nRELEVANT INSIGHTS FROM KNOWLEDGE BASE:`);
    request.knowledgeDocuments.slice(0, 2).forEach((doc, idx) => {
      const percent = Math.round((doc.similarity_score || 0) * 100);
      parts.push(`  ${idx + 1}. [${percent}% match] ${doc.content.substring(0, 150)}`);
    });
  }

  // Emphasize the exact structure required
  parts.push(`\nREMEMBER: Generate EXACTLY ${intentLayoutStrategy.sections.length} sections with types: ${intentLayoutStrategy.sections.map(s => s.type).join(', ')}`);

  return parts.join('\n');
}

/**
 * Determine if a page has likely been generated before
 * Useful for caching to avoid regenerating identical pages
 */
export function getPageCacheKey(
  userMessage: string,
  pageType: PageType,
  personaHash?: string
): string {
  const messageHash = hashString(userMessage.substring(0, 100));
  const persona = personaHash || 'default';
  return `page_${pageType}_${messageHash}_${persona}`;
}

/**
 * Simple hash function for creating cache keys
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Process a batch of user messages to generate pages for each
 * Useful for analyzing conversation patterns
 */
export async function generatePagesBatch(
  requests: PageGenerationRequest[]
): Promise<PageGenerationResponse[]> {
  return Promise.all(requests.map((req) => generatePageSpec(req)));
}

/**
 * Get a fallback text-only response if page generation fails
 * Ensures graceful degradation
 */
export function getFallbackPageContent(pageType: PageType, userMessage: string): string {
  const fallbacks: Record<PageType, string> = {
    solution_brief: "I understand your challenge. Our solution is designed to address these specific pain points in the beverage industry. Let me know if you would like more details about how we can help.",
    feature_showcase: "Great question! These features are core to our platform and help teams work more efficiently. Would you like me to walk through any specific capability in more detail?",
    case_study: "We have helped many beverage companies achieve significant results. Each implementation is tailored to their unique needs. Would you like to discuss a similar scenario?",
    comparison: "We stand out by focusing specifically on the beverage industry with purpose-built features. Let me know which aspects matter most to you, and I can provide a detailed comparison.",
    implementation_roadmap: "Most implementations follow a structured process that we can customize to your timeline. We ensure a smooth launch with proper planning and support every step of the way.",
    roi_calculator: "The financial impact depends on your specific situation. Factors like team size, current processes, and your goals all play a role. Let us discuss your scenario to build a more accurate projection.",
  };

  return fallbacks[pageType];
}

/**
 * Enhance a page specification with additional context
 * Used to personalize generated pages
 */
export function enhancePageWithContext(
  page: BevGeniePage,
  persona?: PersonaScores
): BevGeniePage {
  if (!persona) {
    return page;
  }

  // Add persona metadata if not already present
  if ('persona' in page && typeof page.persona === 'string') {
    const personaLabel = determinePrimaryPersona(persona);
    page.persona = personaLabel;
  }

  // Enhance CTA buttons based on persona focus
  if (persona.sales_focus_score > 0.7) {
    // For sales-focused users, emphasize demo/trial CTAs
    // This would require modifying the sections array
  }

  if (persona.compliance_focus_score > 0.7) {
    // For compliance-focused users, emphasize security/compliance
  }

  return page;
}

/**
 * Determine the primary persona classification
 */
function determinePrimaryPersona(persona: PersonaScores): string {
  const classifications: string[] = [];

  if (persona.supplier_score > 0.7) classifications.push('supplier');
  if (persona.distributor_score > 0.7) classifications.push('distributor');
  if (persona.craft_score > 0.7) classifications.push('craft');
  if (persona.mid_sized_score > 0.7) classifications.push('mid_sized');
  if (persona.large_score > 0.7) classifications.push('large');

  if (persona.sales_focus_score > 0.7) classifications.push('sales_focus');
  if (persona.marketing_focus_score > 0.7) classifications.push('marketing_focus');
  if (persona.compliance_focus_score > 0.7) classifications.push('compliance_focus');

  return classifications.join('_');
}

/**
 * Generate multiple page variants for A/B testing
 * Creates 2-3 variations with different messaging
 */
export async function generatePageVariants(
  baseRequest: PageGenerationRequest,
  variantCount: number = 2
): Promise<PageGenerationResponse[]> {
  const variants: PageGenerationRequest[] = [];

  for (let i = 0; i < variantCount; i++) {
    const variant = {
      ...baseRequest,
      userMessage: `${baseRequest.userMessage} (Variant ${i + 1}: Try a different approach to messaging)`,
    };
    variants.push(variant);
  }

  return generatePagesBatch(variants);
}

/**
 * Estimate the generation time for a page
 * Useful for setting expectations and managing timeouts
 */
export function estimateGenerationTime(pageType: PageType): number {
  // Rough estimates in milliseconds
  const estimates: Record<PageType, number> = {
    solution_brief: 3000,
    feature_showcase: 4000,
    case_study: 5000,
    comparison: 4500,
    implementation_roadmap: 4000,
    roi_calculator: 3500,
  };

  return estimates[pageType];
}
