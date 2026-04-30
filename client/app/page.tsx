"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import Hero from "./_components/Home/Hero";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

const AnimatedText = dynamic(() => import("./_components/Home/AnimatedText"), {
  loading: () => <div className="h-28 sm:h-32 md:h-36" />,
});

const Features = dynamic(() => import("./_components/Home/Features"), {
  loading: () => <div className="min-h-[420px] w-full animate-pulse bg-slate-50" />,
});

const UpcomingEvents = dynamic(() => import("./_components/Home/UpcomingEvents"), {
  loading: () => <div className="min-h-[520px] w-full animate-pulse bg-white" />,
});

const CTA = dynamic(() => import("./_components/Home/CTA"), {
  loading: () => <div className="min-h-[280px] w-full animate-pulse bg-slate-50" />,
});

const FAQPage = dynamic(() => import("./_components/Home/FAQs"), {
  loading: () => <div className="min-h-[420px] w-full animate-pulse bg-white" />,
});

const Footer = dynamic(() => import("./_components/Home/Footer"), {
  loading: () => <div className="min-h-[220px] w-full animate-pulse bg-[#063168]" />,
});

export default function Home() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    gsap.utils.toArray<HTMLElement>(".section").forEach((section) => {
      gsap.from(section, {
        opacity: 0,
        y: 50,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: section,
          start: "top 80%",
          end: "bottom 20%",
          toggleActions: "play none none reverse",
        },
      });
    });
  }, []);

  return (
    <main className="w-full">
      <div className="section relative z-10">
        <Hero />
        <div className="absolute bottom-0 left-0 w-full z-0 pointer-events-none">
          <img src="/images/hero-wave.svg" className="w-full" alt="" />
        </div>
        <div className="relative z-20">
          <AnimatedText />
        </div>
      </div>
      <div className="section relative z-10">
        <Features />
      </div>
      <div className="section relative z-10">
        <UpcomingEvents />
      </div>
      <div className="section relative z-10">
        <CTA />
      </div>
      <div className="section relative z-10">
        <FAQPage />
      </div>
      <div className="section relative z-10">
        <Footer />
      </div>
    </main>
  );
}
