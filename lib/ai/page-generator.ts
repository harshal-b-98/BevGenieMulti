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

const client = new Anthropic();

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
}

export interface PageGenerationResponse {
  success: boolean;
  page?: BevGeniePage;
  error?: string;
  retryCount?: number;
  generationTime?: number;
}

/**
 * Generate a page specification using templates + AI
 * MUCH FASTER: Uses pre-built templates, AI fills content only
 * Falls back to full generation if template-based fails
 */
export async function generatePageSpec(
  request: PageGenerationRequest
): Promise<PageGenerationResponse> {
  const startTime = Date.now();

  // Try template-based generation first (5-8s)
  try {
    const { generateFromTemplate } = await import('./template-engine');

    console.log('[PageGen] Using template-based generation (fast path)');
    const result = await generateFromTemplate(
      request.userMessage,
      request.pageType,
      request.persona || {} as any,
      request.knowledgeDocuments
    );

    if (result.success && result.filledPage) {
      // Validate generated page
      const validationErrors = validatePageSpec(result.filledPage);
      if (validationErrors.length === 0) {
        console.log(`[PageGen] ✅ Template generation successful in ${result.generationTime}ms`);
        return {
          success: true,
          page: result.filledPage,
          retryCount: 0,
          generationTime: Date.now() - startTime,
        };
      } else {
        console.warn('[PageGen] Template validation failed:', validationErrors);
        // Fall through to full generation
      }
    }
  } catch (error) {
    console.warn('[PageGen] Template generation failed, falling back to full generation:', error);
    // Fall through to full generation
  }

  // Fallback: Full generation (slower, 20-25s)
  console.log('[PageGen] Using full generation (slow path - fallback)');
  let retryCount = 0;
  const maxRetries = 2;

  while (retryCount <= maxRetries) {
    try {
      const page = await attemptPageGeneration(request, retryCount);

      // Validate the generated page
      const validationErrors = validatePageSpec(page);
      if (validationErrors.length === 0) {
        return {
          success: true,
          page,
          retryCount,
          generationTime: Date.now() - startTime,
        };
      }

      // If validation fails and we have retries left, try again with feedback
      if (retryCount < maxRetries) {
        retryCount++;
        // Adjust request for retry with validation feedback
        request = {
          ...request,
          userMessage: `${request.userMessage}\n\n[Previous attempt had validation issues: ${validationErrors.join(', ')}. Please regenerate with these corrections.]`,
        };
        continue;
      }

      // All retries exhausted
      return {
        success: false,
        error: `Validation failed after ${maxRetries} retries: ${validationErrors.join(', ')}`,
        retryCount,
        generationTime: Date.now() - startTime,
      };
    } catch (error) {
      if (retryCount < maxRetries) {
        retryCount++;
        continue;
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during page generation',
        retryCount,
        generationTime: Date.now() - startTime,
      };
    }
  }

  return {
    success: false,
    error: 'Max retries exceeded',
    retryCount,
    generationTime: Date.now() - startTime,
  };
}

/**
 * Internal function to attempt page generation with Claude
 */
