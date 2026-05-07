import React from "react";
import { CentreClubCard } from "./ClubCard";
import { SectionHeader } from "./SectionHeader";

interface SectionItem {
  id: string | number;
  title: string;
  subtitle?: string;
  description: string;
  slug?: string;
  image?: string;
  categories?: string[];
  type: "center" | "club" | "cell";
  registrationsOpen?: boolean;
  showEditButton?: boolean;
  editHref?: string;
  showManageButton?: boolean;
  manageHref?: string;
}

interface SectionProps {
  title: string;
  items: SectionItem[];
  linkUrl: string;
  showAll?: boolean;
}

export const ClubSection = ({
  title,
  items,
  linkUrl,
  showAll = false,
}: SectionProps) => {
  const displayItems = showAll ? items : items.slice(0, 6);

  return (
    <div className="min-w-0">
      <SectionHeader title={title} link={linkUrl} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        {displayItems.map((item) => (
          <div key={item.id} className="min-w-0 h-full">
            <CentreClubCard
              title={item.title}
              subtitle={item.subtitle}
              description={item.description}
              slug={item.slug}
              image={item.image}
              categories={item.categories}
              type={item.type}
              registrationsOpen={item.registrationsOpen}
              showEditButton={item.showEditButton}
              editHref={item.editHref}
              showManageButton={item.showManageButton}
              manageHref={item.manageHref}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
