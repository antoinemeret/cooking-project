# Product Requirements Document: URL Import Technology Comparison

## Introduction/Overview

This feature will create a side-by-side comparison system to evaluate different technologies for importing recipes from URLs. The current Ollama-based LLM solution has performance and quality issues (slow processing, prompt compliance problems, and inaccurate content extraction). This comparison feature will test the current solution against a more traditional approach using structured data parsing and specialized scraping libraries to determine the optimal technology for recipe URL imports.

**Problem Statement:** The current URL import functionality is too slow, often fails to extract recipe data accurately, and doesn't respect structured prompts, leading to poor user experience and requiring manual editing.

**Goal:** Implement a temporary comparison system to objectively evaluate different URL import technologies and select the best performing solution for production use.

## Goals

1. **Performance Evaluation:** Compare processing speed between current Ollama solution and traditional parsing approaches
2. **Quality Assessment:** Measure accuracy of recipe data extraction (title, ingredients, instructions) from both technologies
3. **Decision Support:** Provide objective data to choose the optimal URL import technology
4. **Future Flexibility:** Build a reusable comparison framework for testing additional solutions later

## User Stories

1. **As a developer/product owner**, I want to test the same recipe URL with both technologies simultaneously so that I can compare their performance and accuracy objectively.

2. **As a developer/product owner**, I want to see side-by-side structured recipe data outputs so that I can evaluate accuracy by selecting success or failure for both titles, ingredient lists and instruction lists.

3. **As a developer/product owner**, I want to track success/failure rates for both technologies so that I can make data-driven decisions about which solution to implement.

4. **As a developer/product owner**, I want to manually test different URLs so that I can evaluate performance across various recipe websites.

## Functional Requirements

### Core Comparison Functionality
1. The system must process the same URL simultaneously with both the current Ollama solution and the new traditional parsing approach.
2. The system must display structured recipe data (title, ingredients, instructions) side-by-side for both technologies.
3. The system must provide buttons to act success or failure for each recipe data sets.
4. The system must be integrated into the existing recipe import flow as a manual toggle/comparison mode (saving the right data must be possible)
5. The system must track and display success/failure rates for both technologies.
6. The system must measure and display processing times for performance comparison.

### Traditional Parsing Implementation
7. The system must implement JSON-LD and microdata parsing for websites using schema.org Recipe markup.
8. The system must implement intelligent HTML parsing using specialized libraries for sites without structured data.
9. The system must use appropriate parsing libraries (Python: recipe-scrapers, or Node.js: Cheerio + custom rules).
10. The system must create a new backend endpoint or modify existing scrape functionality to support both technologies.

### User Interface
11. The comparison interface must be accessible only to developers/product owners (admin-only feature).
12. The system must provide a manual trigger to enable comparison mode for specific URL tests.
13. The system must display clear actions to let the user declare success/failure for each technology.
14. The system must display clear visual indicators for success/failure status of each technology.
15. The system must show processing time metrics for each approach.

### Data Collection
16. The system must log success/failure rates for analysis.
17. The system must capture and store comparison results for later review.
18. The system must provide a way to manually evaluate and score the quality of extracted data.

## Non-Goals (Out of Scope)

1. **Automated Quality Scoring:** The system will not include automated quality assessment algorithms (manual evaluation only).
2. **Batch Testing:** No automated batch processing of multiple URLs simultaneously.
3. **Scheduled Comparisons:** No automated/scheduled comparison runs.
4. **End User Access:** Regular app users will not have access to this comparison feature.
5. **Cost Tracking Integration:** No automated cost calculation or billing integration.
6. **Claude API Integration:** This iteration focuses on traditional parsing vs. current Ollama solution (Claude API testing is deferred).
7. **Permanent UI Changes:** No permanent modifications to the main user interface.

## Design Considerations

- **Integration Point:** Add comparison toggle to existing recipe import interface
- **Visual Layout:** Side-by-side comparison view with clear technology labels
- **Status Indicators:** Use color-coded success/failure indicators (green/red)
- **Performance Metrics:** Display processing time prominently for each technology
- **Admin Access:** Implement behind admin authentication or feature flag
- **Responsive Design:** Ensure comparison interface works on both desktop and mobile

## Technical Considerations

### Backend Implementation
- **New Endpoint:** Create `/api/recipes/import-comparison` endpoint or extend existing `/api/scrape`
- **Parallel Processing:** Implement concurrent execution of both technologies for fair comparison
- **Error Handling:** Robust error handling to capture failure modes of each technology
- **Logging:** Comprehensive logging for success/failure analysis

### Traditional Parsing Technology Stack
- **Structured Data:** Implement JSON-LD and microdata parsing using appropriate libraries
- **HTML Parsing:** Use recipe-scrapers (Python) or Cheerio + custom rules (Node.js)
- **Fallback Logic:** Implement graceful fallbacks when structured data is unavailable

### Data Storage
- **Comparison Results:** Store comparison data for analysis (temporary tables/collections)
- **Performance Metrics:** Track processing times and success rates
- **URL Test Cases:** Maintain a collection of test URLs for consistent evaluation

## Success Metrics

1. **Accuracy Improvement:** New traditional parsing approach achieves >80% accurate extraction of title, ingredients, and instructions
2. **Performance Gain:** New approach processes URLs in <5 seconds (vs. current slow Ollama performance)
3. **Success Rate:** New approach achieves >90% success rate across tested recipe websites
4. **Decision Timeline:** Technology comparison completed and decision made within 2 weeks
5. **Implementation Efficiency:** Winning technology integrated and inferior solution removed within 1 week of decision

## Open Questions

1. **Technology Choice:** Should we implement the traditional parsing approach in Python (using recipe-scrapers) or Node.js (using Cheerio) to match the existing tech stack?
2. **Test URL Collection:** What set of representative recipe websites should we use for comprehensive testing?
3. **Quality Evaluation:** What specific criteria should we use to manually score the quality of extracted recipe data?
4. **Comparison Duration:** How long should we run comparisons before making a final decision?
5. **Rollback Strategy:** What's the plan if both solutions prove inadequate and we need to explore additional alternatives?
6. **Performance Baseline:** What are the current exact performance metrics (processing time, success rate) of the Ollama solution for baseline comparison?

---

**Next Steps:**
1. Implement traditional parsing backend endpoint
2. Create comparison UI interface
3. Define test URL dataset
4. Begin parallel testing and data collection
5. Analyze results and make technology decision
6. Remove inferior solution and clean up codebase 