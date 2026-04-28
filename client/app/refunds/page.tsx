"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function RefundPolicy() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-blue-50">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="bg-white shadow-xl rounded-2xl overflow-hidden">
          <div className="bg-[#063168] py-6 px-8">
            <h1 className="text-3xl font-bold text-white">Refund Policy</h1>
            <p className="mt-2 text-blue-100">Effective Date: 21st April 2026</p>
          </div>

          <div className="px-8 py-6 prose prose-blue max-w-none text-gray-700">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800">No Payment Processing</h2>
              <p>
                SOCIO is a free-to-use campus event management platform built exclusively for Christ University.
                We do not collect, process, or handle any payments, fees, or financial transactions of any kind.
              </p>
              <p>
                All events listed on SOCIO are free for registered users. There are no ticket purchases,
                subscription charges, or in-app payments facilitated through this platform.
              </p>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800">No Refunds Applicable</h2>
              <p>
                Since SOCIO does not charge users for any service, feature, or event registration,
                there is nothing to refund. If you believe you were charged through a service
                claiming to be SOCIO, please report it immediately — it is not affiliated with us.
              </p>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800">Third-Party Payments</h2>
              <p>
                Some events managed externally by clubs or departments at Christ University may
                involve separate payment processes outside of the SOCIO platform. SOCIO has no
                involvement in, control over, or liability for any such transactions. Please
                contact the respective organiser directly for any payment-related queries.
              </p>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800">Contact</h2>
              <p>
                If you have questions about this policy, reach out to us at{" "}
                <a href="mailto:hello@withsocio.com" className="text-[#154CB3] hover:underline">
                  hello@withsocio.com
                </a>
                .
              </p>
            </div>

            <div className="mt-10 pt-6 border-t border-gray-200 flex flex-wrap gap-4 text-sm text-[#154CB3]">
              <Link href="/terms" className="hover:underline">Terms of Service</Link>
              <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
              <Link href="/cookies" className="hover:underline">Cookie Policy</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
