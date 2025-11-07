import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { HeroBackgroundSlideshow } from "./hero-background-slideshow"

interface HeroProps {
  onCtaClick?: (text: string) => void;
}

export function Hero({ onCtaClick }: HeroProps) {
  return (
    <section className="relative h-[calc(100vh-4rem)] flex items-center bg-gradient-to-b from-[#0A1628] to-[#0D1B2E] overflow-hidden">
      <HeroBackgroundSlideshow />

      <div className="absolute inset-0 opacity-8">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
            linear-gradient(to right, #06B6D4 1px, transparent 1px),
            linear-gradient(to bottom, #06B6D4 1px, transparent 1px)
          `,
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-[#0A1628] via-[#0A1628]/80 to-transparent z-[3]" />

      <div className="absolute top-20 right-10 w-96 h-96 rounded-full border border-[#06B6D4]/20 opacity-30" />
      <div className="absolute top-40 right-32 w-64 h-64 rounded-full border border-[#06B6D4]/15 opacity-20" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10 w-full">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <div className="max-w-2xl">
            <h1 className="font-display font-extrabold text-[#FFFFFF] mb-6 leading-tight">
              <span className="block text-5xl sm:text-6xl md:text-6xl lg:text-6xl font-semibold mb-3">
                Simplify intelligence
              </span>
              <span className="block text-2xl sm:text-3xl md:text-3xl lg:text-3xl font-normal text-[#FFFFFF]/90">
                Get answers, not dashboards
              </span>
            </h1>

            <p className="text-[#94A3B8] text-base md:text-lg mb-6 leading-relaxed max-w-xl">
              Built specifically for beverage suppliers, BevGenie's AI uses mastered industry data and your performance
              signals to answer complex questions in seconds.
            </p>

            <div className="space-y-3 mb-6">
              <button
                onClick={() => onCtaClick?.('uncover sales opportunities')}
                className="w-full text-left p-4 bg-[#152238] border border-white/10 rounded-xl hover:border-[#06B6D4]/50 hover:-translate-y-1 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[#06B6D4] font-semibold text-lg">Uncover sales opportunities</span>
                  <ArrowRight className="text-[#06B6D4] group-hover:translate-x-1 transition-transform" size={20} />
                </div>
              </button>
              <button
                onClick={() => onCtaClick?.('sharpen go-to-market strategy')}
                className="w-full text-left p-4 bg-[#152238] border border-white/10 rounded-xl hover:border-[#06B6D4]/50 hover:-translate-y-1 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[#06B6D4] font-semibold text-lg">Sharpen go-to-market</span>
                  <ArrowRight className="text-[#06B6D4] group-hover:translate-x-1 transition-transform" size={20} />
                </div>
              </button>
              <button
                onClick={() => onCtaClick?.('grow with confidence')}
                className="w-full text-left p-4 bg-[#152238] border border-white/10 rounded-xl hover:border-[#06B6D4]/50 hover:-translate-y-1 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[#06B6D4] font-semibold text-lg">Grow with confidence</span>
                  <ArrowRight className="text-[#06B6D4] group-hover:translate-x-1 transition-transform" size={20} />
                </div>
              </button>
            </div>

            <div className="pt-4 border-t border-white/10">
              <Button
                size="lg"
                className="bg-[#06B6D4] text-white hover:bg-[#0891B2] font-semibold text-base px-8 py-4 rounded-xl group transition-all"
                onClick={() => onCtaClick?.('talk to an expert')}
              >
                Talk to an expert
                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={18} />
              </Button>
            </div>
          </div>

          <div className="hidden lg:block" />
        </div>
      </div>
    </section>
  )
}
