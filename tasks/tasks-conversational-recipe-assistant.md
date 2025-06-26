# Task Breakdown: Conversational Recipe Planning Assistant

## Overview
Implementation of AI-powered conversational meal planning assistant with Claude Sonnet 4 and LangChain, featuring recipe suggestions from user's collection, accept/decline workflow, and integrated planner/grocery list pages.

## Phase 1: MVP Implementation (8-10 weeks)

### 🏗️ **Task 1: Database Schema & Backend Setup** (Week 1-2)
**Priority: Critical** | **Dependencies: None**

#### 1.1 Database Schema Extensions
- [x] Create MealPlan table (id, userId, createdAt, status)
- [x] Create PlannedRecipe table (id, mealPlanId, recipeId, completed, addedAt)
- [x] Create GroceryList table (id, mealPlanId, ingredients JSON, checkedItems JSON)
- [x] Run database migrations and update Prisma schema

#### 1.2 Backend Dependencies
- [ ] Install LangChain dependencies (`langchain`, `@langchain/anthropic`)
- [ ] Add environment variables for Claude API key
- [ ] Create utility functions for recipe filtering by seasonality (using existing startSeason/endSeason fields)
- [ ] Set up rate limiting configuration for AI API calls

#### 1.3 Recipe Data Preparation
- [ ] Add tags field to Recipe model for flexible categorization (vegetarian, dairy free, salad, etc.)
- [ ] Backfill existing recipes with relevant tags if missing

### 🤖 **Task 2: AI Conversation Engine** (Week 2-3)
**Priority: Critical** | **Dependencies: Task 1.2**

#### 2.1 LangChain Setup
- [ ] Configure Claude Sonnet 4 API integration
- [ ] Create conversation chain with meal planning context
- [ ] Design system prompts for recipe recommendation scenarios
- [ ] Implement conversation memory management within sessions

#### 2.2 Recipe Filtering Logic
- [ ] Create filtering functions based on tags (vegetarian, dairy free, etc.)
- [ ] Implement seasonality-based filtering using current date and existing startSeason/endSeason fields
- [ ] Add ingredient-based filtering (required/excluded ingredients)

#### 2.3 API Endpoint
- [ ] Create `/api/assistant/chat` endpoint for conversation
- [ ] Implement streaming responses for real-time chat experience
- [ ] Add error handling for AI API failures
- [ ] Create session management for conversation state

### 🎨 **Task 3: Chat Interface** (Week 3-4)
**Priority: Critical** | **Dependencies: Task 2**

#### 3.1 Chat UI Components
- [ ] Create `ChatInterface` component with message history
- [ ] Build `MessageBubble` component (user vs assistant styling)
- [ ] Implement `ChatInput` with send button and loading states
- [ ] Add typing indicator during AI processing

#### 3.2 Recipe Card Components
- [ ] Design `RecipeCard` component for chat interface
- [ ] Add Accept/Skip buttons with clear visual distinction
- [ ] Implement recipe preview with title, brief description, and tags
- [ ] Create loading states for recipe suggestions

#### 3.3 Chat Page Implementation
- [ ] Create `/assistant` page with full chat interface
- [ ] Implement real-time message updates
- [ ] Add conversation reset functionality
- [ ] Handle empty states and conversation starters

### 📋 **Task 4: Navigation & Layout** (Week 4-5)
**Priority: High** | **Dependencies: Task 3**

#### 4.1 Bottom Navigation
- [ ] Update layout to include four-tab bottom navigation
- [ ] Add 🤌 Recipes, 💬 Assistant, 📋 Planner, 🛒 Groceries tabs
- [ ] Implement active state styling and navigation logic
- [ ] Ensure mobile-optimized touch targets (44px minimum)

#### 4.2 Layout Optimization
- [ ] Make layout mobile-first responsive
- [ ] Optimize for tablet screens (kitchen counter use)
- [ ] Implement proper safe area handling for mobile devices
- [ ] Add pull-to-refresh functionality where appropriate

#### 4.3 Accessibility Improvements
- [ ] Add proper ARIA labels for navigation
- [ ] Implement high-contrast color scheme
- [ ] Ensure keyboard navigation support
- [ ] Add screen reader support for chat interface

### 📅 **Task 5: Planner Page** (Week 5-6)
**Priority: High** | **Dependencies: Task 2, Task 4**

#### 5.1 Planner Interface
- [ ] Create `/planner` page with meal plan overview
- [ ] Display accepted recipes in organized list format
- [ ] Add checkboxes for marking meals as completed
- [ ] Implement recipe removal from current plan

#### 5.2 Meal Plan State Management
- [ ] Create API endpoints for meal plan CRUD operations
- [ ] Implement optimistic updates for checkbox interactions
- [ ] Add persistence for completed meal status
- [ ] Handle empty states when no meals are planned

#### 5.3 Recipe Integration
- [ ] Enable tapping recipes to view full details using existing sheet behavior
- [ ] Reuse current Recipes page sheet opener functionality
- [ ] Add serving information display
- [ ] Implement quick actions (mark complete, remove from plan)

### 🛒 **Task 6: Grocery List Page** (Week 6-7)
**Priority: High** | **Dependencies: Task 5**

#### 6.1 Grocery List Generation
- [ ] Create algorithm to aggregate ingredients from planned recipes
- [ ] Implement duplicate ingredient detection and quantity merging
- [ ] Handle unit conversion and standardization

