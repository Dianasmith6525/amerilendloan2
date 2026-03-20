import { describe, it, expect } from "vitest";
import { toTitleCase, capitalizeWords } from "./format";

describe("toTitleCase", () => {
  it("capitalizes first letter of each word", () => {
    expect(toTitleCase("john doe")).toBe("John Doe");
  });

  it("handles empty string", () => {
    expect(toTitleCase("")).toBe("");
  });

  it("handles hyphenated names", () => {
    expect(toTitleCase("mary-jane")).toBe("Mary-Jane");
  });

  it("handles apostrophes", () => {
    expect(toTitleCase("o'brien")).toBe("O'Brien");
  });

  it("handles single word", () => {
    expect(toTitleCase("hello")).toBe("Hello");
  });
});

describe("capitalizeWords", () => {
  it("capitalizes each whitespace-separated word", () => {
    expect(capitalizeWords("new york city")).toBe("New York City");
  });

  it("handles empty string", () => {
    expect(capitalizeWords("")).toBe("");
  });

  it("handles single word", () => {
    expect(capitalizeWords("hello")).toBe("Hello");
  });

  it("preserves already-capitalized letters", () => {
    expect(capitalizeWords("Hello World")).toBe("Hello World");
  });
});
