# URL Import Technology Comparison - Evaluation Guidelines

This document provides comprehensive guidelines for evaluating and testing the URL import comparison system between Ollama LLM and Traditional parsing approaches.

## Table of Contents

1. [Overview](#overview)
2. [Test Setup](#test-setup)
3. [Evaluation Procedures](#evaluation-procedures)
4. [Quality Assessment Criteria](#quality-assessment-criteria)
5. [Test Datasets](#test-datasets)
6. [Performance Benchmarking](#performance-benchmarking)
7. [Decision-Making Framework](#decision-making-framework)
8. [Common Issues and Troubleshooting](#common-issues-and-troubleshooting)

## Overview

The comparison system evaluates two technologies for extracting recipe data from web URLs:

- **Ollama LLM**: AI-powered approach using the deepseek-r1:latest model
- **Traditional Parsing**: Rule-based approach using JSON-LD, microdata, and HTML parsing

### Evaluation Goals

1. **Accuracy**: How correctly does each technology extract recipe information?
2. **Performance**: How fast is each technology?
3. **Reliability**: How consistently does each technology work across different websites?
4. **Usability**: How usable are the extracted recipes for cooking?

## Test Setup

### Prerequisites

1. **Development Environment**
   ```bash
   npm install
   npm run dev
   ```

2. **Ollama Service**
   ```bash
   # Install Ollama
   curl https://ollama.ai/install.sh | sh
   
   # Pull the required model
   ollama pull deepseek-r1:latest
   
   # Verify service is running
   curl http://localhost:11434/api/tags
   ```

3. **Database Setup**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

4. **Admin Access**
   - Navigate to `/admin/import-comparison`
   - Use admin key: `admin123` (for development)

### Environment Configuration

Create `.env.local` with:
```
LLM_PROVIDER=ollama
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_ADMIN_KEY=admin123
```

## Evaluation Procedures

### 1. Systematic Testing Workflow

#### Step 1: Select Test URLs
Choose URLs from the predefined test datasets or add new ones:

- **Quick Validation** (4 URLs): For rapid testing during development
- **Basic Evaluation** (8 URLs): Core set for initial comparison
- **Structured Data Focus** (10+ URLs): Sites with confirmed JSON-LD/microdata
- **Challenging Sites** (8+ URLs): Difficult parsing scenarios
- **Comprehensive** (13 URLs): Complete evaluation suite

#### Step 2: Run Comparisons
1. Access the admin interface at `/admin/import-comparison`
2. Enter the recipe URL
3. Click "Compare" to run both technologies in parallel
4. Wait for results (typically 10-30 seconds)

#### Step 3: Evaluate Results
For each technology, assess:

1. **Title Accuracy**
   - ✅ **Accurate**: Exact or very close match to original title
   - ⚠️ **Partial**: Minor differences but recognizable
   - ❌ **Inaccurate**: Wrong, missing, or completely different

2. **Ingredients Accuracy**
   - ✅ **Accurate**: All ingredients with proper quantities
   - ⚠️ **Partial**: Most ingredients present, minor formatting issues
   - ❌ **Inaccurate**: Major ingredients missing or wrong

3. **Instructions Accuracy**
   - ✅ **Accurate**: Complete cooking process captured
   - ⚠️ **Partial**: Most steps present, minor gaps
   - ❌ **Inaccurate**: Major steps missing or incomprehensible

4. **Overall Success**
   - ✅ **Success**: Recipe is usable for cooking
   - ⚠️ **Partial**: Mostly usable but needs some interpretation
   - ❌ **Failed**: Recipe is not usable

#### Step 4: Document Results
Record evaluation using the API or manual tracking:

```typescript
// Example evaluation submission
const evaluation = {
  comparisonId: "abc123",
  technology: "ollama",
  evaluation: {
    titleAccurate: true,
    ingredientsAccurate: false,
    instructionsAccurate: true,
    overallSuccess: false,
    evaluatorNotes: "Missing ingredient quantities"
  }
}
```

### 2. Batch Testing Process

For systematic evaluation of multiple URLs:

1. **Prepare Test Session**
   - Select target dataset (e.g., "basic-evaluation")
   - Set up evaluation spreadsheet or use API
   - Ensure Ollama service is running

2. **Execute Batch Tests**
   ```typescript
   // Automated batch testing (when implemented)
   const results = await runBatchComparison([
     'https://example.com/recipe1',
     'https://example.com/recipe2',
     // ... more URLs
   ])
   ```

3. **Systematic Evaluation**
   - Process URLs in consistent order
   - Take breaks between evaluations to maintain accuracy
   - Document any technical issues encountered

4. **Results Analysis**
   - Export data for analysis: `/api/recipes/import-comparison/export`
   - Calculate success rates per technology
   - Identify patterns in failures

## Quality Assessment Criteria

### Scoring Guidelines

#### Title Extraction (Weight: 25%)

**✅ Accurate (Score: 1.0)**
- Exact match or minor formatting differences
- Acceptable variations: "Best Cookies" vs "The Best Cookies"
- Case differences are acceptable

**⚠️ Partial (Score: 0.5)**
- Missing descriptors: "Cookies" vs "Chocolate Chip Cookies"
- Extra words: "Easy Chocolate Chip Cookies Recipe"
- Minor spelling errors

**❌ Inaccurate (Score: 0.0)**
- Wrong recipe entirely
- Generic titles like "Recipe" or "Delicious Food"
- Website name instead of recipe title
- No title extracted

#### Ingredients Extraction (Weight: 40%)

**✅ Accurate (Score: 1.0)**
- All ingredients with proper quantities
- Minor formatting acceptable: "2 cups flour" vs "2 c. flour"
- Complete ingredient list captured

**⚠️ Partial (Score: 0.5)**
- 80-90% of ingredients present
- Missing quantities but ingredients correct
- Minor formatting issues affecting readability

**❌ Inaccurate (Score: 0.0)**
- Less than 80% of ingredients captured
- Wrong ingredients from different recipe
- No ingredients extracted
- Contains non-food items

#### Instructions Extraction (Weight: 25%)

**✅ Accurate (Score: 1.0)**
- Complete step-by-step process
- All cooking times and temperatures included
- Proper sequence maintained

**⚠️ Partial (Score: 0.5)**
- Most steps present but some minor gaps
- Formatting issues but content readable
- Steps combined or separated differently

**❌ Inaccurate (Score: 0.0)**
- Major steps missing (50%+ of process)
- Wrong instructions from different recipe
- Unintelligible or mangled text

#### Overall Usability (Weight: 10%)

**✅ Success (Score: 1.0)**
- Recipe is fully usable for cooking
- Someone could successfully make this dish
- Minor formatting issues don't affect usability

**⚠️ Partial (Score: 0.5)**
- Recipe mostly usable with some guesswork
- Core information present but some gaps

**❌ Failed (Score: 0.0)**
- Recipe not usable for cooking
- Too much essential information missing
- Would likely result in cooking failure

### Confidence Levels

- **High**: Clear assessment, obvious success or failure
- **Medium**: Some uncertainty, subjective judgment required
- **Low**: Difficult to assess, domain knowledge needed

## Test Datasets

### Pre-defined Test Sets

1. **Quick Validation Set** (4 URLs)
   - Easy sites with good structured data
   - For rapid testing during development
   - Expected success rate: 90%+

2. **Basic Evaluation Set** (8 URLs)
   - Representative mix of website types
   - Core comparison testing
   - Balanced difficulty levels

3. **Structured Data Focus** (10+ URLs)
   - Sites with confirmed JSON-LD/microdata
   - Tests structured data parsing capabilities
   - Should favor traditional parsing

4. **Challenging Sites** (8+ URLs)
   - Non-English sites
   - Complex layouts
   - Minimal structured data
   - Tests fallback capabilities

5. **Comprehensive Suite** (13 URLs)
   - Complete test coverage
   - All website types and scenarios
   - For final evaluation

### Adding New Test URLs

When adding URLs to test datasets:

1. **Verify URL Accessibility**
   ```bash
   curl -I https://example.com/recipe
   ```

2. **Document Expected Results**
   ```typescript
   {
     url: 'https://example.com/new-recipe',
     expectedRecipe: {
       title: 'Expected Recipe Title',
       ingredients: ['ingredient 1', 'ingredient 2'],
       instructions: ['step 1', 'step 2']
     },
     websiteName: 'Example Site',
     difficulty: 'medium',
     hasStructuredData: true,
     notes: 'Special considerations for this URL'
   }
   ```

3. **Test Manually First**
   - Verify both technologies can process it
   - Document any specific issues
   - Note parsing method used by traditional parser

## Performance Benchmarking

### Metrics to Track

1. **Processing Time**
   - Average response time per technology
   - 95th percentile response times
   - Timeout rates

2. **Success Rates**
   - Overall success percentage
   - Success by website category
   - Success by structured data availability

3. **Quality Scores**
   - Average weighted quality scores
   - Score distribution by field (title, ingredients, instructions)
   - Consistency across different evaluators

### Performance Testing

1. **Individual URL Tests**
   ```bash
   # Test specific URL performance
   time curl -X POST http://localhost:3000/api/recipes/import-comparison \
     -H "Content-Type: application/json" \
     -d '{"url": "https://example.com/recipe"}'
   ```

2. **Batch Performance Testing**
   - Process multiple URLs sequentially
   - Monitor resource usage
   - Track error rates

3. **Concurrent Load Testing**
   - Test multiple simultaneous requests
   - Verify system stability
   - Measure performance degradation

## Decision-Making Framework

### Success Criteria

A technology is considered superior if it achieves:

1. **Accuracy Threshold**: >80% overall weighted score
2. **Performance Threshold**: <10 seconds average processing time
3. **Reliability Threshold**: <5% failure rate
4. **Usability Threshold**: >75% "usable for cooking" rating

### Evaluation Matrix

| Criterion | Weight | Ollama Target | Traditional Target |
|-----------|--------|---------------|-------------------|
| Title Accuracy | 25% | >85% | >90% |
| Ingredients Accuracy | 40% | >75% | >85% |
| Instructions Accuracy | 25% | >70% | >80% |
| Processing Speed | 10% | <15s | <5s |

### Decision Tree

1. **If both technologies meet all thresholds:**
   - Choose faster technology
   - Consider maintenance complexity
   - Factor in future scalability

2. **If only one technology meets thresholds:**
   - Choose the qualifying technology
   - Document specific advantages

3. **If neither technology meets thresholds:**
   - Identify primary failure points
   - Consider hybrid approach
   - Postpone decision pending improvements

### Technology Recommendations

#### Choose Ollama If:
- Superior accuracy on complex sites
- Better handling of non-standard layouts
- Acceptable performance for use case
- Flexibility needed for new site types

#### Choose Traditional Parsing If:
- Faster processing required
- Consistent structured data available
- Predictable parsing behavior needed
- Lower resource usage preferred

## Common Issues and Troubleshooting

### Ollama-Specific Issues

1. **Service Unavailable**
   ```bash
   # Check if Ollama is running
   curl http://localhost:11434/api/tags
   
   # Restart if needed
   ollama serve
   ```

2. **Model Not Found**
   ```bash
   # Pull required model
   ollama pull deepseek-r1:latest
   ```

3. **Timeout Issues**
   - Increase timeout in API configuration
   - Check model performance on hardware
   - Consider using smaller/faster model

### Traditional Parsing Issues

1. **No Structured Data Found**
   - Check HTML source for JSON-LD or microdata
   - Verify HTML parsing selectors
   - Review fallback logic

2. **Incorrect Data Extraction**
   - Inspect specific parsing method used
   - Check for HTML structure changes
   - Verify CSS selectors accuracy

### General Issues

1. **URL Access Problems**
   ```bash
   # Test URL accessibility
   curl -I "https://example.com/recipe"
   
   # Check for redirects or blocking
   curl -L -v "https://example.com/recipe"
   ```

2. **Database Issues**
   ```bash
   # Reset database if needed
   npx prisma migrate reset
   npx prisma migrate dev
   ```

3. **Performance Problems**
   - Monitor memory usage during tests
   - Check network connectivity
   - Verify adequate system resources

### Evaluation Quality Issues

1. **Inconsistent Scoring**
   - Re-read evaluation criteria
   - Take breaks between evaluations
   - Have multiple evaluators for critical URLs

2. **Subjective Assessments**
   - Focus on usability for cooking
   - Document reasoning in notes
   - Use confidence levels appropriately

3. **Edge Cases**
   - Document unusual scenarios
   - Consider creating special evaluation criteria
   - Flag for separate analysis

## Data Export and Analysis

### Exporting Results

```bash
# Export all comparison data as CSV
curl "http://localhost:3000/api/recipes/import-comparison/export?format=csv" \
  -o comparison_results.csv

# Export with filtering
curl "http://localhost:3000/api/recipes/import-comparison/export?format=json&status=evaluated&limit=100" \
  -o comparison_results.json

# Export aggregated statistics
curl -X POST "http://localhost:3000/api/recipes/import-comparison/export/stats" \
  -H "Content-Type: application/json" \
  -d '{"days": 30, "includeTrends": true}' \
  -o comparison_stats.json
```

### Analysis Tools

1. **Spreadsheet Analysis**
   - Import CSV data into Excel/Google Sheets
   - Create pivot tables for success rates
   - Generate charts for performance comparison

2. **Statistical Analysis**
   - Calculate confidence intervals
   - Perform significance testing
   - Analyze correlation between website types and success

3. **Dashboard Monitoring**
   ```bash
   # Get real-time dashboard data
   curl "http://localhost:3000/api/recipes/import-comparison/dashboard" \
     -o dashboard_data.json
   ```

## Cleanup and Maintenance

### Data Cleanup

```typescript
// Remove test data
import { cleanupTestUrls } from '@/lib/data-cleanup'

// Cleanup test URLs
await cleanupTestUrls(['localhost', 'example.com', 'test.'], true) // dry run

// Archive old comparisons
await archiveOldComparisons(60, false) // archive comparisons older than 60 days
```

### System Maintenance

1. **Regular Database Cleanup**
   - Archive old comparison results
   - Remove test data
   - Reset performance metrics if needed

2. **Model Updates**
   - Monitor for Ollama model updates
   - Test new models with existing dataset
   - Update configuration as needed

3. **Performance Monitoring**
   - Track system resource usage
   - Monitor API response times
   - Review error logs regularly

---

## Quick Reference

### Essential Commands

```bash
# Start development server
npm run dev

# Run comparison test
curl -X POST http://localhost:3000/api/recipes/import-comparison \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/recipe"}'

# Submit evaluation
curl -X POST http://localhost:3000/api/recipes/import-comparison/evaluate \
  -H "Content-Type: application/json" \
  -d '{"comparisonId": "abc123", "technology": "ollama", "evaluation": {...}}'

# Export results
curl "http://localhost:3000/api/recipes/import-comparison/export?format=csv"
```

### Key Evaluation Questions

1. Would someone be able to cook this recipe successfully?
2. Are all essential ingredients and quantities present?
3. Are the cooking steps clear and complete?
4. Is the extracted information accurate to the original?

### Success Thresholds

- **Minimum Acceptable**: 70% overall weighted score
- **Good Performance**: 80% overall weighted score  
- **Excellent Performance**: 90% overall weighted score
- **Processing Time Target**: <10 seconds average
- **Reliability Target**: >95% success rate 