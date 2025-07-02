/**
 * Decision-Making Framework for URL Import Technology Comparison
 * 
 * This module implements the decision logic based on success metrics from the PRD
 * to objectively determine which technology (Ollama vs Traditional) should be selected.
 */

export interface TechnologyMetrics {
  technology: 'ollama' | 'traditional'
  accuracy: {
    titleSuccessRate: number
    ingredientsSuccessRate: number
    instructionsSuccessRate: number
    overallSuccessRate: number
  }
  performance: {
    averageProcessingTime: number
    medianProcessingTime: number
    p95ProcessingTime: number
    timeoutRate: number
  }
  reliability: {
    uptime: number
    errorRate: number
    consistencyScore: number
  }
  usability: {
    cookingUsabilityRate: number
    completeRecipeRate: number
    userSatisfactionScore: number
  }
}

export interface DecisionCriteria {
  // Weights for each category (must sum to 1.0)
  weights: {
    accuracy: number
    performance: number
    reliability: number
    usability: number
    maintenance: number
  }
  
  // Minimum thresholds that must be met
  thresholds: {
    minimumAccuracy: number        // Overall accuracy threshold (0.0-1.0)
    maximumProcessingTime: number  // In milliseconds
    minimumUptime: number          // Uptime percentage (0.0-1.0)
    minimumUsability: number       // Cooking usability rate (0.0-1.0)
  }
  
  // Scoring preferences
  preferences: {
    prioritizeSpeed: boolean       // True if speed is critical
    prioritizeAccuracy: boolean    // True if accuracy is critical
    riskTolerance: 'low' | 'medium' | 'high'
  }
}

export interface DecisionResult {
  selectedTechnology: 'ollama' | 'traditional' | 'hybrid' | 'neither'
  confidence: 'high' | 'medium' | 'low'
  overallScore: {
    ollama: number
    traditional: number
  }
  breakdown: {
    category: string
    ollamaScore: number
    traditionalScore: number
    weight: number
    winner: 'ollama' | 'traditional' | 'tie'
  }[]
  reasoning: string[]
  recommendations: string[]
  risks: string[]
}

/**
 * Default decision criteria based on PRD requirements
 */
export const DEFAULT_CRITERIA: DecisionCriteria = {
  weights: {
    accuracy: 0.40,     // 40% - Most important for recipe quality
    performance: 0.25,  // 25% - Important for user experience
    reliability: 0.20,  // 20% - Critical for production stability
    usability: 0.10,    // 10% - Important for end-user success
    maintenance: 0.05   // 5% - Long-term consideration
  },
  
  thresholds: {
    minimumAccuracy: 0.80,        // 80% minimum accuracy
    maximumProcessingTime: 15000, // 15 seconds maximum
    minimumUptime: 0.95,          // 95% uptime minimum
    minimumUsability: 0.75        // 75% cooking usability minimum
  },
  
  preferences: {
    prioritizeSpeed: false,       // Accuracy over speed by default
    prioritizeAccuracy: true,     // Quality over quantity
    riskTolerance: 'medium'       // Balanced approach
  }
}

/**
 * Alternative criteria for speed-focused scenarios
 */
export const SPEED_FOCUSED_CRITERIA: DecisionCriteria = {
  ...DEFAULT_CRITERIA,
  weights: {
    accuracy: 0.25,
    performance: 0.45,  // Increased weight for performance
    reliability: 0.20,
    usability: 0.05,
    maintenance: 0.05
  },
  thresholds: {
    ...DEFAULT_CRITERIA.thresholds,
    maximumProcessingTime: 5000  // 5 seconds maximum for speed focus
  },
  preferences: {
    prioritizeSpeed: true,
    prioritizeAccuracy: false,
    riskTolerance: 'low'
  }
}

/**
 * Alternative criteria for accuracy-focused scenarios
 */
