/**
 * Zod Schemas for Page Generation
 *
 * Defines strict validation schemas for all 8 BevGenie section types.
 * Used with generateObject() to enforce schema at generation time,
 * eliminating validation failures and retries.
 */

import { z } from 'zod';

/**
 * Base layout metadata schema
 * LLM specifies exact height allocation for each section
 */
export const baseSectionLayoutSchema = z.object({
  requestedHeightPercent: z.number().min(15).max(100).optional(), // LLM decides height (15-100%)
  size: z.enum(['compact', 'medium', 'large']).optional(),
  visualWeight: z.enum(['subtle', 'normal', 'prominent']).optional(),
});

/**
 * 1. Hero Section Schema
 * Opening impact section with headline, subheadline, and optional CTA
 */
export const heroSectionSchema = z.object({
  type: z.literal('hero'),
  layout: baseSectionLayoutSchema.optional(), // LLM-driven height allocation
  headline: z.string().min(10).max(100),
  subheadline: z.string().min(20).max(150).optional(),
  size: z.enum(['compact', 'medium', 'large']).optional(),
  visualWeight: z.enum(['subtle', 'normal', 'prominent']).optional(),
  ctaButton: z.object({
    text: z.string().min(3).max(30),
    action: z.string()
  }).optional()
});

/**
 * 2. Feature Grid Section Schema
 * Grid of features with icons and descriptions
 */
export const featureGridSectionSchema = z.object({
  type: z.literal('feature_grid'),
  layout: baseSectionLayoutSchema.optional(), // LLM-driven height allocation
  title: z.string().min(5).max(60).optional(),
  subtitle: z.string().min(10).max(120).optional(),
  size: z.enum(['compact', 'medium', 'large']).optional(),
  visualWeight: z.enum(['subtle', 'normal', 'prominent']).optional(),
  columns: z.number().min(2).max(4).optional(),
  features: z.array(z.object({
    title: z.string().min(5).max(50),
    description: z.string().min(10).max(200),
    icon: z.string().optional()
  })).min(1).max(6)
});

/**
 * 3. Metrics Section Schema
 * Key statistics and metrics
 */
export const metricsSectionSchema = z.object({
  type: z.literal('metrics'),
  layout: baseSectionLayoutSchema.optional(), // LLM-driven height allocation
  title: z.string().min(5).max(60).optional(),
  size: z.enum(['compact', 'medium', 'large']).optional(),
  visualWeight: z.enum(['subtle', 'normal', 'prominent']).optional(),
  metrics: z.array(z.object({
    label: z.string().min(3).max(40),
    value: z.string().min(1).max(20),
    description: z.string().min(10).max(100).optional()
  })).min(2).max(4)
});

/**
 * 4. Comparison Table Section Schema
 * Feature-by-feature comparison
 */
export const comparisonTableSectionSchema = z.object({
  type: z.literal('comparison_table'),
  layout: baseSectionLayoutSchema.optional(), // LLM-driven height allocation
  title: z.string().min(5).max(60).optional(),
  size: z.enum(['compact', 'medium', 'large']).optional(),
  visualWeight: z.enum(['subtle', 'normal', 'prominent']).optional(),
  headers: z.array(z.string().min(3).max(40)).min(2).max(4),
  rows: z.array(z.object({
    feature: z.string().min(3).max(50),
    values: z.array(z.union([
      z.string(),
      z.boolean()
    ]))
  })).min(2).max(8)
});

/**
 * 5. Steps Section Schema
 * Process or implementation steps
 */
export const stepsSectionSchema = z.object({
  type: z.literal('steps'),
  layout: baseSectionLayoutSchema.optional(), // LLM-driven height allocation
  title: z.string().min(5).max(60).optional(),
  subtitle: z.string().min(10).max(120).optional(),
  size: z.enum(['compact', 'medium', 'large']).optional(),
  visualWeight: z.enum(['subtle', 'normal', 'prominent']).optional(),
  timeline: z.string().min(3).max(50).optional(),
  steps: z.array(z.object({
    number: z.number().min(1).max(10),
    title: z.string().min(5).max(50),
    description: z.string().min(10).max(200)
  })).min(2).max(5)
});

/**
 * 6. CTA Section Schema
 * Call-to-action section
 */
export const ctaSectionSchema = z.object({
  type: z.literal('cta'),
  layout: baseSectionLayoutSchema.optional(), // LLM-driven height allocation
  title: z.string().min(10).max(80),
  description: z.string().min(10).max(150).optional(),
  size: z.enum(['compact', 'medium', 'large']).optional(),
  visualWeight: z.enum(['subtle', 'normal', 'prominent']).optional(),
  backgroundColor: z.enum(['blue', 'green', 'purple']).optional(),
  buttons: z.array(z.object({
    text: z.string().min(3).max(30),
    action: z.string(),
    primary: z.boolean()
  })).min(1).max(3).optional() // Made optional - frontend has fallback buttons
});

/**
 * 7. FAQ Section Schema
 * Frequently asked questions
 */
export const faqSectionSchema = z.object({
  type: z.literal('faq'),
  layout: baseSectionLayoutSchema.optional(), // LLM-driven height allocation
  title: z.string().min(5).max(60).optional(),
  size: z.enum(['compact', 'medium', 'large']).optional(),
  visualWeight: z.enum(['subtle', 'normal', 'prominent']).optional(),
  items: z.array(z.object({
    question: z.string().min(10).max(150),
    answer: z.string().min(20).max(600)
  })).min(1).max(8)
});

