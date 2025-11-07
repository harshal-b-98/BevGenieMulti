import Link from "next/link"
import { Linkedin } from "lucide-react"

export function Footer() {
  return (
    <footer className="bg-[#0A1930] text-[#FFFFFF] py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-6 mb-3">
          {/* Brand */}
          <div>
            <h3 className="font-display font-bold text-sm mb-1">BevGenie</h3>
            <p className="text-[#FFFFFF]/80 text-xs leading-snug">
              Built by data and beverage industry experts to power the next generation of supplier intelligence.
            </p>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="font-display font-semibold text-sm mb-1">Company</h4>
            <ul className="space-y-1">
              <li>
                <Link href="/about" className="text-[#FFFFFF]/80 hover:text-[#00C8FF] transition-colors text-xs">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-[#FFFFFF]/80 hover:text-[#00C8FF] transition-colors text-xs">
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h4 className="font-display font-semibold text-sm mb-1">Connect</h4>
            <ul className="space-y-1">
              <li>
                <Link href="/demo" className="text-[#FFFFFF]/80 hover:text-[#00C8FF] transition-colors text-xs">
                  Book a Demo
                </Link>
              </li>
              <li>
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#FFFFFF]/80 hover:text-[#00C8FF] transition-colors flex items-center gap-1 text-xs"
                >
                  <Linkedin size={14} />
                  LinkedIn
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-2 border-t border-[#FFFFFF]/10">
          <p className="text-[#FFFFFF]/60 text-xs text-center">© 2025 BevGenie. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
