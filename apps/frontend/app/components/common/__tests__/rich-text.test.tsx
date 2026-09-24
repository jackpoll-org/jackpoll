import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { RichText } from "../rich-text";

describe("RichText", () => {
  it("renders the Markdown subset", () => {
    const { container } = render(
      <RichText markdown={"# Source\n\n**bold** and *italic*\n\n- one\n- two"} />,
    );
    expect(container.querySelector("h3")?.textContent).toBe("Source");
    expect(container.querySelector("strong")?.textContent).toBe("bold");
    expect(container.querySelectorAll("li")).toHaveLength(2);
  });

  it("opens links in a new tab without leaking the opener", () => {
    const { container } = render(<RichText markdown="[docs](https://example.org)" />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://example.org");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toContain("noopener");
  });

  it("never renders raw HTML, script URLs or remote images", () => {
    const { container } = render(
      <RichText
        markdown={
          '<script>alert(1)</script><b onclick="x()">hi</b>\n\n[x](javascript:alert(1))\n\n![tracker](https://evil.example/p.png)'
        }
      />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("a")?.getAttribute("href") ?? "").not.toContain("javascript");
  });
});