/**
 * 8. Single Screen Section Schema
 * All-in-one compact format
 */
export const singleScreenSectionSchema = z.object({
  type: z.literal('single_screen'),
  layout: baseSectionLayoutSchema.optional(), // LLM-driven height allocation
  headline: z.string().min(10).max(80),
  subtitle: z.string().min(20).max(120).optional(),
  insights: z.array(z.object({
    title: z.string().min(5).max(60),
    description: z.string().min(20).max(250)
  })).min(3).max(4).optional(),
  stats: z.array(z.object({
    label: z.string().min(3).max(40),
    value: z.string().min(1).max(20)
  })).min(2).max(3).optional(),
  visualContent: z.object({
    type: z.string(),
    data: z.any()
  }).optional(),
  howItWorks: z.array(z.object({
    step: z.string().min(10).max(100)
  })).min(3).max(5).optional(),
  ctas: z.array(z.object({
    text: z.string().min(3).max(30),
    action: z.string(),
    primary: z.boolean()
  })).min(1).max(3)
});

/**
 * Simplified section schema for AI SDK compatibility
 * Uses a flexible approach with optional fields instead of strict unions
 */
export const pageSectionSchema = z.object({
  type: z.enum(['hero', 'feature_grid', 'metrics', 'comparison_table', 'steps', 'cta', 'faq', 'single_screen']),
  // Layout metadata - LLM decides height allocation
  layout: z.object({
    requestedHeightPercent: z.number().min(15).max(100).optional(),
    size: z.enum(['compact', 'medium', 'large']).optional(),
    visualWeight: z.enum(['subtle', 'normal', 'prominent']).optional(),
  }).optional(),
  // Common fields
  title: z.string().optional(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  size: z.enum(['compact', 'medium', 'large']).optional(),
  visualWeight: z.enum(['subtle', 'normal', 'prominent']).optional(),

  // Hero fields
  headline: z.string().optional(),
  subheadline: z.string().optional(),
  ctaButton: z.object({
    text: z.string(),
    action: z.string()
  }).optional(),

  // Feature grid fields
  columns: z.number().optional(),
  features: z.array(z.object({
    title: z.string(),
    description: z.string(),
    icon: z.string().optional()
  })).optional(),

  // Metrics fields
  metrics: z.array(z.object({
    label: z.string(),
    value: z.string(),
    description: z.string().optional()
  })).optional(),

  // Comparison table fields
  headers: z.array(z.string()).optional(),
  rows: z.array(z.object({
    feature: z.string(),
    values: z.array(z.union([z.string(), z.boolean()]))
  })).optional(),

  // Steps fields
  timeline: z.string().optional(),
  steps: z.array(z.object({
    number: z.number(),
    title: z.string(),
    description: z.string()
  })).optional(),

  // CTA fields
  backgroundColor: z.enum(['blue', 'green', 'purple']).optional(),
  buttons: z.array(z.object({
    text: z.string(),
    action: z.string(),
    primary: z.boolean()
  })).optional(),

  // FAQ fields
  items: z.array(z.object({
    question: z.string(),
    answer: z.string()
  })).optional(),

  // Single screen fields
  insights: z.array(z.object({
    title: z.string(),
    description: z.string()
  })).optional(),
  stats: z.array(z.object({
    label: z.string(),
    value: z.string()
  })).optional(),
  visualContent: z.object({
    type: z.string(),
    data: z.any()
  }).optional(),
  howItWorks: z.array(z.object({
    step: z.string()
  })).optional(),
  ctas: z.array(z.object({
    text: z.string(),
    action: z.string(),
    primary: z.boolean()
  })).optional()
}).passthrough(); // Allow additional fields

/**
 * Page layout schema
 */
export const pageLayoutSchema = z.object({
  mode: z.enum(['compact', 'balanced', 'spacious']),
  totalSections: z.number().min(1).max(5),
  estimatedHeight: z.string()
});

/**
 * Complete page schema
 * Simplified to only essential fields for reliable generation
 */
export const pageSchema = z.object({
  type: z.enum([
    'solution_brief',
    'feature_showcase',
    'case_study',
    'comparison',
    'implementation_roadmap',
    'roi_calculator'
  ]),
  title: z.string().min(10).max(100),
  description: z.string().min(50).max(250),
  sections: z.array(pageSectionSchema).min(1).max(5)
});

/**
 * Type exports (inferred from schemas)
 */
export type HeroSectionZod = z.infer<typeof heroSectionSchema>;
export type FeatureGridSectionZod = z.infer<typeof featureGridSectionSchema>;
export type MetricsSectionZod = z.infer<typeof metricsSectionSchema>;
export type ComparisonTableSectionZod = z.infer<typeof comparisonTableSectionSchema>;
export type StepsSectionZod = z.infer<typeof stepsSectionSchema>;
export type CTASectionZod = z.infer<typeof ctaSectionSchema>;
export type FAQSectionZod = z.infer<typeof faqSectionSchema>;
export type SingleScreenSectionZod = z.infer<typeof singleScreenSectionSchema>;
export type PageSectionZod = z.infer<typeof pageSectionSchema>;
export type PageZod = z.infer<typeof pageSchema>;