export const ACCURACY_FOCUSED_CRITERIA: DecisionCriteria = {
  ...DEFAULT_CRITERIA,
  weights: {
    accuracy: 0.60,     // Increased weight for accuracy
    performance: 0.10,
    reliability: 0.20,
    usability: 0.05,
    maintenance: 0.05
  },
  thresholds: {
    ...DEFAULT_CRITERIA.thresholds,
    minimumAccuracy: 0.90,        // Higher accuracy requirement
    maximumProcessingTime: 30000  // More lenient on processing time
  },
  preferences: {
    prioritizeSpeed: false,
    prioritizeAccuracy: true,
    riskTolerance: 'high'
  }
}

/**
 * Main decision function that evaluates both technologies
 */
export function makeDecision(
  ollamaMetrics: TechnologyMetrics,
  traditionalMetrics: TechnologyMetrics,
  criteria: DecisionCriteria = DEFAULT_CRITERIA
): DecisionResult {
  // Step 1: Check if either technology meets minimum thresholds
  const ollamaMeetsThresholds = meetsThresholds(ollamaMetrics, criteria)
  const traditionalMeetsThresholds = meetsThresholds(traditionalMetrics, criteria)

  // Step 2: Calculate weighted scores for each category
  const breakdown = calculateCategoryScores(ollamaMetrics, traditionalMetrics, criteria)
  
  // Step 3: Calculate overall scores
  const overallScore = {
    ollama: breakdown.reduce((sum, cat) => sum + (cat.ollamaScore * cat.weight), 0),
    traditional: breakdown.reduce((sum, cat) => sum + (cat.traditionalScore * cat.weight), 0)
  }

  // Step 4: Make the decision based on thresholds and scores
  const decision = determineWinner(
    ollamaMeetsThresholds,
    traditionalMeetsThresholds,
    overallScore,
    criteria
  )

  // Step 5: Generate reasoning and recommendations
  const reasoning = generateReasoning(breakdown, ollamaMeetsThresholds, traditionalMeetsThresholds, criteria)
  const recommendations = generateRecommendations(decision.selectedTechnology, breakdown, criteria)
  const risks = identifyRisks(decision.selectedTechnology, ollamaMetrics, traditionalMetrics, criteria)

  return {
    selectedTechnology: decision.selectedTechnology,
    confidence: decision.confidence,
    overallScore,
    breakdown,
    reasoning,
    recommendations,
    risks
  }
}

/**
 * Check if a technology meets minimum thresholds
 */
function meetsThresholds(metrics: TechnologyMetrics, criteria: DecisionCriteria): boolean {
  return (
    metrics.accuracy.overallSuccessRate >= criteria.thresholds.minimumAccuracy &&
    metrics.performance.averageProcessingTime <= criteria.thresholds.maximumProcessingTime &&
    metrics.reliability.uptime >= criteria.thresholds.minimumUptime &&
    metrics.usability.cookingUsabilityRate >= criteria.thresholds.minimumUsability
  )
}

/**
 * Calculate scores for each category
 */
function calculateCategoryScores(
  ollamaMetrics: TechnologyMetrics,
  traditionalMetrics: TechnologyMetrics,
  criteria: DecisionCriteria
): DecisionResult['breakdown'] {
  return [
    {
      category: 'Accuracy',
      ollamaScore: calculateAccuracyScore(ollamaMetrics),
      traditionalScore: calculateAccuracyScore(traditionalMetrics),
      weight: criteria.weights.accuracy,
      winner: getWinner(
        calculateAccuracyScore(ollamaMetrics),
        calculateAccuracyScore(traditionalMetrics)
      )
    },
    {
      category: 'Performance',
      ollamaScore: calculatePerformanceScore(ollamaMetrics),
      traditionalScore: calculatePerformanceScore(traditionalMetrics),
      weight: criteria.weights.performance,
      winner: getWinner(
        calculatePerformanceScore(ollamaMetrics),
        calculatePerformanceScore(traditionalMetrics)
      )
    },
    {
      category: 'Reliability',
      ollamaScore: calculateReliabilityScore(ollamaMetrics),
      traditionalScore: calculateReliabilityScore(traditionalMetrics),
      weight: criteria.weights.reliability,
      winner: getWinner(
        calculateReliabilityScore(ollamaMetrics),
        calculateReliabilityScore(traditionalMetrics)
      )
    },
    {
      category: 'Usability',
      ollamaScore: calculateUsabilityScore(ollamaMetrics),
      traditionalScore: calculateUsabilityScore(traditionalMetrics),
      weight: criteria.weights.usability,
      winner: getWinner(
        calculateUsabilityScore(ollamaMetrics),
        calculateUsabilityScore(traditionalMetrics)
      )
    },
    {
      category: 'Maintenance',
      ollamaScore: calculateMaintenanceScore('ollama'),
      traditionalScore: calculateMaintenanceScore('traditional'),
      weight: criteria.weights.maintenance,
      winner: getWinner(
        calculateMaintenanceScore('ollama'),
        calculateMaintenanceScore('traditional')
      )
    }
  ]
}

