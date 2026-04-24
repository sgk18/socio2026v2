import Link from "next/link";
import Image from "next/image";
import Logo from "@/app/logo.svg";
import { useAuth } from "@/context/AuthContext";

export default function Footer() {
  const { session } = useAuth();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-gradient-to-b from-[#063168] to-[#3D75BD] pt-12 pb-6 px-4">
      <div className="max-w-7xl mx-auto">

        {/* Main 4-column grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 md:gap-8">

          {/* Column 1: Brand */}
          <div>
            <Link href={session ? "/Discover" : "/"}>
              <Image
                src={Logo}
                alt="SOCIO"
                width={96}
                height={36}
                className="mb-3 brightness-0 invert"
              />
            </Link>
            <p className="text-white/60 text-sm leading-relaxed mb-6">
              Connecting campus through events, &amp; activities.
            </p>

            {/* Social icons — small bordered squares */}
            <div className="flex items-center gap-3">
              <a
                href="https://www.instagram.com/the.socio.official"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="w-8 h-8 flex items-center justify-center rounded border border-white/20 hover:border-white/60 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="white" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a
                href="http://www.youtube.com/@the.socio.official"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
                className="w-8 h-8 flex items-center justify-center rounded border border-white/20 hover:border-white/60 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="white" viewBox="0 0 24 24">
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                </svg>
              </a>
              <a
                href="https://www.linkedin.com/company/socio.official/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="w-8 h-8 flex items-center justify-center rounded border border-white/20 hover:border-white/60 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="white" viewBox="0 0 24 24">
                  <path d="M4.98 3.5c0 1.381-1.11 2.5-2.48 2.5s-2.48-1.119-2.48-2.5c0-1.38 1.11-2.5 2.48-2.5s2.48 1.12 2.48 2.5zm.02 4.5h-5v16h5v-16zm7.982 0h-4.968v16h4.969v-8.399c0-4.67 6.029-5.052 6.029 0v8.399h4.988v-10.131c0-7.88-8.922-7.593-11.018-3.714v-2.155z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Column 2: Product */}
          <div>
            <h3 className="text-white font-semibold text-xs tracking-widest uppercase pb-2 mb-4 border-b border-[#FFCC00]">
              Product
            </h3>
            <ul className="space-y-3">
              <li><Link href="/Discover" className="text-white/60 text-sm hover:text-white transition-colors">Discover</Link></li>
              <li><Link href="/fests" className="text-white/60 text-sm hover:text-white transition-colors">Fests</Link></li>
              <li><Link href="/clubs" className="text-white/60 text-sm hover:text-white transition-colors">Clubs</Link></li>
              <li><Link href="/create" className="text-white/60 text-sm hover:text-white transition-colors">Create Event</Link></li>
              <li><Link href="/pricing" className="text-white/60 text-sm hover:text-white transition-colors">Pricing</Link></li>
            </ul>
          </div>

          {/* Column 3: Company */}
          <div>
            <h3 className="text-white font-semibold text-xs tracking-widest uppercase pb-2 mb-4 border-b border-[#FFCC00]">
              Company
            </h3>
            <ul className="space-y-3">
              <li><Link href="/about" className="text-white/60 text-sm hover:text-white transition-colors">About</Link></li>
              <li><Link href="/support/careers" className="text-white/60 text-sm hover:text-white transition-colors">Careers</Link></li>
              <li><Link href="/contact" className="text-white/60 text-sm hover:text-white transition-colors">Contact</Link></li>
              <li><Link href="/support" className="text-white/60 text-sm hover:text-white transition-colors">Support</Link></li>
              <li><Link href="/blog" className="text-white/60 text-sm hover:text-white transition-colors">Blog</Link></li>
            </ul>
          </div>

          {/* Column 4: Legal */}
          <div>
            <h3 className="text-white font-semibold text-xs tracking-widest uppercase pb-2 mb-4 border-b border-[#FFCC00]">
              Legal
            </h3>
            <ul className="space-y-3">
              <li><Link href="/privacy" className="text-white/60 text-sm hover:text-white transition-colors">Privacy</Link></li>
              <li><Link href="/terms" className="text-white/60 text-sm hover:text-white transition-colors">Terms</Link></li>
              <li><Link href="/cookies" className="text-white/60 text-sm hover:text-white transition-colors">Cookies</Link></li>
              <li><Link href="/refunds" className="text-white/60 text-sm hover:text-white transition-colors">Refunds</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-5 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-white/40 text-xs">
            © {currentYear} Socio - Christ (Deemed to be University)
          </p>
          <p className="text-white/40 text-xs">
            Made on campus, in Bangalore.
          </p>
        </div>

      </div>
    </footer>
  );
}
