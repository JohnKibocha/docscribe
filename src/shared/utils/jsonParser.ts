/**
 * @fileoverview Robust JSON parsing utilities for AI responses.
 * 
 * This module provides utilities for extracting and parsing JSON from AI responses
 * that may be wrapped in code fences or contain mixed content. Chrome AI often
 * returns JSON wrapped in markdown code blocks, which requires special handling.
 * 
 * @module utils/jsonParser
 * @see VoiceDictation.tsx for original implementation
 */

/**
 * Extract and parse JSON from AI response, handling code fences and raw JSON.
 * CRITICAL: AI often returns JSON wrapped in code fences (```json ... ```) or raw braces.
 * 
 * This function handles multiple patterns:
 * 1. Raw JSON: { "key": "value" }
 * 2. Fenced JSON: ```json\n{ "key": "value" }\n```
 * 3. Generic fences: ```\n{ "key": "value" }\n```
 * 4. Mixed content with JSON embedded
 * 
 * @param rawResponse - The raw AI response that may contain JSON
 * @returns {any} Parsed JSON object
 * 
 * @throws {Error} If no valid JSON can be extracted or parsed
 * 
 * @example
 * ```typescript
 * // Handle code fence response
 * const response = "```json\n{\"type\": \"SOAP\"}\n```";
 * const parsed = extractAndParseJSON(response);
 * console.log(parsed.type); // "SOAP"
 * 
 * // Handle raw JSON
 * const rawJson = '{"encounterType": "Progress"}';
 * const parsed2 = extractAndParseJSON(rawJson);
 * console.log(parsed2.encounterType); // "Progress"
 * ```
 */
export function extractAndParseJSON(rawResponse: string): any {
  if (!rawResponse || typeof rawResponse !== 'string') {
    throw new Error('Invalid response: empty or non-string input');
  }

  try {
    // First, try to parse as-is (for clean JSON responses)
    return JSON.parse(rawResponse.trim());
  } catch {
    // If that fails, extract JSON from various patterns
    try {
      // Pattern 1: Code fences with optional language specifier
      // Matches: ```json\n{...}\n``` or ```\n{...}\n```
      const fencePattern = /```(?:json|javascript|js)?\s*\n?([\s\S]*?)\n?```/i;
      const fenceMatch = rawResponse.match(fencePattern);
      
      if (fenceMatch && fenceMatch[1]) {
        const extractedJSON = fenceMatch[1].trim();
        console.log('JSON PARSER: Extracted from code fences:', extractedJSON.substring(0, 100) + '...');
        return JSON.parse(extractedJSON);
      }
      
      // Pattern 2: Find JSON by locating outermost braces
      // This handles mixed content where JSON is embedded
      const openBrace = rawResponse.indexOf('{');
      const closeBrace = rawResponse.lastIndexOf('}');
      
      if (openBrace !== -1 && closeBrace !== -1 && closeBrace > openBrace) {
        const extractedJSON = rawResponse.substring(openBrace, closeBrace + 1);
        console.log('JSON PARSER: Extracted from braces:', extractedJSON.substring(0, 100) + '...');
        return JSON.parse(extractedJSON);
      }
      
      // Pattern 3: Try to find JSON objects with balanced braces
      const jsonObjectPattern = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
      const matches = rawResponse.match(jsonObjectPattern);
      
      if (matches && matches.length > 0) {
        // Try the largest match (most likely to be complete)
        const largestMatch = matches.reduce((a, b) => a.length > b.length ? a : b);
        console.log('JSON PARSER: Extracted from pattern matching:', largestMatch.substring(0, 100) + '...');
        return JSON.parse(largestMatch);
      }
      
      throw new Error('No valid JSON found in response');
      
    } catch (parseError) {
      console.error('JSON PARSER: Failed to parse extracted content:', parseError);
      throw new Error(`Failed to extract valid JSON from AI response. Raw response: ${rawResponse.substring(0, 200)}...`);
    }
  }
}

/**
 * Safely parse JSON with fallback handling for AI processing pipelines.
 * This function never throws, instead returning a structured error response
 * that allows the processing pipeline to continue gracefully.
 * 
 * @param rawResponse - The raw AI response that may contain JSON
 * @param fallbackData - Default data to return if parsing fails
 * @returns {object} Either parsed JSON or fallback data with error info
 * 
 * @example
 * ```typescript
 * const result = safeParseJSON(aiResponse, { 
 *   encounterType: 'Unknown', 
 *   speakerContext: 'Unknown' 
 * });
 * 
 * if (result.parseError) {
 *   console.log('Parsing failed, using fallback');
 * }
 * ```
 */
export function safeParseJSON(rawResponse: string, fallbackData: any = {}): any {
  try {
    return extractAndParseJSON(rawResponse);
  } catch (error) {
    console.error('JSON PARSER: Safe parse failed, using fallback:', error);
    return {
      ...fallbackData,
      parseError: true,
      errorMessage: error instanceof Error ? error.message : 'Unknown parsing error',
      rawResponse: rawResponse?.substring(0, 200) || 'No response'
    };
  }
}