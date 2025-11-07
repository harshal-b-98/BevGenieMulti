'use client';

import React, { useState, useEffect } from 'react';

interface SimpleLoaderProps {
  query: string;
  onComplete?: () => void;
}

/**
 * Simple Blinking Text Loader
 * Shows progressive status messages with blinking animation
 */
export function SimpleLoader({ query, onComplete }: SimpleLoaderProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  const messages = [
    'AI is thinking...',
    'Detecting persona...',
    'Analyzing your question...',
    'Searching knowledge base...',
    'Gathering insights...',
    'Crafting solution...',
    'Finalizing content...'
  ];

  useEffect(() => {
    // Cycle through messages
    const interval = setInterval(() => {
      setCurrentMessageIndex(prev => {
        const nextIndex = prev + 1;
        if (nextIndex >= messages.length) {
          clearInterval(interval);
          return prev;
        }
        return nextIndex;
      });
    }, 800); // Change message every 800ms

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center pb-32" style={{
      backgroundColor: 'rgba(10, 22, 40, 0.4)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)'
    }}>
      <div className="text-center space-y-4 animate-fade-in">
        {/* Blinking Dot */}
        <div className="flex items-center justify-center gap-2">
          <div className="w-3 h-3 bg-[#06B6D4] rounded-full animate-blink" />
          <div className="w-3 h-3 bg-[#06B6D4] rounded-full animate-blink" style={{ animationDelay: '0.2s' }} />
          <div className="w-3 h-3 bg-[#06B6D4] rounded-full animate-blink" style={{ animationDelay: '0.4s' }} />
        </div>

        {/* Current Message - Blinking Text */}
        <p className="text-[#06B6D4] text-2xl font-semibold animate-pulse">
          {messages[currentMessageIndex]}
        </p>

        {/* Query Context */}
        <p className="text-[#94A3B8] text-sm max-w-md">
          {query}
        </p>
      </div>

      <style jsx>{`
        @keyframes blink {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.3;
            transform: scale(0.8);
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-blink {
          animation: blink 1s ease-in-out infinite;
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