/**
 * Calculate accuracy score (0-1) based on different success rates
 */
function calculateAccuracyScore(metrics: TechnologyMetrics): number {
  // Weighted average of different accuracy components
  return (
    metrics.accuracy.titleSuccessRate * 0.25 +
    metrics.accuracy.ingredientsSuccessRate * 0.40 +
    metrics.accuracy.instructionsSuccessRate * 0.25 +
    metrics.accuracy.overallSuccessRate * 0.10
  )
}

/**
 * Calculate performance score (0-1) with preference for faster processing
 */
function calculatePerformanceScore(metrics: TechnologyMetrics): number {
  // Normalize processing time (lower is better)
  const maxAcceptableTime = 30000 // 30 seconds
  const timeScore = Math.max(0, 1 - (metrics.performance.averageProcessingTime / maxAcceptableTime))
  
  // Timeout rate penalty (lower is better)
  const timeoutScore = Math.max(0, 1 - metrics.performance.timeoutRate)
  
  return (timeScore * 0.7) + (timeoutScore * 0.3)
}

/**
 * Calculate reliability score (0-1)
 */
function calculateReliabilityScore(metrics: TechnologyMetrics): number {
  return (
    metrics.reliability.uptime * 0.4 +
    (1 - metrics.reliability.errorRate) * 0.3 +
    metrics.reliability.consistencyScore * 0.3
  )
}

/**
 * Calculate usability score (0-1)
 */
function calculateUsabilityScore(metrics: TechnologyMetrics): number {
  return (
    metrics.usability.cookingUsabilityRate * 0.5 +
    metrics.usability.completeRecipeRate * 0.3 +
    metrics.usability.userSatisfactionScore * 0.2
  )
}

/**
 * Calculate maintenance score based on technology type
 */
function calculateMaintenanceScore(technology: 'ollama' | 'traditional'): number {
  // Subjective scoring based on maintenance complexity
  const maintenanceScores = {
    ollama: 0.6,      // More complex: model management, dependencies
    traditional: 0.8   // Simpler: rule-based, predictable updates
  }
  
  return maintenanceScores[technology]
}

/**
 * Determine winner between two scores
 */
function getWinner(score1: number, score2: number): 'ollama' | 'traditional' | 'tie' {
  const threshold = 0.05 // 5% threshold for tie
  
  if (Math.abs(score1 - score2) < threshold) {
    return 'tie'
  }
  
  return score1 > score2 ? 'ollama' : 'traditional'
}

/**
 * Determine the overall winner based on thresholds and scores
 */
function determineWinner(
  ollamaMeetsThresholds: boolean,
  traditionalMeetsThresholds: boolean,
  overallScore: { ollama: number; traditional: number },
  criteria: DecisionCriteria
): { selectedTechnology: DecisionResult['selectedTechnology']; confidence: DecisionResult['confidence'] } {
  // If neither meets thresholds
  if (!ollamaMeetsThresholds && !traditionalMeetsThresholds) {
    return { selectedTechnology: 'neither', confidence: 'high' }
  }
  
  // If only one meets thresholds
  if (ollamaMeetsThresholds && !traditionalMeetsThresholds) {
    return { selectedTechnology: 'ollama', confidence: 'high' }
  }
  
  if (!ollamaMeetsThresholds && traditionalMeetsThresholds) {
    return { selectedTechnology: 'traditional', confidence: 'high' }
  }
  
  // Both meet thresholds - compare scores
  const scoreDifference = Math.abs(overallScore.ollama - overallScore.traditional)
  
  // Consider hybrid if scores are very close
  if (scoreDifference < 0.1) { // Less than 10% difference
    return { selectedTechnology: 'hybrid', confidence: 'low' }
  }
  
  const winner = overallScore.ollama > overallScore.traditional ? 'ollama' : 'traditional'
  const confidence = scoreDifference > 0.2 ? 'high' : 'medium'
  
  return { selectedTechnology: winner, confidence }
}

