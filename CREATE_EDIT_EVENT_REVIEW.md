# Create/Edit Event Page Review
## sociowebinterns/socio2026v2

---

## Overview
The create/edit event functionality is split into two pages that share a common form component:
- **Create**: [/client/app/create/event/page.tsx](sociowebinterns/socio2026v2/client/app/create/event/page.tsx)
- **Edit**: [/client/app/edit/event/[id\]/page.tsx](sociowebinterns/socio2026v2/client/app/edit/event/[id]/page.tsx)
- **Form Component**: [/client/app/_components/Admin/ManageEvent.tsx](sociowebinterns/socio2026v2/client/app/_components/Admin/ManageEvent.tsx)

---

## Page Structure

### 1. Create Event Page (`/create/event/page.tsx`)
**Purpose**: Allows organizers to create new events

**Flow**:
1. Authenticates user via Supabase
2. Validates session and token expiration
3. Collects form data via EventForm component
4. Converts form data to FormData object with file handling
5. Sends POST request to `/api/events`
6. Shows success/error feedback

**Key Features**:
- Session validation and token refresh
- Token expiration check
- Comprehensive logging for debugging
- File handling for images, banners, and PDFs
- Detailed error messages
- Redirect to `/auth` on auth failure

### 2. Edit Event Page (`/edit/event/[id]/page.tsx`)
**Purpose**: Allows organizers to modify existing events

**Flow**:
1. Validates user authorization (organizer or master admin)
2. Fetches existing event data from API
3. Pre-fills EventForm with event data
4. Handles file operations (preserve, replace, or delete)
5. Sends PUT request to `/api/events/{eventIdSlug}`
6. Handles event ID changes when title is updated

**Key Features**:
- Authorization checks (is_organiser or is_masteradmin)
- Data transformation from API format to form format
- Event archival/unarchival toggle
- File URL preservation logic
- Event ID slug auto-generation from title
- Archive status management
- Detailed error handling for stale states

**Data Transformation**:
- Parses `department_access` from various formats (array, JSON string, single string)
- Converts dates using dayjs formatting (YYYY-MM-DD)
- Normalizes schedule items with time validation
- Handles team event parameters (min/max participants)
- Converts boolean values correctly (handles "0", "1", "true", "false" strings)

### 3. EventForm Component (`ManageEvent.tsx`)
**Purpose**: Reusable form for creating and editing events

#### Form Fields:

##### Basic Information
- **Event Title** (required): Text input
- **Event Date** (required): Custom date picker with min-date validation
- **End Date**: Optional custom date picker
- **Event Time** (required): Custom time picker (HH:MM format)
- **Detailed Description** (required): Textarea

##### Organization & Categorization
- **Department** (required): Multi-select dropdown
  - Supports single or multiple departments
  - Dynamic normalization to handle various formats
- **Organizing Department** (required): Text input
- **Category**: Custom dropdown
- **Fest Event**: Dropdown with options loaded dynamically
  - Cascading: Updates department/category/campus when fest changes (create mode only)
  - Options: "None" + dynamically fetched fests

##### Registration & Participation
- **Registration Deadline**: Custom date picker
- **Registration Fee**: Number input (defaults to 0)
- **Venue**: Text input
- **Is Team Event**: Toggle
  - Enables min/max participants fields
- **Max Participants**: Only visible if team event
- **Min Participants**: Only visible if team event

##### Contact Information
- **Contact Email** (required): Email input
- **Contact Phone**: Phone input
- **WhatsApp Invite Link**: URL input

##### Advanced Features
- **Provide Claims**: Toggle (default: false)
- **On-Spot Registration**: Toggle (default: false)
- **Send Notifications**: Toggle

##### Outsider Registration (Optional)
- **Allow Outsiders**: Toggle
- **Outsider Registration Fee**: Number input
- **Outsider Max Participants**: Number input

##### Campus Management
- **Campus Hosted At**: Dropdown (CHRIST University campuses)
- **Allowed Campuses**: Multi-select of CHRIST campuses

##### Dynamic Lists
- **Schedule Items**: Add/remove time-activity pairs
  - Fields: Time (HH:MM), Activity description
  - Validation: Both fields required
  
- **Rules**: Add/remove rule entries
  - Simple text list
  
- **Prizes**: Add/remove prize entries
  - Simple text list
  
- **Event Heads**: Contact emails/names (in API layer)
  
