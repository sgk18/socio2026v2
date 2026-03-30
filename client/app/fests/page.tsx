"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { formatDateRange } from "@/lib/dateUtils";

import { FestCard } from "../_components/Discover/FestCard";
import Footer from "../_components/Home/Footer";

const ITEMS_PER_PAGE = 12;

interface Fest {
  fest_id: number;
  fest_title: string;
  organizing_dept: string;
  description: string;
  opening_date: string;
  closing_date: string;
  fest_image_url: string;
  category: string;
}

interface FilterOption {
  name: string;
  active: boolean;
}

const buildFestsUrl = (category: string | null, searchValue: string) => {
  const params = new URLSearchParams();
  if (category && category.toLowerCase() !== "all") {
    params.set("category", category);
  }

  const normalizedSearch = searchValue.trim();
  if (normalizedSearch) {
    params.set("search", normalizedSearch);
  }

  const queryString = params.toString();
  return queryString ? `/fests?${queryString}` : "/fests";
};

const FestsPage = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const categoryParam = searchParams.get("category");
  const searchParam = searchParams.get("search") || "";

  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState(searchParam);
  const [filterOptions, setFilterOptions] = useState<FilterOption[]>([
    { name: "All", active: true },
    { name: "Technology", active: false },
    { name: "Cultural", active: false },
    { name: "Science", active: false },
    { name: "Arts", active: false },
    { name: "Management", active: false },
    { name: "Academic", active: false },
    { name: "Sports", active: false },
  ]);

  const [allFests, setAllFests] = useState<Fest[]>([]);
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/api\/?$/, "");
  
  useEffect(() => {
    fetch(`${API_URL}/api/fests`)
      .then((res) => res.json())
      .then((data) => {
        // Assuming the API returns { fests: Fest[] }
        if (data && Array.isArray(data.fests)) {
          setAllFests(data.fests);
        } else {
          console.error(
            "Error: API response is not in the expected format",
            data
          );
          setAllFests([]);
        }
      })
      .catch((error) => {
        console.error("Error fetching fests:", error);
        setAllFests([]);
      });
  }, []);

  useEffect(() => {
    const activeFilter = filterOptions
      .find((f) => f.active)
      ?.name.toLowerCase();
    const paramToMatch = categoryParam?.toLowerCase();

    if (categoryParam && activeFilter !== paramToMatch) {
      const normalizedCategoryParam = categoryParam.toLowerCase();
      const newActiveExists = filterOptions.some(
        (filter) => filter.name.toLowerCase() === normalizedCategoryParam
      );

      setFilterOptions((prevFilters) =>
        prevFilters.map((filter) => ({
          ...filter,
          active: newActiveExists
            ? filter.name.toLowerCase() === normalizedCategoryParam
            : filter.name === "All",
        }))
      );
    } else if (!categoryParam && activeFilter !== "all") {
      setFilterOptions((prevFilters) =>
        prevFilters.map((filter) => ({
          ...filter,
          active: filter.name === "All",
        }))
      );
    }
  }, [categoryParam]);

  const activeFilter =
    filterOptions.find((filter) => filter.active)?.name || "All";

  useEffect(() => {
    setSearchQuery(searchParam);
  }, [searchParam]);

  // Keep URL in sync with the page-level fests search input.
  useEffect(() => {
    const normalizedSearch = searchQuery.trim();
    const normalizedParamSearch = searchParam.trim();

    if (normalizedSearch === normalizedParamSearch) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      router.replace(buildFestsUrl(categoryParam, normalizedSearch), {
        scroll: false,
      });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [categoryParam, router, searchParam, searchQuery]);

  const festsToFilter = Array.isArray(allFests) ? allFests : [];
  const filteredFests: Fest[] = festsToFilter.filter((fest: Fest) => {
    if (
      activeFilter !== "All" &&
      fest.category?.toLowerCase() !== activeFilter.toLowerCase()
    ) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const titleMatch = fest.fest_title?.toLowerCase().includes(q);
      const deptMatch = fest.organizing_dept?.toLowerCase().includes(q);
      const descriptionMatch = fest.description?.toLowerCase().includes(q);
      const categoryMatch = fest.category?.toLowerCase().includes(q);

      if (!titleMatch && !deptMatch && !descriptionMatch && !categoryMatch) {
        return false;
      }
    }

    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredFests.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedFests = filteredFests.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Reset to page 1 when category/search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchQuery]);

  const handleFilterClick = (clickedFilter: string) => {
    setFilterOptions(
      filterOptions.map((filter) => ({
        ...filter,
        active: filter.name === clickedFilter,
      }))
    );

    const nextCategory = clickedFilter === "All" ? null : clickedFilter;
    router.push(buildFestsUrl(nextCategory, searchQuery));
  };

  const handlePageSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    router.push(buildFestsUrl(categoryParam, searchQuery), { scroll: false });
  };

  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="mb-12">
          <div className="flex flexrow items-center justify-between">
            <h1 className="text-3xl font-black text-[#154CB3] mb-2 mt-6">
              Explore fests
            </h1>
            <Link
              href="/Discover"
              className="flex items-center text-[#063168] hover:underline cursor-pointer text-xs sm:text-base"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                />
              </svg>
              Back to Discovery
            </Link>
          </div>
          <p className="text-gray-500 mb-6 text-sm sm:text-base">
            Browse through all upcoming fests and festivals happening on campus.
          </p>

          <form onSubmit={handlePageSearchSubmit} className="mb-6 sm:mb-8 max-w-3xl">
            <label htmlFor="fests-page-search" className="sr-only">
              Search fests
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  id="fests-page-search"
                  type="text"
                  placeholder="Search by fest title, department, category, or description"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-full border border-gray-300 px-4 py-2.5 pr-20 text-sm sm:text-base focus:outline-none focus:ring-1 focus:ring-[#154CB3] focus:border-[#154CB3]"
                />
                {searchQuery.trim() ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs font-semibold text-[#154CB3] hover:bg-[#154CB3]/10 cursor-pointer"
                  >
                    Clear
                  </button>
                ) : (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      className="h-4 w-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m21 21-4.35-4.35m1.6-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                      />
                    </svg>
                  </span>
                )}
              </div>
              <button
                type="submit"
                className="shrink-0 rounded-full bg-[#154CB3] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f3f95] transition-colors cursor-pointer"
              >
                Search
              </button>
            </div>
          </form>

          <div className="flex flex-wrap gap-2 mb-6 sm:mb-8">
            {filterOptions.map((filter, index) => (
              <button
                key={index}
                onClick={() => handleFilterClick(filter.name)}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all cursor-pointer touch-manipulation ${
                  filter.active
                    ? "bg-[#154CB3] text-white"
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
                }`}
              >
                {filter.name}
              </button>
            ))}
          </div>

          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-[#063168] mb-4 sm:mb-6">
              {`${activeFilter === "All" ? "All" : activeFilter} fests (${
                filteredFests.length
              })`}
            </h2>

            {paginatedFests.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                  {paginatedFests.map((fest) => (
                    <div key={fest.fest_id} className="min-w-0 h-full">
                      <FestCard
                        title={fest.fest_title}
                        dept={fest.organizing_dept}
                        description={fest.description}
                        dateRange={formatDateRange(fest.opening_date, fest.closing_date)}
                        image={fest.fest_image_url}
                      />
                    </div>
                  ))}
                </div>

                {/* Pagination Controls */}
                {filteredFests.length > ITEMS_PER_PAGE && (
                  <div className="flex justify-center items-center gap-4 mt-12">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-6 py-3 bg-[#154CB3] text-white rounded-full disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-[#154cb3eb] transition-colors font-medium"
                    >
                      Previous
                    </button>
                    <span className="text-gray-700 font-medium">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-6 py-3 bg-[#154CB3] text-white rounded-full disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-[#154cb3eb] transition-colors font-medium"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 sm:py-12">
                <h3 className="text-lg sm:text-xl font-bold text-gray-700 mb-2">
                  No fests found
                </h3>
                <p className="text-gray-500 text-sm sm:text-base">
                  Try adjusting your filters to find more fests.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default FestsPage;

