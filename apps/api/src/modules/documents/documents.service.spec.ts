import { formatDocumentCode, estimateReadTimeMinutes } from "@keyvantic/types";

describe("document code formatting", () => {
  it("formats a category code and sequence into KV-XX-### form", () => {
    expect(formatDocumentCode("bs", 1)).toBe("KV-BS-001");
    expect(formatDocumentCode("FW", 42)).toBe("KV-FW-042");
  });
});

describe("read time estimation", () => {
  it("rounds up to the nearest minute at 200wpm and never returns less than 1", () => {
    expect(estimateReadTimeMinutes(0)).toBe(1);
    expect(estimateReadTimeMinutes(199)).toBe(1);
    expect(estimateReadTimeMinutes(201)).toBe(2);
  });
});