- **Custom Fields**: Dynamic form field builder
  - Field name, type (text/dropdown/checkbox), required toggle

##### File Uploads
- **Event Image**: Single file upload
  - Formats: .jpg, .png (handled by FileInput component)
  - Display: Shows existing URL in edit mode
  
- **Banner Image**: Single file upload
  - Display: Shows existing URL in edit mode
  
- **PDF File**: Single file upload
  - Display: Shows existing URL in edit mode
  - Remove option available in edit mode

#### Special Features in Edit Mode

1. **Archive Toggle**
   - Displays current archive status
   - Separate button with loading state
   - PATCH to `/api/events/{id}/archive`

2. **File Handling**
   - Show existing file URLs
   - Option to replace files
   - Option to remove files explicitly
   - Sends removal flags if file was cleared

3. **Event ID Change Detection**
   - If title changes, event ID slug regenerates
   - API returns `id_changed` flag and new `event_id`
   - Auto-redirects to new URL with success toast
   - Shows 5-second notification about URL change

4. **Delete Event Option**
   - Confirmation modal with event title
   - Deletes event and all registrations
   - Shows success modal with note about caching
   - Redirects to `/manage`

5. **Close Registrations**
   - Separate action button
   - POST to `/api/events/{id}/close`
   - Shows success modal

#### Validation & Error Handling

- **Custom Date/Time Pickers**: 
  - Date: YYYY-MM-DD format
  - Time: HH:MM format (00-23 hours, 00-59 minutes)
  - Min date validation for event date

- **Participant Numbers**:
  - Min participants must be ≤ max participants
  - Triggers validation when team event toggle changes
  - Auto-sets to 1 for non-team events

- **Fest Cascading** (Create Mode Only):
  - Selecting a fest pre-fills department, organizing dept, category, campus
  - Manual changes are possible after selection
  - Edit mode prevents auto-cascading to preserve manual edits

- **Department/Campus Normalization**:
  - Handles case-insensitive matching
  - Removes special characters for comparison
  - Supports multiple formats (string, JSON array, comma-separated)

- **Error Display**:
  - Page-level error banner on API failures
  - Field-level errors from validation
  - Toast notifications for operations (success, error)

#### Success States & Modals

1. **Publish Success Modal** (Create)
   - Shows checkmark and "Event Published!"
   - Button: "Back to Dashboard" → redirects to `/manage`

2. **Update Success Modal** (Edit)
   - Shows checkmark and "Event Updated!"
   - Handles redirect if URL changed

3. **Delete Success Modal**
   - Shows checkmark and "Event Deleted"
   - Includes caching disclaimer
   - Button: "Back to My Events"

4. **Close Registrations Modal**
   - Confirms registration closure

#### Visual Feedback

- **Publishing Overlay**: 
  - Shows during submission with sprint + victory animation
  - Different visual modes: "publishing", "updating", "deleting"

- **Loading States**:
  - Initial data loading on edit
  - Submit button disabled during submission
  - Archive toggle button shows loading state

- **Responsive Design**:
  - Mobile-first with sm: and md: breakpoints
  - Reduced padding on mobile
  - Full-width on mobile, max-w-4xl on desktop

---

## API Integration

### Create Event: POST `/api/events`
**Headers**: Authorization Bearer token, FormData

**Body Fields**:
```
- title
- event_date (YYYY-MM-DD)
- end_date (YYYY-MM-DD)
- event_time (HH:MM:SS)
- description
- organizing_dept
- department_access (JSON array)
- category
- fest_id (optional)
- registration_deadline (YYYY-MM-DD)
- venue
- registration_fee
- max_participants
- min_participants
- organizer_email
- organizer_phone
- whatsapp_invite_link
- claims_applicable (boolean)
- send_notifications (boolean)
- on_spot (boolean)
- allow_outsiders (boolean)
- outsider_registration_fee
- outsider_max_participants
- campus_hosted_at
- allowed_campuses (JSON array)
- schedule (JSON array)
- rules (JSON array)
- prizes (JSON array)
- event_heads (JSON array)
- custom_fields (JSON array)
- created_by (user email)
- eventImage (File)
- bannerImage (File)
- pdfFile (File)
```

### Fetch Event: GET `/api/events/{eventIdSlug}`
**Returns**: Event object with all details and file URLs

