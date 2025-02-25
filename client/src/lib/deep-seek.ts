export async function generateTestCaseRecommendation(prompt: string): Promise<string> {
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
    // DeepSeek chat completion format
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Error generating test cases:", error);
    throw error;
  }
}