"use client";

import { useState } from "react";

interface FAQ {
  question: string;
  answer: string;
}

export default function FAQSection() {
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    "What is SOCIO?": true,
  });

  const toggleItem = (question: string) => {
    setOpenItems((prev) => ({
      ...prev,
      [question]: !prev[question],
    }));
  };

  const faqItems: FAQ[] = [
    {
      question: "What is SOCIO?",
      answer:
        "SOCIO is a campus event platform that helps students discover events, register quickly, and stay connected with what is happening across their college community.",
    },
    {
      question: "Is Socio free to use?",
      answer:
        "Yes, absolutely. Socio is completely free for students. You can browse events, register, and stay updated, all without paying a rupee.",
    },
    {
      question: "How do I find events I'm interested in?",
      answer:
        "Use the Discover page to browse events by category, date, or department. You can also search for specific events using the site navigation.",
    },
    {
      question: "How do I register for an event?",
      answer:
        "Open the event page, click Register Now, and follow the prompts to complete registration. You will receive a confirmation once your sign-up is successful.",
    },
    {
      question: "How does QR code attendance work?",
      answer:
        "After registering, you receive a unique QR code. Show it at the event for quick check-in, and the attendance gets recorded instantly.",
    },
    {
      question: "Can I cancel my event registration?",
      answer:
        "Yes, you can cancel a registration from your profile or event details page, subject to the organizer's cancellation policy and deadlines.",
    },
    {
      question: "Who can post an event on SOCIO?",
      answer:
        "Events are posted by verified organizers and coordinators so the listings stay genuine and approved before they go live.",
    },
    {
      question: "How do I know when a new event has been posted?",
      answer:
        "SOCIO notifies you when new events go live, so you can stay updated without constantly checking multiple group chats.",
    },
  ];

  return (
    <div
      className="w-full py-8 sm:py-12 px-4 sm:px-6 md:px-16 bg-white mb-8"
    >
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10">
          <div className="w-full">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 text-gray-900">
              Frequently asked questions
            </h2>
            <p className="text-gray-500 text-base sm:text-lg leading-normal">
              Check out our FAQs for quick answers about event registrations,
              tickets, check-ins, and more. Contact us if you have any other
              queries.
            </p>
          </div>

          <div className="w-full">
            <div className="space-y-1">
              {faqItems.map((faq, index) => (
                <div
                  key={index}
                  className={`faq-item ${
                    index !== faqItems.length - 1
                      ? "border-b border-gray-200"
                      : ""
                  }`}
                >
                  <button
                    onClick={() => toggleItem(faq.question)}
                    className="flex justify-between items-center w-full text-left py-4 sm:py-6 cursor-pointer"
                    aria-expanded={openItems[faq.question] || false}
                  >
                    <span className="font-medium text-base sm:text-lg text-gray-900">
                      {faq.question}
                    </span>
                    <span className="flex-shrink-0 ml-4 text-lg">
                      {openItems[faq.question] ? "-" : "+"}
                    </span>
                  </button>

                  {openItems[faq.question] && (
                    <div className="pb-4 sm:pb-6 pr-6 sm:pr-10 text-gray-500 text-sm sm:text-base leading-relaxed">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