### Edit Event: PUT `/api/events/{eventIdSlug}`
**Headers**: Authorization Bearer token, FormData

**Special Handling**:
- `existingImageFileUrl`: Preserve existing image
- `existingBannerFileUrl`: Preserve existing banner
- `existingPdfFileUrl`: Preserve existing PDF
- `removeImageFile`: Flag to delete image
- `removeBannerFile`: Flag to delete banner
- `removePdfFile`: Flag to delete PDF
- `eventImage`, `bannerImage`, `pdfFile`: New files (optional)

**Response**: 
- Returns updated event object
- Includes `id_changed` and new `event_id` if title changed

### Archive Event: PATCH `/api/events/{eventIdSlug}/archive`
**Headers**: Authorization Bearer token

**Body**: `{ archive: boolean }`

**Response**: Updated event with `is_archived` status

### Close Registrations: POST `/api/events/{eventIdSlug}/close`
**Headers**: Authorization Bearer token

### Delete Event: DELETE `/api/events/{eventIdSlug}`
**Headers**: Authorization Bearer token

---

## Key Code Patterns

### Session Management
```typescript
// Validate and refresh session
const { data: refreshData } = await supabase.auth.refreshSession();
const { data: { session } } = await supabase.auth.getSession();

// Verify token expiration
const tokenPayload = JSON.parse(atob(token.split('.')[1]));
const currentTime = Math.floor(Date.now() / 1000);
if (tokenPayload.exp <= currentTime) { /* expired */ }
```

### FormData Handling
```typescript
const formData = new FormData();

// String fields
formData.append("title", dataFromHookForm.eventTitle);

// Arrays as JSON
formData.append("schedule", JSON.stringify(dataFromHookForm.scheduleItems));

// Files
if (file instanceof FileList && file.length > 0) {
  formData.append("eventImage", file[0]);
} else if (file instanceof File) {
  formData.append("eventImage", file);
}
```

### Data Transformation
```typescript
// Parse API response
const parsedDepartments = [];
if (Array.isArray(dbDepartmentAccess)) {
  parsedDepartments = dbDepartmentAccess.filter(
    val => typeof val === "string" && 
    departmentOptions.some(opt => opt.value === val)
  );
} else if (typeof dbDepartmentAccess === "string") {
  try {
    const jsonData = JSON.parse(dbDepartmentAccess);
    // Handle as array
  } catch (e) {
    // Treat as single string
  }
}
```

### Normalization
```typescript
const toCanonical = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const normalizeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    // Try JSON parse, comma split, or single value
  }
  return [];
};
```

---

## Common Issues & Solutions

### Issue: Form doesn't pre-fill on edit
**Solution**: Check if `defaultValues` is being passed and `reset()` is called in useEffect

### Issue: Files not uploading
**Solution**: Verify FileList handling - check if `file instanceof FileList` and extract first item

### Issue: Cascading doesn't work
**Solution**: Remember this only works in CREATE mode. Edit mode preserves user's manual changes.

### Issue: Date format mismatch
**Solution**: Always use YYYY-MM-DD format. Use dayjs for parsing/formatting.

### Issue: Department/Campus not recognized
**Solution**: Check normalization functions for case/special character handling

### Issue: Token expired during submission
**Solution**: Session refresh happens at page load, but long-running forms may expire. Consider refresh in submission handler.

---

## Best Practices

1. **Always validate file types** before appending to FormData
2. **Use toast notifications** for user feedback (success/error)
3. **Preserve file URLs** in edit mode to avoid re-uploading unchanged files
4. **Handle both string and boolean** values for flags (API may return different types)
5. **Use dayjs** for all date operations for consistency
6. **Log FormData contents** for debugging (file names, sizes, types)
7. **Check authorization** before rendering edit page (organizer or masteradmin only)
8. **Show caching disclaimers** for destructive operations (delete)
9. **Auto-cascade fest values** only in create mode
10. **Validate URLs** before redirects after delete

---

## Architecture Notes

- **Client-side validation**: Forms use React Hook Form with custom normalization
- **Server-side validation**: API handles final validation and persistence
- **File handling**: Multipart FormData for mixed file and text data
- **Authentication**: Supabase session management with token verification
- **Error handling**: Multi-layer (session, API, form validation)
- **UX**: Modals for success/confirmation, overlays for loading states
- **Responsive**: Mobile-first CSS with Tailwind breakpoints
