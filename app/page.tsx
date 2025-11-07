'use client';

import { useState, useEffect, useRef } from 'react';
import { Navigation } from "@/components/navigation"
import { Hero } from "@/components/hero"
import { Challenges } from "@/components/challenges"
import { DataPowered } from "@/components/data-powered"
import { Solutions } from "@/components/solutions"
import { Footer } from "@/components/footer"
import { ChatBubble } from '@/components/genie/chat-bubble';
import { SimpleLoader } from '@/components/genie/simple-loader';
import { DynamicContent } from '@/components/genie/dynamic-content';
import { PresentationBubble } from '@/components/genie/presentation-bubble';
import { ProfileModal } from '@/components/profile-modal';
import type { BevGeniePage } from '@/lib/ai/page-specs';
import { SessionTracker } from '@/lib/session/session-tracker';
import type { PersonaScores } from '@/lib/session/types';

/**
 * Page History Item
 */
interface PageHistoryItem {
  id: string;
  query: string;
  content: BevGeniePage;
  textResponse?: string;
  timestamp: number;
  context?: any;
}

/**
 * Chat Message
 */
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  pageId?: string; // Link to generated page
}

export default function HomePage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentQuery, setCurrentQuery] = useState('');

  // Page stacking state - Array of all generated pages
  const [pageHistory, setPageHistory] = useState<PageHistoryItem[]>([]);

  // Chat message history
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Session Tracker for presentation generation
  const [sessionTracker, setSessionTracker] = useState<SessionTracker | null>(null);

  // Profile modal state
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Ref for scrolling to newly generated pages
  const lastPageRef = useRef<HTMLDivElement>(null);

  // Show landing page only when no pages generated yet (even during generation)
  const showLandingPage = pageHistory.length === 0;

  // Initialize session tracker
  useEffect(() => {
    const defaultPersona: PersonaScores = {
      detection_vectors: {
        functional_role: null,
        functional_role_confidence: 0,
        functional_role_history: [],
        org_type: null,
        org_type_confidence: 0,
        org_type_history: [],
        org_size: null,
        org_size_confidence: 0,
        org_size_history: [],
        product_focus: null,
        product_focus_confidence: 0,
        product_focus_history: [],
        vectors_updated_at: Date.now(),
      },
      supplier_score: 0,
      distributor_score: 0,
      craft_score: 0,
      mid_sized_score: 0,
      large_score: 0,
      sales_focus_score: 0,
      marketing_focus_score: 0,
      operations_focus_score: 0,
      compliance_focus_score: 0,
      pain_points_detected: [],
      pain_points_confidence: {
        execution_blind_spot: 0,
        market_assessment: 0,
        sales_effectiveness: 0,
        market_positioning: 0,
        operational_challenge: 0,
        regulatory_compliance: 0,
      },
      overall_confidence: 0,
      total_interactions: 0,
    };

    const tracker = new SessionTracker(defaultPersona);
    setSessionTracker(tracker);
  }, []);

  /**
   * Scroll to the latest generated page
   */
  const scrollToLatestPage = () => {
    if (lastPageRef.current) {
      lastPageRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  /**
   * Handle user message - Generate BOTH text response AND UI page
   * @param query - The user's question
   * @param context - Optional context (if from navigation/button click)
   * @param isNavigationClick - If true, don't add messages to chat (silent navigation)
   */
  const handleSendMessage = async (query: string, context?: any, isNavigationClick: boolean = false) => {
    setCurrentQuery(query);
    setIsGenerating(true);
    setLoadingProgress(0);

    // Add user message to chat ONLY if it's not from navigation
    if (!isNavigationClick) {
      const userMessageId = `msg-${Date.now()}`;
      setChatMessages(prev => [...prev, {
        id: userMessageId,
        role: 'user',
        content: query,
        timestamp: Date.now()
      }]);

      // Track this query for presentation generation
      if (sessionTracker) {
        sessionTracker.trackQuery(
          query,
          context?.source || 'chat',
          'Generating solution...',
          'BevGenie AI'
        );
      }
    }

    try {
      // Call the real API endpoint with SSE streaming
      const requestBody = context
        ? { message: query, context, interactionSource: context.source }
        : { message: query };

      console.log('[HomePage] Calling API with:', requestBody);

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let generatedPage: BevGeniePage | null = null;
      let textResponse = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              try {
                const event = JSON.parse(data);

                // Handle stage progress updates
                if (event.stageId) {
                  const stageProgress: Record<string, number> = {
                    'init': 5,
                    'intent': 15,
                    'signals': 35,
                    'knowledge': 55,
                    'response': 75,
                    'page': 90,
                    'complete': 100,
                  };
                  setLoadingProgress(stageProgress[event.stageId] || 0);
                }

                // Handle text response chunks
                if (event.text) {
                  textResponse += event.text;
                }

                // Handle generated page
                if (event.page) {
                  generatedPage = event.page;
                  console.log('[HomePage] Page received:', generatedPage.type);
                }

                // Handle persona updates from backend (from 'complete' event)
                if (event.session?.persona && sessionTracker) {
                  console.log('[HomePage] Received persona update from backend:', event.session.persona);
                  sessionTracker.updatePersona(event.session.persona);
                  // Force re-render by creating a new tracker instance
                  const updatedTracker = Object.create(Object.getPrototypeOf(sessionTracker));
                  Object.assign(updatedTracker, sessionTracker);
                  setSessionTracker(updatedTracker);
                }
              } catch (e) {
                // Skip non-JSON lines
                console.debug('[HomePage] Skipping non-JSON line');
              }
            }
          }
        }
      }

      // Create new page entry
      if (generatedPage) {
        const pageId = `page-${Date.now()}`;
        const newPage: PageHistoryItem = {
          id: pageId,
          query,
          content: generatedPage,
          textResponse: textResponse || `Here's what I found about "${query}"`,
          timestamp: Date.now(),
          context
        };

        // Add page to history (APPEND, don't replace!)
        setPageHistory(prev => [...prev, newPage]);

        // Add assistant text response to chat ONLY if it's not from navigation
        if (!isNavigationClick && textResponse) {
          setChatMessages(prev => [...prev, {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: textResponse,
            timestamp: Date.now(),
            pageId
          }]);

          // Update the tracker with the actual solution
          if (sessionTracker) {
            sessionTracker.updateLastQuery(
              textResponse,
              generatedPage?.type || 'BevGenie AI'
            );
          }
        }

        setIsGenerating(false);

        // Scroll to new page after render
        setTimeout(() => {
          scrollToLatestPage();
        }, 100);
      } else {
        console.warn('[HomePage] No page generated');
        setIsGenerating(false);

        // Only show error in chat if not from navigation
        if (!isNavigationClick) {
          setChatMessages(prev => [...prev, {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: 'Unable to generate a page at this time. Please try rephrasing your question.',
            timestamp: Date.now()
          }]);
        }
      }
    } catch (error) {
      console.error('[HomePage] Generation failed:', error);
      setIsGenerating(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Add error message to chat only if not from navigation
      if (!isNavigationClick) {
        setChatMessages(prev => [...prev, {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: `Sorry, I encountered an error: ${errorMessage}. Please try again.`,
          timestamp: Date.now()
        }]);
      }
    }
  };

  /**
   * Handle back to home - Clear pages and return to landing page
   */
  const handleBackToHome = () => {
    // Clear all generated pages
    setPageHistory([]);
    // Clear chat messages
    setChatMessages([]);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * Handle navigation click within a generated page
   * These are silent - no chat messages added
   */
  const handleNavigationClick = (action: string, context?: any) => {
    // Generate a new message based on the interaction
    const interactionMessage = `${currentQuery} - User clicked on: ${context?.text || action}`;
    // Pass true for isNavigationClick to keep it silent
    handleSendMessage(interactionMessage, {
      ...context,
      source: action,
      originalQuery: currentQuery,
      pageIndex: pageHistory.length
    }, true);
  };

  /**
   * Handle persona updates from profile modal
   */
  const handleUpdatePersona = (updates: Partial<PersonaScores>) => {
    if (sessionTracker) {
      sessionTracker.updatePersona(updates);
      // Force re-render by creating a new tracker reference with updated persona
      const updatedTracker = Object.create(Object.getPrototypeOf(sessionTracker));
      Object.assign(updatedTracker, sessionTracker);
      setSessionTracker(updatedTracker);
    }
  };

  return (
    <div className="relative snap-y snap-mandatory overflow-y-auto h-screen scroll-smooth" id="infinite-canvas">
      {/* Loading Screen - Simple Blinking Text */}
      {isGenerating && (
        <SimpleLoader
          query={currentQuery}
          onComplete={() => {
            // Loader handles its own completion
          }}
        />
      )}

      {/* Landing Page - Show when no pages generated - SINGLE SCREEN */}
      {showLandingPage && (
        <main className="h-screen overflow-hidden snap-start">
          <Navigation onProfileClick={() => setIsProfileOpen(true)} />
          <Hero onCtaClick={(text) => handleSendMessage(`I want to ${text}`, { source: 'hero-cta', text })} />
        </main>
      )}

      {/* Generated Pages Stack - Vertical Scrolling with Snap Points */}
      {pageHistory.length > 0 && (
        <>
          {/* Show homepage first when there are generated pages */}
          {!showLandingPage && (
            <div className="h-screen overflow-hidden snap-start">
              <Navigation onProfileClick={() => setIsProfileOpen(true)} />
              <Hero onCtaClick={(text) => handleSendMessage(`I want to ${text}`, { source: 'hero-cta', text })} />
            </div>
          )}

          {/* Generated pages */}
          <div id="generated-pages-stack">
            {pageHistory.map((page, index) => (
              <section
                key={page.id}
                id={page.id}
                ref={index === pageHistory.length - 1 ? lastPageRef : null}
                className="snap-start h-screen overflow-hidden"
                data-page-index={index}
              >
                <DynamicContent
                  specification={page.content}
                  onBackToHome={handleBackToHome}
                  onNavigationClick={handleNavigationClick}
                />
              </section>
            ))}
          </div>
        </>
      )}

      {/* Chat Bubble (Always visible) - Passes message history */}
      <ChatBubble
        onSendMessage={handleSendMessage}
        isGenerating={isGenerating}
        messages={chatMessages}
        pageHistory={pageHistory}
      />

      {/* Presentation Bubble - Generate personalized presentation */}
      {sessionTracker && (
        <PresentationBubble
          tracker={sessionTracker}
          onGenerate={() => {
            console.log('[HomePage] Generating presentation...');
          }}
        />
      )}

      {/* Profile Modal - View and edit persona */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        persona={sessionTracker?.getPersona() || null}
        onUpdatePersona={handleUpdatePersona}
      />
    </div>
  );
}