/**
 * Generate reasoning for the decision
 */
function generateReasoning(
  breakdown: DecisionResult['breakdown'],
  ollamaMeetsThresholds: boolean,
  traditionalMeetsThresholds: boolean,
  criteria: DecisionCriteria
): string[] {
  const reasoning: string[] = []
  
  // Threshold analysis
  if (!ollamaMeetsThresholds && !traditionalMeetsThresholds) {
    reasoning.push('Neither technology meets the minimum thresholds for production use')
  } else if (!ollamaMeetsThresholds) {
    reasoning.push('Ollama does not meet minimum thresholds while Traditional parsing does')
  } else if (!traditionalMeetsThresholds) {
    reasoning.push('Traditional parsing does not meet minimum thresholds while Ollama does')
  } else {
    reasoning.push('Both technologies meet minimum production thresholds')
  }
  
  // Category winners
  breakdown.forEach(category => {
    if (category.winner !== 'tie') {
      const winner = category.winner === 'ollama' ? 'Ollama' : 'Traditional parsing'
      reasoning.push(
        `${winner} wins in ${category.category} (${(category.winner === 'ollama' ? category.ollamaScore : category.traditionalScore).toFixed(2)} vs ${(category.winner === 'ollama' ? category.traditionalScore : category.ollamaScore).toFixed(2)})`
      )
    }
  })
  
  // Priority analysis
  if (criteria.preferences.prioritizeAccuracy) {
    const accuracyCategory = breakdown.find(cat => cat.category === 'Accuracy')
    if (accuracyCategory) {
      reasoning.push(`Accuracy is prioritized, and ${accuracyCategory.winner === 'ollama' ? 'Ollama' : 'Traditional parsing'} performs better`)
    }
  }
  
  if (criteria.preferences.prioritizeSpeed) {
    const performanceCategory = breakdown.find(cat => cat.category === 'Performance') 
    if (performanceCategory) {
      reasoning.push(`Speed is prioritized, and ${performanceCategory.winner === 'ollama' ? 'Ollama' : 'Traditional parsing'} is faster`)
    }
  }
  
  return reasoning
}

/**
 * Generate recommendations based on the decision
 */
function generateRecommendations(
  selectedTechnology: DecisionResult['selectedTechnology'],
  breakdown: DecisionResult['breakdown'],
  criteria: DecisionCriteria
): string[] {
  const recommendations: string[] = []
  
  switch (selectedTechnology) {
    case 'ollama':
      recommendations.push('Implement Ollama as the primary recipe parsing technology')
      recommendations.push('Remove Traditional parsing implementation to reduce complexity')
      recommendations.push('Monitor performance closely and implement caching for frequently requested URLs')
      
      // Check for weaknesses
      const ollamaWeakness = breakdown.find(cat => cat.winner === 'traditional')?.category
      if (ollamaWeakness) {
        recommendations.push(`Focus on improving ${ollamaWeakness.toLowerCase()} where Traditional parsing performed better`)
      }
      break
      
    case 'traditional':
      recommendations.push('Implement Traditional parsing as the primary recipe parsing technology')
      recommendations.push('Remove Ollama integration to reduce dependencies and resource usage')
      recommendations.push('Expand CSS selector coverage for better site compatibility')
      
      // Check for weaknesses
      const traditionalWeakness = breakdown.find(cat => cat.winner === 'ollama')?.category
      if (traditionalWeakness) {
        recommendations.push(`Consider enhancements to address ${traditionalWeakness.toLowerCase()} limitations`)
      }
      break
      
    case 'hybrid':
      recommendations.push('Implement hybrid approach using both technologies')
      recommendations.push('Use Traditional parsing for sites with good structured data')
      recommendations.push('Use Ollama for complex sites or as fallback when Traditional parsing fails')
      recommendations.push('Implement intelligent routing logic to choose the best technology per URL')
      break
      
    case 'neither':
      recommendations.push('Neither technology meets production requirements')
      recommendations.push('Consider improving both approaches before making a decision')
      recommendations.push('Re-evaluate thresholds if they are too strict for current requirements')
      recommendations.push('Investigate alternative parsing technologies or hybrid approaches')
      break
  }
  
  return recommendations
}

