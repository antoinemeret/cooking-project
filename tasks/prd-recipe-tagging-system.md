# Product Requirements Document: Recipe Tagging System

## Introduction/Overview

The recipe tagging system enhances recipe discoverability and organization by allowing users to add, edit, and filter recipes using descriptive tags. This feature addresses the need for better recipe categorization and improves the assistant's ability to provide relevant recipe suggestions based on user preferences and dietary requirements.

**Problem Statement:** Users currently have limited ways to categorize and filter recipes, making it difficult to find specific types of recipes (e.g., vegetarian, quick & easy, Italian cuisine) and reducing the assistant's effectiveness in providing targeted suggestions.

**Goal:** Implement a comprehensive tagging system that allows both manual tag management and LLM-assisted auto-tagging during recipe import, improving recipe discoverability and user experience.

## Goals

1. **Enable Manual Tag Management:** Allow users to add, edit, and remove tags across all recipe interaction points (creation, editing, viewing)
2. **Implement LLM Auto-Tagging:** Automatically suggest relevant tags when importing recipes, with user review and approval
3. **Improve Recipe Discoverability:** Make tags visible and actionable across the application (cards, lists, assistant responses)
4. **Enhance User Experience:** Provide intuitive tag input with suggestions and validation to prevent duplicates
5. **Support Assistant Intelligence:** Enable the assistant to use tags for better recipe filtering and suggestions

## User Stories

**As a user importing a recipe from a URL/video:**
- I want the system to automatically suggest relevant tags based on the recipe content
- I want to review and modify these suggested tags (remove, add new) before saving the recipe
- So that my recipes are properly categorized without manual effort

**As a user manually creating a recipe:**
- I want to add tags during the recipe creation process
- I want to see my most frequently used tags as suggestions
- So that I can quickly categorize my new recipe

**As a user editing an existing recipe:**
- I want to see all current tags and be able to remove unwanted ones
- I want to add new tags with intelligent suggestions
- So that I can keep my recipe tags up-to-date and accurate

**As a user viewing a recipe:**
- I want to see the recipe's tags displayed clearly
- I want to be able to modify tags directly from the view
- So that I can quickly update categorization when needed

**As a user browsing recipes:**
- I want to click on tags to filter recipes by that category
- I want to see tags in assistant suggestions and planner cards (already existing)
- So that I can quickly find similar recipes

## Functional Requirements

### Phase 1: Manual Tag Management

**Tag Input Interface:**
1. The system must provide a tag input component that shows the user's most frequently used tags in a dropdown
2. The dropdown must update dynamically as the user types, filtering suggestions based on input
3. The system must suggest similar existing tags when user input closely matches existing tags
4. The system must allow users to create new tags if their input doesn't match existing suggestions
5. The tag input must support adding multiple tags in a single session

**Recipe Creation:**
6. The manual recipe creation form must include a tag input field
7. Users must be able to add tags during the recipe creation process
8. The system must save tags when the recipe is successfully created

**Recipe Viewing (Sheet Component):**
9. The recipe detail sheet must display all tags associated with the recipe
10. Users must be able to add new tags directly from the recipe view
11. Users must be able to remove tags directly from the recipe view
12. Tag changes must be saved immediately upon modification

### Phase 2: LLM Auto-Tagging

**Recipe Import Auto-Tagging:**
13. The system must analyze imported recipes using LLM to suggest relevant tags
14. Suggested tags must be presented to the user in the edit dialog before saving
15. Users must be able to review : approve, reject, or modify suggested tags
16. The system must not save tags without user review and approval

**LLM Tag Suggestions:**
17. The LLM must analyze recipe content including title, ingredients, instructions, and metadata
18. The system must suggest tags from existing tags and categories: cuisine type, dietary restrictions, meal type, difficulty, cooking method, and ingredients
19. The system must limit LLM suggestions to a reasonable number (5-10 tags) to avoid overwhelming users

### Cross-Phase Requirements

**Tag Display and Interaction:**
20. Recipe cards in assistant suggestions must display tags (already implemented)
21. Recipe cards in planner must display tags (already implemented)
22. Tags on recipe cards must be clickable and filter the recipe list
23. The recipe list page must support filtering by tags
24. The assistant chat must consider tags when providing recipe suggestions

**Tag Validation and Management:**
25. The system must prevent duplicate tags (case-insensitive)
26. The system must limit recipes to a maximum of 100 tags
27. The system must normalize tag formatting (lowercase, consistent spacing)
28. The system must track tag usage frequency per user for suggestion ordering

## Non-Goals (Out of Scope)

1. **Offensive Content Management:** The system will not include automated filtering of inappropriate or offensive tags
2. **Internationalization:** Multi-language tag support is not included in this scope
3. **Tag Categories/Hierarchies:** Advanced tag organization features are not included
4. **Global Tag Administration:** System-wide tag management or admin controls are not included
5. **Tag Analytics:** Detailed analytics on tag usage patterns are not included
6. **Bulk Tag Operations:** Mass tag editing across multiple recipes is not included
7. **Tag Synonyms:** Automatic tag merging or synonym handling is not included

## Design Considerations

**UI/UX Requirements:**
- Follow the existing design system and component patterns
- Use Notion-style tag input as inspiration for the dropdown and suggestion interface
- Ensure tag input is accessible and keyboard-friendly
- Display tags consistently across all components (cards, dialogs, sheets)
- Implement smooth transitions and loading states for LLM suggestions

**Component Integration:**
- Integrate with existing recipe detail sheet component
- Integrate with existing edit dialog after import
- Integrate with existing recipe creation form
- Ensure consistent styling with current recipe cards

## Technical Considerations

**Dependencies:**
- Integrate with existing LLM client for auto-tagging analysis
- Utilize existing Prisma schema (tags field already exists on Recipe model)
- Integrate with existing recipe import pipeline
- Work with existing UI components (dialog, sheet, input components)

**Performance:**
- Implement efficient tag suggestion queries with proper indexing
- Cache frequently used tags to reduce database queries
- Optimize LLM calls to avoid delays in recipe import process

**Data Storage:**
- Leverage existing Recipe.tags field in Prisma schema
- Consider adding user-specific tag frequency tracking
- Ensure tag data is properly indexed for filtering queries

## Success Metrics

Success metrics are not defined for this initial implementation. Future iterations may include:
- Recipe discovery improvement metrics
- User engagement with tagging features
- Assistant response relevance improvements

## Open Questions

1. **LLM Model Selection:** Which LLM model should be used for recipe analysis and tag suggestion? Let's perform a backend test to compare llama vs mistral vs deepseek during immplementation
2. **Tag Suggestion Context:** Should the LLM consider user's existing tags when suggesting new ones? yes
3. **Performance Thresholds:** What are the acceptable response times for LLM tag suggestions? 10 sec
4. **User Preferences:** Should users be able to disable auto-tagging suggestions? not for now
5. **Tag Migration:** How should existing recipes without tags be handled during rollout? back fill them

## Implementation Notes

**Phase 1 Priority:** Focus on manual tag management features first to establish the core functionality and user experience patterns.

**Phase 2 Integration:** LLM auto-tagging should integrate seamlessly with the manual tagging interface established in Phase 1.

**Testing Requirements:** Ensure comprehensive testing of tag input validation, suggestion algorithms, and cross-component integration. 