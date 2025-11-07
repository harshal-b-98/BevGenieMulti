/**
 * SSE Chat Streaming Endpoint - Web Streams API Implementation
 *
 * POST /api/chat/stream
 *
 * Real-time streaming of page generation stages
 * Uses Web Streams API (proper Next.js app router pattern)
 */

import { NextRequest } from 'next/server';
import { getSession, updatePersona, addConversationMessage as addConvMsg, addConversationMessagesBatch, getConversationHistory } from '@/lib/session/session';
import { validateAIConfiguration } from '@/lib/ai/orchestrator';
import { detectPersonaSignals, updatePersonaWithSignals, detectAndUpdateVectors } from '@/lib/ai/persona-detection';
import { getCurrentVectorClassification } from '@/lib/ai/vector-detection';
import { getContextForLLM, getKnowledgeDocuments } from '@/lib/ai/knowledge-search';
import { getPersonalizedSystemPrompt, PAIN_POINT_PROMPTS } from '@/lib/ai/prompts/system';
import { recordPersonaSignal, recordPersonaSignalsBatch } from '@/lib/session/session';
import { classifyMessageIntent } from '@/lib/ai/intent-classification';
import { generatePageSpec } from '@/lib/ai/page-generator';
import Anthropic from '@anthropic-ai/sdk';
import type { PersonaScores, PainPointType } from '@/lib/session/types';