/**
 * Identify risks associated with the selected technology
 */
function identifyRisks(
  selectedTechnology: DecisionResult['selectedTechnology'],
  ollamaMetrics: TechnologyMetrics,
  traditionalMetrics: TechnologyMetrics,
  criteria: DecisionCriteria
): string[] {
  const risks: string[] = []
  
  switch (selectedTechnology) {
    case 'ollama':
      if (ollamaMetrics.performance.averageProcessingTime > 10000) {
        risks.push('Processing time may impact user experience for real-time operations')
      }
      if (ollamaMetrics.reliability.uptime < 0.98) {
        risks.push('Ollama service availability may affect system reliability')
      }
      risks.push('Dependency on external AI model and service')
      risks.push('Potential for unexpected model behavior changes with updates')
      break
      
    case 'traditional':
      if (traditionalMetrics.accuracy.overallSuccessRate < 0.85) {
        risks.push('Lower accuracy may result in incomplete or incorrect recipe data')
      }
      risks.push('Brittleness when websites change their HTML structure')
      risks.push('Requires ongoing maintenance of CSS selectors and parsing rules')
      risks.push('Limited ability to handle new website formats without code changes')
      break
      
    case 'hybrid':
      risks.push('Increased system complexity with two parsing technologies')
      risks.push('Routing logic complexity may introduce new failure modes')
      risks.push('Higher maintenance burden maintaining two different approaches')
      risks.push('Potential inconsistency in parsing results between technologies')
      break
      
    case 'neither':
      risks.push('No viable solution for production recipe parsing')
      risks.push('May need to delay feature launch until suitable solution found')
      risks.push('Risk of implementing suboptimal solution under time pressure')
      break
  }
  
  return risks
}

/**
 * Generate a comprehensive decision report
 */
export function generateDecisionReport(result: DecisionResult): string {
  return `
# URL Import Technology Decision Report

## Executive Summary

**Selected Technology:** ${result.selectedTechnology.toUpperCase()}
**Decision Confidence:** ${result.confidence.toUpperCase()}

## Overall Scores

- **Ollama LLM:** ${(result.overallScore.ollama * 100).toFixed(1)}%
- **Traditional Parsing:** ${(result.overallScore.traditional * 100).toFixed(1)}%

## Category Breakdown

${result.breakdown.map(category => `
### ${category.category} (Weight: ${(category.weight * 100).toFixed(0)}%)

- **Ollama:** ${(category.ollamaScore * 100).toFixed(1)}%
- **Traditional:** ${(category.traditionalScore * 100).toFixed(1)}%
- **Winner:** ${category.winner === 'tie' ? 'Tie' : category.winner === 'ollama' ? 'Ollama' : 'Traditional'}
`).join('')}

## Decision Reasoning

${result.reasoning.map(reason => `- ${reason}`).join('\n')}

## Recommendations

${result.recommendations.map(rec => `- ${rec}`).join('\n')}

## Identified Risks

${result.risks.map(risk => `- ${risk}`).join('\n')}

## Next Steps

1. Review and validate this decision with all stakeholders
2. Plan implementation timeline based on selected technology
3. Implement monitoring and success metrics for chosen solution
4. Execute cleanup strategy to remove non-selected technology
5. Document lessons learned for future technology evaluations

---

*Report generated on ${new Date().toISOString()}*
  `.trim()
} 