create table if not exists public.support_articles (
  id bigint generated always as identity primary key,
  category text not null check (category in ('account', 'events', 'technical', 'mobile', 'organizer')),
  title text not null,
  description text not null,
  content text not null,
  read_time_minutes integer not null default 3 check (read_time_minutes > 0),
  helpful_count integer not null default 0 check (helpful_count >= 0),
  status text not null default 'published' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.support_articles (
  category,
  title,
  description,
  content,
  read_time_minutes,
  helpful_count,
  status
)
select *
from (
  values
    (
      'account',
      'How to create a SOCIO account',
      'Step-by-step guide to setting up your student account',
      'Sign in using your Christ University Google account from the SOCIO auth page. If you are a student or staff member, your profile will be created automatically after first login. Review your profile details and complete any missing fields before registering for events.',
      3,
      89,
      'published'
    ),
    (
      'account',
      'Forgot password? Reset it here',
      'Quick steps to recover your account access',
      'SOCIO uses Google authentication, so password resets are managed in your Google account settings. If login still fails, clear browser cache, sign out of all Google accounts, and sign in again with your campus account.',
      2,
      156,
      'published'
    ),
    (
      'events',
      'How to register for events',
      'Complete guide to event registration and payment',
      'Open the event page, review eligibility and deadline details, then click Register. For paid events, complete payment if required and verify your registration confirmation. Your QR code will be available in your account once registration is successful.',
      4,
      234,
      'published'
    ),
    (
      'events',
      'Managing your event registrations',
      'View, modify, or cancel your event bookings',
      'Go to your profile and open the registrations area to view upcoming and past registrations. You can cancel registrations where cancellation is allowed before the deadline. Always check event-specific rules before modifying submissions.',
      3,
      142,
      'published'
    ),
    (
      'events',
      'QR code attendance system',
      'How the QR attendance tracking works',
      'After successful registration, SOCIO generates a unique QR code tied to your registration record. Show this QR code at the venue for attendance scanning by organizers. If scanning fails, present your registration details for manual verification.',
      2,
      98,
      'published'
    ),
    (
      'technical',
      'App not loading properly',
      'Troubleshoot common loading issues',
      'Start by refreshing the page and checking your internet connection. If issues continue, clear cache and cookies for the site, then try again in an updated browser. If the problem persists, contact support with screenshots and device details.',
      3,
      67,
      'published'
    ),
    (
      'technical',
      'Notification settings',
      'Customize your event notifications',
      'Review your notification preferences in profile settings and ensure browser notification permissions are enabled for SOCIO. Also check email spam folders for missed updates. Disable and re-enable notifications if delivery appears inconsistent.',
      2,
      45,
      'published'
    ),
    (
      'organizer',
      'How to create and manage events',
      'Complete guide for event organizers',
      'Organizers can create events from the management dashboard by filling title, schedule, venue, and participant settings. After publishing, monitor registrations, communicate updates, and track attendance from organizer tools. Keep deadlines and event details current.',
      8,
      78,
      'published'
    ),
    (
      'mobile',
      'Download the SOCIO mobile app',
      'Get the app for iOS and Android',
      'Visit the app download section and select your platform. Install the app, sign in with your SOCIO account, and enable notifications for real-time event alerts. Use the latest app version for best reliability and performance.',
      1,
      234,
      'published'
    )
) as seed_data (
  category,
  title,
  description,
  content,
  read_time_minutes,
  helpful_count,
  status
)
where not exists (
  select 1 from public.support_articles
);
