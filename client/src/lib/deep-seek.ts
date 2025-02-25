export async function generateTestCaseRecommendation(prompt: string): Promise<{
  content: string;
  debug?: {
    filesAnalyzed: string[];
    relevantContext?: string;
  };
}> {
  try {
    const response = await fetch("/api/deepseek/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to generate recommendations");
    }

    const data = await response.json();
    // Return the response with debug info
    return {
      content: data.choices[0].message.content,
      debug: {
        filesAnalyzed: data.debug?.filesAnalyzed || [],
        relevantContext: data.debug?.relevantContext
      }
    };
  } catch (error) {
    console.error("Error generating test cases:", error);
    throw error;
  }
}