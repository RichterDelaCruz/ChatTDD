export async function generateTestCaseRecommendation(prompt: string): Promise<string> {
  try {
    const response = await fetch("/api/deepseek/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: `You are a Test-Driven Development expert. Based on the following code or requirement, suggest test cases that would help verify the functionality. Focus on edge cases, error conditions, and important behavioral aspects. DO NOT provide implementation code.

Input: ${prompt}

Generate test cases in the following format:
1. Test case description
2. Expected behavior
3. Edge cases to consider`
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || response.statusText);
    }

    const data = await response.json();
    return data.choices[0].text;
  } catch (error) {
    console.error("Error generating test cases:", error);
    throw new Error("Failed to generate test case recommendations. Please try again later.");
  }
}