#### 6.2 Grocery Interface
- [ ] Create `/groceries` page with simple ingredient list
- [ ] Add checkboxes for marking items as purchased
- [ ] Add total item count and completion progress

#### 6.3 Shopping Experience
- [ ] Add search functionality for finding specific ingredients
- [ ] Implement persistence for checked items
- [ ] Create clear visual distinction for completed items

### 🔄 **Task 7: Session & State Management** (Week 7-8)
**Priority: High** | **Dependencies: Tasks 2-6**

#### 7.1 Conversation State
- [ ] Implement session persistence during active conversation
- [ ] Add ability to resume interrupted conversations
- [ ] Create session timeout and cleanup logic
- [ ] Handle browser refresh and navigation scenarios

#### 7.2 Accept/Decline Workflow
- [ ] Track accepted and declined recipes within session
- [ ] Implement undo functionality for accidental actions
- [ ] Add session summary before finalizing meal plan
- [ ] Create confirmation flow for plan completion

#### 7.3 Data Synchronization
- [ ] Ensure real-time updates across planner and grocery pages
- [ ] Implement optimistic UI updates with error rollback
- [ ] Add offline support for viewing existing plans
- [ ] Handle concurrent user sessions gracefully

### 🚨 **Task 8: Error Handling & Edge Cases** (Week 8-9)
**Priority: Medium** | **Dependencies: All previous tasks**

#### 8.1 AI Service Error Handling
- [ ] Implement graceful fallbacks for Claude API failures
- [ ] Add retry logic with exponential backoff
- [ ] Create user-friendly error messages for service outages
- [ ] Add manual conversation reset options

#### 8.2 Data Validation & Edge Cases
- [ ] Handle users with very small recipe collections
- [ ] Implement suggestions for building recipe collection
- [ ] Add validation for malformed user inputs
- [ ] Handle scenarios with no matching recipes

#### 8.3 Network & Performance
- [ ] Add offline indicators and error states
- [ ] Implement request timeout handling
- [ ] Create loading states for all async operations
- [ ] Add performance monitoring for slow responses

### 🧪 **Task 9: Testing & Polish** (Week 9-10)
**Priority: Medium** | **Dependencies: All previous tasks**

#### 9.1 User Testing
- [ ] Create global test scenarios for the entire feature
- [ ] Test conversation flows with various dietary restrictions
- [ ] Validate mobile and tablet user experience

#### 9.2 Performance Optimization
- [ ] Optimize chat interface for smooth scrolling
- [ ] Implement lazy loading for message history
- [ ] Add caching for frequently accessed recipes
- [ ] Optimize API response times and database queries

#### 9.3 Final Polish
- [ ] Refine visual design and animations
- [ ] Add helpful onboarding tips and conversation starters
- [ ] Implement analytics tracking for success metrics
- [ ] Create comprehensive error logging and monitoring

## Key Technical Decisions

### AI Integration Approach
- **Service**: Claude Sonnet 4 via Anthropic API
- **Framework**: LangChain for conversation management
- **Streaming**: Real-time response streaming for better UX
- **Context**: Session-based conversation memory (no persistent history in V1)

### Database Strategy
- **Extension**: Extend existing Recipe schema rather than separate tables
- **Meal Plans**: Separate tables for meal planning state
- **Grocery Lists**: JSON storage for flexibility with ingredient aggregation
- **Performance**: Indexed queries for filtering recipes by dietary restrictions and seasonality

### Mobile-First Design
- **Navigation**: Four-tab bottom navigation for thumb-friendly access (🤌 Recipes, 💬 Assistant, 📋 Planner, 🛒 Groceries)
- **Touch Targets**: Minimum 44px for all interactive elements
- **Responsive**: Mobile-first with tablet adaptations
- **Offline**: Basic offline support for viewing existing plans

## Success Criteria for MVP

### Functional Requirements Met
- [ ] Users can describe meal planning needs in natural language
- [ ] System suggests recipes from user's existing collection
- [ ] Accept/decline workflow functions smoothly
- [ ] Planner page shows accepted recipes with completion tracking
- [ ] Grocery list aggregates ingredients from planned meals
- [ ] Mobile-responsive interface works on phones and tablets

### Performance Benchmarks
- [ ] Chat responses appear within 3 seconds
- [ ] Recipe filtering completes in under 1 second
- [ ] Page load times under 2 seconds on mobile
- [ ] 95% uptime for conversation functionality

### User Experience Goals
- [ ] 70% of users complete their first planning session
- [ ] Average of 3-5 recipes accepted per session
- [ ] Users report reduced time spent on meal planning
- [ ] Interface feels intuitive and conversational

## Future Enhancements (Post-MVP)

### Phase 2 Features
- Voice input integration
- Advanced filtering options
- Improved recipe matching algorithms
- Enhanced grocery list organization
- Persistent conversation history

### Phase 3 Features
- Collaborative planning features
- Calendar integration
- Nutrition information display
- Advanced meal planning analytics
- Recipe recommendation improvements

## Risk Mitigation

### Technical Risks
- **AI API Costs**: Implement usage monitoring and rate limiting
- **Response Quality**: Design comprehensive prompts and fallback responses
- **Performance**: Implement caching and optimize database queries
- **Mobile UX**: Extensive testing on various devices and screen sizes

### Product Risks
- **Small Recipe Collections**: Provide guidance and suggestions for building collections
- **User Adoption**: Design intuitive onboarding and clear value proposition
- **Conversation Quality**: Iterate on prompts based on user feedback
- **Feature Complexity**: Start simple and add complexity gradually 