const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Helper to send SSE event
function createEvent(eventType: string, data: any): string {
  return `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  try {
    validateAIConfiguration();

    const body = await request.json();
    const { message, context, interactionSource } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response('Invalid message', { status: 400 });
    }

    const session = await getSession();
    if (!session.user) {
      return new Response('No session', { status: 500 });
    }

    const conversationHistory = await getConversationHistory();

    // Use Web Streams API for proper Next.js compatibility
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await processStreamWithController(
            message,
            session,
            conversationHistory,
            controller,
            encoder,
            context,
            interactionSource
          );
          controller.close();
        } catch (error) {
          console.error('[Stream] Fatal error:', error);
          controller.enqueue(
            encoder.encode(
              createEvent('error', {
                error: error instanceof Error ? error.message : 'Unknown error',
              })
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('[Stream] Error:', error);
    return new Response('Stream error', { status: 500 });
  }
}

async function processStreamWithController(
  message: string,
  session: any,
  conversationHistory: any[],
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  pageContext?: any,
  interactionSource?: string
): Promise<void> {
  let updatedPersona: PersonaScores = session.user.persona;
  let aiResponse = '';
  let generatedPage: any = null;
  const signalDescriptions: string[] = [];

  // Performance tracking
  const perfStart = Date.now();
  const perfLog = (stage: string, startTime: number) => {
    const duration = Date.now() - startTime;
    console.log(`[PERF] ${stage}: ${duration}ms`);
    return Date.now();
  };

  try {
    // Helper to enqueue event
    const sendEvent = (eventType: string, data: any) => {
      const eventStr = createEvent(eventType, data);
      controller.enqueue(encoder.encode(eventStr));
    };

    // Stage 0: Init
    let perfTime = Date.now();
    sendEvent('stage', {
      stageId: 'init',
      status: 'active',
      stageName: 'Initializing...',
      progress: 5,
    });

    // Stage 1: Intent
    sendEvent('stage', {
      stageId: 'intent',
      status: 'active',
      stageName: 'Analyzing your question...',
      progress: 15,
    });

    const intentAnalysis = classifyMessageIntent(
      message,
      conversationHistory.length,
      updatedPersona
    );
    perfTime = perfLog('Intent classification', perfTime);

    sendEvent('stage', {
      stageId: 'intent',
      status: 'complete',
      stageName: 'Question analyzed',
      progress: 25,
    });

    // Stage 2: Signals
    sendEvent('stage', {
      stageId: 'signals',
      status: 'active',
      stageName: 'Detecting your profile...',
      progress: 35,
    });

    const signals = detectPersonaSignals(message, updatedPersona);

    // Build signal descriptions for tracking
    signals.forEach(signal => {
      signalDescriptions.push(`${signal.type}/${signal.category}`);
    });

    // Batch record all signals in a single DB operation (much faster!)
    try {
      await recordPersonaSignalsBatch(signals);
    } catch (e) {
      console.error('Batch signal recording error:', e);
    }
    perfTime = perfLog('Signal detection + DB write', perfTime);

    updatedPersona = updatePersonaWithSignals(updatedPersona, signals);

    // ==================== NEW: Update 4-Vector Detection ====================
    // Detect and update the 4 key persona vectors based on message + interaction context
    updatedPersona = detectAndUpdateVectors(message, updatedPersona, pageContext ? {
      source: pageContext.source,
      text: pageContext.text,
      context: pageContext.context,
    } : undefined);

    // Get current vector classification for logging/tracking
    const vectorClassification = getCurrentVectorClassification(updatedPersona.detection_vectors);
    console.log('[Stream] Persona vectors updated:', {
      functional_role: vectorClassification.functional_role.value,
      org_type: vectorClassification.org_type.value,
      org_size: vectorClassification.org_size.value,
      product_focus: vectorClassification.product_focus.value,
    });
    // ======================================================================

    sendEvent('stage', {
      stageId: 'signals',
      status: 'complete',
      stageName: 'Profile updated',
      progress: 45,
    });

    // Send persona vector update event for client awareness
    sendEvent('persona_vectors', {
      functional_role: vectorClassification.functional_role.value,
      org_type: vectorClassification.org_type.value,
      org_size: vectorClassification.org_size.value,
      product_focus: vectorClassification.product_focus.value,
      all_vectors_identified: vectorClassification.all_vectors_identified,
    });

    // Stage 3: Knowledge
    sendEvent('stage', {
      stageId: 'knowledge',
      status: 'active',
      stageName: 'Searching knowledge base...',
      progress: 55,
    });

    // Parallelize both KB searches for faster response
    const [knowledgeContext, knowledgeDocuments] = await Promise.all([
      getContextForLLM(message, updatedPersona, 5),
      getKnowledgeDocuments(message, undefined, undefined, 5)
    ]);
    perfTime = perfLog('Knowledge base search (parallel)', perfTime);

    sendEvent('stage', {
      stageId: 'knowledge',
      status: 'complete',
      stageName: 'Context gathered',
      progress: 65,
    });

    // Stage 4 & 5: Parallel Generation (OpenAI + Claude together for speed!)
    sendEvent('stage', {
      stageId: 'response',
      status: 'active',
      stageName: 'Generating response and page...',
      progress: 75,
    });

    // Truncate knowledge context to avoid token limits (max 500 chars)
    const truncatedContext = knowledgeContext ? knowledgeContext.substring(0, 500) : '';

    const systemPrompt = getPersonalizedSystemPrompt(
      updatedPersona,
      truncatedContext ? `\nContext: ${truncatedContext}` : ''
    );

    let enhancedSystemPrompt = systemPrompt;
    if (updatedPersona.pain_points_detected.length > 0) {
      const topPainPoint = updatedPersona.pain_points_detected[0];
      if (PAIN_POINT_PROMPTS[topPainPoint]) {
        enhancedSystemPrompt += `\n\n${PAIN_POINT_PROMPTS[topPainPoint]}`;
      }
    }

    // Limit conversation history to last 3 messages to avoid token limits
    const recentHistory = conversationHistory.slice(-3);

    const messages = [
      ...recentHistory.map((msg: any) => ({
        role: msg.message_role,
        content: msg.message_content,
      })),
      { role: 'user' as const, content: message },
    ];

    const pageType = intentAnalysis.suggestedPageType || 'solution_brief';
    const pageKnowledgeContext = knowledgeContext
      ? knowledgeContext.split('\n').filter((l: string) => l.trim())
      : [];

    // Run Claude for both text response and page generation in parallel!
    try {
      const [claudeTextResult, pageGenResult] = await Promise.all([
        // Claude text response
        claude.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 150,
          temperature: 0.7,
          system: enhancedSystemPrompt,
          messages: messages.map((m: any) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
          })),
        }).catch(error => {
          console.error('Claude text error:', error);
          return null;
        }),
        // Claude page generation
        generatePageSpec({
          userMessage: message,
          pageType: pageType as any,
          persona: updatedPersona,
          knowledgeContext: pageKnowledgeContext,
          knowledgeDocuments: knowledgeDocuments,
          conversationHistory: messages.slice(-3),
          personaDescription: 'User profile',
          pageContext: pageContext,
          interactionSource: interactionSource,
        })
      ]);

      // Process Claude text result
      if (claudeTextResult) {
        const textBlock = claudeTextResult.content.find((block: any) => block.type === 'text');
        aiResponse = textBlock ? textBlock.text : 'Error generating response';
      } else {
        aiResponse = 'Error generating response';
      }
      perfTime = perfLog('Parallel: Claude text + page', perfTime);

      // Send text response
      sendEvent('text', {
        text: aiResponse,
      });

      sendEvent('stage', {
        stageId: 'response',
        status: 'complete',
        stageName: 'Response ready',
        progress: 90,
      });

      // Process Claude page result
      if (pageGenResult.success && pageGenResult.page) {
        generatedPage = {
          page: pageGenResult.page,
          intent: intentAnalysis.intent,
          intentConfidence: intentAnalysis.confidence,
        };

        sendEvent('page', {
          page: generatedPage.page,
        });
      } else {
        console.warn('[Stream] Page generation failed:', pageGenResult.error, 'Retries:', pageGenResult.retryCount);
      }
    } catch (error) {
      console.error('[Stream] Parallel generation error:', error);
    }

    sendEvent('stage', {
      stageId: 'page',
      status: 'complete',
      stageName: 'Page ready',
      progress: 95,
    });

    // Save to history in background (non-blocking for faster response!)
    addConversationMessagesBatch([
      { role: 'user', content: message, generationMode: 'fresh' },
      { role: 'assistant', content: aiResponse, generationMode: 'fresh' }
    ]).catch(e => console.error('Background history save error:', e));

    // Update persona in background (non-blocking)
    updatePersona(updatedPersona).catch(e => console.error('Background persona update error:', e));

    console.log('[PERF] History and persona saves running in background (non-blocking)');

    // Complete event
    sendEvent('complete', {
      success: true,
      message: aiResponse,
      session: {
        sessionId: session.user.sessionId,
        persona: updatedPersona,
        messageCount: session.user.messageCount + 1,
      },
      signals: signalDescriptions,
      generationMode: 'fresh',
      generatedPage,
    });

    sendEvent('stage', {
      stageId: 'complete',
      status: 'complete',
      stageName: 'Complete',
      progress: 100,
    });

    const totalTime = Date.now() - perfStart;
    console.log(`[PERF] ======================================`);
    console.log(`[PERF] TOTAL TIME: ${totalTime}ms (${(totalTime / 1000).toFixed(1)}s)`);
    console.log(`[PERF] ======================================`);
    console.log('[Stream] Processing complete');
  } catch (error) {
    console.error('[Stream] Fatal error:', error);
    controller.enqueue(
      encoder.encode(
        createEvent('error', {
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      )
    );
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