async function attemptPageGeneration(
  request: PageGenerationRequest,
  retryCount: number
): Promise<BevGeniePage> {
  const systemPrompt = buildSystemPrompt(request, retryCount);
  const userPrompt = buildUserPrompt(request);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929', // Fast model for quick generation
    max_tokens: 1500, // Reduced for faster generation (was 2500)
    temperature: 0.3, // Lower temperature for more consistent output
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' }, // Cache system prompt for 50-90% speed boost
      }
    ],
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  });

  // Extract the text response
  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  // Parse the JSON from the response
  let pageSpec: BevGeniePage;
  try {
    // Try to extract JSON from the response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    pageSpec = JSON.parse(jsonMatch[0]) as BevGeniePage;
  } catch (error) {
    throw new Error(`Failed to parse page specification: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return pageSpec;
}

/**
 * Build the system prompt for page generation
 * Provides context about page types, structure, and requirements
 */
function buildSystemPrompt(
  request: PageGenerationRequest,
  retryCount: number
): string {
  const template = PAGE_TYPE_TEMPLATES[request.pageType];
  const retryNote = retryCount > 0 ? `\nRetry ${retryCount}: Fix previous validation errors.` : '';

  return `You are a UI/UX designer AND content creator for ${request.pageType} pages (beverage B2B SaaS).

SCREEN SPACE: You have ~100vh (one viewport height) to work with. Design a layout that fits perfectly in one screen without scrolling.

YOUR TASK: Design both content AND layout. You decide:
1. Which sections to include (only relevant ones)
2. How much vertical space each section gets (compact/medium/spacious)
3. Visual hierarchy (what's prominent, what's subtle)
4. Section order and arrangement

OUTPUT STRUCTURE:
{
  "type": "${request.pageType}",
  "title": "50-100ch",
  "description": "150-250ch",
  "layout": {
    "mode": "compact" | "balanced" | "spacious",
    "totalSections": 2-5,
    "estimatedHeight": "fits in 100vh"
  },
  "sections": [
    {
      "type": "hero|feature_grid|metrics|comparison_table|steps|cta|faq|single_screen",
      "size": "compact|medium|large",
      "visualWeight": "subtle|normal|prominent",
      ...content fields...
    }
  ]
}

SECTION TYPES:
1. hero (20-30vh compact, 30-40vh large): Opening impact
2. feature_grid (25-35vh): 2-4 features with icons
3. metrics (15-25vh): 2-4 key stats (only if you have real numbers)
4. comparison_table (30-40vh): Feature comparison (only for vs questions)
5. steps (25-35vh): Process steps (only for how-to)
6. cta (15-20vh): Call to action
7. faq (30-40vh): Q&As (only for complex questions)
8. single_screen (100vh): All-in-one compact format

LAYOUT MODES:
- compact: Dense, fits more content (hero-compact + feature_grid-compact + cta-compact = ~80vh)
- balanced: Medium spacing (hero-medium + metrics-medium + cta-medium = ~90vh)
- spacious: Generous breathing room (hero-large + cta-large = ~70vh, rest whitespace)

DESIGN DECISIONS:
✓ Quick answer? → single_screen (100vh, all content in one section)
✓ Feature question? → compact mode: hero-compact + feature_grid-medium + cta-compact
✓ Process question? → balanced mode: hero-medium + steps-medium + cta-compact
✓ Results question? → spacious mode: hero-large + metrics-large + cta-medium
✓ Comparison? → balanced mode: hero-compact + comparison_table-large + cta-compact

RULES:
- Total estimated height should be ≤100vh
- Don't include sections without relevant content
- Size sections based on content importance
- Use "prominent" visualWeight for the most important section
- Compact mode = more sections, less space each
- Spacious mode = fewer sections, more space each

EXAMPLE GOOD LAYOUTS:
Q: "How do you track sales?"
→ compact: hero-compact (25vh) + steps-medium (35vh) + cta-compact (15vh) = 75vh ✓

Q: "What results?"
→ spacious: hero-large (40vh) + metrics-large (35vh) + cta-medium (20vh) = 95vh ✓

Q: "What is BevGenie?"
→ single_screen (100vh) ✓

COLORS: Navy #0A1930, Cyan #00C8FF, Copper #AA6C39
CONTENT: Beverage-specific, professional B2B
OUTPUT: Valid JSON only${retryNote}`;
}

/**
 * Build the user prompt for page generation
 * Includes specific context from the conversation and knowledge base
 */
function buildUserPrompt(request: PageGenerationRequest): string {
  const parts: string[] = [];

  parts.push(`QUERY: "${request.userMessage}"`);

  // Add page interaction context if available
  if (request.pageContext?.context) {
    parts.push(`\nCONTEXT: User clicked "${request.pageContext.context}" - provide deeper detail on this.`);
  }

  // Add persona context (brief)
  if (request.personaDescription) {
    parts.push(`\nUSER: ${request.personaDescription.substring(0, 150)}`);
  }

  // Add knowledge documents - top 2 only, 150 chars each
  if (request.knowledgeDocuments && request.knowledgeDocuments.length > 0) {
    parts.push(`\nINSIGHTS:`);
    request.knowledgeDocuments.slice(0, 2).forEach((doc, idx) => {
      const percent = Math.round((doc.similarity_score || 0) * 100);
      parts.push(`${idx + 1}. [${percent}%] ${doc.content.substring(0, 150)}`);
    });
  }

  parts.push(`\nGenerate ${request.pageType} with varied sections. Output JSON only.`);

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
