'use client';

import React, { useMemo } from 'react';
import { BevGeniePage, PageSection, sanitizePageContent } from '@/lib/ai/page-specs';
import { COLORS } from '@/lib/constants/colors';
import { Download, Share2, ExternalLink } from 'lucide-react';
import { SingleScreenSection } from '@/components/genie/single-screen-section';

interface DynamicPageRendererProps {
  page: BevGeniePage;
  onDownload?: () => void;
  onShare?: () => void;
  onNavigationClick?: (action: string, context?: any) => void;
  compact?: boolean; // For displaying in chat vs full page
  onBackToHome?: () => void;
}

/**
 * Dynamic Page Renderer
 *
 * Converts BevGenie page specifications (JSON) into rendered React components.
 * Supports 6 page types and 8 section types with consistent styling.
 * Automatically sanitizes content to ensure it fits on screen.
 */
export function DynamicPageRenderer({
  page,
  onDownload,
  onShare,
  onNavigationClick,
  compact = false,
  onBackToHome,
}: DynamicPageRendererProps) {
  // Sanitize content to ensure it fits on screen (safety measure)
  const sanitizedPage = useMemo(() => sanitizePageContent(page), [page]);

  return (
    <div className={`dynamic-page-renderer h-full overflow-hidden ${compact ? 'compact' : 'full'}`}>
      {/* Render sections */}
      <div className={`page-content h-full overflow-hidden ${compact ? 'max-w-2xl' : ''}`}>
        {sanitizedPage.sections.map((section, index) => (
          <SectionRenderer
            key={index}
            section={section}
            index={index}
            onNavigationClick={onNavigationClick}
            onBackToHome={onBackToHome}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Layout utility functions
 * Map size and visualWeight properties to Tailwind classes
 */
function getSizeClasses(size?: 'compact' | 'medium' | 'large'): {
  minHeight: string;
  padding: string;
  textScale: string;
} {
  switch (size) {
    case 'compact':
      return { minHeight: 'min-h-[25vh]', padding: 'py-8', textScale: 'scale-90' };
    case 'large':
      return { minHeight: 'min-h-[40vh]', padding: 'py-24', textScale: 'scale-110' };
    case 'medium':
    default:
      return { minHeight: 'min-h-[30vh]', padding: 'py-16', textScale: 'scale-100' };
  }
}

function getVisualWeightClasses(weight?: 'subtle' | 'normal' | 'prominent'): {
  opacity: string;
  fontScale: string;
  shadow: string;
} {
  switch (weight) {
    case 'subtle':
      return { opacity: 'opacity-75', fontScale: 'text-sm', shadow: 'shadow-sm' };
    case 'prominent':
      return { opacity: 'opacity-100', fontScale: 'text-lg', shadow: 'shadow-2xl' };
    case 'normal':
    default:
      return { opacity: 'opacity-90', fontScale: 'text-base', shadow: 'shadow-lg' };
  }
}

/**
 * Section Renderer
 * Routes to appropriate section component based on section type
 */
function SectionRenderer({
  section,
  index,
  onNavigationClick,
  onBackToHome,
}: {
  section: PageSection;
  index: number;
  onNavigationClick?: (action: string, context?: any) => void;
  onBackToHome?: () => void;
}) {
  const sectionWithLayout = section as any;
  const layoutProps = {
    size: sectionWithLayout.size,
    visualWeight: sectionWithLayout.visualWeight,
  };

  switch (section.type) {
    case 'single_screen':
      return (
        <SingleScreenSection
          headline={(section as any).headline}
          subtitle={(section as any).subtitle}
          insights={(section as any).insights}
          stats={(section as any).stats}
          visualContent={(section as any).visualContent}
          howItWorks={(section as any).howItWorks}
          ctas={(section as any).ctas}
          onCTAClick={onNavigationClick}
          onBackToHome={onBackToHome}
        />
      );
    case 'hero':
      return <HeroSection section={section} onNavigationClick={onNavigationClick} {...layoutProps} />;
    case 'feature_grid':
      return <FeatureGridSection section={section} onNavigationClick={onNavigationClick} {...layoutProps} />;
    // Testimonial sections removed - BevGenie is a new product
    case 'comparison_table':
      return <ComparisonTableSection section={section} {...layoutProps} />;
    case 'cta':
      return <CTASection section={section} onNavigationClick={onNavigationClick} {...layoutProps} />;
    case 'faq':
      return <FAQSection section={section} {...layoutProps} />;
    case 'metrics':
      return <MetricsSection section={section} {...layoutProps} />;
    case 'steps':
      return <StepsSection section={section} onNavigationClick={onNavigationClick} {...layoutProps} />;
    default:
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          Unknown section type: {(section as any).type}
        </div>
      );
  }
}

/**
 * Hero Section Component
 * Large headline with optional CTA button - Modern design with floating blur elements
 */
function HeroSection({
  section,
  onNavigationClick,
  size,
  visualWeight,
}: {
  section: any;
  onNavigationClick?: (action: string, context?: any) => void;
  size?: 'compact' | 'medium' | 'large';
  visualWeight?: 'subtle' | 'normal' | 'prominent';
}) {
  const handleCtaClick = () => {
    if (onNavigationClick) {
      onNavigationClick(section.ctaButton?.action || 'hero_cta_click', {
        text: section.ctaButton?.text,
        context: section.headline,
      });
    }
  };

  const handleLearnMore = () => {
    if (onNavigationClick) {
      onNavigationClick('learn_more', {
        context: section.headline,
      });
    }
  };

  // Split headline to apply gradient to last word
  const words = section.headline.split(' ');
  const lastWord = words[words.length - 1];
  const restOfHeadline = words.slice(0, -1).join(' ');

  const sizeClasses = getSizeClasses(size);
  const weightClasses = getVisualWeightClasses(visualWeight);

  // Dynamic text sizes based on size and weight
  const headlineSize = size === 'compact' ? 'text-4xl lg:text-5xl' :
                       size === 'large' ? 'text-6xl lg:text-7xl xl:text-8xl' :
                       'text-5xl lg:text-6xl xl:text-7xl';
  const subheadlineSize = size === 'compact' ? 'text-base' :
                          size === 'large' ? 'text-2xl' :
                          'text-xl';

  return (
    <div className={`hero-section relative ${sizeClasses.minHeight} flex items-center overflow-hidden ${sizeClasses.padding} px-6 rounded-2xl ${weightClasses.opacity}`}>
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#fdf8f6] via-white to-[#ecfeff]" />

      {/* Floating blur elements */}
      <div className="absolute top-20 right-10 w-96 h-96 bg-[#AA6C39]/10 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute bottom-20 left-10 w-80 h-80 bg-[#00C8FF]/10 rounded-full blur-3xl animate-pulse-slow" />

      <div className="max-w-4xl relative z-10">
        <h2 className={`${headlineSize} font-bold mb-6 leading-tight`}>
          <span style={{ color: COLORS.navy }}>{restOfHeadline} </span>
          <span className="gradient-text">{lastWord}</span>
        </h2>
        {section.subheadline && (
          <p className={`${subheadlineSize} leading-relaxed mb-10 max-w-3xl`} style={{ color: COLORS.darkGray }}>
            {section.subheadline}
          </p>
        )}
        {section.ctaButton && (
          <div className="flex flex-wrap gap-4 mt-8">
            <button
              onClick={handleCtaClick}
              className={`px-10 py-5 font-bold rounded-xl ${weightClasses.shadow} hover:shadow-xl hover:-translate-y-1 transition-all text-white bg-gradient-to-r from-[#AA6C39] to-[#8B5A2B]`}
            >
              {section.ctaButton.text}
            </button>
            <button
              onClick={handleLearnMore}
              className="px-10 py-5 font-bold rounded-xl transition-all hover:shadow-lg hover:-translate-y-1 border-2 bg-white"
              style={{
                borderColor: COLORS.navy,
                color: COLORS.navy,
              }}
            >
              Learn More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Feature Grid Section Component
 * Grid of features with icons and descriptions - Modern design with gradient icons
 */
function FeatureGridSection({
  section,
  onNavigationClick,
  size,
  visualWeight
}: {
  section: any;
  onNavigationClick?: (action: string, context?: any) => void;
  size?: 'compact' | 'medium' | 'large';
  visualWeight?: 'subtle' | 'normal' | 'prominent';
}) {
  const sizeClasses = getSizeClasses(size);
  const weightClasses = getVisualWeightClasses(visualWeight);

  const titleSize = size === 'compact' ? 'text-3xl lg:text-4xl' :
                    size === 'large' ? 'text-5xl lg:text-6xl' :
                    'text-4xl lg:text-5xl';

  return (
    <div className={`feature-grid-section ${sizeClasses.padding} ${weightClasses.opacity}`}>
      {section.title && (
        <h3 className={`${titleSize} font-bold mb-4`} style={{ color: COLORS.navy }}>
          {section.title}
        </h3>
      )}
      {section.subtitle && (
        <p className="mb-12 text-xl leading-relaxed" style={{ color: COLORS.darkGray }}>
          {section.subtitle}
        </p>
      )}

      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        style={{
          gridTemplateColumns: section.columns
            ? `repeat(${Math.min(section.columns, 3)}, minmax(0, 1fr))`
            : undefined,
        }}
      >
        {section.features.map((feature: any, idx: number) => (
          <div
            key={idx}
            className="feature-card p-8 rounded-2xl hover:shadow-xl transition-all hover:-translate-y-1 duration-300 border-2 group"
            style={{
              backgroundColor: COLORS.white,
              borderColor: COLORS.mediumGray,
            }}
          >
            {feature.icon && (
              <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#AA6C39] to-[#00C8FF] text-white text-3xl group-hover:scale-110 transition-transform">
                {feature.icon}
              </div>
            )}
            <h4 className="text-xl font-bold mb-3" style={{ color: COLORS.navy }}>
              {feature.title}
            </h4>
            <p className="text-base leading-relaxed" style={{ color: COLORS.textGray }}>
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Testimonial Section Component
 * Customer quote with attribution
 */
function TestimonialSection({ section }: { section: any }) {
  return (
    <div className="testimonial-section">
      <div
        className="p-8 rounded-lg"
        style={{
          backgroundColor: COLORS.lightGray,
          borderLeft: `4px solid ${COLORS.cyan}`,
        }}
      >
        <div className="flex items-start gap-4">
          {section.image && (
            <img
              src={section.image}
              alt={section.author}
              className="w-16 h-16 rounded-full object-cover flex-shrink-0"
            />
          )}
          <div className="flex-grow">
            <blockquote
              className="text-lg italic mb-4"
              style={{ color: COLORS.darkGray }}
            >
              "{section.quote}"
            </blockquote>
            <div>
              <p
                className="font-semibold"
                style={{ color: COLORS.navy }}
              >
                {section.author}
              </p>
              {section.role && (
                <p className="text-sm" style={{ color: COLORS.textGray }}>
                  {section.role}
                </p>
              )}
              {section.company && (
                <p className="text-sm" style={{ color: COLORS.textGray }}>
                  {section.company}
                </p>
              )}
              {section.metric && (
                <p
                  className="text-sm font-semibold mt-2"
                  style={{ color: COLORS.cyan }}
                >
                  {section.metric}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Comparison Table Section Component
 * Feature-by-feature comparison matrix
 */
function ComparisonTableSection({
  section,
  size,
  visualWeight
}: {
  section: any;
  size?: 'compact' | 'medium' | 'large';
  visualWeight?: 'subtle' | 'normal' | 'prominent';
}) {
  const sizeClasses = getSizeClasses(size);
  const weightClasses = getVisualWeightClasses(visualWeight);

  const titleSize = size === 'compact' ? 'text-xl' :
                    size === 'large' ? 'text-3xl' :
                    'text-2xl';

  return (
    <div className={`comparison-table-section ${sizeClasses.padding} ${weightClasses.opacity}`}>
      {section.title && (
        <h3
          className={`${titleSize} font-bold mb-6`}
          style={{ color: COLORS.navy }}
        >
          {section.title}
        </h3>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ backgroundColor: COLORS.navy, color: COLORS.white }}>
              {section.headers.map((header: string, idx: number) => (
                <th
                  key={idx}
                  className="px-6 py-4 text-left font-semibold border"
                  style={{ borderColor: COLORS.mediumGray }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row: any, rowIdx: number) => (
              <tr
                key={rowIdx}
                style={{
                  backgroundColor:
                    rowIdx % 2 === 0 ? COLORS.white : COLORS.lightGray,
                }}
              >
                <td
                  className="px-6 py-4 font-semibold border"
                  style={{
                    color: COLORS.navy,
                    borderColor: COLORS.mediumGray,
                  }}
                >
                  {row.feature}
                </td>
                {row.values.map((value: any, colIdx: number) => (
                  <td
                    key={colIdx}
                    className="px-6 py-4 border text-center"
                    style={{
                      color: COLORS.darkGray,
                      borderColor: COLORS.mediumGray,
                    }}
                  >
                    {typeof value === 'boolean' ? (
                      value ? (
                        <span style={{ color: COLORS.cyan, fontWeight: 'bold' }}>
                          ✓
                        </span>
                      ) : (
                        <span style={{ color: COLORS.copper, fontWeight: 'bold' }}>
                          ✗
                        </span>
                      )
                    ) : (
                      value
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * CTA Section Component
 * Call-to-action buttons with various actions - Modern design with dramatic gradients
 */
function CTASection({
  section,
  onNavigationClick,
  size,
  visualWeight
}: {
  section: any;
  onNavigationClick?: (action: string, context?: any) => void;
  size?: 'compact' | 'medium' | 'large';
  visualWeight?: 'subtle' | 'normal' | 'prominent';
}) {
  const handleButtonClick = (button: any) => {
    if (onNavigationClick) {
      onNavigationClick(button.action || 'cta_click', {
        text: button.text,
        context: section.title,
        isPrimary: button.primary,
      });
    }
  };

  const sizeClasses = getSizeClasses(size);
  const weightClasses = getVisualWeightClasses(visualWeight);

  const titleSize = size === 'compact' ? 'text-3xl md:text-4xl' :
                    size === 'large' ? 'text-5xl md:text-6xl lg:text-7xl' :
                    'text-4xl md:text-5xl lg:text-6xl';

  return (
    <div className={`cta-section relative ${sizeClasses.padding} px-6 rounded-2xl ${weightClasses.shadow} text-center text-white overflow-hidden ${weightClasses.opacity}`}>
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#AA6C39] via-[#0A1930] to-[#243b53]" />

      {/* Floating blur elements */}
      <div className="absolute top-10 right-10 w-64 h-64 bg-[#00C8FF]/20 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute bottom-10 left-10 w-64 h-64 bg-[#AA6C39]/20 rounded-full blur-3xl animate-pulse-slow" />

      <div className="relative z-10">
        <h3 className={`${titleSize} font-bold mb-6`}>{section.title}</h3>
        {section.description && (
          <p className="text-xl mb-12 max-w-2xl mx-auto leading-relaxed opacity-90">
            {section.description}
          </p>
        )}

        <div className="flex flex-wrap gap-4 justify-center mt-10">
          {section.buttons.map((button: any, idx: number) => (
            <button
              key={idx}
              onClick={() => handleButtonClick(button)}
              className={`px-10 py-5 font-bold rounded-xl transition-all hover:shadow-xl hover:-translate-y-1 ${
                button.primary ? 'bg-white text-[#0A1930]' : 'border-2 border-white text-white bg-transparent'
              }`}
            >
              {button.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * FAQ Section Component
 * Accordion-style frequently asked questions
 */
function FAQSection({
  section,
  size,
  visualWeight
}: {
  section: any;
  size?: 'compact' | 'medium' | 'large';
  visualWeight?: 'subtle' | 'normal' | 'prominent';
}) {
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null);

  const sizeClasses = getSizeClasses(size);
  const weightClasses = getVisualWeightClasses(visualWeight);

  const titleSize = size === 'compact' ? 'text-xl' :
                    size === 'large' ? 'text-3xl' :
                    'text-2xl';

  return (
    <div className={`faq-section ${sizeClasses.padding} ${weightClasses.opacity}`}>
      {section.title && (
        <h3
          className={`${titleSize} font-bold mb-6`}
          style={{ color: COLORS.navy }}
        >
          {section.title}
        </h3>
      )}

      <div className="space-y-3">
        {section.items.map((item: any, idx: number) => (
          <div
            key={idx}
            className="rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            style={{
              backgroundColor: COLORS.white,
              border: `1px solid ${COLORS.mediumGray}`,
            }}
          >
            <button
              onClick={() =>
                setExpandedIndex(expandedIndex === idx ? null : idx)
              }
              className="w-full px-6 py-4 text-left font-semibold flex items-center justify-between transition-colors"
              style={{
                backgroundColor: COLORS.lightGray,
                color: COLORS.navy,
              }}
            >
              {item.question}
              <span
                className={`transform transition-transform ${
                  expandedIndex === idx ? 'rotate-180' : ''
                }`}
              >
                ▼
              </span>
            </button>
            {expandedIndex === idx && (
              <div
                className="px-6 py-4 border-t"
                style={{
                  color: COLORS.darkGray,
                  backgroundColor: COLORS.white,
                  borderColor: COLORS.mediumGray,
                }}
              >
                {item.answer}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Metrics Section Component
 * Display key metrics and statistics - Modern design with gradient numbers
 */
function MetricsSection({
  section,
  size,
  visualWeight
}: {
  section: any;
  size?: 'compact' | 'medium' | 'large';
  visualWeight?: 'subtle' | 'normal' | 'prominent';
}) {
  const sizeClasses = getSizeClasses(size);
  const weightClasses = getVisualWeightClasses(visualWeight);

  const titleSize = size === 'compact' ? 'text-3xl lg:text-4xl' :
                    size === 'large' ? 'text-5xl lg:text-6xl' :
                    'text-4xl lg:text-5xl';
  const metricValueSize = size === 'compact' ? 'text-4xl lg:text-5xl' :
                          size === 'large' ? 'text-6xl lg:text-7xl' :
                          'text-5xl lg:text-6xl';

  return (
    <div className={`metrics-section ${sizeClasses.padding} ${weightClasses.opacity}`}>
      {section.title && (
        <h3 className={`${titleSize} font-bold mb-12 text-center`} style={{ color: COLORS.navy }}>
          {section.title}
        </h3>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {section.metrics.map((metric: any, idx: number) => (
          <div
            key={idx}
            className={`metric-card p-8 rounded-2xl text-center hover:shadow-xl transition-all hover:-translate-y-1 duration-300 border-2 ${weightClasses.shadow}`}
            style={{
              backgroundColor: COLORS.white,
              borderColor: COLORS.mediumGray,
            }}
          >
            <div className={`${metricValueSize} font-bold mb-4 bg-gradient-to-r from-[#AA6C39] to-[#00C8FF] bg-clip-text text-transparent`}>
              {metric.value}
            </div>
            <p className="text-xl font-bold mb-3" style={{ color: COLORS.navy }}>
              {metric.label}
            </p>
            {metric.description && (
              <p className="text-base leading-relaxed" style={{ color: COLORS.darkGray }}>
                {metric.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Steps Section Component
 * Implementation or process steps with gradient timeline
 */
function StepsSection({
  section,
  onNavigationClick,
  size,
  visualWeight
}: {
  section: any;
  onNavigationClick?: (action: string, context?: any) => void;
  size?: 'compact' | 'medium' | 'large';
  visualWeight?: 'subtle' | 'normal' | 'prominent';
}) {
  const sizeClasses = getSizeClasses(size);
  const weightClasses = getVisualWeightClasses(visualWeight);

  const titleSize = size === 'compact' ? 'text-3xl lg:text-4xl' :
                    size === 'large' ? 'text-5xl lg:text-6xl' :
                    'text-4xl lg:text-5xl';

  return (
    <div className={`steps-section ${sizeClasses.padding} ${weightClasses.opacity}`}>
      {section.title && (
        <h3 className={`${titleSize} font-bold mb-4`} style={{ color: COLORS.navy }}>
          {section.title}
        </h3>
      )}
      {section.timeline && (
        <p className="text-xl font-semibold mb-12 bg-gradient-to-r from-[#AA6C39] to-[#00C8FF] bg-clip-text text-transparent">
          Timeline: {section.timeline}
        </p>
      )}

      <div className="relative">
        {/* Vertical gradient line */}
        <div className="absolute left-8 top-0 bottom-0 w-1 hidden md:block bg-gradient-to-b from-[#AA6C39] via-[#00C8FF] to-[#AA6C39]" />

        {/* Steps */}
        <div className="space-y-8">
          {section.steps.map((step: any, idx: number) => (
            <div key={idx} className="flex gap-6">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center w-16 h-16 rounded-full text-white font-bold text-xl shadow-lg bg-gradient-to-br from-[#AA6C39] to-[#00C8FF]">
                  {step.number}
                </div>
              </div>
              <div className="flex-grow pt-2 p-6 bg-white rounded-2xl border-2 hover:shadow-xl hover:-translate-y-1 transition-all" style={{ borderColor: COLORS.mediumGray }}>
                <h4 className="text-xl font-bold mb-2" style={{ color: COLORS.navy }}>
                  {step.title}
                </h4>
                <p className="text-base leading-relaxed" style={{ color: COLORS.textGray }}>
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

